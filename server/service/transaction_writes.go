package service

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/util"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"sort"
	"time"
)

func validateTransaction(tx model.Transaction) error {
	if tx.Creator == "" || tx.DateTime.IsZero() || tx.Amount <= 0 || money.Validate(tx.Amount, tx.Currency) != nil || len(tx.Note) > 500 {
		return errors.New("invalid transaction")
	}
	switch tx.Type {
	case "income":
		if !tx.SourceAccount.IsZero() || tx.DestinationAccount.IsZero() || tx.Category.IsZero() {
			return errors.New("invalid income references")
		}
	case "expense":
		if tx.SourceAccount.IsZero() || !tx.DestinationAccount.IsZero() || tx.Category.IsZero() {
			return errors.New("invalid expense references")
		}
	case "transfer":
		if tx.SourceAccount.IsZero() || tx.DestinationAccount.IsZero() || tx.SourceAccount == tx.DestinationAccount || !tx.Category.IsZero() {
			return errors.New("invalid transfer references")
		}
	default:
		return errors.New("invalid transaction type")
	}
	return nil
}
func transactionDigest(tx model.Transaction) string { return TransactionDigest(tx) }
func TransactionDigest(tx model.Transaction) string {
	tx.ID = primitive.NilObjectID
	tx.LastUpdate = time.Time{}
	tx.RequestKey = ""
	tx.RequestHash = ""
	tx.IsDeleted = false
	raw, _ := json.Marshal(tx)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

func validateCategory(ctx context.Context, tx *sql.Tx, v model.Transaction) error {
	if v.Type == "transfer" {
		return nil
	}
	var one int
	err := tx.QueryRowContext(ctx, `SELECT 1 FROM categories WHERE id=$1 AND owner=$2 AND currency=$3 AND type=$4 AND is_deleted=false FOR UPDATE`, v.Category.Hex(), util.UserID(ctx), v.Currency, v.Type).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("category is missing, deleted or not owned")
	}
	return err
}

func replayTransaction(ctx context.Context, key, hash string) (primitive.ObjectID, error) {
	var id, stored string
	user := util.UserID(ctx)
	if user == "" {
		return primitive.NilObjectID, errors.New("missing authenticated user")
	}
	err := util.DB.QueryRowContext(ctx, `SELECT id,request_hash FROM transactions WHERE creator=$1 AND request_key=$2`, user, key).Scan(&id, &stored)
	if err != nil {
		return primitive.NilObjectID, err
	}
	if stored != hash {
		return primitive.NilObjectID, ErrIdempotencyConflict
	}
	return primitive.ObjectIDFromHex(id)
}
func nullID(id primitive.ObjectID) any {
	if id.IsZero() {
		return nil
	}
	return id.Hex()
}

// Call before inserting the transaction (which otherwise takes FK key-share
// locks), and before changing any balance. Zero and duplicate IDs are ignored.
func lockTransactionAccounts(ctx context.Context, tx *sql.Tx, ids ...primitive.ObjectID) error {
	unique := make(map[string]primitive.ObjectID, len(ids))
	for _, id := range ids {
		if !id.IsZero() {
			unique[id.Hex()] = id
		}
	}
	ordered := make([]string, 0, len(unique))
	for id := range unique {
		ordered = append(ordered, id)
	}
	sort.Strings(ordered)
	for _, id := range ordered {
		if err := util.LockFinancialAccount(ctx, tx, unique[id]); err != nil {
			return err
		}
	}
	return nil
}
