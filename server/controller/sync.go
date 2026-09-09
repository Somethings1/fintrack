package controller

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"io"
	"net/http"
	"time"
)

const syncPageSize = 500

type syncPosition struct {
	Time time.Time          `json:"time"`
	ID   primitive.ObjectID `json:"id"`
}

func decodePosition(raw string) (syncPosition, error) {
	var p syncPosition
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return p, err
	}
	err = json.Unmarshal(data, &p)
	if err == nil && (p.Time.IsZero() || p.ID.IsZero()) {
		return p, io.ErrUnexpectedEOF
	}
	return p, err
}

type syncFetcher[T any] func(context.Context, string, time.Time, time.Time, primitive.ObjectID, int) ([]T, bool, error)
type syncIdentity[T any] func(T) (time.Time, primitive.ObjectID)

func streamSince[T any](c *gin.Context, fetch syncFetcher[T], identity syncIdentity[T]) {
	since, err := time.Parse(time.RFC3339, c.Param("time"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid timestamp"})
		return
	}
	var after time.Time
	var afterID primitive.ObjectID
	if raw := c.Query("cursor"); raw != "" {
		if len(raw) > 256 {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		p, err := decodePosition(raw)
		if err != nil {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		after, afterID = p.Time, p.ID
	}
	rows, more, err := fetch(c.Request.Context(), c.GetString("username"), since, after, afterID, syncPageSize)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "synchronization unavailable"})
		return
	}
	exact := c.GetHeader("Accept") == "application/vnd.fintrack.exact-v1+ndjson"
	c.Header("Vary", "Accept")
	c.Header("Content-Type", "application/x-ndjson")
	c.Header("X-Accel-Buffering", "no")
	enc := json.NewEncoder(c.Writer)
	var last syncPosition
	for _, row := range rows {
		var output any = row
		if exact {
			output, err = exactMoneyRecord(row)
			if err != nil {
				return
			}
		}
		if err := enc.Encode(output); err != nil {
			return
		}
		last.Time, last.ID = identity(row)
	}
	next := ""
	if more && !last.Time.IsZero() && !last.ID.IsZero() {
		raw, _ := json.Marshal(last)
		next = base64.RawURLEncoding.EncodeToString(raw)
	}
	_ = enc.Encode(gin.H{"_syncComplete": true, "nextCursor": next})
}

// Preserve the exact JSON decimal lexeme. A float64 conversion here would lose
// cents for large balances before the native client's BigInt parser sees them.
func exactMoneyRecord(value any) (map[string]json.RawMessage, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	var row map[string]json.RawMessage
	if err := json.Unmarshal(raw, &row); err != nil {
		return nil, err
	}
	for _, key := range []string{"amount", "balance", "openingBalance", "budget", "goal"} {
		if v, ok := row[key]; ok {
			row[key], err = json.Marshal(string(v))
			if err != nil {
				return nil, err
			}
		}
	}
	return row, nil
}
