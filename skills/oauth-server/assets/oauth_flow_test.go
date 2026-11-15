package oauth // ADJUST: the package of the authorization server's HTTP tests

// oauth_flow_test.go: oauth-server rules checked over real flows through the whole server: authorize with PKCE,
// sign-in, code exchange, refresh, revocation, and the refusals.
//
// Enforces (exact for the paths these flows run):
//   oauth-never-log-credentials   nothing logged during the flows (request logs and the access log included) holds
//                                 a code, an access or refresh token, the client secret, a PKCE verifier or the
//                                 password, including the wrong ones the refusal cases send
//   oauth-one-verifier            on every API surface a live token is accepted, and a revoked token, one from an
//                                 ended session or a disabled client, an unknown one and none at all are refused
//                                 with the same 401 and WWW-Authenticate: Bearer resource_metadata="..."
//   oauth-opaque-hashed-tokens    no stored row holds an issued code, token or the client secret in clear, and the
//                                 tokens carry the app's prefixes
//
// Misses: log lines written outside Logs (a proxy's access log), flows not run here (client credentials, consent
// denied, the error pages: add cases), surfaces missing from Surfaces, storage outside Rows, and whether the
// generator uses crypto/rand (golangci-lint gosec G404; scripts/scan.sh).
//
// ADJUST: the project writes newFlowHarness in its own _test.go file in this package:
//
//	func newFlowHarness(t *testing.T) *flowHarness
//
// It builds the server as in production over a fresh test database, with a registered client and user, and
// returns the hooks below. Each test calls it once per case, so a case may disable the client. Standard library
// only, Go 1.24 or later; dumpRows at the bottom helps with Rows.

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// --- Settings ------------------------------------------------------------------------------------

const (
	authorizePath = "/oauth2/authorize" // ADJUST
	tokenPath     = "/oauth2/token"     // ADJUST
	revokePath    = "/oauth2/revoke"    // ADJUST
)

// flowHarness is what the project provides (newFlowHarness).
type flowHarness struct {
	// The whole server: /oauth2/*, the sign-in and consent pages, every API surface, with request logging and the
	// access log on, as in production.
	Handler http.Handler
	// Everything logged since the harness was built, as text: point the logger and the access log at a buffer.
	Logs func() string

	// A registered confidential client (client_secret_basic) allowed refresh tokens and every surface's resource.
	ClientID, ClientSecret, RedirectURI, Scope string
	// The test user's password, the one SignIn types.
	Password string
	// SignIn takes an authorize URL (path and query), drives the sign-in and consent pages through Handler as a new
	// browser would, and returns the final redirect to RedirectURI (with code and state).
	SignIn func(t *testing.T, authorizeURL string) *url.URL

	// One operation on each API surface (from the route table) and the resource its tokens are issued for.
	Surfaces []surface
	// Optional cases; nil skips one. EndSession ends the sign-in session that produced the access token (sign-out);
	// DisableClient disables the registered client.
	EndSession    func(t *testing.T, accessToken string)
	DisableClient func(t *testing.T)

	// Every value of every row of the token, code, grant, session and client tables, as text (see dumpRows).
	Rows func(t *testing.T) []string
	// The prefixes of issued access and refresh tokens ("<app>_at_", "<app>_rt_"); "" skips that check.
	AccessPrefix, RefreshPrefix string
}

type surface struct{ Name, Method, Path, Resource string }

// --- The tests -----------------------------------------------------------------------------------

func TestOAuthNoCredentialsInLogs(t *testing.T) {
	h := newFlowHarness(t)
	resource := h.Surfaces[0].Resource
	f := runFlow(t, h, resource)
	access2, refresh2 := refresh(t, h, f.refresh, resource)
	call(h, h.Surfaces[0], access2) // the API's access log sees the Authorization header
	revoke(t, h, refresh2, "refresh_token")

	// Refusals log too: a reused code, a wrong verifier, a wrong client secret.
	expectStatus(t, "reused code", tokenRequest(h, h.ClientSecret, url.Values{
		"grant_type": {"authorization_code"}, "code": {f.code}, "redirect_uri": {h.RedirectURI}, "code_verifier": {f.verifier},
	}), http.StatusBadRequest)
	g := authorize(t, h, resource)
	wrongVerifier := newSecret()
	expectStatus(t, "wrong verifier", tokenRequest(h, h.ClientSecret, url.Values{
		"grant_type": {"authorization_code"}, "code": {g.code}, "redirect_uri": {h.RedirectURI}, "code_verifier": {wrongVerifier},
	}), http.StatusBadRequest)
	wrongSecret := newSecret()
	expectStatus(t, "wrong client secret", tokenRequest(h, wrongSecret, url.Values{
		"grant_type": {"refresh_token"}, "refresh_token": {f.refresh},
	}), http.StatusUnauthorized)

	logs := h.Logs()
	if strings.TrimSpace(logs) == "" {
		t.Fatal("Logs returned nothing: point the logger and the access log at the buffer Logs reads")
	}
	for name, secret := range map[string]string{
		"authorization code": f.code, "second authorization code": g.code,
		"access token": f.access, "refreshed access token": access2,
		"refresh token": f.refresh, "rotated refresh token": refresh2,
		"client secret": h.ClientSecret, "wrong client secret": wrongSecret,
		"PKCE verifier": f.verifier, "wrong PKCE verifier": wrongVerifier,
		"password": h.Password,
	} {
		for _, form := range []string{secret, url.QueryEscape(secret)} {
			if line, ok := lineWith(logs, form); ok {
				t.Errorf("the %s is in the logs: %q\n    log client, subject, grant, result and request id only; drop the form, query or body (rule oauth-never-log-credentials)",
					name, line)
				break
			}
		}
	}
}

