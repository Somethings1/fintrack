package main

import (
    "context"
    "fmt"
    "net/http"
    "time"

    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
    "github.com/rs/cors"
)

func helloWorld(w http.ResponseWriter, r *http.Request) {
    // Set up MongoDB client and context
    client, err := mongo.NewClient(options.Client().ApplyURI("mongodb://localhost:27017"))
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    // Connect to MongoDB with a 10-second timeout
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    err = client.Connect(ctx)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    defer client.Disconnect(ctx)

    // Access a MongoDB database and collection
    collection := client.Database("test").Collection("test")

    // Find a document from the collection
    var result map[string]interface{}
    err = collection.FindOne(ctx, map[string]interface{}{}).Decode(&result)
    if err != nil {
        if err == mongo.ErrNoDocuments {
            fmt.Fprintln(w, "No documents found")
        } else {
            http.Error(w, err.Error(), http.StatusInternalServerError)
        }
        return
    }

    // Respond with the message from MongoDB
    fmt.Fprintf(w, "Message from MongoDB: %v", result["message"])
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/", helloWorld)

    // Enable CORS
    handler := cors.Default().Handler(mux)

    fmt.Println("Server running at http://localhost:8080")
    http.ListenAndServe(":8080", handler)
}

