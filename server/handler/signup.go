package handler

import (
    "fmt"
	"encoding/json"
	"net/http"
	"fintrack/server/model"
	"fintrack/server/service"
	"fintrack/server/util"
	"go.mongodb.org/mongo-driver/mongo"
)


func parseUser(r *http.Request) (model.User, error) {
    var user model.User

    err := json.NewDecoder(r.Body).Decode(&user)

    return user, err
}

func assertUserInfo(user model.User) string {
    if len(user.Username) < 6 {
        return "Username must be at least 6 characters long"
    }
    for _, char := range user.Username {
        if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9')) {
            return "Username must contain only letters and numbers"
        }
    }
    if user.Name == "" {
        return "Name cannot be empty"
    }
    if len(user.Password) < 6 {
        return "Password must be at least 6 characters long"
    }
    return ""
}


func SignUpHandler(w http.ResponseWriter, r *http.Request) {
    fmt.Println("Received signup request")
    // Assert HTTP request method
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

    // Parse the request body
    user, err := parseUser(r)
	if err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

    // Assert user info
    message := assertUserInfo(user)
    if message != "" {
        http.Error(w, message, http.StatusBadRequest)
        return
    }

    // Hash password
	hashedPassword, err := service.HashPassword(user.Password)
	if err != nil {
		http.Error(w, "Internal server error (hashing not available)", http.StatusInternalServerError)
		return
	}

	user.Password = hashedPassword

	_, err = util.UserCollection.InsertOne(r.Context(), user)
	if err != nil {
        if mongo.IsDuplicateKeyError(err) {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}
		http.Error(w, "Internal server error (could not create user)", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "User created successfully"}`))
}

