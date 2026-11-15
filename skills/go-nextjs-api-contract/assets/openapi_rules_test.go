package app // ADJUST: the package that holds TestOpenAPI (references/document.md)

// openapi_rules_test.go: the go-nextjs-api-contract rules the OpenAPI document itself can prove, checked by
// walking every api/<surface>.openapi.json. One test, one subtest per rule and surface
// (go test -run 'TestOpenAPIRules/contract-scope-header').
//
// Enforces (exact for what the document states):
//   contract-scope-header                 no tenant/workspace query, path or cookie parameter or request-body field;
//                                         the scope header is only ever the one shared components/parameters entry
//   contract-list-parameters              a GET whose 200 reply has a "data" array takes offset, limit and sort, none
//                                         of page/pageSize/orderBy/filter/search/count, and answers a required integer
//                                         total (a cursor list, with "after", takes limit and no offset or total)
//   contract-cap-limit-whitelist-sort     every limit parameter has a maximum, every sort parameter an enum
//   contract-rfc3339-utc-times            properties and query parameters named *_at, *_date, *_time, expires,
//                                         timestamp, date, time are strings with format date-time or date
//   contract-doc-stable-operation-ids     every operation has an explicit, unique verb+Resource operationId
//                                         (listItems) that isn't a handler's Go name (handlerNames)
//   contract-snake-case-names             every property and query parameter name is snake_case
//   contract-opaque-encoded-ids           every path parameter and every id / *_id property is a string
//   contract-doc-shared-failure-response  every 4xx, 5xx and default response is a $ref to the shared Failure
//
// Misses: what the handlers really do (the reply check in references/contract-tests.md, and
// openapi_lists_test.go for the limit clamp and the sort whitelist), time and id fields named outside the
// convention, and anything a schema reaches only through an external $ref.
//
// Copy it next to TestOpenAPI, set the package and the settings below. Standard library only, Go 1.22 or later.
// A finding names the document, the place in it (method, path, status, property path) and what to change in the
// Go route table or type it is generated from.

