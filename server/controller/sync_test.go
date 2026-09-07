package controller

import (
	"encoding/base64"
	"encoding/json"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"testing"
	"time"
)

func TestCursorValidation(t *testing.T) {
	expected := syncPosition{Time: time.Now().UTC().Truncate(time.Millisecond), ID: primitive.NewObjectID()}
	raw, _ := json.Marshal(expected)
	actual, err := decodePosition(base64.RawURLEncoding.EncodeToString(raw))
	if err != nil || actual != expected {
		t.Fatalf("cursor round trip failed: %v", err)
	}
	for _, input := range []string{"bad!!!", base64.RawURLEncoding.EncodeToString([]byte(`{}`)), base64.RawURLEncoding.EncodeToString([]byte(`{"time":"invalid"}`))} {
		if _, err := decodePosition(input); err == nil {
			t.Fatal("invalid cursor accepted")
		}
	}
}
