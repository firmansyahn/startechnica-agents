---
title: Close every outbound response body
impact: MEDIUM
tags: http-client, resources, leaks
check: scan, lint (bodyclose)
---

## Close every outbound response body

**Impact: MEDIUM** (an unclosed body keeps its connection out of the pool; under load the process runs out of connections or file descriptors)

After a successful `Do`/`Get`/`Post`, `defer resp.Body.Close()` on the next lines, before checking the status. To reuse the connection when the body isn't read to the end, drain a bounded amount first (`io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))`). Read bodies through `io.LimitReader` too: a vendor can send gigabytes.

**Incorrect:**

```go
resp, err := client.Do(req)
if err != nil {
	return err
}
if resp.StatusCode != http.StatusOK {
	return fmt.Errorf("status %d", resp.StatusCode) // body never closed
}
```

**Correct:**

```go
resp, err := client.Do(req)
if err != nil {
	return fmt.Errorf("call vendor: %w", err)
}
defer resp.Body.Close()
if resp.StatusCode != http.StatusOK {
	return fmt.Errorf("vendor status %d", resp.StatusCode)
}
body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
```

**How to check:** `scripts/scan.sh` flags a `resp, err := ….Do(`/`Get(`/`Post(` with no `Body.Close()` in the next eight lines. `bodyclose` does it precisely.
