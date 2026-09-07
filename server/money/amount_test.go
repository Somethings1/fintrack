package money

import (
	"encoding/json"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"testing"
)

func TestExactArithmeticAndEncoding(t *testing.T) {
	a, err := Add(Must("0.1"), Must("0.2"))
	if err != nil || a != Must("0.3") {
		t.Fatal(a, err)
	}
	for _, s := range []string{"0", "-0.01", "10.25", "1000000000000", "0.000001", "1e2"} {
		want := Must(s)
		raw, err := json.Marshal(want)
		if err != nil {
			t.Fatal(err)
		}
		var got Amount
		if json.Unmarshal(raw, &got) != nil || got != want {
			t.Fatalf("JSON roundtrip %s", s)
		}
		encoded, err := bson.Marshal(struct {
			Amount Amount `bson:"amount"`
		}{want})
		if err != nil {
			t.Fatal(err)
		}
		if bson.Raw(encoded).Lookup("amount").Type.String() != "128-bit decimal" {
			if _, ok := bson.Raw(encoded).Lookup("amount").Decimal128OK(); !ok {
				t.Fatal("not Decimal128")
			}
		}
		var decoded struct {
			Amount Amount `bson:"amount"`
		}
		if err := bson.Unmarshal(encoded, &decoded); err != nil || decoded.Amount != want {
			t.Fatal(decoded, err)
		}
	}
	if Validate(Must("0.001"), "USD") == nil || Validate(Must("0.01"), "VND") == nil || Validate(Must("0.001"), "KWD") != nil {
		t.Fatal("currency precision")
	}
	if _, err := Add(Max, Must("0.01")); err == nil {
		t.Fatal("overflow accepted")
	}
}
func TestRejectInvalidAndLegacyMoney(t *testing.T) {
	for _, s := range []string{"NaN", "Inf", "null", "true", "1/3", "1.0000001", "1000000000001", "1e99", "-01", ""} {
		if _, err := Parse(s); err == nil {
			t.Errorf("accepted %q", s)
		}
	}
	for _, v := range []interface{}{0.1, int64(1), int32(1), "0.1", nil} {
		raw, _ := bson.Marshal(bson.M{"amount": v})
		var d struct {
			Amount Amount `bson:"amount"`
		}
		if bson.Unmarshal(raw, &d) == nil {
			t.Errorf("accepted legacy %T", v)
		}
	}
	d, _ := primitive.ParseDecimal128("NaN")
	raw, _ := bson.Marshal(bson.M{"amount": d})
	var v struct {
		Amount Amount `bson:"amount"`
	}
	if bson.Unmarshal(raw, &v) == nil {
		t.Fatal("NaN accepted")
	}
}