import (
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// --- Settings ------------------------------------------------------------------------------------

var (
	// The documents, relative to this package's folder.
	docGlob = filepath.Join("..", "..", "api", "*.openapi.json") // ADJUST

	// The shared scope header: components/parameters/<scopeParam>, in: header. "" for an API without one.
	scopeParam = "TenantID" // ADJUST
	// Names a scope must not travel under outside that header (query, path, cookie, request body).
	scopeNames = regexp.MustCompile(`(?i)^(tenant|workspace)([_-]?id)?$`)
	// Header names that are the scope, so an inline header parameter with one of them is reported.
	scopeHeaders = regexp.MustCompile(`(?i)^(x-)?(tenant|workspace)(-?id)?$`)

	timeNames   = regexp.MustCompile(`(_at|_date|_time)$|^(expires|timestamp|date|time)$`)
	listBanned  = regexp.MustCompile(`^(page|page_size|pageSize|per_page|perPage|order_by|orderBy|order_dir|orderDir|filter|search|count)$`)
	snakeCase   = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
	idNames     = regexp.MustCompile(`^(id|[a-z0-9_]+_id)$`)
	operationID = regexp.MustCompile(`^[a-z]+[A-Z][A-Za-z0-9]*$`) // verb + Resource: listItems, archiveItem

	// The shared refusal every 4xx/5xx response points at. "" skips contract-doc-shared-failure-response.
	failureRef = "#/components/responses/Failure"

	// The Go names of the route table's handlers, so an operationId copied from one is reported. nil skips it.
	// For example: for each route, runtime.FuncForPC(reflect.ValueOf(r.Handler).Pointer()).Name(), last part.
	handlerNames func() []string // ADJUST (optional)
)

// Accepted exceptions. Where is "<surface> <place>" exactly as a finding prints it. An entry that matches
// nothing fails the test, so the list only holds what is still true.
type allowed struct{ Rule, Where, Reason string }

var allow = []allowed{
	// {Rule: "contract-scope-header", Where: "console POST /admin/items/{id}/move body.tenant_id", Reason: "an admin moves the item to another tenant"},
}

// --- The test ------------------------------------------------------------------------------------

var ruleIDs = []string{
	"contract-scope-header",
	"contract-list-parameters",
	"contract-cap-limit-whitelist-sort",
	"contract-rfc3339-utc-times",
	"contract-doc-stable-operation-ids",
	"contract-snake-case-names",
	"contract-opaque-encoded-ids",
	"contract-doc-shared-failure-response",
}

func TestOpenAPIRules(t *testing.T) {
	files, err := filepath.Glob(docGlob)
	if err != nil || len(files) == 0 {
		t.Fatalf("no OpenAPI document matches %s: set docGlob", docGlob)
	}
	used := map[int]bool{}
	for _, file := range files {
		surface := strings.TrimSuffix(filepath.Base(file), ".openapi.json")
		d := loadDoc(t, file)
		found := map[string][]finding{}
		for _, f := range d.check() {
			found[f.rule] = append(found[f.rule], f)
		}
		for _, rule := range ruleIDs {
			t.Run(rule+"/"+surface, func(t *testing.T) {
				for _, f := range found[rule] {
					where := surface + " " + f.where
					if i := allowedAt(rule, where); i >= 0 {
						used[i] = true
						continue
					}
					t.Errorf("%s: %s\n    %s (rule %s)\n    or accept it: {Rule: %q, Where: %q, Reason: \"...\"}",
						file, f.where, f.fix, rule, rule, where)
				}
			})
		}
	}
	if f := flag.Lookup("test.run"); f != nil && f.Value.String() != "" {
		return // a filtered run can't tell a stale entry from one it didn't reach
	}
	for i, a := range allow {
		if !used[i] {
			t.Errorf("allow entry {Rule: %q, Where: %q} matches nothing any more: remove it", a.Rule, a.Where)
		}
	}
}

func allowedAt(rule, where string) int {
	for i, a := range allow {
		if a.Rule == rule && a.Where == where {
			return i
		}
	}
	return -1
}

type finding struct{ rule, where, fix string }

func (d *doc) check() []finding {
	var out []finding
	add := func(rule, where, fix string) { out = append(out, finding{rule, where, fix}) }
	ops := d.operations()

	// Every property of every schema, once: components, then the inline schemas of each operation.
	type prop struct {
		where, name string
		s           node
	}
	var props []prop
	collect := func(at string, s node) {
		d.props(s, at, false, nil, func(at, name string, p node) { props = append(props, prop{at + "." + name, name, p}) })
	}
	comps := obj(d.root["components"])
	for _, kind := range []string{"schemas", "requestBodies", "responses"} {
		m := obj(comps[kind])
		for _, name := range sortedKeys(m) {
			at := "components." + kind + "." + name
			if kind == "schemas" {
				collect(at, obj(m[name]))
				continue
			}
			for _, s := range contentSchemas(obj(m[name])) {
				collect(at, s)
			}
		}
	}
	for _, o := range ops {
		if b := obj(o.op["requestBody"]); b != nil && b["$ref"] == nil {
			for _, s := range contentSchemas(b) {
				collect(o.id+" body", s)
			}
		}
		resps := obj(o.op["responses"])
		for _, code := range sortedKeys(resps) {
			if r := obj(resps[code]); r != nil && r["$ref"] == nil {
				for _, s := range contentSchemas(r) {
					collect(o.id+" "+code, s)
				}
			}
		}
	}

	// contract-scope-header
	scopeHeader := ""
	if scopeParam != "" {
		p := obj(obj(comps["parameters"])[scopeParam])
		scopeHeader, _ = p["name"].(string)
		if p == nil || p["in"] != "header" || scopeHeader == "" {
			add("contract-scope-header", "components.parameters."+scopeParam,
				"declare the scope once as a header parameter here (or set scopeParam to its name)")
		}
		for _, name := range sortedKeys(obj(comps["parameters"])) {
			p := obj(obj(comps["parameters"])[name])
			if name != scopeParam && p["in"] == "header" && isScopeHeader(str(p["name"]), scopeHeader) {
				add("contract-scope-header", "components.parameters."+name,
					"a second definition of the scope header: reference components/parameters/"+scopeParam+" instead")
			}
		}
	}
	for _, o := range ops {
		for _, p := range o.params {
			switch {
			case p.in != "header" && scopeNames.MatchString(p.name):
				add("contract-scope-header", o.id+" "+p.in+"."+p.name,
					"take the scope from the shared header parameter, not the "+p.in)
			case p.in == "header" && isScopeHeader(p.name, scopeHeader) && p.ref != "#/components/parameters/"+scopeParam:
				add("contract-scope-header", o.id+" header."+p.name,
					"reference the shared parameter ($ref: #/components/parameters/"+scopeParam+") instead of declaring the header here")
			}
		}
		if b := obj(o.op["requestBody"]); b != nil {
			b, _ = d.resolve(b)
			seen := map[string]bool{}
			for _, s := range contentSchemas(b) {
				d.props(s, "body", true, seen, func(at, name string, _ node) {
					if scopeNames.MatchString(name) {
						add("contract-scope-header", o.id+" "+at+"."+name,
							"drop the scope from the request type; the handler reads it from the scope header")
					}
				})
			}
		}
	}

	// contract-list-parameters
	for _, o := range ops {
		if !d.isList(o) {
			continue
		}
		fields, required := d.objectProps(d.jsonSchema(obj(obj(o.op["responses"])["200"])))
		query := map[string]bool{}
		for _, p := range o.params {
			if p.in == "query" {
				query[p.name] = true
				if listBanned.MatchString(p.name) {
					add("contract-list-parameters", o.id+" query."+p.name,
						"use the list parameters offset, limit, sort, q and one parameter per filter field")
				}
			}
		}
		cursor := query["after"]
		want := []string{"limit"}
		if !cursor {
			want = append(want, "offset", "sort")
		} else if query["offset"] {
			add("contract-list-parameters", o.id+" query.offset", "a cursor list (after) takes no offset: use one kind of pagination")
		}
		for _, name := range want {
			if !query[name] {
				add("contract-list-parameters", o.id+" query."+name, "add the "+name+" query parameter to the list's query type")
			}
		}
		if !cursor && (!hasType(d, fields["total"], "integer") || !required["total"]) {
			add("contract-list-parameters", o.id+" 200.total",
				"answer the page envelope (httpx.Page): a required integer total beside data")
		}
	}

	// contract-cap-limit-whitelist-sort
	for _, o := range ops {
		for _, p := range o.params {
			if p.in != "query" {
				continue
			}
			s, _ := d.resolve(p.schema)
			items, _ := d.resolve(obj(s["items"]))
			switch {
			case p.name == "limit" && s["maximum"] == nil:
				add("contract-cap-limit-whitelist-sort", o.id+" query.limit",
					"declare the server's cap as the parameter's maximum (and clamp to it in the handler)")
			case p.name == "sort" && len(arr(s["enum"])) == 0 && len(arr(items["enum"])) == 0:
				add("contract-cap-limit-whitelist-sort", o.id+" query.sort",
					"list the sortable fields as the parameter's enum (and map them to SQL through the same list)")
			}
		}
	}

	// contract-rfc3339-utc-times
	timeFix := func(where string, s node) {
		types, format := d.types(s)
		if !contains(types, "string") || contains(types, "integer") || contains(types, "number") ||
			(format != "date-time" && format != "date") {
			add("contract-rfc3339-utc-times", where,
				"make it a time.Time (format date-time, sent in UTC) or a calendar date (format date), never a number or a free string")
		}
	}
	for _, p := range props {
		if timeNames.MatchString(p.name) {
			timeFix(p.where, p.s)
		}
	}
	for _, o := range ops {
		for _, p := range o.params {
			if p.in == "query" && timeNames.MatchString(p.name) {
				timeFix(o.id+" query."+p.name, p.schema)
			}
		}
	}

	// contract-doc-stable-operation-ids
	handlers := map[string]bool{}
	if handlerNames != nil {
		for _, h := range handlerNames() {
			handlers[strings.ToLower(h)] = true
		}
	}
	ids := map[string]string{}
	for _, o := range ops {
		id, _ := o.op["operationId"].(string)
		switch {
		case id == "":
			add("contract-doc-stable-operation-ids", o.id+" operationId", "set an explicit operationId: verb + resource (listItems, patchItem)")
		case !operationID.MatchString(id):
			add("contract-doc-stable-operation-ids", o.id+" operationId "+id, "name it verb + resource in lowerCamelCase (listItems, patchItem)")
		case handlers[strings.ToLower(id)]:
			add("contract-doc-stable-operation-ids", o.id+" operationId "+id, "it is a handler's Go name; set an explicit verb + resource name that survives a refactor")
		}
		if other, dup := ids[id]; dup && id != "" {
			add("contract-doc-stable-operation-ids", o.id+" operationId "+id, "already used by "+other+": operation ids are unique")
		}
		ids[id] = o.id
	}

	// contract-snake-case-names
	for _, p := range props {
		if !snakeCase.MatchString(p.name) {
			add("contract-snake-case-names", p.where, "rename the json tag to snake_case")
		}
	}
	for _, o := range ops {
		for _, p := range o.params {
			if p.in == "query" && !snakeCase.MatchString(p.name) {
				add("contract-snake-case-names", o.id+" query."+p.name, "rename the query parameter to snake_case")
			}
		}
	}

	// contract-opaque-encoded-ids
	idFix := func(where string, s node) {
		types, _ := d.types(s)
		if !contains(types, "string") || contains(types, "integer") || contains(types, "number") {
			add("contract-opaque-encoded-ids", where, "send the id as a string (`json:\",string\"` on an integer column), never a number")
		}
	}
	for _, p := range props {
		if idNames.MatchString(p.name) {
			idFix(p.where, p.s)
		}
	}
	for _, o := range ops {
		for _, p := range o.params {
			if p.in == "path" {
				idFix(o.id+" path."+p.name, p.schema)
			}
		}
	}

	// contract-doc-shared-failure-response
	if failureRef != "" {
		for _, o := range ops {
			resps := obj(o.op["responses"])
			for _, code := range sortedKeys(resps) {
				if (code[0] == '4' || code[0] == '5' || code == "default") && obj(resps[code])["$ref"] != failureRef {
					add("contract-doc-shared-failure-response", o.id+" "+code,
						"point the refusal at "+failureRef+" (the route's Errors list), not an inline response")
				}
			}
		}
	}
	return out
}

func isScopeHeader(name, shared string) bool {
	return scopeHeaders.MatchString(name) || (shared != "" && strings.EqualFold(name, shared))
}

// --- Walking the document ------------------------------------------------------------------------

type node = map[string]any

type doc struct{ root node }

func loadDoc(t *testing.T, file string) *doc {
	t.Helper()
	b, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	var root node
	if err := json.Unmarshal(b, &root); err != nil {
		t.Fatalf("%s: %v", file, err)
	}
	return &doc{root}
}

type param struct {
	name, in, ref string
	schema        node
}

type operation struct {
	method, path, id string // id: "GET /items"
	op               node
	params           []param
}

var methods = []string{"get", "put", "post", "delete", "options", "head", "patch", "trace"}

// operations lists every operation with its parameters resolved, path-level ones merged in.
func (d *doc) operations() []operation {
	var out []operation
	paths := obj(d.root["paths"])
	for _, path := range sortedKeys(paths) {
		item := obj(paths[path])
		for _, m := range methods {
			op := obj(item[m])
			if op == nil {
				continue
			}
			o := operation{method: m, path: path, id: strings.ToUpper(m) + " " + path, op: op}
			index := map[string]int{}
			for _, list := range []any{item["parameters"], op["parameters"]} {
				for _, raw := range arr(list) {
					p, ref := d.resolve(obj(raw))
					pp := param{name: str(p["name"]), in: str(p["in"]), ref: ref, schema: obj(p["schema"])}
					if i, ok := index[pp.in+" "+pp.name]; ok {
						o.params[i] = pp
						continue
					}
					index[pp.in+" "+pp.name] = len(o.params)
					o.params = append(o.params, pp)
				}
			}
			out = append(out, o)
		}
	}
	return out
}

// resolve follows $ref (local "#/..." pointers only); it also returns the first $ref it followed.
func (d *doc) resolve(n node) (node, string) {
	first := ""
	for range 32 {
		ref, ok := n["$ref"].(string)
		if !ok {
			return n, first
		}
		if first == "" {
			first = ref
		}
		n = d.pointer(ref)
	}
	return n, first
}

func (d *doc) pointer(ref string) node {
	if !strings.HasPrefix(ref, "#/") {
		return nil
	}
	var cur any = d.root
	for _, part := range strings.Split(ref[2:], "/") {
		part = strings.ReplaceAll(strings.ReplaceAll(part, "~1", "/"), "~0", "~")
		m, ok := cur.(map[string]any)
		if !ok {
			return nil
		}
		cur = m[part]
	}
	return obj(cur)
}

// props calls fn for every property of s and of the schemas nested in it (items, allOf/anyOf/oneOf,
// additionalProperties), with the dotted path to it. With follow, it also walks into $ref'd schemas, once
// each per seen set; without, a $ref is left to the walk over components.
func (d *doc) props(s node, at string, follow bool, seen map[string]bool, fn func(at, name string, p node)) {
	if s == nil {
		return
	}
	if ref, ok := s["$ref"].(string); ok {
		if !follow || seen[ref] {
			return
		}
		seen[ref] = true
		s, _ = d.resolve(s)
	}
	ps := obj(s["properties"])
	for _, name := range sortedKeys(ps) {
		fn(at, name, obj(ps[name]))
		d.props(obj(ps[name]), at+"."+name, follow, seen, fn)
	}
	d.props(obj(s["items"]), at+"[]", follow, seen, fn)
	d.props(obj(s["additionalProperties"]), at+".*", follow, seen, fn)
	for _, k := range []string{"allOf", "anyOf", "oneOf"} {
		for _, x := range arr(s[k]) {
			d.props(obj(x), at, follow, seen, fn)
		}
	}
}

// isList: a GET whose 200 reply has a "data" array (the page envelope, or a cursor feed).
func (d *doc) isList(o operation) bool {
	if o.method != "get" {
		return false
	}
	fields, _ := d.objectProps(d.jsonSchema(obj(obj(o.op["responses"])["200"])))
	return hasType(d, fields["data"], "array")
}

// objectProps merges the properties and required names of s and its allOf parts.
func (d *doc) objectProps(s node) (map[string]node, map[string]bool) {
	fields, required := map[string]node{}, map[string]bool{}
	var walk func(s node, depth int)
	walk = func(s node, depth int) {
		s, _ = d.resolve(s)
		if s == nil || depth > 8 {
			return
		}
		ps := obj(s["properties"])
		for name := range ps {
			fields[name] = obj(ps[name])
		}
		for _, r := range arr(s["required"]) {
			required[str(r)] = true
		}
		for _, x := range arr(s["allOf"]) {
			walk(obj(x), depth+1)
		}
	}
	walk(s, 0)
	return fields, required
}

// types collects the JSON types and the format a schema allows, through $ref and allOf/anyOf/oneOf.
func (d *doc) types(s node) ([]string, string) {
	var types []string
	format := ""
	var walk func(s node, depth int)
	walk = func(s node, depth int) {
		s, _ = d.resolve(s)
		if s == nil || depth > 8 {
			return
		}
		switch v := s["type"].(type) {
		case string:
			types = append(types, v)
		case []any:
			for _, x := range v {
				types = append(types, str(x))
			}
		}
		if f, ok := s["format"].(string); ok && format == "" {
			format = f
		}
		for _, k := range []string{"allOf", "anyOf", "oneOf"} {
			for _, x := range arr(s[k]) {
				walk(obj(x), depth+1)
			}
		}
	}
	walk(s, 0)
	return types, format
}

func hasType(d *doc, s node, want string) bool {
	if s == nil {
		return false
	}
	types, _ := d.types(s)
	return contains(types, want)
}

// jsonSchema is the JSON body schema of a response or request body (resolved), or nil.
func (d *doc) jsonSchema(r node) node {
	r, _ = d.resolve(r)
	for _, s := range contentSchemas(r) {
		s, _ = d.resolve(s)
		return s
	}
	return nil
}

// contentSchemas are the schemas of a response's or request body's JSON media types.
func contentSchemas(r node) []node {
	var out []node
	content := obj(r["content"])
	for _, media := range sortedKeys(content) {
		if strings.Contains(media, "json") {
			if s := obj(obj(content[media])["schema"]); s != nil {
				out = append(out, s)
			}
		}
	}
	return out
}

func obj(v any) node  { m, _ := v.(map[string]any); return m }
func arr(v any) []any { a, _ := v.([]any); return a }
func str(v any) string {
	s, _ := v.(string)
	return s
}

func contains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
