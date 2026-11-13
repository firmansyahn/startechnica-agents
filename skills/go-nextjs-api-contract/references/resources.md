# Resources: paths, lists, writes and values

## Paths and names

- **Plural nouns per resource, nested by ownership only one level:** `/items`, `/items/{id}`, `/items/{id}/notes`. An action that isn't CRUD is a sub-resource with POST: `/items/{id}/archive`, `/invoices/{id}/send`.
- **One API surface per audience** (`/api/v1/console/<app>/...`, `/api/v1/<app>/...`); both reuse the same Domain code (`go-project-layout`), only shapes and auth differ.
- **`snake_case`** for JSON fields and query parameters; the generated TypeScript types keep it, and forms use the same names, so 422 paths match without a mapping.
- `operationId` on every operation: `listItems`, `getItem`, `createItem`, `patchItem`, `deleteItem`, `archiveItem`.

## Ids

- **Opaque strings on the wire**, even when the database uses integers or UUIDv7 (`go-database`): `type: string`, with `format: uuid` when it is one. Clients never compute, compare by order or parse them.
- **In paths, one segment, encoded** by the client (`encodeURIComponent`) and checked by the server: an id that decodes to `/`, `..` or a control character is a 400 (or 404), never a different route (`nextjs-data` Server actions rules).
- **Natural keys** (a username, a code) in paths only when they are stable and unique in scope; encode them the same way.
- References between resources are `<thing>_id` fields (`category_id`); a reply may also embed a small summary (`category: { id, name }`) so lists don't need a lookup per row, documented in the schema.

## Lists

```
GET /items?offset=0&limit=50&sort=-created_at,name&q=north&status=active&category_id=0190...
→ { "status": "success", "data": [ ... ], "total": 132 }
```

| Parameter | Rule |
|---|---|
| `offset`, `limit` | Default `limit` 50, maximum capped by the server (e.g. 200; larger asks are clamped, not refused); `offset` ≥ 0 |
| `sort` | Comma-separated field names, `-` for descending; only fields the schema lists as sortable (an `enum` on the parameter); a stable tiebreaker (`id`) is added by the server |
| `q` | Free-text search over the fields the operation's description names; trimmed; empty means no search |
| filters | One query parameter per filterable field, named like the field (`status`, `category_id`); repeat for several values (`status=active&status=paused`); ranges as `<field>_from`/`<field>_to` |
| `total` | Count of rows matching the filters; always present on paged lists |

- Unknown parameters are a 400 on public APIs (catches typos), ignored on internal ones only if the project says so.
- **Cursor pagination** (`?after=<opaque>&limit=50` → `next` cursor, no `total`) for feeds, logs and tables too large to count; never mix both on one endpoint.
- The frontend builds the query from the generated `operations["listItems"]["parameters"]["query"]` type and puts the same object in the query key (`nextjs-data`), so a typo is a type error.
- Exports of a whole filtered list are a separate operation (`GET /items/export?format=csv&...` with the same filters), streamed, not a huge `limit`.

## Create, update, delete

- **POST** `/items` with the new record's writable fields → `201` with the whole row.
- **PATCH** `/items/{id}` with **only the changed fields**, JSON Merge Patch semantics (RFC 7396):

| In the body | Means |
|---|---|
| field absent | leave it unchanged |
| field: value | set it |
| field: `null` | clear it (only for nullable fields; a 422 otherwise) |

  The reply is the whole updated row. An empty body is a no-op `200` with the current row (or the client doesn't send it at all: `nextjs-forms` skips a save with no dirty fields).
- **PUT** only where the client really replaces the whole resource (a settings document edited as a whole).
- **DELETE** `/items/{id}` → `204` (or the project's chosen empty `200`). Deleting something already deleted in scope is a 404; deleting something in use is a 409 naming what uses it.
- **Optimistic concurrency** where two people edit the same record: the row carries `version` (or `updated_at`), the PATCH sends it back, a mismatch is a 409 "Changed by someone else; reload".

In Go, a PATCH type must tell absent from null; a pointer can't (both decode to `nil`):

```go
// Opt is a PATCH field: Set when the key was present, Null when it was null.
type Opt[T any] struct {
	Set   bool
	Null  bool
	Value T
}

func (o *Opt[T]) UnmarshalJSON(b []byte) error {
	o.Set = true
	if string(b) == "null" {
		o.Null = true
		return nil
	}
	return json.Unmarshal(b, &o.Value)
}

type ItemPatch struct {
	Name Opt[string] `json:"name"`
	Note Opt[string] `json:"note"` // nullable: {"note": null} clears it
}
```

`encoding/json` calls `UnmarshalJSON` for a present key (with `null` for a null value) and not at all for an absent one. The document generator maps `Opt[T]` to an optional property, nullable when the column is.

## Values

| Value | On the wire | Go | TypeScript |
|---|---|---|---|
| Instant | RFC 3339 string in UTC with `Z` (`"2026-11-13T07:15:05Z"`), `format: date-time` | `time.Time`, `.UTC()` before marshalling | `string`; parsed for display only, formatted with the user's locale and time zone |
| Calendar date | `"2026-11-13"`, `format: date` | a `civil.Date`-like type or `string` | `string` (zod `z.iso.date()`) |
| Duration | integer with the unit in the name (`timeout_sec`) | `time.Duration` converted at the edge | `number` |
| Money | integer minor units + ISO 4217 code (`{ "amount": 1250, "currency": "USD" }`), or a decimal string (`"12.50"`) when minor units vary; never a float | `int64` / a decimal type | `number` (safe below 2^53) or `string`; formatted with `Intl.NumberFormat` |
| Large integers (bytes, counters) | number when below 2^53, else a string | `int64` | `number` / `string` |
| Enum | lowercase `snake_case` string, values listed in the schema (`enum`) | a string type with constants and `Enum()` | the generated union; a `default` branch renders unknown values |
| Boolean | `true`/`false`, never `"1"`/`"yes"` | `bool` | `boolean` |
| Empty list | `[]`, never `null` (`go-code-style`: make the empty slice explicitly) | `make([]T, 0)` | `T[]` |

- Enums grow: a new value is additive only if every client renders an unknown value safely (a neutral badge with the raw value), so frontends never `switch` without a default.
- Labels for enum values live in the frontend's translations keyed by the value, not in the API.

## The scope header

- A multi-tenant API takes the scope in one header (`Tenant-ID`, or the project's name), declared once as a shared parameter on every operation that accepts it. The server checks the caller may act in it; absent means the caller's own scope.
- Writes from the frontend name the scope in the action input; the BFF turns it into the header (`nextjs-data`, `nextjs-bff`). Never take the scope from the body on one endpoint and the header on another.

## Files

- **Upload:** `POST` with `multipart/form-data` (a `file` part plus fields), declared with the media type and size limit; replies with the envelope. Large files go to a pre-signed URL instead.
- **Download:** `GET` returning the file's media type with `Content-Disposition: attachment; filename="..."`, outside the envelope; failures before streaming starts still answer the envelope as JSON.
