package main

import (
    "fmt"
    "test2"
    "log"
)

func main() {
    log.SetPrefix("Test: ")
    messages, err := greeting.SayHellos([]string{"Nong", "Thai"})
    if err != nil {
        log.Fatal(err)
    }
    for name, message := range messages {
        fmt.Printf("%s: %s\n", name, message)
    }
}
