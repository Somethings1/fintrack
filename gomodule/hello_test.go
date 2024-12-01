package greeting

import (
    "testing"
    "regexp"
)

func TestSayHello(t *testing.T) {
    name := "Nong"
    message, err := SayHello(name)
    want := regexp.MustCompile(`\b` + name + `\b`)
    if !want.MatchString(message) || err  != nil {
        t.Fatalf(`SayHello("Nong") = %q, %v, want match for %#q, nil`, message, err, want)
    }
}

func TestHelloEmpty(t *testing.T) {
    message, err := SayHello("")
    if message != "" || err == nil {
        t.Fatalf(`SayHello("") = %q, %v, want "", error`, message, err)
    }
}
