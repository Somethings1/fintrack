package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fintrack/server/telemetry"
	"io"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

const maxToolResultBytes = 32 << 10
const maxProviderRequestBytes = 128 << 10

type guardError struct{ code string }

func (e *guardError) Error() string { return e.code }
func deny(code string) error        { telemetry.AgentGuard(code); return &guardError{code: code} }

// These are high-confidence credential patterns, not a complete PII detector or
// a prompt-injection classifier. Inbound credentials are rejected, never logged.
var credentialPatterns = []*regexp.Regexp{
	regexp.MustCompile(`-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----`),
	regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{30,}\b`),
	regexp.MustCompile(`\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})\b`),
	regexp.MustCompile(`\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b`),
	regexp.MustCompile(`(?i)(?:postgres(?:ql)?|mongodb(?:\+srv)?)://[^\s/@:]+:[^\s/@]+@`),
	regexp.MustCompile(`(?i)\b(?:password|passwd|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret)\s*[:=]\s*["']?[^\s"',;]{4,}`),
}

func sensitive(text string) bool {
	for _, pattern := range credentialPatterns {
		if pattern.MatchString(text) {
			return true
		}
	}
	return false
}
func validText(text string) bool {
	if !utf8.ValidString(text) {
		return false
	}
	for _, r := range text {
		if (unicode.IsControl(r) && r != '\n' && r != '\t' && r != '\r') || r == '\u202a' || r == '\u202b' || r == '\u202c' || r == '\u202d' || r == '\u202e' || r == '\u2066' || r == '\u2067' || r == '\u2068' || r == '\u2069' {
			return false
		}
	}
	return true
}
func checkUserText(text string) error {
	if !validText(text) {
		return deny("invalid_text")
	}
	if sensitive(text) {
		return deny("sensitive_input")
	}
	return nil
}

