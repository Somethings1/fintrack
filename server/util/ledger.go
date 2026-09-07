package util

import (
	"context"
	"errors"
	"fintrack/server/money"
)

// EnsureLedger makes the database currency immutable after first initialization.
// Monetary columns are BIGINT fixed-point millionths; no implicit conversion is
// ever performed at startup.
func EnsureLedger(ctx context.Context, currency string) error {
	if _, err := money.Precision(currency); err != nil {
		return err
	}
	if DB == nil {
		return errors.New("database is not initialized")
	}
	if _, err := DB.ExecContext(ctx, `INSERT INTO ledger_settings(singleton,currency,money_version)
		VALUES (true,$1,1) ON CONFLICT (singleton) DO NOTHING`, currency); err != nil {
		return err
	}
	var stored string
	var version int
	if err := DB.QueryRowContext(ctx, `SELECT currency,money_version FROM ledger_settings WHERE singleton=true`).Scan(&stored, &version); err != nil {
		return err
	}
	if stored != currency || version != 1 {
		return errors.New("immutable ledger configuration mismatch")
	}
	return nil
}
