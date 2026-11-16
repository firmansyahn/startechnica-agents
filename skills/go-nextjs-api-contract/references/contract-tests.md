# Contract tests

A generated document proves the types were declared; these tests prove the code sends and accepts what the document says.

## Backend (Go)

**1. The document is current** (the `TestOpenAPI` test in [document.md](document.md)): regenerate in memory, compare to the committed file, fail with the command to run.

**2. Every route is documented, every documented operation is routed:**

```go
func TestEveryRouteIsDocumented(t *testing.T) {
	doc := loadDoc(t, "console")
	for _, r := range consoleRoutes() {
		if doc.Operation(r.Method, r.Path) == nil {
			t.Errorf("%s %s has no operation in api/console.openapi.json", r.Method, r.Path)
		}
	}
	for _, op := range doc.Operations() {
		if !routed(op.Method, op.Path) {
			t.Errorf("%s %s is documented but not routed", op.Method, op.Path)
		}
	}
}
```

**3. Handler replies match their schema.** A shared test helper validates any recorded reply against the operation's schema for its status, so every existing handler test checks the contract for free:

```go
rec := httptest.NewRecorder()
srv.ServeHTTP(rec, httptest.NewRequest("GET", "/items?limit=2", nil))
contract.Check(t, doc, "GET", "/items", rec)   // status declared? body matches the schema for that status? envelope present?
```

- Use a JSON Schema 2020-12 validator (3.1 schemas are 2020-12) in the helper; compile each operation's schema once per test binary.
- Check refusals too: a 422 test asserts the `errors` paths (`rules.2.value`), a 404 test asserts the envelope, a guard 401 test asserts `WWW-Authenticate`.
- Database-backed handler tests run on real PostgreSQL ([go-testing](../../go-testing/SKILL.md)), so the reply reflects real column types (a `NULL` that the schema says can't be null fails here).

**4. Requests the document allows are accepted.** For write operations, a test sends the documented example (or a minimal valid body built from the schema) and expects a non-400. This catches a handler that requires a field the document marks optional.

## Frontend (TypeScript)

**1. Types are current:** `yarn gen:api --check` in CI, then `yarn tsc --noEmit`.

**2. Fixtures pass the reply check.** The test network fake (`fakeApi`) runs every answer through the same validator the BFF uses (`src/api/validate.ts`, [nextjs-bff](../../nextjs-bff/SKILL.md)) and fails the test on a mismatch, so a fixture the backend could never send can't make a test pass:

```ts
const calls = fakeApi({
  "PATCH items/42": { status: 200, body: { status: "success", message: "", data: item({ name: "North" }) } },
  "PATCH items/43": { status: 422, body: { status: "failed", message: "Check the fields", errors: { name: ["Already taken"] } } },
});
```

- Build fixtures from typed factories (`item(overrides): components["schemas"]["Item"]`), so a renamed field is a type error in the fixture too.
- One factory per schema in `tests/fixtures/` (or the section's `_shared/testkit.tsx`); never a hand-typed object literal per test.

**3. Requests match the document.** The fake also checks the request: the path exists in the document for that method, the query parameters are declared, the body passes the operation's request schema. A test that sends `categoryId` instead of `category_id` fails here, not in production.

## End to end

A short Playwright run against the real backend (seeded test database) on the main branch catches what both sides' fakes agree on wrongly: auth headers, the scope header, real error messages. Keep it to the critical paths; the contract tests above carry the breadth.

## CI order

1. Backend: `go test ./...` (document current, routes documented, replies valid; with [assets/openapi_rules_test.go](../assets/openapi_rules_test.go) and [assets/openapi_lists_test.go](../assets/openapi_lists_test.go), the document's own rules and the list limits).
2. Frontend: `yarn gen:api --check`, `yarn tsc --noEmit`, `yarn vitest run` (fixtures and requests valid).
3. Merge requests: [assets/ci/openapi-breaking.sh](../assets/ci/openapi-breaking.sh) compares each document with the target branch's through `oasdiff breaking` and fails on an undeprecated removal, a removed response field, a type change or a changed operation id; accepted breaks go in `api/breaking-ignore.txt`. On GitLab:

```yaml
api:breaking:
  stage: test
  image: golang:<version>
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes: [api/*.openapi.json]
  script:
    - go install github.com/oasdiff/oasdiff@<version>
    - git fetch --depth=1 origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
    - bash ci/openapi-breaking.sh "origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME" api
```
