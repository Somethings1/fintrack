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

type Category struct {
	ID      primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Owner   string             `bson:"owner" json:"owner"`
	Type    string             `bson:"type" json:"type"` // income or expense
	Icon    string             `bson:"icon" json:"icon"`
	Name    string             `bson:"name" json:"name"`
	Budget  float64            `bson:"budget,omitempty" json:"budget,omitempty"`
}

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

// Create Category
func createCategory(token string, category Category) (primitive.ObjectID, error) {
	payload, _ := json.Marshal(category)
	req, err := http.NewRequest("POST", "http://localhost:8080/api/categories/add", bytes.NewReader(payload))
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

// Update Category
func updateCategory(token string, id primitive.ObjectID, category Category) error {
	payload, _ := json.Marshal(category)
	req, err := http.NewRequest("PUT", fmt.Sprintf("http://localhost:8080/api/categories/update/%s", id.Hex()), bytes.NewReader(payload))
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

// Get Categories
func getCategories(token string) ([]Category, error) {
	req, err := http.NewRequest("GET", "http://localhost:8080/api/categories/get", nil)
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

	var categories []Category
	decoder := json.NewDecoder(resp.Body)
	for {
		var category Category
		if err := decoder.Decode(&category); err == io.EOF {
			break
		} else if err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}
	return categories, nil
}

// Delete Category
func deleteCategory(token string, id primitive.ObjectID) error {
	req, err := http.NewRequest("DELETE", fmt.Sprintf("http://localhost:8080/api/categories/delete/%s", id.Hex()), nil)
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

// Test function for Category CRUD operations
func TestCategoryFlow(t *testing.T) {
	// Login and obtain token
	token, err := login()
	if err != nil {
		t.Fatalf("Failed to login: %v", err)
	}

	// Create a new category
	category := Category{
		Owner: "testaccount1",
		Type:  "expense",
		Icon:  "shopping-cart",
		Name:  "Shopping",
		Budget: 200.0,
	}
	id, err := createCategory(token, category)
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}
	t.Logf("Category created with ID: %s", id.Hex())

	// Update the category
	category.Budget = 300.0
	category.Name = "Updated Shopping"
	if err := updateCategory(token, id, category); err != nil {
		t.Fatalf("Failed to update category: %v", err)
	}
	t.Log("Category updated successfully")

	// Get categories
	categories, err := getCategories(token)
	if err != nil {
		t.Fatalf("Failed to get categories: %v", err)
	}

	// Validate updated category
	found := false
	for _, cat := range categories {
		if cat.ID == id {
			found = true
			if cat.Budget != 300.0 || cat.Name != "Updated Shopping" {
				t.Fatalf("Category update not reflected: %+v", cat)
			}
		}
	}
	if !found {
		t.Fatalf("Category not found in list: ID %s", id.Hex())
	}
	t.Log("Category validated successfully")

	// Delete the category
	if err := deleteCategory(token, id); err != nil {
		t.Fatalf("Failed to delete category: %v", err)
	}
	t.Log("Category deleted successfully")

	// Verify deletion
	categories, err = getCategories(token)
	if err != nil {
		t.Fatalf("Failed to get categories after deletion: %v", err)
	}
	for _, cat := range categories {
		if cat.ID == id {
			t.Fatalf("Category not deleted: %+v", cat)
		}
	}
	t.Log("Category deletion verified")
}
