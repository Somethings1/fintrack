// Package money stores amounts as exact fixed-point integers in Go and BSON
// Decimal128 in MongoDB. JSON remains decimal major units, never binary floats.
package money

import (
	"context"
	"encoding/json"
	"errors"
	"math/big"
	"regexp"
	"strconv"
	"strings"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/bsontype"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Amount is millionths of a major currency unit. Use Parse or Must, NOT a cast
// from a numeric major-unit literal. Currency precision is checked separately.
type Amount int64

const Scale int64 = 1_000_000
const Max Amount = 1_000_000_000_000 * Amount(Scale)

var decimal = regexp.MustCompile(`^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]{1,2})?$`)
var ErrAmount = errors.New("amount must be an exact decimal within +/-1e12 with at most six decimal places")

func Parse(s string) (Amount, error) {
	if len(s) > 64 || !decimal.MatchString(s) {
		return 0, ErrAmount
	}
	n, ok := new(big.Rat).SetString(s)
	if !ok {
		return 0, ErrAmount
	}
	n.Mul(n, new(big.Rat).SetInt64(Scale))
	if !n.IsInt() || !n.Num().IsInt64() {
		return 0, ErrAmount
	}
	a := Amount(n.Num().Int64())
	if a < -Max || a > Max {
		return 0, ErrAmount
	}
	return a, nil
}
func Must(s string) Amount {
	a, err := Parse(s)
	if err != nil {
		panic(err)
	}
	return a
}
func (a Amount) String() string {
	n := int64(a)
	sign := ""
	if n < 0 {
		sign = "-"
		n = -n
	}
	whole := strconv.FormatInt(n/Scale, 10)
	fraction := strings.TrimRight(strconv.FormatInt(n%Scale+Scale, 10)[1:], "0")
	if fraction == "" {
		return sign + whole
	}
	return sign + whole + "." + fraction
}
func (a Amount) MarshalJSON() ([]byte, error) {
	if a < -Max || a > Max {
		return nil, ErrAmount
	}
	return []byte(a.String()), nil
}
func (a *Amount) UnmarshalJSON(raw []byte) error {
	s := string(raw)
	// String inputs allow callers to avoid floating point before transport.
	if len(raw) > 0 && raw[0] == '"' {
		if err := json.Unmarshal(raw, &s); err != nil {
			return err
		}
	}
	parsed, err := Parse(s)
	if err == nil {
		*a = parsed
	}
	return err
}
func (a Amount) MarshalBSONValue() (bsontype.Type, []byte, error) {
	if a < -Max || a > Max {
		return bsontype.Null, nil, ErrAmount
	}
	d, err := primitive.ParseDecimal128(a.String())
	if err != nil {
		return bsontype.Null, nil, err
	}
	return bson.MarshalValue(d)
}
func (a *Amount) UnmarshalBSONValue(t bsontype.Type, raw []byte) error {
	// Legacy doubles MUST go through the reviewed offline migration. Refusing
	// them prevents mixed-type $inc promotion from silently reintroducing floats.
	if t != bsontype.Decimal128 {
		return errors.New("legacy monetary storage: run the reviewed money migration")
	}
	d, ok := (bson.RawValue{Type: t, Value: raw}).Decimal128OK()
	if !ok {
		return ErrAmount
	}
	parsed, err := Parse(d.String())
	if err == nil {
		*a = parsed
	}
	return err
}
func Add(a, b Amount) (Amount, error) {
	if a < -Max || a > Max || b < -Max || b > Max {
		return 0, ErrAmount
	}
	// 2*Max is below MaxInt64, so this addition itself cannot overflow.
	result := a + b
	if result < -Max || result > Max {
		return 0, ErrAmount
	}
	return result, nil
}

// Precision is an intentionally bounded currency allowlist, not an FX engine.
func Precision(currency string) (int, error) {
	switch currency {
	case "JPY", "VND", "KRW":
		return 0, nil
	case "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SGD", "THB", "CNY":
		return 2, nil
	case "KWD", "BHD":
		return 3, nil
	default:
		return 0, errors.New("unsupported ledger currency")
	}
}
func Validate(a Amount, currency string) error {
	precision, err := Precision(currency)
	if err != nil {
		return err
	}
	divisor := int64(1)
	for i := precision; i < 6; i++ {
		divisor *= 10
	}
	if a < -Max || a > Max || int64(a)%divisor != 0 {
		return errors.New("amount exceeds the currency precision or allowed range")
	}
	return nil
}

type currencyKey struct{}

func WithCurrency(ctx context.Context, currency string) context.Context {
	return context.WithValue(ctx, currencyKey{}, currency)
}
func Currency(ctx context.Context) string { s, _ := ctx.Value(currencyKey{}).(string); return s }
func Resolve(ctx context.Context, supplied string) (string, error) {
	currency := Currency(ctx)
	if _, err := Precision(currency); err != nil {
		return "", err
	}
	if supplied != "" && supplied != currency {
		return "", errors.New("cross-currency writes are not supported")
	}
	return currency, nil
}
