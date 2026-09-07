package controller

import (
	"encoding/base64"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
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
	var position syncPosition
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return position, err
	}
	err = json.Unmarshal(data, &position)
	if err == nil && (position.Time.IsZero() || position.ID.IsZero()) {
		return position, io.ErrUnexpectedEOF
	}
	return position, err
}

// streamSince is a bounded, tenant-scoped keyset page. Tombstones are included.
// A completion marker distinguishes a complete page from a truncated 200 response.
func streamSince[T any](c *gin.Context, collection *mongo.Collection, tenant string) {
	since, err := time.Parse(time.RFC3339, c.Param("time"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid timestamp"})
		return
	}
	filter := bson.M{tenant: c.GetString("username"), "last_update": bson.M{"$gte": since}}
	if raw := c.Query("cursor"); raw != "" {
		if len(raw) > 256 {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		position, err := decodePosition(raw)
		if err != nil {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		filter["$or"] = bson.A{bson.M{"last_update": bson.M{"$gt": position.Time}}, bson.M{"last_update": position.Time, "_id": bson.M{"$gt": position.ID}}}
	}
	ctx := c.Request.Context()
	cursor, err := collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "last_update", Value: 1}, {Key: "_id", Value: 1}}).SetLimit(syncPageSize+1).SetBatchSize(syncPageSize+1))
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "synchronization unavailable"})
		return
	}
	defer cursor.Close(ctx)
	c.Header("Content-Type", "application/x-ndjson")
	c.Header("X-Accel-Buffering", "no")
	count := 0
	var position syncPosition
	c.Stream(func(w io.Writer) bool {
		more := cursor.Next(ctx)
		if more && count < syncPageSize {
			var value T
			if cursor.Decode(&value) != nil {
				return false
			}
			var row struct {
				ID   primitive.ObjectID `bson:"_id"`
				Time time.Time          `bson:"last_update"`
			}
			if bson.Unmarshal(cursor.Current, &row) != nil || row.ID.IsZero() || row.Time.IsZero() {
				return false
			}
			position = syncPosition{Time: row.Time, ID: row.ID}
			count++
			return json.NewEncoder(w).Encode(value) == nil
		}
		if cursor.Err() != nil {
			return false
		}
		next := ""
		if more {
			raw, _ := json.Marshal(position)
			next = base64.RawURLEncoding.EncodeToString(raw)
		}
		_ = json.NewEncoder(w).Encode(gin.H{"_syncComplete": true, "nextCursor": next})
		return false
	})
}
