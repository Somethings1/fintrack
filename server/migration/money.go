// Package migration builds a deterministic, fail-closed, offline money plan.
// It never rounds, guesses historical currency, or writes during planning.
package migration

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/service"
	"fintrack/server/util"
	"fmt"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
	"sort"
	"strconv"
	"time"
)

const MaxDocuments = 2000
const MaxBytes = 8 << 20

type Schedule struct {
	Processed int    `json:"processed"`
	Next      string `json:"next"`
}
type Row struct {
	Collection            string
	Original, Replacement bson.Raw
	Changed               bool
}
type Balance struct {
	Collection, ID, Owner      string
	Opening, Activity, Closing money.Amount
	Inferred                   bool
}
type Plan struct {
	Currency  string    `json:"currency"`
	Digest    string    `json:"digest"`
	Documents int       `json:"documents"`
	Changes   int       `json:"changes"`
	Balances  []Balance `json:"balances"`
	Issues    []string  `json:"issues"`
	Rows      []Row     `json:"-"`
}

func canonical(v interface{}) interface{} {
	switch x := v.(type) {
	case bson.M:
		keys := make([]string, 0, len(x))
		for k := range x {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		d := bson.D{}
		for _, k := range keys {
			d = append(d, bson.E{Key: k, Value: canonical(x[k])})
		}
		return d
	case bson.D:
		m := bson.M{}
		for _, e := range x {
			m[e.Key] = e.Value
		}
		return canonical(m)
	case bson.A:
		a := make(bson.A, len(x))
		for i, e := range x {
			a[i] = canonical(e)
		}
		return a
	default:
		return v
	}
}
func encode(v interface{}) (bson.Raw, error) {
	raw, err := bson.Marshal(canonical(v))
	return bson.Raw(raw), err
}
func convert(v interface{}) (money.Amount, error) {
	switch n := v.(type) {
	case primitive.Decimal128:
		return money.Parse(n.String())
	case float64:
		return money.Parse(strconv.FormatFloat(n, 'g', -1, 64))
	case int32:
		return money.Parse(strconv.FormatInt(int64(n), 10))
	case int64:
		return money.Parse(strconv.FormatInt(n, 10))
	default:
		return 0, errors.New("non-numeric monetary value")
	}
}
func decimalValue(a money.Amount) primitive.Decimal128 {
	d, _ := primitive.ParseDecimal128(a.String())
	return d
}

func Build(ctx context.Context, db *mongo.Database, currency string, schedules map[string]Schedule) (Plan, error) {
	plan := Plan{Currency: currency, Issues: []string{}, Balances: []Balance{}}
	if _, err := money.Precision(currency); err != nil {
		return plan, err
	}
	var metadata struct {
		Currency string `bson:"currency"`
	}
	err := db.Collection("schema_metadata").FindOne(ctx, bson.M{"_id": "money_v1"}).Decode(&metadata)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return plan, err
	}
	if metadata.Currency != "" && metadata.Currency != currency {
		return plan, errors.New("cannot reinterpret an existing ledger in another currency")
	}
	names := []string{"accounts", "categories", "savings", "subscriptions", "transactions"}
	type document struct {
		collection        string
		original, updated bson.M
		raw               bson.Raw
	}
	docs := []document{}
	size := 0
	for _, collection := range names {
		cursor, err := db.Collection(collection).Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}).SetLimit(MaxDocuments+1))
		if err != nil {
			return plan, err
		}
		for cursor.Next(ctx) {
			if len(docs) >= MaxDocuments {
				cursor.Close(ctx)
				return plan, errors.New("migration exceeds bounded atomic document limit; use a separately reviewed large-ledger migration")
			}
			var original, updated bson.M
			if err := bson.Unmarshal(cursor.Current, &original); err != nil {
				cursor.Close(ctx)
				return plan, err
			}
			if err := bson.Unmarshal(cursor.Current, &updated); err != nil {
				cursor.Close(ctx)
				return plan, err
			}
			raw, err := encode(original)
			if err != nil {
				cursor.Close(ctx)
				return plan, err
			}
			size += len(raw)
			if size > MaxBytes {
				cursor.Close(ctx)
				return plan, errors.New("migration exceeds atomic byte limit")
			}
			docs = append(docs, document{collection, original, updated, raw})
		}
		err = cursor.Err()
		cursor.Close(ctx)
		if err != nil {
			return plan, err
		}
	}
	accounts := map[primitive.ObjectID]*document{}
	categories := map[primitive.ObjectID]*document{}
	effects := map[primitive.ObjectID]money.Amount{}
	for i := range docs {
		d := &docs[i]
		id, ok := d.original["_id"].(primitive.ObjectID)
		if !ok {
			return plan, errors.New("unsupported document ID")
		}
		if c, ok := d.original["currency"]; ok && c != currency {
			plan.Issues = append(plan.Issues, fmt.Sprintf("%s/%s currency mismatch", d.collection, id.Hex()))
		}
		d.updated["currency"] = currency
		legacy := bson.M{}
		for _, field := range util.MonetaryFields[d.collection] {
			value, exists := d.original[field]
			if !exists {
				if field != "opening_balance" {
					plan.Issues = append(plan.Issues, fmt.Sprintf("%s/%s missing %s", d.collection, id.Hex(), field))
				}
				continue
			}
			a, err := convert(value)
			if err == nil {
				err = money.Validate(a, currency)
			}
			if err != nil {
				plan.Issues = append(plan.Issues, fmt.Sprintf("%s/%s %s requires explicit correction: %v", d.collection, id.Hex(), field, err))
				continue
			}
			d.updated[field] = decimalValue(a)
			if _, exact := value.(primitive.Decimal128); !exact {
				legacy[field] = value
			}
		}
		if len(legacy) > 0 {
			d.updated["legacy_money_v1"] = legacy
		}
		ownerField := "owner"
		if d.collection == "transactions" || d.collection == "subscriptions" {
			ownerField = "creator"
		}
		if owner, ok := d.original[ownerField].(string); !ok || owner == "" {
			plan.Issues = append(plan.Issues, fmt.Sprintf("%s/%s missing owner", d.collection, id.Hex()))
		}
		if d.collection == "accounts" || d.collection == "savings" {
			if _, duplicate := accounts[id]; duplicate {
				plan.Issues = append(plan.Issues, "ambiguous account/saving ID "+id.Hex())
			}
			accounts[id] = d
		}
		if d.collection == "categories" {
			categories[id] = d
		}
	}
	// Compute exact net activity using the prospective records, not floating sums.
	for i := range docs {
		d := &docs[i]
		if d.collection != "transactions" {
			continue
		}
		raw, err := encode(d.updated)
		if err != nil {
			return plan, err
		}
		var tx model.Transaction
		if err = bson.Unmarshal(raw, &tx); err != nil {
			plan.Issues = append(plan.Issues, "invalid transaction document")
			continue
		}
		if tx.RequestKey != "" {
			d.updated["request_hash"] = service.TransactionDigest(tx)
		}
		if tx.IsDeleted {
			continue
		}
		validReferences := false
		switch tx.Type {
		case "income":
			validReferences = tx.SourceAccount.IsZero() && !tx.DestinationAccount.IsZero() && !tx.Category.IsZero()
		case "expense":
			validReferences = !tx.SourceAccount.IsZero() && tx.DestinationAccount.IsZero() && !tx.Category.IsZero()
		case "transfer":
			validReferences = !tx.SourceAccount.IsZero() && !tx.DestinationAccount.IsZero() && tx.SourceAccount != tx.DestinationAccount && tx.Category.IsZero()
		}
		if !validReferences || tx.DateTime.IsZero() {
			plan.Issues = append(plan.Issues, "invalid active transaction references/date "+tx.ID.Hex())
		}
		if tx.Type != "transfer" {
			category, ok := categories[tx.Category]
			if !ok || category.original["owner"] != tx.Creator || category.original["type"] != tx.Type {
				plan.Issues = append(plan.Issues, "orphan or incompatible transaction category "+tx.ID.Hex())
			}
		}
		if tx.Amount <= 0 {
			plan.Issues = append(plan.Issues, "non-positive active transaction "+tx.ID.Hex())
			continue
		}
		for _, change := range []struct {
			id     primitive.ObjectID
			amount money.Amount
		}{{tx.SourceAccount, -tx.Amount}, {tx.DestinationAccount, tx.Amount}} {
			if change.id.IsZero() {
				continue
			}
			account, ok := accounts[change.id]
			if !ok || account.original["owner"] != tx.Creator {
				plan.Issues = append(plan.Issues, "orphan or cross-owner transaction "+tx.ID.Hex())
				continue
			}
			amount, err := money.Add(effects[change.id], change.amount)
			if err != nil {
				plan.Issues = append(plan.Issues, "activity exceeds range for "+change.id.Hex())
				continue
			}
			effects[change.id] = amount
		}
	}
	for id, d := range accounts {
		closing, err := convert(d.updated["balance"])
		if err != nil {
			continue
		}
		opening, exists := d.updated["opening_balance"]
		inferred := !exists
		var start money.Amount
		if inferred {
			start, err = money.Add(closing, -effects[id])
			d.updated["opening_balance"] = decimalValue(start)
			d.updated["opening_balance_inferred"] = true
		} else {
			start, err = convert(opening)
		}
		if err != nil {
			plan.Issues = append(plan.Issues, "opening balance exceeds range for "+id.Hex())
			continue
		}
		total, err := money.Add(start, effects[id])
		if err != nil || total != closing {
			plan.Issues = append(plan.Issues, "balance does not reconcile for "+id.Hex())
		}
		owner, _ := d.original["owner"].(string)
		plan.Balances = append(plan.Balances, Balance{d.collection, id.Hex(), owner, start, effects[id], closing, inferred})
	}
	sort.Slice(plan.Balances, func(i, j int) bool { return plan.Balances[i].ID < plan.Balances[j].ID })
	for i := range docs {
		d := &docs[i]
		if d.collection != "subscriptions" {
			continue
		}
		if d.original["schedule_version"] == int32(2) || d.original["schedule_version"] == int64(2) {
			continue
		}
		id := d.original["_id"].(primitive.ObjectID)
		mapping, ok := schedules[id.Hex()]
		if !ok {
			plan.Issues = append(plan.Issues, "explicit processed/next schedule mapping required for "+id.Hex())
			continue
		}
		raw, err := encode(d.updated)
		if err != nil {
			return plan, err
		}
		var sub model.Subscription
		if bson.Unmarshal(raw, &sub) != nil {
			plan.Issues = append(plan.Issues, "invalid subscription document "+id.Hex())
			continue
		}
		account, accountOK := accounts[sub.SourceAccount]
		category, categoryOK := categories[sub.Category]
		if sub.Amount <= 0 || sub.MaxInterval < 0 || sub.RemindBefore < 0 || sub.RemindBefore > 366 || !accountOK || account.original["owner"] != sub.Creator || !categoryOK || category.original["owner"] != sub.Creator || category.original["type"] != "expense" {
			plan.Issues = append(plan.Issues, "invalid subscription references or values "+id.Hex())
			continue
		}
		next, err := service.OccurrenceAt(sub.StartDate, sub.Interval, mapping.Processed)
		requested, parseErr := time.Parse(time.RFC3339Nano, mapping.Next)
		if err != nil || parseErr != nil || !next.Equal(requested) || (sub.MaxInterval > 0 && mapping.Processed > sub.MaxInterval) {
			plan.Issues = append(plan.Issues, "invalid reviewed schedule mapping for "+id.Hex())
			continue
		}
		d.updated["legacy_schedule_v1"] = bson.M{"current_interval": d.original["current_interval"], "next_active": d.original["next_active"], "notify_at": d.original["notify_at"]}
		d.updated["schedule_version"] = int32(2)
		d.updated["current_interval"] = mapping.Processed
		d.updated["next_active"] = next
		d.updated["notify_at"] = next.AddDate(0, 0, -sub.RemindBefore)
		d.updated["is_active"] = sub.IsActive && (sub.MaxInterval == 0 || mapping.Processed < sub.MaxInterval)
	}
	hash := sha256.New()
	hash.Write([]byte("money-v1:" + currency))
	for _, d := range docs {
		raw, err := encode(d.updated)
		if err != nil {
			return plan, err
		}
		changed := !bytes.Equal(d.raw, raw)
		plan.Rows = append(plan.Rows, Row{d.collection, d.raw, raw, changed})
		if changed {
			plan.Changes++
		}
		hash.Write([]byte(d.collection))
		hash.Write(d.raw)
		hash.Write(raw)
	}
	sort.Strings(plan.Issues)
	plan.Documents = len(docs)
	plan.Digest = hex.EncodeToString(hash.Sum(nil))
	return plan, nil
}