func TestOAuthOneVerifierEverySurface(t *testing.T) {
	cases := []struct {
		name  string
		end   func(t *testing.T, h *flowHarness, tokens []string)
		check func(h *flowHarness) bool
	}{
		{"revoked", func(t *testing.T, h *flowHarness, tokens []string) {
			for _, tok := range tokens {
				revoke(t, h, tok, "access_token")
			}
		}, func(*flowHarness) bool { return true }},
		{"session ended", func(t *testing.T, h *flowHarness, tokens []string) {
			for _, tok := range tokens {
				h.EndSession(t, tok)
			}
		}, func(h *flowHarness) bool { return h.EndSession != nil }},
		{"client disabled", func(t *testing.T, h *flowHarness, _ []string) { h.DisableClient(t) },
			func(h *flowHarness) bool { return h.DisableClient != nil }},
	}
	refusals := map[string]string{} // surface → the WWW-Authenticate of its first token refusal
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := newFlowHarness(t)
			if !c.check(h) {
				t.Skipf("no hook for %q in the harness", c.name)
			}
			var tokens []string
			for _, s := range h.Surfaces {
				tok := runFlow(t, h, s.Resource).access
				if rec := call(h, s, tok); rec.Code == http.StatusUnauthorized {
					t.Fatalf("%s refuses a live token for %s: fix the harness or the verifier", s.Name, s.Resource)
				}
				tokens = append(tokens, tok)
			}
			c.end(t, h, tokens)
			for i, s := range h.Surfaces {
				expectRefused(t, s, call(h, s, tokens[i]), c.name, refusals)
			}
		})
	}
	t.Run("unknown token", func(t *testing.T) {
		h := newFlowHarness(t)
		for _, s := range h.Surfaces {
			expectRefused(t, s, call(h, s, h.AccessPrefix+newSecret()), "unknown token", refusals)
		}
	})
	t.Run("no token", func(t *testing.T) {
		h := newFlowHarness(t)
		for _, s := range h.Surfaces {
			expectRefused(t, s, call(h, s, ""), "no token", nil) // RFC 6750: no error code without a token, so not compared
		}
	})
}

func TestOAuthTokensStoredHashed(t *testing.T) {
	h := newFlowHarness(t)
	resource := h.Surfaces[0].Resource
	f := runFlow(t, h, resource)
	access2, refresh2 := refresh(t, h, f.refresh, resource)

	rows := h.Rows(t)
	if len(rows) == 0 {
		t.Fatal("Rows returned nothing: dump the token, code, grant, session and client tables")
	}
	for name, secret := range map[string]string{
		"authorization code": f.code, "access token": f.access, "refresh token": f.refresh,
		"refreshed access token": access2, "rotated refresh token": refresh2, "client secret": h.ClientSecret,
	} {
		for _, v := range rows {
			if strings.Contains(v, secret) {
				t.Errorf("the %s is stored in clear (%.60q): store only its SHA-256 (rule oauth-opaque-hashed-tokens)", name, v)
				break
			}
		}
	}
	for _, tc := range []struct{ name, token, prefix string }{
		{"access token", f.access, h.AccessPrefix}, {"refreshed access token", access2, h.AccessPrefix},
		{"refresh token", f.refresh, h.RefreshPrefix}, {"rotated refresh token", refresh2, h.RefreshPrefix},
	} {
		if tc.prefix != "" && !strings.HasPrefix(tc.token, tc.prefix) {
			t.Errorf("the %s %.12q... lacks the prefix %q that secret scanners know (rule oauth-opaque-hashed-tokens)", tc.name, tc.token, tc.prefix)
		}
	}
}

// --- The flow ------------------------------------------------------------------------------------

type issued struct{ code, verifier, access, refresh string }

// authorize runs the authorization request through sign-in and returns the code and its verifier.
func authorize(t *testing.T, h *flowHarness, resource string) issued {
	t.Helper()
	verifier, state := newSecret(), newSecret()
	sum := sha256.Sum256([]byte(verifier))
	q := url.Values{
		"response_type": {"code"}, "client_id": {h.ClientID}, "redirect_uri": {h.RedirectURI}, "scope": {h.Scope},
		"state": {state}, "code_challenge": {base64.RawURLEncoding.EncodeToString(sum[:])},
		"code_challenge_method": {"S256"}, "resource": {resource},
	}
	back := h.SignIn(t, authorizePath+"?"+q.Encode())
	if back == nil || back.Query().Get("state") != state || back.Query().Get("code") == "" {
		t.Fatalf("SignIn returned %v: want the redirect to %s with the code and state %q", back, h.RedirectURI, state)
	}
	return issued{code: back.Query().Get("code"), verifier: verifier}
}

