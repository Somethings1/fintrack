package handler

import (
    "fmt"
    "net/http"
    "fintrack/server/service"
)

func SignInHandler(w http.ResponseWriter, r *http.Request) {
    fmt.Println("Received signin request")
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

    // Verify user info
    err = service.VerifyUser(user)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    // Return success message
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("Signin successful"))
}
