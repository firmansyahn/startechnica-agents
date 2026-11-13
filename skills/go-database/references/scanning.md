# Struct Scanning and NULLable Columns

## Struct Scanning with pgx

With pgx v5, `pgx.RowToStructByName` maps columns to fields by name; tag a field with `db:"column_name"` when the names differ (and `db:"-"` to skip one):

```go
type User struct {
    ID        uuid.UUID  `db:"id"`
    Name      string     `db:"name"`
    Email     string     `db:"email"`
    DeletedAt *time.Time `db:"deleted_at"` // NULLable
}

// Single row — returns pgx.ErrNoRows when nothing matches
rows, err := pool.Query(ctx, "SELECT id, name, email, deleted_at FROM users WHERE id = $1", id)
if err != nil {
    return fmt.Errorf("querying user: %w", err)
}
user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[User])

// Multiple rows — CollectRows closes rows and checks rows.Err()
rows, err = pool.Query(ctx,
    "SELECT id, name, email, deleted_at FROM users WHERE active = true AND deleted_at IS NULL")
if err != nil {
    return fmt.Errorf("querying users: %w", err)
}
users, err := pgx.CollectRows(rows, pgx.RowToStructByName[User])
```

Every selected column must have a field (and the reverse); list the columns explicitly rather than `SELECT *`. `pgx.RowToStructByNameLax` allows fields with no column.

## JSON Marshaling

Struct tags for both database and JSON work together. Pointer fields marshal to `null` in JSON when NULL in the database:

```go
type User struct {
    ID        uuid.UUID  `db:"id"         json:"id"`
    Name      string     `db:"name"       json:"name"`
    Email     string     `db:"email"      json:"email"`
    Bio       *string    `db:"bio"        json:"bio,omitempty"` // NULL → omitted in JSON
    DeletedAt *time.Time `db:"deleted_at" json:"deleted_at"`    // NULL → null in JSON
}
```

## NULLable Columns

Three approaches, from most to least recommended:

**1. Pointer fields (recommended)** — clean, works with JSON marshaling:

```go
type User struct {
    ID        uuid.UUID  `db:"id"    json:"id"`
    Name      string     `db:"name"  json:"name"`
    DeletedAt *time.Time `db:"deleted_at" json:"deleted_at"` // nil when NULL
}
// Check: if user.DeletedAt != nil { ... }
```

**2. `pgtype` types** (`pgtype.Text`, `pgtype.Int8`, `pgtype.Timestamptz`) — explicit but verbose; keep them inside the data layer and map to pointer fields before the value reaches an API's JSON:

```go
type User struct {
    ID        uuid.UUID   `db:"id"`
    Bio       pgtype.Text `db:"bio"`
}
// Check: if user.Bio.Valid { use(user.Bio.String) }
```

**3. `COALESCE` in SQL** — moves NULL handling to the query:

```sql
SELECT id, COALESCE(bio, '') AS bio FROM users WHERE id = $1
```
