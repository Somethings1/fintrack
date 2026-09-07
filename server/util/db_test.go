package util

import (
	"context"
	"testing"
)

func TestUserIDFailsClosed(t *testing.T) {
	if got := UserID(context.Background()); got != "" {
		t.Fatalf("unauthenticated context returned user %q", got)
	}
	ctx := context.WithValue(context.Background(), UserIdKey, "owner-a")
	if got := UserID(ctx); got != "owner-a" {
		t.Fatalf("authenticated context returned %q", got)
	}
}
