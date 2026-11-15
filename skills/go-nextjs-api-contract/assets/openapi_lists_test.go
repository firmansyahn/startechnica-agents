package app // ADJUST: the same package as openapi_rules_test.go, whose document loader this test uses

// openapi_lists_test.go: contract-cap-limit-whitelist-sort at runtime, for every list the document declares
// (a GET whose 200 reply has a "data" array). For each one, through the surface's real handler:
//   - limit far above the documented maximum answers 200 with at most maximum rows: clamped, not refused;
//   - sort=<a field the enum doesn't list> answers 400 or 422: never accepted, never a 5xx (an unchecked
//     sort field that reaches SQL fails there).
//
// Misses: the clamp itself when the seed data has fewer rows than the maximum (the test then only proves a large
// limit isn't refused; it logs that with -v), the id tiebreaker, and lists missing from the document
// (contract-test-routes-match-operations).
//
// ADJUST: the project writes newListServer in its own _test.go file in this package:
//
//	func newListServer(t *testing.T, surface string) (http.Handler, http.Header)
//
// It returns the surface's whole handler (router and middleware) over a seeded test database, and the request
// headers of a caller allowed to list everything (Authorization, the scope header). Seed more rows than the
// largest maximum where it's cheap, so the clamp is proved too. Standard library only.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// --- Settings ------------------------------------------------------------------------------------

var (
	// What the handler expects before the document's paths (the path of the document's servers URL, /api/v1/console).
	listPrefix = "" // ADJUST
	// A value for each path parameter of a nested list ({id} in /items/{id}/notes), from the seed data.
	listPathValues = map[string]string{ // ADJUST
		// "id": "0190a1b2-0000-7000-8000-000000000001",
	}
	// A sort field no list allows.
	unknownSort = "zz_not_a_field"
)

// --- The test ------------------------------------------------------------------------------------

func TestListLimitsAndSorts(t *testing.T) {
	files, err := filepath.Glob(docGlob)
	if err != nil || len(files) == 0 {
		t.Fatalf("no OpenAPI document matches %s: set docGlob", docGlob)
	}
	for _, file := range files {
		surface := strings.TrimSuffix(filepath.Base(file), ".openapi.json")
		d := loadDoc(t, file)
		h, header := newListServer(t, surface)
		for _, o := range d.operations() {
			if !d.isList(o) {
				continue
			}
			t.Run(surface+" "+o.id, func(t *testing.T) {
				path, ok := fillPath(t, o.path)
				if !ok {
					return
				}
				maximum, hasSort := -1, false
				for _, p := range o.params {
					s, _ := d.resolve(p.schema)
					if p.in == "query" && p.name == "limit" {
						if m, ok := s["maximum"].(float64); ok {
							maximum = int(m)
						}
					}
					hasSort = hasSort || (p.in == "query" && p.name == "sort")
				}

				if maximum >= 0 {
					limit := max(100000, maximum*10)
					rec := get(h, header, path+"?limit="+strconv.Itoa(limit))
					if rec.Code != http.StatusOK {
						t.Errorf("%s ?limit=%d answered %d: clamp a limit above the maximum (%d) instead of refusing it (rule contract-cap-limit-whitelist-sort)",
							o.id, limit, rec.Code, maximum)
					} else {
						var body struct {
							Data []json.RawMessage `json:"data"`
						}
						if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
							t.Fatalf("%s: reply isn't the envelope: %v", o.id, err)
						}
						switch n := len(body.Data); {
						case n > maximum:
							t.Errorf("%s ?limit=%d answered %d rows, more than the documented maximum %d: clamp limit in the handler (rule contract-cap-limit-whitelist-sort)",
								o.id, limit, n, maximum)
						case n < maximum:
							t.Logf("%s: only %d rows seeded, below the maximum %d, so the clamp itself isn't proved", o.id, n, maximum)
						}
					}
				}

				if hasSort {
					rec := get(h, header, path+"?sort="+unknownSort)
					if rec.Code != http.StatusBadRequest && rec.Code != http.StatusUnprocessableEntity {
						t.Errorf("%s ?sort=%s answered %d, want 400 or 422: look the sort key up in the operation's allow-list before it reaches SQL (rule contract-cap-limit-whitelist-sort)",
							o.id, unknownSort, rec.Code)
					}
				}
			})
		}
	}
}

func fillPath(t *testing.T, path string) (string, bool) {
	t.Helper()
	ok := true
	for {
		i := strings.Index(path, "{")
		j := strings.Index(path, "}")
		if i < 0 || j < i {
			return path, ok
		}
		name := path[i+1 : j]
		v, found := listPathValues[name]
		if !found {
			t.Errorf("no value for {%s}: add one to listPathValues", name)
			ok = false
			v = "missing"
		}
		path = path[:i] + v + path[j+1:]
	}
}

func get(h http.Handler, header http.Header, target string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, listPrefix+target, nil)
	for k, vs := range header {
		req.Header[k] = vs
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}
