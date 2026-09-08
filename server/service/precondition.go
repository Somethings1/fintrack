package service

import (
	"context"
	"database/sql"
	"fintrack/server/util"
	"fmt"
)

// Only developer-owned simple UPDATE statements call this helper. The version
// predicate is evaluated atomically by PostgreSQL while acquiring the row lock.
func conditionalUpdate(ctx context.Context, query string, args ...any) (sql.Result, error) {
	_, checked := util.ExpectedVersion(ctx)
	if version, ok := util.ExpectedVersion(ctx); ok {
		args = append(args, version)
		query += fmt.Sprintf(" AND last_update=$%d::timestamptz", len(args))
	}
	result, err := util.DB.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	if checked {
		n, err := result.RowsAffected()
		if err != nil {
			return nil, err
		}
		if n != 1 {
			return nil, util.ErrPrecondition
		}
	}
	return result, nil
}
