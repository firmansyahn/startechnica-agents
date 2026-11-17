# The client: settings, pool, timeouts, health and shutdown

Read with [SKILL.md](../SKILL.md) ("The store package") when setting up MongoDB in a service, sizing the pool, or chasing timeouts and connection errors.

## Settings

One block in the service's `Config` (loaded with koanf, see `go-knadh-koanf`), with defaults in `Defaults()`:

```go
// MongoDB is the mongodb block of the settings file.
type MongoDB struct {
	// URI is the connection string (mongodb:// or mongodb+srv://). A secret: inline, or uri_file for a mounted file.
	URI     string `koanf:"uri"`
	URIFile string `koanf:"uri_file"`
	// Database is the database the service owns.
	Database string `koanf:"database"`
	// Timeout bounds each operation whose context has no deadline (CSOT, timeoutMS). Default 5s.
	Timeout time.Duration `koanf:"timeout"`
	// ServerSelectionTimeout is how long an operation waits for a usable server. Default 5s.
	ServerSelectionTimeout time.Duration `koanf:"server_selection_timeout"`
	// ConnectTimeout bounds TCP + TLS + auth for a new connection. Default 5s.
	ConnectTimeout time.Duration `koanf:"connect_timeout"`
	// MaxPoolSize caps connections per server; 0 means the driver default (100).
	MaxPoolSize uint64 `koanf:"max_pool_size"`
	// MinPoolSize keeps warm connections per server. Default 0.
	MinPoolSize uint64 `koanf:"min_pool_size"`
	// MaxConnIdleTime closes connections idle for longer. Default 5m.
	MaxConnIdleTime time.Duration `koanf:"max_conn_idle_time"`
}
```

- The URI carries the hosts, `replicaSet`, `tls`, `authSource` and credentials. It is a secret (`sec-no-secrets-in-logs`): never log it, and never log `opts` built from it.
- Options set in code after `ApplyURI` override the same option in the URI. Set in code only what the settings file names, so an operator can still tune the rest in the URI.
- `SetAppName` with the service name: it appears in the server's logs, `currentOp` and slow-query entries.
- `SetRetryWrites(true)` and `SetRetryReads(true)` are the defaults; leave them on.

## Opening

```go
func Open(ctx context.Context, cfg config.MongoDB, log *zap.Logger) (*Store, error) {
	opts := options.Client().
		ApplyURI(cfg.URI).
		SetAppName("<app>").
		SetTimeout(cfg.Timeout).
		SetServerSelectionTimeout(cfg.ServerSelectionTimeout).
		SetConnectTimeout(cfg.ConnectTimeout).
		SetMaxConnIdleTime(cfg.MaxConnIdleTime).
		SetWriteConcern(writeconcern.Majority()).
		SetMonitor(otelmongo.NewMonitor()) // traces per command
	if cfg.MaxPoolSize > 0 {
		opts.SetMaxPoolSize(cfg.MaxPoolSize)
	}
	opts.SetMinPoolSize(cfg.MinPoolSize)

	client, err := mongo.Connect(opts) // v2: no ctx; validates options, connects in the background
	if err != nil {
		return nil, fmt.Errorf("mongodb connect: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, readpref.Primary()); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, fmt.Errorf("mongodb ping: %w", err)
	}
	return &Store{client: client, db: client.Database(cfg.Database), log: log}, nil
}
```

`mongo.Connect` does not reach the server; the first `Ping` does. Whether a failed ping at startup should stop the process or let it start unready is the project's choice: a service that can do nothing without MongoDB fails fast, one with other work starts and reports not-ready.

## Timeouts

| Setting | Bounds | Notes |
|---|---|---|
| Context deadline | One operation, including retries | Wins over every client setting. A request's context carries the HTTP deadline. |
| `SetTimeout` (`timeoutMS`) | Any operation whose context has no deadline: server selection, checkout, execution, retries | Client-side operation timeout (CSOT). Still marked experimental by the driver docs; `0` disables it. |
| `SetServerSelectionTimeout` | Waiting for a usable server (an election, a network split) | Default 30s; 5s fails over faster. |
| `SetConnectTimeout` | TCP + TLS + auth of a new connection | Default 30s. |
| `SetMaxConnIdleTime` | How long an idle pooled connection lives | Keep it below any load balancer or firewall idle cut-off. |

v2 removed `SetSocketTimeout`, `SetMaxTime` on operations, `SetMaxCommitTime` and the write concern's `WTimeout`: they are all replaced by the context deadline and `SetTimeout`.

A cursor's context: the one given to `cur.All` bounds the whole iteration; the one given to `cur.Next` bounds each batch fetch.

## Pool sizing

- The pool is per server, per Client. The default `maxPoolSize` of 100 suits most services; change it only with numbers.
- Each Client also opens two monitoring connections per replica set member. Total connections a deployment opens ≈ `instances × (maxPoolSize + 2) × members` at the worst case: check it against the server's connection limit before raising the pool or the replica count.
- First estimate from load: `pool ≈ ops/sec × average op duration (s) × 1.2`. A pool that needs to be very large usually means slow queries: fix the query and its index first (`mongodb-query-optimizer`).
- `SetMaxConnecting` (default 2) limits concurrent connection establishment; raise it only if a cold start or a failover shows checkout waits.
- `SetMinPoolSize` above 0 keeps warm connections ready for bursts, at the cost of idle connections on every member.

MongoDB's `mongodb-connection` agent skill (github.com/mongodb/agent-skills, not vendored here because it covers every driver language) has scenario tables (serverless, OLTP, analytics, bursty traffic) and a monitoring guide; read it when tuning a specific workload.

## Health

- The readiness probe pings with a short deadline (`client.Ping(ctx, readpref.Primary())` with 1–2s). The liveness probe doesn't touch MongoDB: a database outage must not restart every pod.
- Pool metrics: `SetPoolMonitor(&event.PoolMonitor{Event: ...})` sees `ConnectionCheckOutFailed`, `ConnectionCreated`, `ConnectionClosed` and pool clears; count them as metrics (`go-observability`), never log every event.

## Shutdown

Order in `run()`: stop accepting HTTP requests, wait for in-flight handlers, stop workers and change streams, then `client.Disconnect(ctx)` with a bounded context (10s). `Disconnect` waits for in-use connections to return to the pool, then closes them. A `Client` must not be used after `Disconnect` (`mongo.ErrClientDisconnected`).

## Logging

The driver's own logger (`SetLoggerOptions`) is off by default; keep it off in production and turn on a component (`options.LogComponentCommand`, `LogComponentConnection`) only while debugging, through a `LogSink` that forwards to the service's zap logger. Command monitoring (`SetMonitor`) is for tracing; log failed commands only through the error the store returns, once, at the edge (`err-handle-once`). Command documents can hold personal data: don't log them.
