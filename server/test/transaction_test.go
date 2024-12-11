package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"
    "io"
)

type Transaction struct {
	ID               string  `json:"id,omitempty"`
	Creator          string  `json:"creator"`
	Amount           float64 `json:"amount"`
	DateTime         string  `json:"date_time"`
	Type             string  `json:"type"` // income, expense, transfer
	SourceAccount    string  `json:"source_account,omitempty"`
	DestinationAccount string `json:"destination_account,omitempty"`
	Category         string  `json:"category,omitempty"`
	Note             string  `json:"note"`
}


func createTransaction(token string, transaction Transaction) (string, error) {
	payload, _ := json.Marshal(transaction)
	req, err := http.NewRequest("POST", "http://localhost:8080/api/transactions/add", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
    req.AddCookie(&http.Cookie{Name: "access_token", Value: token})

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "1", err
	}
	defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        type Error struct {
            Message string `json:"error"`
        }

        var errorResponse Error
        if err := json.NewDecoder(resp.Body).Decode(&errorResponse); err != nil {
            return "4", err
        }

        return "3", fmt.Errorf("create failed: %s", errorResponse.Message)
	}
	var response struct {
        Msg  string `json:"message"`
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return "2", err
	}
	return response.ID, nil
}

func updateTransaction(token, id string, transaction Transaction) error {
	payload, _ := json.Marshal(transaction)
	req, err := http.NewRequest("PUT", fmt.Sprintf("http://localhost:8080/api/transactions/update/%s", id), bytes.NewReader(payload))
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

func getTransactionsByYear(token, year string) ([]Transaction, error) {
	req, err := http.NewRequest("GET", fmt.Sprintf("http://localhost:8080/api/transactions/get/%s", year), nil)
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

	var transactions []Transaction
    decoder := json.NewDecoder(resp.Body)
    for {
        var transaction Transaction
        if err := decoder.Decode(&transaction); err == io.EOF {
            break
        } else if err != nil {
            return nil, err
        }
        transactions = append(transactions, transaction)
    }
	return transactions, nil
}

func deleteTransaction(token, id string) error {
	req, err := http.NewRequest("DELETE", fmt.Sprintf("http://localhost:8080/api/transactions/delete/%s", id), nil)
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

func TestTransactionFlow(t *testing.T) {
	// Login and obtain token
	token, err := login()
	if err != nil {
		t.Fatalf("Failed to login: %v", err)
	}

	// Create a new transaction
	transaction := Transaction{
		Creator:  "testaccount1",
		Amount:   100.0,
		DateTime: time.Now().Format(time.RFC3339),
		Type:     "income",
        Category: "675857a0e9c0f5df7df809ff",
        SourceAccount: "6758476703a5bb195bfc2dd3",
		Note:     "Test transaction",
	}
	id, err := createTransaction(token, transaction)
	if err != nil {
		t.Fatalf("Failed to create transaction: %s %v", id, err)
	}
	t.Logf("Transaction created with ID: %s", id)

	// Update the transaction
	transaction.Amount = 200.0
	transaction.Note = "Updated transaction"
	if err := updateTransaction(token, id, transaction); err != nil {
		t.Fatalf("Failed to update transaction: %v", err)
	}
	t.Log("Transaction updated successfully")

	// Get transactions by year
	year := time.Now().Format("2006")
	transactions, err := getTransactionsByYear(token, year)
	if err != nil {
		t.Fatalf("Failed to get transactions: %v", err)
	}

	// Validate updated transaction
	found := false
	for _, tr := range transactions {
		if tr.ID == id {
			found = true
            fmt.Println(tr.ID)
			if tr.Amount != 200.0 || tr.Note != "Updated transaction" {
				t.Errorf("Transaction update not reflected: %+v", t)
			}
		}
	}
	if !found {
		t.Fatalf("Transaction not found in list: ID %s", id)
	}
	t.Log("Transaction validated successfully")

	// Delete the transaction
	if err := deleteTransaction(token, id); err != nil {
		t.Fatalf("Failed to delete transaction: %v", err)
	}
	t.Log("Transaction deleted successfully")

	// Verify deletion
	transactions, err = getTransactionsByYear(token, year)
	if err != nil {
		t.Fatalf("Failed to get transactions after deletion: %v", err)
	}
	for _, tr := range transactions {
		if tr.ID == id {
			t.Fatalf("Transaction not deleted: %+v", t)
		}
	}
	t.Log("Transaction deletion verified")
}

