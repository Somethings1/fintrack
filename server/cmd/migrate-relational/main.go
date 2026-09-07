// migrate-relational copies a reviewed FinTrack MongoDB ledger into PostgreSQL.
// It is offline, dry-run by default, preserves existing IDs, and refuses legacy
// floating-point money through the model's strict BSON decoders.
package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fintrack/server/model"
	"fintrack/server/util"
	"fmt"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"os"
	"time"
)

type snapshot struct {
	Accounts      []model.Account      `json:"accounts"`
	Savings       []model.Saving       `json:"savings"`
	Categories    []model.Category     `json:"categories"`
	Subscriptions []model.Subscription `json:"subscriptions"`
	Transactions  []model.Transaction  `json:"transactions"`
	Notifications []model.Notification `json:"notifications"`
}

type plan struct {
	Accounts      int    `json:"accounts"`
	Savings       int    `json:"savings"`
	Categories    int    `json:"categories"`
	Subscriptions int    `json:"subscriptions"`
	Transactions  int    `json:"transactions"`
	Notifications int    `json:"notifications"`
	Digest        string `json:"digest"`
}

func loadCollection[T any](ctx context.Context, db *mongo.Database, name string) ([]T, error) {
	cursor, err := db.Collection(name).Find(ctx, bson.D{}, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var out []T
	for cursor.Next(ctx) {
		var row T
		if err := cursor.Decode(&row); err != nil {
			return nil, fmt.Errorf("decode %s: %w (run the reviewed exact-money migration first if this is legacy data)", name, err)
		}
		out = append(out, row)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func loadSnapshot(ctx context.Context, db *mongo.Database) (snapshot, error) {
	var s snapshot
	var err error
	if s.Accounts, err = loadCollection[model.Account](ctx, db, "accounts"); err != nil {
		return s, err
	}
	if s.Savings, err = loadCollection[model.Saving](ctx, db, "savings"); err != nil {
		return s, err
	}
	if s.Categories, err = loadCollection[model.Category](ctx, db, "categories"); err != nil {
		return s, err
	}
	if s.Subscriptions, err = loadCollection[model.Subscription](ctx, db, "subscriptions"); err != nil {
		return s, err
	}
	if s.Transactions, err = loadCollection[model.Transaction](ctx, db, "transactions"); err != nil {
		return s, err
	}
	if s.Notifications, err = loadCollection[model.Notification](ctx, db, "notifications"); err != nil {
		return s, err
	}
	return s, nil
}

func snapshotPlan(s snapshot) (plan, error) {
	raw, err := json.Marshal(s)
	if err != nil {
		return plan{}, err
	}
	sum := sha256.Sum256(raw)
	return plan{
		Accounts: len(s.Accounts), Savings: len(s.Savings), Categories: len(s.Categories),
		Subscriptions: len(s.Subscriptions), Transactions: len(s.Transactions), Notifications: len(s.Notifications),
		Digest: hex.EncodeToString(sum[:]),
	}, nil
}

func idOrNil(id primitive.ObjectID) any {
	if id.IsZero() {
		return nil
	}
	return id.Hex()
}

func timeOrNil(v time.Time) any {
	if v.IsZero() {
		return nil
	}
	return v.UTC()
}

func stringOrNil(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func requireCurrency(currency string, values ...string) error {
	for _, value := range values {
		if value != currency {
			return fmt.Errorf("source contains currency %q; reviewed target ledger currency is %q", value, currency)
		}
	}
	return nil
}

func targetEmpty(ctx context.Context, tx *sql.Tx) error {
	for _, table := range []string{"financial_accounts", "categories", "subscriptions", "transactions", "notifications"} {
		var count int64
		if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM `+table).Scan(&count); err != nil {
			return err
		}
		if count != 0 {
			return fmt.Errorf("target table %s is not empty", table)
		}
	}
	return nil
}

func apply(ctx context.Context, s snapshot, currency string) error {
	if util.DB == nil {
		return fmt.Errorf("target database is not initialized")
	}
	tx, err := util.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := targetEmpty(ctx, tx); err != nil {
		return err
	}

	for _, v := range s.Accounts {
		if err := requireCurrency(currency, v.Currency); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO financial_accounts(id,owner,kind,currency,opening_balance_micros,balance_micros,icon,name,goal_micros,created_date,goal_date,last_update,is_deleted) VALUES($1,$2,'account',$3,$4,$5,$6,$7,0,NULL,NULL,$8,$9)`, v.ID.Hex(), v.Owner, v.Currency, int64(v.OpeningBalance), int64(v.Balance), v.Icon, v.Name, v.LastUpdate.UTC(), v.IsDeleted); err != nil {
			return fmt.Errorf("insert account %s: %w", v.ID.Hex(), err)
		}
	}
	for _, v := range s.Savings {
		if err := requireCurrency(currency, v.Currency); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO financial_accounts(id,owner,kind,currency,opening_balance_micros,balance_micros,icon,name,goal_micros,created_date,goal_date,last_update,is_deleted) VALUES($1,$2,'saving',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, v.ID.Hex(), v.Owner, v.Currency, int64(v.OpeningBalance), int64(v.Balance), v.Icon, v.Name, int64(v.Goal), timeOrNil(v.CreatedDate), timeOrNil(v.GoalDate), v.LastUpdate.UTC(), v.IsDeleted); err != nil {
			return fmt.Errorf("insert saving %s: %w", v.ID.Hex(), err)
		}
	}
	for _, v := range s.Categories {
		if err := requireCurrency(currency, v.Currency); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO categories(id,owner,currency,type,icon,name,budget_micros,last_update,is_deleted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, v.ID.Hex(), v.Owner, v.Currency, v.Type, v.Icon, v.Name, int64(v.Budget), v.LastUpdate.UTC(), v.IsDeleted); err != nil {
			return fmt.Errorf("insert category %s: %w", v.ID.Hex(), err)
		}
	}
	for _, v := range s.Subscriptions {
		if err := requireCurrency(currency, v.Currency); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO subscriptions(id,creator,currency,schedule_version,name,icon,amount_micros,source_account_id,category_id,start_date,interval_unit,max_interval,current_interval,is_active,remind_before,next_active,notify_at,last_update,is_deleted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, v.ID.Hex(), v.Creator, v.Currency, v.ScheduleVersion, v.Name, v.Icon, int64(v.Amount), v.SourceAccount.Hex(), v.Category.Hex(), v.StartDate.UTC(), v.Interval, v.MaxInterval, v.CurrentInterval, v.IsActive, v.RemindBefore, v.NextActive.UTC(), timeOrNil(v.NotifyAt), v.LastUpdate.UTC(), v.IsDeleted); err != nil {
			return fmt.Errorf("insert subscription %s: %w", v.ID.Hex(), err)
		}
	}
	for _, v := range s.Transactions {
		if err := requireCurrency(currency, v.Currency); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO transactions(id,creator,currency,amount_micros,date_time,type,source_account_id,destination_account_id,category_id,note,request_key,request_hash,subscription_id,occurrence_at,last_update,is_deleted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, v.ID.Hex(), v.Creator, v.Currency, int64(v.Amount), v.DateTime.UTC(), v.Type, idOrNil(v.SourceAccount), idOrNil(v.DestinationAccount), idOrNil(v.Category), v.Note, stringOrNil(v.RequestKey), stringOrNil(v.RequestHash), idOrNil(v.SubscriptionID), timeOrNil(v.OccurrenceAt), v.LastUpdate.UTC(), v.IsDeleted); err != nil {
			return fmt.Errorf("insert transaction %s: %w", v.ID.Hex(), err)
		}
	}
	for _, v := range s.Notifications {
		if _, err := tx.ExecContext(ctx, `INSERT INTO notifications(id,owner,type,reference_id,title,message,read,scheduled_at,occurrence_key,last_update,is_deleted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, v.ID.Hex(), v.Owner, string(v.Type), v.ReferenceId.Hex(), v.Title, v.Message, v.Read, v.ScheduledAt.UTC(), stringOrNil(v.OccurrenceKey), v.LastUpdate.UTC(), v.IsDeleted); err != nil {
			return fmt.Errorf("insert notification %s: %w", v.ID.Hex(), err)
		}
	}
	return tx.Commit()
}

func run() error {
	sourceDatabase := flag.String("source-database", "", "explicit MongoDB database name")
	currency := flag.String("currency", "", "reviewed immutable ledger currency")
	applyChanges := flag.Bool("apply", false, "copy the reviewed snapshot into the empty PostgreSQL target")
	writersStopped := flag.Bool("writers-stopped", false, "attest API and recurring workers are stopped")
	expectedPlan := flag.String("expected-plan", "", "SHA256 digest printed by the reviewed dry-run")
	flag.Parse()

	sourceURI := os.Getenv("SOURCE_MONGO_URI")
	if sourceURI == "" {
		sourceURI = os.Getenv("MONGO_URI")
	}
	targetURL := os.Getenv("DATABASE_URL")
	if sourceURI == "" || targetURL == "" || *sourceDatabase == "" || *currency == "" {
		return fmt.Errorf("SOURCE_MONGO_URI (or MONGO_URI), DATABASE_URL, --source-database and --currency are required")
	}
	if *applyChanges && (!*writersStopped || *expectedPlan == "") {
		return fmt.Errorf("apply requires --writers-stopped and --expected-plan from a reviewed dry-run")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	source, err := mongo.Connect(ctx, options.Client().ApplyURI(sourceURI).SetServerSelectionTimeout(10*time.Second))
	if err != nil {
		return fmt.Errorf("source MongoDB connection failed")
	}
	defer source.Disconnect(context.Background())
	if err := source.Ping(ctx, nil); err != nil {
		return fmt.Errorf("source MongoDB readiness failed")
	}

	s, err := loadSnapshot(ctx, source.Database(*sourceDatabase))
	if err != nil {
		return err
	}
	p, err := snapshotPlan(s)
	if err != nil {
		return err
	}
	fmt.Printf("accounts=%d savings=%d categories=%d subscriptions=%d transactions=%d notifications=%d plan=%s\n", p.Accounts, p.Savings, p.Categories, p.Subscriptions, p.Transactions, p.Notifications, p.Digest)
	if !*applyChanges {
		return nil
	}
	if p.Digest != *expectedPlan {
		return fmt.Errorf("source changed after review: expected plan %s, got %s", *expectedPlan, p.Digest)
	}
	if err := util.InitDB(ctx, targetURL); err != nil {
		return err
	}
	defer util.CloseDB()
	if err := util.EnsureLedger(ctx, *currency); err != nil {
		return err
	}
	if err := apply(ctx, s, *currency); err != nil {
		return err
	}
	fmt.Println("migration applied atomically; run application contract/reconciliation checks before enabling writers")
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
