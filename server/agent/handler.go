package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fintrack/server/config"
	"fintrack/server/util"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"io"
	"net/http"
	"strings"
	"time"
)

func Handler(cfg config.Config) gin.HandlerFunc {
	p := provider{endpoint: "https://generativelanguage.googleapis.com/v1beta/models/" + cfg.AgentModel + ":generateContent", key: cfg.AgentKey,
		client: &http.Client{Timeout: 18 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
	slots := make(chan struct{}, 8)
	return func(c *gin.Context) {
		if !cfg.AgentEnabled {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "AI drafts are disabled"})
			return
		}
		raw, err := io.ReadAll(io.LimitReader(c.Request.Body, (16<<10)+1))
		if err != nil || len(raw) > 16<<10 {
			c.AbortWithStatus(http.StatusRequestEntityTooLarge)
			return
		}
		var request struct {
			Input   string `json:"input"`
			Consent bool   `json:"consent"`
		}
		if decodeStrict(raw, &request) != nil || !request.Consent || strings.TrimSpace(request.Input) == "" || len(request.Input) > 2000 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "provide up to 2000 bytes of text and explicit AI consent"})
			return
		}
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "agent is busy"})
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
		defer cancel()
		catalog, err := loadCatalog(ctx, c.GetString("username"))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnprocessableEntity, gin.H{"error": "unable to load a bounded account and category catalog"})
			return
		}
		result, err := p.draft(ctx, request.Input, catalog)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadGateway, gin.H{"error": "AI could not produce a safe draft; try a clearer description or enter it manually"})
			return
		}
		// Deliberately no calls into transaction services. The ordinary authenticated,
		// ownership-checked transaction endpoint is used only after user confirmation.
		c.JSON(http.StatusOK, result)
	}
}

func loadCatalog(ctx context.Context, user string) (Catalog, error) {
	if user == "" {
		return Catalog{}, errors.New("missing user")
	}
	var catalog Catalog
	for _, item := range []struct {
		collection *mongo.Collection
		target     *[]Choice
	}{
		{util.AccountCollection, &catalog.Accounts}, {util.SavingCollection, &catalog.Accounts}, {util.CategoryCollection, &catalog.Categories},
	} {
		cursor, err := item.collection.Find(ctx, bson.M{"owner": user, "is_deleted": bson.M{"$ne": true}},
			options.Find().SetProjection(bson.M{"_id": 1, "name": 1, "type": 1}).SetSort(bson.D{{Key: "_id", Value: 1}}).SetLimit(101))
		if err != nil {
			return Catalog{}, err
		}
		for cursor.Next(ctx) {
			var row struct {
				ID   primitive.ObjectID `bson:"_id"`
				Name string             `bson:"name"`
				Type string             `bson:"type"`
			}
			if err := cursor.Decode(&row); err != nil {
				cursor.Close(ctx)
				return Catalog{}, err
			}
			if len(row.Name) > 100 || len(*item.target) >= 100 {
				cursor.Close(ctx)
				return Catalog{}, errors.New("catalog too large")
			}
			*item.target = append(*item.target, Choice{ID: row.ID.Hex(), Name: row.Name, Type: row.Type})
		}
		err = cursor.Err()
		cursor.Close(ctx)
		if err != nil {
			return Catalog{}, err
		}
	}
	// Encoding nil slices as [] makes provider context unambiguous.
	if catalog.Accounts == nil {
		catalog.Accounts = []Choice{}
	}
	if catalog.Categories == nil {
		catalog.Categories = []Choice{}
	}
	_, err := json.Marshal(catalog)
	return catalog, err
}
