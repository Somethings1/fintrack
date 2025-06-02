package middleware

import (
    "io"
    "fmt"
    "time"
    "bytes"
    "github.com/gin-gonic/gin"
)

func LoggingMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now();
        method := c.Request.Method
        path := c.Request.URL.Path

        c.Next()

        duration := time.Since(start)
        fmt.Printf("[%s at %s] %s\n", method, path, duration)
    }
}

func PrintRequestDetails() gin.HandlerFunc {
    return func(c *gin.Context) {
        fmt.Println("------------------------------------------")
        fmt.Println("HTTP Method:", c.Request.Method)

        fmt.Println("Request Headers:")
        for key, value := range c.Request.Header {
            fmt.Printf("%s: %s\n", key, value)
        }

        fmt.Println("Query Parameters:")
        for key, value := range c.Request.URL.Query() {
            fmt.Printf("%s: %s\n", key, value)
        }

        var body []byte
        if c.Request.Body != nil {
            body, _ = io.ReadAll(c.Request.Body)
            fmt.Println("Request Body:", string(body))

            c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
        }

        c.Next()
    }
}

