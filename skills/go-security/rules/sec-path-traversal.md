---
title: Keep user-controlled paths inside their root
impact: HIGH
tags: security, files, path-traversal
check: scan (candidates), lint (gosec G304)
---

## Keep user-controlled paths inside their root

**Impact: HIGH** (`../` in a name reads or overwrites files outside the upload or template folder)

A file name from a request, an upload, an archive entry or a database row is never joined onto a directory as is. Open it through `os.Root` (Go 1.24+), which refuses anything that escapes, or check it with `filepath.IsLocal` first. Better still, store files under a generated id and keep the user's name only as metadata.

**Incorrect:**

```go
name := r.PathValue("name")
f, err := os.Open(filepath.Join(h.uploadDir, name)) // name = "../../etc/passwd"
```

**Correct:**

```go
root, err := os.OpenRoot(h.uploadDir) // once, at startup
// ...
f, err := root.Open(r.PathValue("name")) // refuses names that leave the root
if err != nil {
	http.NotFound(w, r)
	return
}
defer f.Close()
```

**How to check:** `scripts/scan.sh` flags `os.Open`/`ReadFile`/`Create`/`filepath.Join`/`http.ServeFile` calls on the same line as request values (`PathValue`, `FormValue`, `URL.Query`, `URLParam`). Also read archive extraction (`zip`, `tar`) and any path built from stored names.
