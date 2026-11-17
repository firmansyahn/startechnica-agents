# Building the client

The team skill wins; this is the detail behind its sections 1 and 2. API names are go-redis v9 (checked against v9.23); read `go.mod` first.

## The settings block

One `redis` block in the settings file, loaded by the config package ([go-knadh-koanf](../../go-knadh-koanf/SKILL.md)): a `Config` struct with `koanf` tags, defaults in `Defaults()`, checked by `validate`.

```go
// Config is the redis block of the settings file.
type Config struct {
	// Addrs: one host:port for a single server, several for a cluster, the sentinels when MasterName is set.
	Addrs []string `koanf:"addrs"`
	// MasterName selects Sentinel: the name of the monitored primary.
	MasterName string `koanf:"master_name"`
	// Username is the ACL user (Redis 6+); empty means the default user.
	Username string `koanf:"username"`
	// Password, or PasswordFile pointing at a mounted secret; set one.
	Password     string `koanf:"password"`
	PasswordFile string `koanf:"password_file"`
	// DB is the logical database (single server only; a cluster has only 0).
	DB  int       `koanf:"db"`
	TLS TLSConfig `koanf:"tls"`
	// KeyPrefix starts every key this service writes, e.g. "orders:" (default: the service name and a colon).
	KeyPrefix string `koanf:"key_prefix"`
	// PoolSize is the connections per node (default 10 per GOMAXPROCS).
	PoolSize     int           `koanf:"pool_size"`
	DialTimeout  time.Duration `koanf:"dial_timeout"`  // default 5s
	ReadTimeout  time.Duration `koanf:"read_timeout"`  // default 5s; also bounds a command when the ctx has no deadline
	WriteTimeout time.Duration `koanf:"write_timeout"` // default 5s
}

// TLSConfig turns on TLS to the server.
type TLSConfig struct {
	Enabled bool   `koanf:"enabled"`
	CAFile  string `koanf:"ca_file"` // empty: the system roots
}
```

```yaml
redis:
  addrs: ["redis.example.com:6380"]
  username: orders
  password_file: /run/secrets/redis-password
  tls:
    enabled: true
  key_prefix: "orders:"
  read_timeout: 1s
  write_timeout: 1s
```

`validate` checks: at least one address; `password` and `password_file` not both; `db` is 0 when there are several addresses; `key_prefix` ends with `:`; timeouts positive. Errors name the dotted key (`redis.password_file`), as the koanf skill shows.

Never put credentials in a `redis://` URL in the settings file: the URL ends up in logs and error messages. `redis.ParseURL` is fine in tests.

## The constructor

```go
// New builds the one client of the process. The caller closes it on shutdown.
func New(ctx context.Context, cfg Config, log *zap.Logger) (redis.UniversalClient, error) {
	password := cfg.Password
	if cfg.PasswordFile != "" {
		b, err := os.ReadFile(cfg.PasswordFile)
		if err != nil {
			return nil, fmt.Errorf("redis.password_file: %w", err)
		}
		password = strings.TrimSpace(string(b))
	}
	var tlsCfg *tls.Config
	if cfg.TLS.Enabled {
		tlsCfg = &tls.Config{MinVersion: tls.VersionTLS12}
		if cfg.TLS.CAFile != "" {
			pem, err := os.ReadFile(cfg.TLS.CAFile)
			if err != nil {
				return nil, fmt.Errorf("redis.tls.ca_file: %w", err)
			}
			pool := x509.NewCertPool()
			if !pool.AppendCertsFromPEM(pem) {
				return nil, fmt.Errorf("redis.tls.ca_file: no certificates in %s", cfg.TLS.CAFile)
			}
			tlsCfg.RootCAs = pool
		}
	}

	rdb := redis.NewUniversalClient(&redis.UniversalOptions{
		Addrs:                 cfg.Addrs,
		MasterName:            cfg.MasterName,
		Username:              cfg.Username,
		Password:              password,
		DB:                    cfg.DB,
		TLSConfig:             tlsCfg,
		PoolSize:              cfg.PoolSize,
		DialTimeout:           cfg.DialTimeout,
		ReadTimeout:           cfg.ReadTimeout,
		WriteTimeout:          cfg.WriteTimeout,
		ContextTimeoutEnabled: true, // the caller's deadline bounds the command, not only ReadTimeout
	})

	if err := errors.Join(
		redisotel.InstrumentTracing(rdb, redisotel.WithDBStatement(false)),
		redisotel.InstrumentMetrics(rdb),
	); err != nil {
		_ = rdb.Close()
		return nil, fmt.Errorf("instrument redis: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := rdb.Ping(pingCtx).Err(); err != nil {
		_ = rdb.Close()
		return nil, fmt.Errorf("ping redis %v: %w", cfg.Addrs, err)
	}
	log.Info("redis connected", zap.Strings("addrs", cfg.Addrs), zap.Bool("tls", cfg.TLS.Enabled))
	return rdb, nil
}
```

