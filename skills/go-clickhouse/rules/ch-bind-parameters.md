---
title: Bind values as parameters, never format them into SQL
impact: CRITICAL
tags: clickhouse, security, injection
check: scan (candidates), review
---

## Bind values as parameters, never format them into SQL

**Impact: CRITICAL** (a value formatted into the query text is SQL injection: a crafted filter reads other tenants' rows or runs `DROP TABLE`)

Pass every value as an argument: `?` placeholders, `clickhouse.Named("name", v)` with `@name`, or server-side `{name:Type}` parameters, which the server parses and type-checks. A table or column name that comes from input goes through `{name:Identifier}` or an allow-list, never `fmt.Sprintf`. Same rule as `sec-sql-parameterized` in [go-security](../../go-security/SKILL.md).

**Incorrect:**

```go
q := fmt.Sprintf("SELECT path, count() FROM page_views WHERE site_id = %d AND path LIKE '%s%%' GROUP BY path", siteID, prefix)
rows, err := s.conn.Query(ctx, q)
```

**Correct:**

```go
var out []PathCount
err := s.conn.Select(ctx, &out, `
	SELECT path, count() AS count
	FROM page_views
	WHERE site_id = {site:UInt32} AND startsWith(path, {prefix:String})
	GROUP BY path
	LIMIT 100`,
	clickhouse.Named("site", siteID),
	clickhouse.Named("prefix", prefix),
)
```

Sorting by a column the caller picks: map it through an allow-list (`map[string]string{"views": "count"}`) and refuse anything else.

**How to check:** `scripts/scan.sh` flags `fmt.Sprintf` and string concatenation that build SQL text in files that use clickhouse-go; confirm each formats a value, not a constant. In review, follow any query string that is built rather than written out.
