//////////////////
// Saving
//////////////////

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"io"
	"net/http"
	"testing"
	"time"
)

func login() (string, error) {
	loginPayload := `{"username": "testaccount1", "password": "testaccount"}`
	resp, err := http.Post("http://localhost:8080/auth/signin", "application/json", bytes.NewReader([]byte(loginPayload)))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	for _, cookie := range resp.Cookies() {
		if cookie.Name == "access_token" { // Replace "token" with the actual name of your token cookie
			return cookie.Value, nil
		}
	}

	return "", fmt.Errorf("token cookie not found")
}

type Saving struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Owner     string             `bson:"owner" json:"owner"`
	Balance   float64            `bson:"balance" json:"balance"`
	Icon      string             `bson:"icon" json:"icon"`
	Name      string             `bson:"name" json:"name"`
	Goal      float64            `bson:"goal,omitempty" json:"goal,omitempty"`
	StartDate time.Time          `bson:"start_date" json:"start_date"`
	GoalDate  time.Time          `bson:"goal_date" json:"goal_date"`
}

func createSaving(token string, saving Saving) (primitive.ObjectID, error) {
	payload, _ := json.Marshal(saving)
	req, err := http.NewRequest("POST", "http://localhost:8080/api/savings/add", bytes.NewReader(payload))
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

func updateSaving(token string, id primitive.ObjectID, saving Saving) error {
	payload, _ := json.Marshal(saving)
	req, err := http.NewRequest("PUT", fmt.Sprintf("http://localhost:8080/api/savings/update/%s", id.Hex()), bytes.NewReader(payload))
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

func getSavings(token string) ([]Saving, error) {
	req, err := http.NewRequest("GET", "http://localhost:8080/api/savings/get", nil)
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

	var savings []Saving
	decoder := json.NewDecoder(resp.Body)
	for {
		var saving Saving
		if err := decoder.Decode(&saving); err == io.EOF {
			break
		} else if err != nil {
			return nil, err
		}
		savings = append(savings, saving)
	}
	return savings, nil
}

func deleteSaving(token string, id primitive.ObjectID) error {
	req, err := http.NewRequest("DELETE", fmt.Sprintf("http://localhost:8080/api/savings/delete/%s", id.Hex()), nil)
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

func TestSavingFlow(t *testing.T) {
	// Login and obtain token
	token, err := login()
	if err != nil {
		t.Fatalf("Failed to login: %v", err)
	}

	saving := Saving{
		Owner:     "testaccount1",
		Balance:   2000.0,
		Icon:      "piggy-bank",
		Name:      "Emergency Fund",
		Goal:      10000.0,
		StartDate: time.Now(),
		GoalDate:  time.Now().AddDate(1, 0, 0),
	}
	id, err := createSaving(token, saving)
	if err != nil {
		t.Fatalf("Failed to create saving: %v", err)
	}
	t.Logf("Saving created with ID: %s", id.Hex())

	saving.Balance = 2500.0
	saving.Name = "Updated Emergency Fund"
	if err := updateSaving(token, id, saving); err != nil {
		t.Fatalf("Failed to update saving: %v", err)
	}
	t.Log("Saving updated successfully")

	savings, err := getSavings(token)
	if err != nil {
		t.Fatalf("Failed to get savings: %v", err)
	}
	found := false
	for _, s := range savings {
		if s.ID == id {
			found = true
			if s.Balance != 2500.0 || s.Name != "Updated Emergency Fund" {
				t.Fatalf("Saving update not reflected: %+v", s)
			}
		}
	}
	if !found {
		t.Fatalf("Saving not found in list: ID %s", id.Hex())
	}
	t.Log("Saving validated successfully")

	if err := deleteSaving(token, id); err != nil {
		t.Fatalf("Failed to delete saving: %v", err)
	}
	t.Log("Saving deleted successfully")
}