`NewUniversalClient` picks the client from the options: `MasterName` set gives a Sentinel-backed `FailoverClient`; two or more `Addrs` (or `IsClusterMode`) give a `ClusterClient`; one address gives a `Client`. Code that needs a cluster-only method (`ForEachMaster`) type-asserts `*redis.ClusterClient` in one place.

A zero `PoolSize` or timeout in `UniversalOptions` means the library default, so `Defaults()` can leave them at zero and the settings file overrides only what it names.

## Pool and timeouts

| Option | Default | Team guidance |
|---|---|---|
| `PoolSize` | 10 × `GOMAXPROCS` per node | Rarely needs changing; raise it only when pool-timeout errors and `PoolStats().Timeouts` show waiting, after checking for slow commands first |
| `PoolTimeout` | `ReadTimeout` + 1 s | Leave it; a pool timeout means commands are too slow or connections leak |
| `MinIdleConns` | 0 | Set a few when dial plus TLS is slow and traffic is bursty |
| `MaxActiveConns` | 0 (no cap) | Cap it when many replicas share a server with a `maxclients` limit |
| `ConnMaxIdleTime` | 30 min | Below the server's and any proxy's idle timeout |
| `DialTimeout` | 5 s | Keep it set |
| `ReadTimeout` / `WriteTimeout` | 5 s | Keep them set even with context deadlines; go-redis runs background checks without a context. On cloud networks don't go below about one second |
| `ContextTimeoutEnabled` | false | Always true (`redis-context-deadline`) |
| `MaxRetries` | 3 | Retries are for idempotent commands; a non-idempotent `INCR` may be applied twice after a timeout. Set `-1` on a client used only for such writes, or accept it |
| `Protocol` | 3 (RESP3) | Leave it; set 2 only for a server or proxy that can't speak RESP3 |

Blocking commands (`BLPOP`, `XREADGROUP` with `Block`) get their own read deadline: go-redis adds 10 s to the block time, so a long `Block` doesn't trip `ReadTimeout`.

Pool statistics: `rdb.PoolStats()` (hits, misses, timeouts, total and idle connections) is exported by `redisotel.InstrumentMetrics`; alert on pool timeouts, not on the totals.

## Credentials and TLS

- Each service connects as its own ACL user, allowed only its key prefix and the commands it uses (`ACL SETUSER orders on >... ~orders:* +@read +@write -@dangerous`). The server side, ACL categories and network exposure are in `redis-security`.
- The password comes from `password_file` (a mounted secret) or the secrets file, never from code, and is never logged: log the addresses and the TLS flag, not the options struct (`sec-no-secrets-in-logs`).
- For rotating credentials, `CredentialsProviderContext` returns the current user and password on each new connection; client-side caching is turned off when a credentials provider is set.
- TLS: `MinVersion: tls.VersionTLS12`, the server's CA in `RootCAs` when it is private, never `InsecureSkipVerify`. Managed services usually listen for TLS on a separate port.

## Health and shutdown

- `/readyz` may `PING` Redis with a short timeout when the service can't serve without it; a cache-only dependency shouldn't fail readiness (the service degrades to the database). `/livez` never checks Redis ([go-observability](../../go-observability/SKILL.md), `obs-kubernetes-probe-paths`).
- Shutdown order: stop accepting requests (`srv.Shutdown`), stop the stream consumers and wait for them, then `rdb.Close()`. A deferred `Close` in `run` after the other defers gets this order for free.

## Logging and tracing

- `redisotel.InstrumentTracing(rdb, redisotel.WithDBStatement(false))` gives a span per command and pipeline with the command name and server; `InstrumentMetrics` gives command durations and pool usage (`redis-otel-no-db-statement`).
- Log Redis failures on the cache path at `Warn` with `zap.String("key", key)` and `zap.Error(err)`; the key is fine to log when the key schema holds no personal data (use IDs, not emails, in keys).
- `redis.SetLogger` replaces go-redis's internal logger (connection pool and reconnect messages). Route it to zap at `Warn` if those messages matter; don't log every command.

## Valkey and managed services

go-redis v9 works against Valkey and the managed Redis-compatible services for the commands they share. Commands newer than the server (`DELEX`, `SET IFEQ`, hash-field expiry on older versions) fail with an unknown-command error: check the server version the project runs before using one, and keep a script fallback. go-redis asks for maintenance notifications automatically (`MaintNotificationsConfig`, mode `auto`) and turns them off when the server doesn't support them; leave the default.
