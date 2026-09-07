//go:build integration

package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"
)

type contractAccount struct {
	ID        string  `json:"_id"`
	Owner     string  `json:"owner"`
	Name      string  `json:"name"`
	Balance   float64 `json:"balance"`
	IsDeleted bool    `json:"isDeleted"`
}

func (a *ledgerContractApp) accounts(token string) map[string]contractAccount {
	a.t.Helper()
	data := a.requireStatus(http.MethodGet, "/api/accounts/get-since/1970-01-01T00:00:00Z", token, nil, "", http.StatusOK)
	decoder := json.NewDecoder(bytes.NewReader(data))
	out := map[string]contractAccount{}
	for decoder.More() {
		var raw json.RawMessage
		if err := decoder.Decode(&raw); err != nil {
			a.t.Fatal(err)
		}
		var marker struct {
			SyncComplete bool `json:"_syncComplete"`
		}
		if json.Unmarshal(raw, &marker) == nil && marker.SyncComplete {
			continue
		}
		var account contractAccount
		if err := json.Unmarshal(raw, &account); err != nil {
			a.t.Fatal(err)
		}
		if account.ID != "" {
			out[account.ID] = account
		}
	}
	return out
}

func (a *ledgerContractApp) balance(token, id string) float64 {
	a.t.Helper()
	account, ok := a.accounts(token)[id]
	if !ok {
		a.t.Fatalf("account %s missing from owner-visible API", id)
	}
	return account.Balance
}

func TestLedgerContractTransactionLifecycle(t *testing.T) {
	app := newLedgerContractApp(t)
	wallet := app.create("/api/accounts/add", "alpha", map[string]interface{}{
		"name": "Wallet", "balance": 100.00, "icon": "W",
	}, "")
	bank := app.create("/api/accounts/add", "alpha", map[string]interface{}{
		"name": "Bank", "balance": 40.00, "icon": "B",
	}, "")
	expenseCategory := app.create("/api/categories/add", "alpha", map[string]interface{}{
		"name": "Food", "type": "expense", "budget": 100, "icon": "F",
	}, "")
	incomeCategory := app.create("/api/categories/add", "alpha", map[string]interface{}{
		"name": "Salary", "type": "income", "budget": 0, "icon": "S",
	}, "")

	expense := map[string]interface{}{
		"amount": 10.25, "dateTime": "2026-09-01T12:00:00Z", "type": "expense",
		"sourceAccount": wallet, "category": expenseCategory, "note": "Lunch",
	}
	expenseID := app.create("/api/transactions/add", "alpha", expense, "contract-expense")
	if got := app.balance("alpha", wallet); got != 89.75 {
		t.Fatalf("expense balance = %.2f, want 89.75", got)
	}

	income := map[string]interface{}{
		"amount": 7.10, "dateTime": "2026-09-02T12:00:00Z", "type": "income",
		"destinationAccount": bank, "category": incomeCategory, "note": "Refund",
	}
	incomeID := app.create("/api/transactions/add", "alpha", income, "contract-income")
	if got := app.balance("alpha", bank); got != 47.10 {
		t.Fatalf("income balance = %.2f, want 47.10", got)
	}

	transfer := map[string]interface{}{
		"amount": 20.00, "dateTime": "2026-09-03T12:00:00Z", "type": "transfer",
		"sourceAccount": wallet, "destinationAccount": bank, "note": "Move cash",
	}
	transferID := app.create("/api/transactions/add", "alpha", transfer, "contract-transfer")
	if got := app.balance("alpha", wallet); got != 69.75 {
		t.Fatalf("transfer source balance = %.2f, want 69.75", got)
	}
	if got := app.balance("alpha", bank); got != 67.10 {
		t.Fatalf("transfer destination balance = %.2f, want 67.10", got)
	}

	// Updating financial intent must atomically reverse the old posting and apply the new one.
	updatedExpense := map[string]interface{}{
		"amount": 12.25, "dateTime": "2026-09-01T12:00:00Z", "type": "expense",
		"sourceAccount": wallet, "category": expenseCategory, "note": "Lunch corrected",
	}
	app.requireStatus(http.MethodPut, "/api/transactions/update/"+expenseID, "alpha", updatedExpense, "", http.StatusOK)
	if got := app.balance("alpha", wallet); got != 67.75 {
		t.Fatalf("updated expense balance = %.2f, want 67.75", got)
	}

	// Deleting a posting reverses its financial effect exactly once.
	app.requireStatus(http.MethodDelete, "/api/transactions/delete/"+transferID, "alpha", nil, "", http.StatusOK)
	if got := app.balance("alpha", wallet); got != 87.75 {
		t.Fatalf("deleted transfer source balance = %.2f, want 87.75", got)
	}
	if got := app.balance("alpha", bank); got != 47.10 {
		t.Fatalf("deleted transfer destination balance = %.2f, want 47.10", got)
	}
	app.requireStatus(http.MethodDelete, "/api/transactions/delete/"+transferID, "alpha", nil, "", http.StatusNotFound)
	if got := app.balance("alpha", wallet); got != 87.75 {
		t.Fatalf("repeated delete changed source balance = %.2f", got)
	}

	app.requireStatus(http.MethodDelete, "/api/transactions/delete/"+incomeID, "alpha", nil, "", http.StatusOK)
	if got := app.balance("alpha", bank); got != 40.00 {
		t.Fatalf("deleted income balance = %.2f, want 40.00", got)
	}
}

