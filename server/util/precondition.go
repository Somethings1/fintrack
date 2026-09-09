package util

import (
	"context"
	"errors"
	"time"
)

var ErrPrecondition = errors.New("record changed since preview")

type expectedVersionKey struct{}

func WithExpectedVersion(ctx context.Context, version time.Time) context.Context {
	return context.WithValue(ctx, expectedVersionKey{}, version)
}
func ExpectedVersion(ctx context.Context) (time.Time, bool) {
	v, ok := ctx.Value(expectedVersionKey{}).(time.Time)
	return v, ok
}

// Check under the same row lock used for the financial write, not in a separate
// preflight query. Older clients without a precondition retain their contract.
func CheckVersion(ctx context.Context, actual time.Time) error {
	if expected, ok := ExpectedVersion(ctx); ok && !expected.Equal(actual) {
		return ErrPrecondition
	}
	return nil
}
