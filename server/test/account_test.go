package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
    "io"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Account struct {
	ID      primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Owner   string             `bson:"owner" json:"owner"`
	Balance float64            `bson:"balance" json:"balance"`
	Icon    string             `bson:"icon" json:"icon"`
	Name    string             `bson:"name" json:"name"`
	Goal    float64            `bson:"goal,omitempty" json:"goal,omitempty"`
}

func createAccount(token string, account Account) (primitive.ObjectID, error) {
	payload, _ := json.Marshal(account)
	req, err := http.NewRequest("POST", "http://localhost:8080/api/accounts/add", bytes.NewReader(payload))
	if err != nil {
		return primitive.NilObjectID, err
	}
	req.Header.Set("Content-Type", "application/json")
    req.AddCookie(&http.Cookie{Name: "access_token", Value: token})

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return primitive.NilObjectID, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		type Error struct {
			Message string `json:"error"`
		}
		var errorResponse Error
		if err := json.NewDecoder(resp.Body).Decode(&errorResponse); err != nil {
			return primitive.NilObjectID, err
		}
		return primitive.NilObjectID, fmt.Errorf("create failed: %s", errorResponse.Message)
	}

	var response struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return primitive.NilObjectID, err
	}

	return primitive.ObjectIDFromHex(response.ID)
}

func updateAccount(token string, id primitive.ObjectID, account Account) error {
	payload, _ := json.Marshal(account)
	req, err := http.NewRequest("PUT", fmt.Sprintf("http://localhost:8080/api/accounts/update/%s", id.Hex()), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
    req.AddCookie(&http.Cookie{Name: "access_token", Value: token})

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("update failed: status code %d", resp.StatusCode)
	}

	return nil
}

func getAccounts(token string) ([]Account, error) {
	req, err := http.NewRequest("GET", "http://localhost:8080/api/accounts/get", nil)
	if err != nil {
		return nil, err
	}
    req.AddCookie(&http.Cookie{Name: "access_token", Value: token})

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("get failed: status code %d", resp.StatusCode)
    }

	var accounts []Account
    decoder := json.NewDecoder(resp.Body)
    for {
        var account Account
        if err := decoder.Decode(&account); err == io.EOF {
            break
        } else if err != nil {
            return nil, err
        }
        accounts = append(accounts, account)
    }
	return accounts, nil
}

func deleteAccount(token string, id primitive.ObjectID) error {
	req, err := http.NewRequest("DELETE", fmt.Sprintf("http://localhost:8080/api/accounts/delete/%s", id.Hex()), nil)
	if err != nil {
		return err
	}
    req.AddCookie(&http.Cookie{Name: "access_token", Value: token})

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("delete failed: status code %d", resp.StatusCode)
	}

	return nil
}

func TestAccountFlow(t *testing.T) {
	// Login and obtain token
	token, err := login()
	if err != nil {
		t.Fatalf("Failed to login: %v", err)
	}

	// Create a new account
	account := Account{
		Owner:   "testaccount1",
		Balance: 1000.0,
		Icon:    "wallet",
		Name:    "Test Wallet",
		Goal:    5000.0,
	}
	id, err := createAccount(token, account)
	if err != nil {
		t.Fatalf("Failed to create account: %v", err)
	}
	t.Logf("Account created with ID: %s", id.Hex())

	// Update the account
	account.Balance = 1200.0
	account.Name = "Updated Wallet"
	if err := updateAccount(token, id, account); err != nil {
		t.Fatalf("Failed to update account: %v", err)
	}
	t.Log("Account updated successfully")

	// Get accounts
	accounts, err := getAccounts(token)
	if err != nil {
		t.Fatalf("Failed to get accounts: %v", err)
	}

	// Validate updated account
	found := false
	for _, acc := range accounts {
		if acc.ID == id {
			found = true
			if acc.Balance != 1200.0 || acc.Name != "Updated Wallet" {
				t.Fatalf("Account update not reflected: %+v", acc)
			}
		}
	}
	if !found {
		t.Fatalf("Account not found in list: ID %s", id.Hex())
	}
	t.Log("Account validated successfully")

	// Delete the account
	if err := deleteAccount(token, id); err != nil {
		t.Fatalf("Failed to delete account: %v", err)
	}
	t.Log("Account deleted successfully")

	// Verify deletion
	accounts, err = getAccounts(token)
	if err != nil {
		t.Fatalf("Failed to get accounts after deletion: %v", err)
	}
	for _, acc := range accounts {
		if acc.ID == id {
			t.Fatalf("Account not deleted: %+v", acc)
		}
	}
	t.Log("Account deletion verified")
}
