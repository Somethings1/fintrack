package main

import (
	"fmt"
	"log"
	"net/http"
	"fintrack/server/handler"
	"fintrack/server/util"
	"github.com/rs/cors"
)

func main() {
	util.InitDB()

	http.HandleFunc("/api/signup", handler.SignUpHandler)

	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		Debug:            true,
	})

	handler := corsHandler.Handler(http.DefaultServeMux)

	fmt.Println("Server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