// Apply requires the freshly rebuilt, reviewed plan and all writers stopped.
// Every record is verified inside one transaction; any conflict rolls back all.
func Apply(ctx context.Context, db *mongo.Database, plan Plan, expected string, acceptInferred bool) error {
	if expected == "" || expected != plan.Digest {
		return errors.New("reviewed plan digest mismatch")
	}
	if len(plan.Issues) > 0 {
		return errors.New("migration has unresolved issues")
	}
	for _, b := range plan.Balances {
		if b.Inferred && !acceptInferred {
			return errors.New("inferred historical opening balances require explicit acceptance")
		}
	}
	session, err := db.Client().StartSession()
	if err != nil {
		return err
	}
	defer session.EndSession(ctx)
	_, err = session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
		expectedCounts := map[string]int64{}
		for name := range util.MonetaryFields {
			expectedCounts[name] = 0
		}
		for _, row := range plan.Rows {
			expectedCounts[row.Collection]++
		}
		for name, want := range expectedCounts {
			got, err := db.Collection(name).CountDocuments(sc, bson.M{})
			if err != nil {
				return nil, err
			}
			if got != want {
				return nil, errors.New("records changed since planning")
			}
		}
		for _, row := range plan.Rows {
			id := row.Original.Lookup("_id").ObjectID()
			var current bson.M
			if err := db.Collection(row.Collection).FindOne(sc, bson.M{"_id": id}).Decode(&current); err != nil {
				return nil, err
			}
			raw, err := encode(current)
			if err != nil {
				return nil, err
			}
			if !bytes.Equal(raw, row.Original) {
				return nil, errors.New("record changed since planning")
			}
			if row.Changed {
				if _, err := db.Collection(row.Collection).ReplaceOne(sc, bson.M{"_id": id}, row.Replacement); err != nil {
					return nil, err
				}
			}
		}
		_, err := db.Collection("schema_metadata").UpdateOne(sc, bson.M{"_id": "money_v1"}, bson.M{"$set": bson.M{"currency": plan.Currency, "storage": "decimal128", "version": 1, "migration_digest": plan.Digest}}, options.Update().SetUpsert(true))
		return nil, err
	}, options.Transaction().SetReadConcern(readconcern.Snapshot()).SetWriteConcern(writeconcern.Majority()))
	return err
}
