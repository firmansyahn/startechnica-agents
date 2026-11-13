---
title: Keep mutexes as named zero-value fields, never copied
impact: MEDIUM
tags: concurrency, mutex, copylocks
check: vet (copylocks), scan
---

## Keep mutexes as named zero-value fields, never copied

**Impact: MEDIUM** (a copied mutex guards nothing: two copies lock independently and the data races; an embedded mutex exposes `Lock`/`Unlock` as part of the type's API)

A mutex is a named field (`mu sync.Mutex`) right above the fields it guards, used through pointer receivers. Never embed it, never use `*sync.Mutex` or `new(sync.Mutex)`, and never pass or return a struct holding one by value.

**Incorrect:**

```go
type Cache struct {
	sync.RWMutex
	items map[string]Item
}

func (c Cache) Get(k string) Item { c.RLock(); defer c.RUnlock(); return c.items[k] } // value receiver copies the lock
```

**Correct:**

```go
type Cache struct {
	mu    sync.RWMutex // guards items
	items map[string]Item
}

func (c *Cache) Get(k string) Item {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.items[k]
}
```

**How to check:** `go vet` (`copylocks`) finds copies. `scripts/scan.sh` flags embedded `sync.Mutex`/`RWMutex` fields, `*sync.Mutex` fields and `new(sync.Mutex)`.
