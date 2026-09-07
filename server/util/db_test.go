package util

import (
	"context"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"testing"
)

func TestTenantFilterFailsClosed(t *testing.T) {
	id := primitive.NewObjectID()
	filter := TenantFilter(context.Background(), "owner", id)
	if _, ok := filter["_id"].(bson.M); !ok {
		t.Fatal("missing authentication permitted an id query")
	}
	ctx := context.WithValue(context.Background(), UserIdKey, "owner")
	filter = TenantFilter(ctx, "owner", id)
	if filter["owner"] != "owner" || filter["_id"] != id || filter["is_deleted"] == nil {
		t.Fatal("tenant/tombstone constraint missing")
	}
}
