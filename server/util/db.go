package util

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fintrack/server/money"
	"fmt"
	"io/fs"
	"strconv"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var DB *sql.DB

// DBTX is the small common surface used by services so financial operations can
// run either directly or inside a PostgreSQL transaction.
type DBTX interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

//go:embed migrations/*.sql
var migrationFS embed.FS

func InitDB(ctx context.Context, databaseURL string) error {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return errors.New("database connection failed")
	}
	db.SetMaxOpenConns(50)
	db.SetMaxIdleConns(10)
	db.SetConnMaxIdleTime(5 * time.Minute)
	db.SetConnMaxLifetime(30 * time.Minute)
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return errors.New("database readiness check failed")
	}
	if err := applyMigrations(ctx, db); err != nil {
		_ = db.Close()
		return fmt.Errorf("database migration failed: %w", err)
	}
	DB = db
	return nil
}

func CloseDB() error {
	if DB == nil {
		return nil
	}
	err := DB.Close()
	DB = nil
	return err
}

func applyMigrations(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// One stable application-specific advisory lock prevents two starting API
	// replicas from applying the same schema migration concurrently.
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(681946223417)`); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version bigint PRIMARY KEY,
		name text NOT NULL,
		applied_at timestamptz NOT NULL DEFAULT now()
	)`); err != nil {
		return err
	}
	entries, err := fs.ReadDir(migrationFS, "migrations")
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		prefix, _, ok := strings.Cut(entry.Name(), "_")
		if !ok {
			return fmt.Errorf("invalid migration filename %q", entry.Name())
		}
		version, err := strconv.ParseInt(prefix, 10, 64)
		if err != nil || version <= 0 {
			return fmt.Errorf("invalid migration version %q", entry.Name())
		}
		var exists bool
		if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version=$1)`, version).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		raw, err := migrationFS.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, string(raw)); err != nil {
			return fmt.Errorf("%s: %w", entry.Name(), err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations(version,name) VALUES ($1,$2)`, version, entry.Name()); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func BeginLedgerTx(ctx context.Context) (*sql.Tx, error) {
	if DB == nil {
		return nil, errors.New("database is not initialized")
	}
	return DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
}

func UserID(ctx context.Context) string {
	user, _ := ctx.Value(UserIdKey).(string)
	return user
}

func nullableObjectID(id primitive.ObjectID) any {
	if id.IsZero() {
		return nil
	}
	return id.Hex()
}

// AdjustBalance applies one ledger posting against an owned account/saving row.
// The SQL row update provides the lock needed to serialize concurrent postings.
func AdjustBalance(ctx context.Context, q DBTX, id primitive.ObjectID, amount money.Amount) (int64, error) {
	if id.IsZero() {
		return 0, nil
	}
	user := UserID(ctx)
	currency := money.Currency(ctx)
	if user == "" {
		return 0, errors.New("missing authenticated user")
	}
	if err := money.Validate(amount, currency); err != nil {
		return 0, err
	}
	var balance int64
	err := q.QueryRowContext(ctx, `
		UPDATE financial_accounts
		SET balance_micros = balance_micros + $1, last_update = now()
		WHERE id=$2 AND owner=$3 AND currency=$4 AND is_deleted=false
		RETURNING balance_micros`, int64(amount), id.Hex(), user, currency).Scan(&balance)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, errors.New("account is missing, deleted, in a different currency, or not owned")
	}
	if err != nil {
		return 0, err
	}
	if balance < -int64(money.Max) || balance > int64(money.Max) {
		return 0, money.ErrAmount
	}
	return 1, nil
}

// LockFinancialAccount validates ownership/currency without changing balances.
// It serializes reference creation against concurrent archival.
func LockFinancialAccount(ctx context.Context, tx *sql.Tx, id primitive.ObjectID) error {
	if id.IsZero() {
		return sql.ErrNoRows
	}
	var one int
	err := tx.QueryRowContext(ctx, `SELECT 1 FROM financial_accounts
		WHERE id=$1 AND owner=$2 AND currency=$3 AND is_deleted=false FOR UPDATE`,
		id.Hex(), UserID(ctx), money.Currency(ctx)).Scan(&one)
	return err
}
