package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fintrack/server/config"
	"fintrack/server/money"
	"fintrack/server/util"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"strings"
	"time"
)

func Handler(cfg config.Config) gin.HandlerFunc {
	p := provider{endpoint: "https://generativelanguage.googleapis.com/v1beta/models/" + cfg.AgentModel + ":generateContent", key: cfg.AgentKey, client: &http.Client{Timeout: 18 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
	slots := make(chan struct{}, 8)
	return func(c *gin.Context) {
		if !cfg.AgentEnabled {
			c.AbortWithStatusJSON(503, gin.H{"error": "AI drafts are disabled"})
			return
		}
		raw, err := io.ReadAll(io.LimitReader(c.Request.Body, (16<<10)+1))
		if err != nil || len(raw) > 16<<10 {
			c.AbortWithStatus(413)
			return
		}
		var request struct {
			Input   string `json:"input"`
			Consent bool   `json:"consent"`
		}
		if decodeStrict(raw, &request) != nil || !request.Consent || strings.TrimSpace(request.Input) == "" || len(request.Input) > 2000 {
			c.AbortWithStatusJSON(400, gin.H{"error": "provide up to 2000 bytes of text and explicit AI consent"})
			return
		}
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			c.AbortWithStatusJSON(429, gin.H{"error": "agent is busy"})
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
		defer cancel()
		catalog, err := loadCatalog(ctx, c.GetString("username"))
		if err != nil {
			c.AbortWithStatusJSON(422, gin.H{"error": "unable to load a bounded account and category catalog"})
			return
		}
		result, err := p.draft(ctx, request.Input, catalog)
		if err != nil {
			c.AbortWithStatusJSON(502, gin.H{"error": "AI could not produce a safe draft; try a clearer description or enter it manually"})
			return
		}
		if result.Transaction != nil && money.Validate(result.Transaction.Amount, money.Currency(ctx)) != nil {
			c.AbortWithStatusJSON(502, gin.H{"error": "AI draft exceeds ledger precision"})
			return
		}
		c.JSON(200, result)
	}
}
func loadCatalog(ctx context.Context, user string) (Catalog, error) {
	if user == "" {
		return Catalog{}, errors.New("missing user")
	}
	var catalog Catalog
	rows, err := util.DB.QueryContext(ctx, `SELECT id,name FROM financial_accounts WHERE owner=$1 AND is_deleted=false ORDER BY id LIMIT 101`, user)
	if err != nil {
		return catalog, err
	}
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			rows.Close()
			return catalog, err
		}
		if len(name) > 100 || len(catalog.Accounts) >= 100 {
			rows.Close()
			return catalog, errors.New("catalog too large")
		}
		catalog.Accounts = append(catalog.Accounts, Choice{ID: id, Name: name})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return catalog, err
	}
	rows.Close()
	rows, err = util.DB.QueryContext(ctx, `SELECT id,name,type FROM categories WHERE owner=$1 AND is_deleted=false ORDER BY id LIMIT 101`, user)
	if err != nil {
		return catalog, err
	}
	for rows.Next() {
		var id, name, kind string
		if err := rows.Scan(&id, &name, &kind); err != nil {
			rows.Close()
			return catalog, err
		}
		if len(name) > 100 || len(catalog.Categories) >= 100 {
			rows.Close()
			return catalog, errors.New("catalog too large")
		}
		catalog.Categories = append(catalog.Categories, Choice{ID: id, Name: name, Type: kind})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return catalog, err
	}
	rows.Close()
	if catalog.Accounts == nil {
		catalog.Accounts = []Choice{}
	}
	if catalog.Categories == nil {
		catalog.Categories = []Choice{}
	}
	_, err = json.Marshal(catalog)
	return catalog, err
}
