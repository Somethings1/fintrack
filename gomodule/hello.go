package greeting

import (
    "fmt"
    "errors"
    "math/rand"
)

func SayHello(name string) (string, error) {
    if name == "" {
       return "", errors.New("empty name")
    }
    message := fmt.Sprintf(randomFormat(), name)
    return message, nil
}

func SayHellos(names []string) (map[string]string, error) {
    messages := make(map[string]string)
    for _, name := range names {
        message, err := SayHello(name)
        if err != nil {
            return nil, err
        }
        messages[name] = message
    }
    return messages, nil
}

func randomFormat() string {
    formats := []string {
        "Dcu may luon %v",
        "Vaix loonf luoon ddaays %v",
        "Aor vl nheer %v",
    }
    return formats[rand.Intn(len(formats))]
}