func TestLedgerContractIdempotencyIsolationAndAtomicFailure(t *testing.T) {
	app := newLedgerContractApp(t)
	ownerAccount := app.create("/api/accounts/add", "alpha", map[string]interface{}{
		"name": "Owner wallet", "balance": 100, "icon": "A",
	}, "")
	foreignAccount := app.create("/api/accounts/add", "beta", map[string]interface{}{
		"name": "Foreign wallet", "balance": 50, "icon": "B",
	}, "")
	category := app.create("/api/categories/add", "alpha", map[string]interface{}{
		"name": "Food", "type": "expense", "budget": 100, "icon": "F",
	}, "")

	tx := map[string]interface{}{
		"amount": 0.10, "dateTime": "2026-09-01T12:00:00Z", "type": "expense",
		"sourceAccount": ownerAccount, "category": category, "note": "Exact money",
	}
	first := app.create("/api/transactions/add", "alpha", tx, "stable-request")
	replay := app.create("/api/transactions/add", "alpha", tx, "stable-request")
	if first != replay {
		t.Fatalf("idempotent replay returned a different transaction: %s != %s", first, replay)
	}
	if got := app.balance("alpha", ownerAccount); got != 99.90 {
		t.Fatalf("idempotent replay double-posted balance: %.2f", got)
	}

	conflict := map[string]interface{}{
		"amount": 0.20, "dateTime": "2026-09-01T12:00:00Z", "type": "expense",
		"sourceAccount": ownerAccount, "category": category, "note": "Changed payload",
	}
	app.requireStatus(http.MethodPost, "/api/transactions/add", "alpha", conflict, "stable-request", http.StatusConflict)
	if got := app.balance("alpha", ownerAccount); got != 99.90 {
		t.Fatalf("idempotency conflict changed balance: %.2f", got)
	}

	foreign := map[string]interface{}{
		"amount": 5, "dateTime": "2026-09-01T12:00:00Z", "type": "expense",
		"sourceAccount": foreignAccount, "category": category, "note": "Must fail",
	}
	app.requireStatus(http.MethodPost, "/api/transactions/add", "alpha", foreign, "foreign-reference", http.StatusBadRequest)
	if got := app.balance("alpha", ownerAccount); got != 99.90 {
		t.Fatalf("failed foreign-reference write changed owner balance: %.2f", got)
	}
	if got := app.balance("beta", foreignAccount); got != 50.00 {
		t.Fatalf("failed foreign-reference write changed foreign balance: %.2f", got)
	}

	// Tenant boundaries must be enforced on direct entity operations as well.
	app.requireStatus(http.MethodPut, "/api/accounts/update/"+ownerAccount, "beta", map[string]interface{}{
		"name": "Hijacked", "balance": 1, "icon": "X",
	}, "", http.StatusNotFound)
	if got := app.balance("alpha", ownerAccount); got != 99.90 {
		t.Fatalf("cross-owner account update changed balance: %.2f", got)
	}

	// Referenced entities cannot be archived while they would invalidate ledger history.
	app.requireStatus(http.MethodDelete, "/api/accounts/delete/"+ownerAccount, "alpha", nil, "", http.StatusConflict)
	app.requireStatus(http.MethodDelete, "/api/categories/delete/"+category, "alpha", nil, "", http.StatusConflict)
}

func TestLedgerContractMetadataUpdatesCannotRewriteBalances(t *testing.T) {
	app := newLedgerContractApp(t)
	account := app.create("/api/accounts/add", "alpha", map[string]interface{}{
		"name": "Wallet", "balance": 10.25, "icon": "W",
	}, "")

	// The client may submit stale balance state during a metadata edit. The ledger owns balance changes.
	app.requireStatus(http.MethodPut, "/api/accounts/update/"+account, "alpha", map[string]interface{}{
		"name": "Renamed wallet", "balance": 999.99, "icon": "R",
	}, "", http.StatusOK)
	if got := app.balance("alpha", account); got != 10.25 {
		t.Fatalf("metadata update clobbered ledger balance: %.2f", got)
	}
}
