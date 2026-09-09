package middleware

import (
	"fintrack/server/util"
	"github.com/gin-gonic/gin"
	"net/http/httptest"
	"testing"
)

func TestRecordPreconditionRejectsAmbiguousValidators(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, raw := range []string{"*", `W/"2026-09-08T00:00:00Z"`, `"not-a-date"`, `"2026-09-08T00:00:00Z", "2026-09-08T00:00:01Z"`} {
		r := gin.New()
		called := false
		r.PUT("/", RecordPrecondition(), func(c *gin.Context) { called = true })
		req := httptest.NewRequest("PUT", "/", nil)
		req.Header.Set("If-Match", raw)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if called || w.Code != 400 {
			t.Fatal("ambiguous revision accepted")
		}
	}
	r := gin.New()
	r.PUT("/", RecordPrecondition(), func(c *gin.Context) {
		if _, ok := util.ExpectedVersion(c.Request.Context()); !ok {
			t.Error("revision lost")
		}
		c.Status(204)
	})
	req := httptest.NewRequest("PUT", "/", nil)
	req.Header.Set("If-Match", `"2026-09-08T00:00:00.123456Z"`)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 204 {
		t.Fatal("valid revision rejected")
	}
}
