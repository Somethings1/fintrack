package handler

import (
    "fmt"
    "time"
    "errors"
    "context"
    "net/http"
    "encoding/json"
	"golang.org/x/crypto/bcrypt"
    "fintrack/server/model"
    "fintrack/server/util"
    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/bson"
    "github.com/golang-jwt/jwt/v4"
)

///////////////////
// Variables
///////////////////
const ACCESS_TOKEN_EXPIRATION_TIME = 15 * time.Minute
const REFRESH_TOKEN_EXPIRATION_TIME = 24 * time.Hour

var jwtKey = []byte("your_secret_key")

type Claims struct {
    Username string `json:"username"`
    jwt.RegisteredClaims
}

///////////////////
// Helper methods
///////////////////

func hashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedPassword), nil
}

func validatePassword(storedPassword, enteredPassword string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(enteredPassword))
	return err == nil
}

func VerifyUser (user model.User) error {
    ctx, close := context.WithTimeout(context.Background(), 10*time.Second)
    defer close()
    filter := bson.M{"username": user.Username}
    result := util.UserCollection.FindOne(ctx, filter)

    // Check if user exists
    if result.Err() != nil {
        if result.Err() == mongo.ErrNoDocuments {
            return errors.New("User not found")
        }
        return result.Err()
    }
    var dbUser model.User
    err := result.Decode(&dbUser)

    if err != nil {
        return err
    }

    if !validatePassword(dbUser.Password, user.Password) {
        return errors.New("Invalid password")
    }
    return nil
}
func parseUser(r *http.Request) (model.User, error) {
    var user model.User

    err := json.NewDecoder(r.Body).Decode(&user)

    return user, err
}

func generateToken(username string, duration time.Duration) (string, error) {
    claims := &Claims{
        Username: username,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
        },
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(jwtKey)
}

func validateTokenFromCookie(r *http.Request, cookieName string) (string, error) {
    cookie, err := r.Cookie(cookieName)
    if err != nil {
        return "", err
    }

    tokenString := cookie.Value
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        return jwtKey, nil
    })
    if err != nil || !token.Valid {
        return "", err
    }

    claims, ok := token.Claims.(*Claims)
    if !ok {
        return "", fmt.Errorf("invalid claims")
    }

    return claims.Username, nil
}

func setTokenCookie(w http.ResponseWriter, name, token string, duration time.Duration) {
    http.SetCookie(w, &http.Cookie{
        Name:     name,
        Value:    token,
        HttpOnly: true,
        SameSite: http.SameSiteNoneMode,
        Expires:  time.Now().Add(duration),
        Path:     "/",
        Secure:   false,
    })
}

// Clear a token cookie
func clearTokenCookie(w http.ResponseWriter, name string) {
    http.SetCookie(w, &http.Cookie{
        Name:     name,
        Value:    "",
        HttpOnly: true,
        Expires:  time.Now().Add(-time.Hour),
        Path:     "/",
    })
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

func saveTokens (w http.ResponseWriter, credentials model.User) {
    accessToken, err := generateToken(credentials.Username, ACCESS_TOKEN_EXPIRATION_TIME)
    if err != nil {
        http.Error(w, "Could not create access token", http.StatusInternalServerError)
        return
    }

    refreshToken, err := generateToken(credentials.Username, REFRESH_TOKEN_EXPIRATION_TIME)
    if err != nil {
        http.Error(w, "Could not create refresh token", http.StatusInternalServerError)
        return
    }

    // Set tokens as HTTP-only cookies
    setTokenCookie(w, "access_token", accessToken, ACCESS_TOKEN_EXPIRATION_TIME)
    setTokenCookie(w, "refresh_token", refreshToken, REFRESH_TOKEN_EXPIRATION_TIME)
}

///////////////////
// Handler methods
///////////////////

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
    hashedPassword, err := hashPassword(user.Password)
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

    saveTokens(w, user)

    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"message": "User created successfully"}`))
}

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
    err = VerifyUser(user)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    saveTokens(w, user)

    // Return success message
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("Signin successful"))
}

func VerifyHandler(w http.ResponseWriter, r *http.Request) {
    fmt.Println("Received verify request")
    // Assert HTTP request method
    if r.Method != http.MethodGet {
        http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
        return
    }
cookie, err := r.Cookie("access_token")
    if err != nil {
        fmt.Println("No access token found")
    } else {
        fmt.Println("Access token:", cookie.Value)
    }

    username, err := validateTokenFromCookie(r, "access_token")
    if err != nil {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    json.NewEncoder(w).Encode(map[string]string{
        "username": username,
        "message":  "Authenticated",
    })
}

func RefreshHandler(w http.ResponseWriter, r *http.Request) {
    fmt.Println("Received refresh request")
    // Assert HTTP request method
    if r.Method != http.MethodPost {
        http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
        return
    }

    username, err := validateTokenFromCookie(r, "refresh_token")
    if err != nil {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    // Generate a new access token
    newAccessToken, err := generateToken(username, 15*time.Minute)
    if err != nil {
        http.Error(w, "Could not create new access token", http.StatusInternalServerError)
        return
    }

    // Set the new access token as an HTTP-only cookie
    setTokenCookie(w, "access_token", newAccessToken, 15*time.Minute)

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Access token refreshed",
    })
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
    fmt.Println("Received logout request")
    // Assert HTTP request method
    if r.Method != http.MethodPost {
        http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
        return
    }

    clearTokenCookie(w, "access_token")
    clearTokenCookie(w, "refresh_token")

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Logged out successfully",
    })
}