// Reject duplicate keys instead of accepting ambiguous last-key-wins JSON.
func uniqueJSON(raw []byte) bool {
	if !utf8.Valid(raw) {
		return false
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var value func(int) error
	value = func(depth int) error {
		if depth > 16 {
			return errors.New("depth")
		}
		token, err := decoder.Token()
		if err != nil {
			return err
		}
		delim, ok := token.(json.Delim)
		if !ok {
			return nil
		}
		switch delim {
		case '{':
			seen := map[string]bool{}
			for decoder.More() {
				key, err := decoder.Token()
				if err != nil {
					return err
				}
				s, ok := key.(string)
				if !ok || seen[s] {
					return errors.New("duplicate")
				}
				seen[s] = true
				if err := value(depth + 1); err != nil {
					return err
				}
			}
			end, err := decoder.Token()
			if err != nil || end != json.Delim('}') {
				return errors.New("object")
			}
		case '[':
			for decoder.More() {
				if err := value(depth + 1); err != nil {
					return err
				}
			}
			end, err := decoder.Token()
			if err != nil || end != json.Delim(']') {
				return errors.New("array")
			}
		default:
			return errors.New("delimiter")
		}
		return nil
	}
	if value(0) != nil {
		return false
	}
	_, err := decoder.Token()
	return err == io.EOF
}

type permissionKey struct{}
type permissions struct{ Changes, Deletes, Notes bool }

func requestPermissions(ctx context.Context) permissions {
	p, _ := ctx.Value(permissionKey{}).(permissions)
	return p
}

// This allowlist is independent of provider schema filtering. A model which
// returns an undeclared or forbidden function still cannot invoke the executor.
var permittedTools = map[string]bool{
	"get_financial_snapshot": true, "get_spending_summary": true,
	"get_savings_goals": true, "get_upcoming_subscriptions": true, "find_records": true,
	"propose_transaction": true, "propose_account": true, "propose_saving": true,
	"propose_category": true, "propose_budget": true, "propose_subscription": true,
}

type guardedTools struct {
	next    toolExecutor
	seen    map[string]bool
	invalid int
}

func (g *guardedTools) Execute(ctx context.Context, name string, raw json.RawMessage) (result any, err error) {
	started := time.Now()
	defer func() { observeTool(ctx, name, started, err) }()
	if !permittedTools[name] {
		return nil, deny("unknown_tool")
	}
	if len(raw) == 0 {
		raw = json.RawMessage(`{}`)
	}
	if len(raw) > 2048 || !uniqueJSON(raw) {
		return nil, deny("invalid_tool_arguments")
	}
	var args map[string]json.RawMessage
	if json.Unmarshal(raw, &args) != nil || args == nil {
		return nil, deny("invalid_tool_arguments")
	}
	p := requestPermissions(ctx)
	if strings.HasPrefix(name, "propose_") {
		if !p.Changes {
			return nil, deny("changes_not_enabled")
		}
		op := stringValue(args["operation"])
		if op == "delete" && !p.Deletes {
			return nil, deny("deletes_not_enabled")
		}
		entity := strings.TrimPrefix(name, "propose_")
		if entity == "budget" {
			entity = "category"
		}
		if id := stringValue(args["recordId"]); id != "" && !g.seen[entity+":"+id] {
			return nil, deny("unverified_record")
		}
		var fields map[string]json.RawMessage
		_ = json.Unmarshal(args["values"], &fields)
		for _, key := range []string{"sourceAccount", "destinationAccount", "category"} {
			id := stringValue(fields[key])
			if id == "" {
				continue
			}
			known := g.seen["account:"+id] || g.seen["saving:"+id]
			if key == "category" {
				known = g.seen["category:"+id]
			}
			if !known {
				return nil, deny("unverified_record")
			}
		}
	}
	if g.next == nil {
		return nil, errToolUnavailable
	}
	result, err = g.next.Execute(ctx, name, raw)
	if err != nil {
		var invalid *toolArgumentError
		if errors.As(err, &invalid) {
			g.invalid++
			if g.invalid >= 3 {
				return nil, deny("invalid_tool_limit")
			}
		}
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	// Proposals go to the user's confirmation card, NOT back to the provider.
	if proposal, ok := result.(*ChangeProposal); ok {
		return proposal, nil
	}
	data, err := json.Marshal(result)
	if err != nil || len(data) > maxToolResultBytes {
		return nil, deny("tool_result_limit")
	}
	g.remember(name, data)
	var decoded any
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if decoder.Decode(&decoded) != nil {
		return nil, errToolUnavailable
	}
	decoded = scrubToolData(decoded, p.Notes)
	return decoded, nil
}
func (g *guardedTools) remember(name string, data []byte) {
	if g.seen == nil {
		g.seen = map[string]bool{}
	}
	var r struct {
		Entity  string `json:"entity"`
		Records []struct {
			ID string `json:"id"`
		} `json:"records"`
		Accounts []struct {
			ID   string `json:"id"`
			Kind string `json:"kind"`
		} `json:"accounts"`
		Categories []struct {
			ID string `json:"id"`
		} `json:"categories"`
		Goals []struct {
			ID string `json:"id"`
		} `json:"goals"`
		Subscriptions []struct {
			ID string `json:"id"`
		} `json:"subscriptions"`
	}
	if json.Unmarshal(data, &r) != nil {
		return
	}
	switch name {
	case "find_records":
		if r.Entity == "budget" {
			r.Entity = "category"
		}
		for _, v := range r.Records {
			g.seen[r.Entity+":"+v.ID] = true
		}
	case "get_financial_snapshot":
		for _, v := range r.Accounts {
			g.seen[v.Kind+":"+v.ID] = true
		}
	case "get_spending_summary":
		for _, v := range r.Categories {
			g.seen["category:"+v.ID] = true
		}
	case "get_savings_goals":
		for _, v := range r.Goals {
			g.seen["saving:"+v.ID] = true
		}
	case "get_upcoming_subscriptions":
		for _, v := range r.Subscriptions {
			g.seen["subscription:"+v.ID] = true
		}
	}
}
func scrubToolData(value any, includeNotes bool) any {
	switch v := value.(type) {
	case string:
		if sensitive(v) || !validText(v) {
			telemetry.AgentGuard("tool_data_redacted")
			return "[redacted sensitive content]"
		}
	case map[string]any:
		for key, item := range v {
			if key == "note" && !includeNotes {
				delete(v, key)
				continue
			}
			v[key] = scrubToolData(item, includeNotes)
		}
	case []any:
		for i, item := range v {
			v[i] = scrubToolData(item, includeNotes)
		}
	}
	return value
}

func scopedDeclarations(ctx context.Context) json.RawMessage {
	var tools []map[string]any
	if json.Unmarshal(allChatToolDeclarations(), &tools) != nil {
		panic("invalid static tool declarations")
	}
	p := requestPermissions(ctx)
	filtered := make([]map[string]any, 0, len(tools))
	for _, tool := range tools {
		if strings.HasPrefix(tool["name"].(string), "propose_") {
			if !p.Changes {
				continue
			}
			if !p.Deletes && tool["name"] != "propose_budget" {
				params := tool["parameters"].(map[string]any)["properties"].(map[string]any)
				params["operation"].(map[string]any)["enum"] = []string{"create", "update"}
			}
		}
		filtered = append(filtered, tool)
	}
	raw, _ := json.Marshal(filtered)
	return raw
}