// runFlow authorizes and exchanges the code: code, verifier, access and refresh token.
func runFlow(t *testing.T, h *flowHarness, resource string) issued {
	t.Helper()
	f := authorize(t, h, resource)
	rec := tokenRequest(h, h.ClientSecret, url.Values{
		"grant_type": {"authorization_code"}, "code": {f.code}, "redirect_uri": {h.RedirectURI},
		"code_verifier": {f.verifier}, "resource": {resource},
	})
	f.access, f.refresh = tokens(t, "code exchange", rec)
	return f
}

func refresh(t *testing.T, h *flowHarness, refreshToken, resource string) (string, string) {
	t.Helper()
	rec := tokenRequest(h, h.ClientSecret, url.Values{
		"grant_type": {"refresh_token"}, "refresh_token": {refreshToken}, "resource": {resource},
	})
	return tokens(t, "refresh", rec)
}

func revoke(t *testing.T, h *flowHarness, token, hint string) {
	t.Helper()
	rec := post(h, revokePath, h.ClientSecret, url.Values{"token": {token}, "token_type_hint": {hint}})
	if rec.Code != http.StatusOK {
		t.Fatalf("revoke answered %d: %s", rec.Code, rec.Body)
	}
}

func tokenRequest(h *flowHarness, secret string, form url.Values) *httptest.ResponseRecorder {
	return post(h, tokenPath, secret, form)
}

func post(h *flowHarness, path, secret string, form url.Values) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(url.QueryEscape(h.ClientID), url.QueryEscape(secret))
	rec := httptest.NewRecorder()
	h.Handler.ServeHTTP(rec, req)
	return rec
}

func tokens(t *testing.T, step string, rec *httptest.ResponseRecorder) (string, string) {
	t.Helper()
	var body struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &body) != nil || body.AccessToken == "" || body.RefreshToken == "" {
		t.Fatalf("%s answered %d %s: want 200 with an access and a refresh token", step, rec.Code, rec.Body)
	}
	return body.AccessToken, body.RefreshToken
}

func expectStatus(t *testing.T, step string, rec *httptest.ResponseRecorder, want int) {
	t.Helper()
	if rec.Code != want {
		t.Errorf("%s answered %d, want %d: %s", step, rec.Code, want, rec.Body)
	}
}

func call(h *flowHarness, s surface, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(s.Method, s.Path, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.Handler.ServeHTTP(rec, req)
	return rec
}

// expectRefused: a 401 with WWW-Authenticate: Bearer resource_metadata="...", the same for every refused token on
// that surface (refusals, keyed by surface; nil doesn't compare).
func expectRefused(t *testing.T, s surface, rec *httptest.ResponseRecorder, why string, refusals map[string]string) {
	t.Helper()
	got := rec.Header().Get("WWW-Authenticate")
	if rec.Code != http.StatusUnauthorized || !strings.HasPrefix(got, "Bearer ") || !strings.Contains(got, `resource_metadata="`) {
		t.Errorf("%s %s (%s) answered %d, WWW-Authenticate %q: want 401 with Bearer resource_metadata=\"<url>\" from the one verifier every surface calls (rule oauth-one-verifier)",
			s.Method, s.Path, why, rec.Code, got)
		return
	}
	if refusals == nil {
		return
	}
	if first, ok := refusals[s.Name]; !ok {
		refusals[s.Name] = got
	} else if got != first {
		t.Errorf("%s answers WWW-Authenticate %q (%s) but %q to another refused token: every refusal answers the same (rule oauth-one-verifier)",
			s.Name, got, why, first)
	}
}

// --- Helpers -------------------------------------------------------------------------------------

func newSecret() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func lineWith(text, s string) (string, bool) {
	for _, line := range strings.Split(text, "\n") {
		if strings.Contains(line, s) {
			return line, true
		}
	}
	return "", false
}

// dumpRows reads every column of every row of the tables as text, for flowHarness.Rows.
func dumpRows(t *testing.T, db *sql.DB, tables ...string) []string {
	t.Helper()
	var out []string
	for _, table := range tables {
		out = append(out, dumpTable(t, db, table)...)
	}
	return out
}

func dumpTable(t *testing.T, db *sql.DB, table string) []string {
	t.Helper()
	rows, err := db.QueryContext(t.Context(), "SELECT * FROM "+table) //nolint:gosec // the test's own table names
	if err != nil {
		t.Fatalf("dump %s: %v", table, err)
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		t.Fatal(err)
	}
	vals := make([]any, len(cols))
	ptrs := make([]any, len(cols))
	for i := range vals {
		ptrs[i] = &vals[i]
	}
	var out []string
	for rows.Next() {
		if err := rows.Scan(ptrs...); err != nil {
			t.Fatal(err)
		}
		for _, v := range vals {
			if b, ok := v.([]byte); ok {
				out = append(out, string(b))
				continue
			}
			out = append(out, fmt.Sprint(v))
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}
