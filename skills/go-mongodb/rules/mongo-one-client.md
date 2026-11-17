---
title: Create one Client per process and disconnect it on shutdown
impact: HIGH
tags: mongodb, connections, lifecycle
check: scan (candidates), review
---

## Create one Client per process and disconnect it on shutdown

**Impact: HIGH** (a Client per request opens a new pool, monitoring connections and a TLS handshake each time, exhausts the server's connection limit under load, and leaks goroutines; a Client never disconnected drops in-flight writes at exit)

A `*mongo.Client` is safe for concurrent use and owns the connection pool. Create it once at startup in the Platform package that owns MongoDB, check it with `Ping`, hand it (or the store built on it) to constructors, and call `Disconnect` once during graceful shutdown, after the HTTP server has stopped taking requests.

**Incorrect:**

```go
func (h *Handler) GetCustomer(w http.ResponseWriter, r *http.Request) {
	client, err := mongo.Connect(options.Client().ApplyURI(h.uri)) // new pool per request, never disconnected
	if err != nil {
		writeError(w, err)
		return
	}
	var c Customer
	_ = client.Database("app").Collection("customers").FindOne(r.Context(), bson.D{{Key: "_id", Value: id}}).Decode(&c)
}
```

**Correct:**

```go
// cmd/<binary>/main.go (run)
store, err := mongostore.Open(ctx, cfg.MongoDB) // mongo.Connect + Ping, once
if err != nil {
	return fmt.Errorf("open mongodb: %w", err)
}
defer func() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := store.Close(ctx); err != nil { // client.Disconnect
		log.Warn("disconnect mongodb", zap.Error(err))
	}
}()
customers := customer.NewService(store)
```

**How to check:** `scripts/scan.sh` flags `mongo.Connect(` outside `package main` and the MongoDB folders (`MONGO_DIRS`), and a module that calls `mongo.Connect` but never `Disconnect`. In review, follow the Client from `Connect` to shutdown: one value, injected, disconnected once.
