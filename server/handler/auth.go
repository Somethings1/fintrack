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
    "github.com/gin-gonic/gin"
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

func validateTokenFromCookie(c *gin.Context, cookieName string) (string, error) {
    cookie, err := c.Cookie(cookieName)
    if err != nil {
        return "", err
    }

    token, err := jwt.ParseWithClaims(cookie, &Claims{}, func(token *jwt.Token) (interface{}, error) {
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

func setTokenCookie(c *gin.Context, name, token string, duration time.Duration) {
	c.SetCookie(
		name,             // Cookie name
		token,            // Cookie value
		int(duration.Seconds()), // Max age in seconds
		"/",              // Cookie path
		"",               // Cookie domain (empty means default)
		false,            // Secure (set to true for HTTPS)
		true,             // HttpOnly
	)
}

func clearTokenCookie(c *gin.Context, name string) {
	c.SetCookie(
		name,         // Cookie name
		"",           // Empty value
		-1,           // Max age in the past to invalidate
		"/",          // Cookie path
		"",           // Cookie domain (empty means default)
		false,        // Secure (set to true for HTTPS)
		true,         // HttpOnly
	)
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

func saveTokens (c *gin.Context, credentials model.User) {
    accessToken, err := generateToken(credentials.Username, ACCESS_TOKEN_EXPIRATION_TIME)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not create access token"})
        return
    }

    refreshToken, err := generateToken(credentials.Username, REFRESH_TOKEN_EXPIRATION_TIME)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not create refresh tokens"})
        return
    }

    // Set tokens as HTTP-only cookies
    setTokenCookie(c, "access_token", accessToken, ACCESS_TOKEN_EXPIRATION_TIME)
    setTokenCookie(c, "refresh_token", refreshToken, REFRESH_TOKEN_EXPIRATION_TIME)
}

///////////////////
//  methods
///////////////////

func Verify(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Verified"})
}

func SignUp(c *gin.Context) {
    var user model.User
    if err := c.ShouldBindJSON(&user); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    message := assertUserInfo(user)
    if message != "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": message})
        return
    }

    // Hash password
    hashedPassword, err := hashPassword(user.Password)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not hash password"})
        return
    }

    user.Password = hashedPassword

    _, err = util.UserCollection.InsertOne(context.TODO(), user)
    if err != nil {
        if mongo.IsDuplicateKeyError(err) {
            c.JSON(http.StatusConflict, gin.H{"error": "Username already exists"})
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not create user"})
        return
    }

    saveTokens(c, user)

    c.JSON(http.StatusOK, gin.H{"message": "User created successfully"})
}

func SignIn(c *gin.Context) {
    var user model.User
    if err := c.ShouldBindJSON(&user); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
        return
    }

    // Verify user info
    err := VerifyUser(user)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
        return
    }

    saveTokens(c, user)

    c.JSON(http.StatusOK, gin.H{
        "message": "User signed in successfully",
        "username": user.Username,
        "name": user.Name,
    })
}

func Refresh(c *gin.Context) {
    username, err := validateTokenFromCookie(c, "refresh_token")
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
        return
    }

    // Generate a new access token
    newAccessToken, err := generateToken(username, 15*time.Minute)

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not create new access token"})
        return
    }

    // Set the new access token as an HTTP-only cookie
    setTokenCookie(c, "access_token", newAccessToken, 15*time.Minute)

    c.JSON(http.StatusOK, gin.H{"message": "Access token refreshed"})
}

func Logout(c *gin.Context) {
    clearTokenCookie(c, "access_token")
    clearTokenCookie(c, "refresh_token")

    c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}
