# The client: settings, pool, timeouts, health and shutdown

Read with [SKILL.md](../SKILL.md) ("The store package") when setting up MongoDB in a service, sizing the pool, or chasing timeouts and connection errors.

## Settings

One block in the service's `Config` (loaded with koanf, see `go-knadh-koanf`), in `internal/config/mongodb.go`, with defaults in `DefaultMongoDB()`:

```yaml
mongodb:
  # Hosts, replica set and TLS; the credentials go in auth below, or in the URI (then use uri_file).
  uri: mongodb://db-0.example.com:27017,db-1.example.com:27017,db-2.example.com:27017/?replicaSet=rs0&tls=true
  # uri_file: /var/run/secrets/mongodb/uri   # instead of uri, for a URI that holds a password
  app_name: orders-service        # required: the service's name, same on every replica
  database: orders                # required: the database the service owns
  auth:                           # required unless the URI holds the credentials
    mechanism: SCRAM-SHA-256      # empty: SCRAM negotiated; PLAIN only with TLS; MONGODB-X509, MONGODB-AWS
    source: admin                 # the user's database
    username: orders-service
    password_file: /var/run/secrets/mongodb/password   # or password:, not both
  timeout: 5s                     # operations without a deadline
  server_selection_timeout: 5s
  connect_timeout: 5s
  max_pool_size: 0                # 0: the driver's default (100)
  min_pool_size: 0
  max_conn_idle_time: 5m
```

```go
// MongoDB is the mongodb block of the settings file.
type MongoDB struct {
	// URI is the connection string: hosts, replicaSet, tls options, and the credentials unless
	// the auth block holds them. A secret when it carries a password: inline, or uri_file for a
	// mounted file, not both. Required.
	URI     string `koanf:"uri"`
	URIFile string `koanf:"uri_file"`
	// AppName names the service in the server's logs, currentOp and slow-query entries: the
	// same on every replica. Required. A label, not an identity; the identity is the login.
	AppName string `koanf:"app_name"`
	// Database is the database the service owns. Required.
	Database string `koanf:"database"`
	// Auth holds the login when it isn't in the URI. Every client logs in: one of the two is required.
	Auth MongoAuth `koanf:"auth"`

	// Timeout bounds each operation whose context has no deadline (CSOT). Default 5s.
	Timeout time.Duration `koanf:"timeout"`
	// ServerSelectionTimeout is how long an operation waits for a usable server. Default 5s.
	ServerSelectionTimeout time.Duration `koanf:"server_selection_timeout"`
	// ConnectTimeout bounds TCP, TLS and the login of a new connection. Default 5s.
	ConnectTimeout time.Duration `koanf:"connect_timeout"`
	// MaxPoolSize caps connections per server; 0 keeps the driver's default (100).
	MaxPoolSize uint64 `koanf:"max_pool_size"`
	// MinPoolSize keeps warm connections per server. Default 0.
	MinPoolSize uint64 `koanf:"min_pool_size"`
	// MaxConnIdleTime closes connections idle for longer. Default 5m.
	MaxConnIdleTime time.Duration `koanf:"max_conn_idle_time"`
}

// MongoAuth is the login, when it isn't in the URI.
type MongoAuth struct {
	// Mechanism: empty lets the server pick SCRAM-SHA-256 (or SCRAM-SHA-1 on old servers);
	// PLAIN (LDAP) only with TLS; MONGODB-X509 (the client certificate in the URI's
	// tlsCertificateKeyFile) and MONGODB-AWS need no password.
	Mechanism    string `koanf:"mechanism"`
	Source       string `koanf:"source"`        // the user's database; empty: the driver's default (admin, or $external)
	Username     string `koanf:"username"`      //
	Password     string `koanf:"password"`      // or password_file, not both
	PasswordFile string `koanf:"password_file"` // a mounted secret; read when the client is built
}

// Set reports whether the settings hold a login of their own.
func (a MongoAuth) Set() bool { return a != MongoAuth{} }
```

`validate` refuses, naming the key (`config <file>: mongodb.app_name is required ...`):

| Key | Refused when |
|---|---|
| `uri` / `uri_file` | neither or both set; a `uri` that isn't `mongodb://` or `mongodb+srv://` (the error never echoes the URI) |
| `app_name`, `database` | empty |
| `auth` | missing while an inline `uri` holds no credentials and no `authMechanism`; set while the `uri` holds credentials |
| `auth.mechanism` | not SCRAM-SHA-256, SCRAM-SHA-1, PLAIN, MONGODB-X509 or MONGODB-AWS (empty means SCRAM) |
| `auth.username` | empty, except for MONGODB-X509 and MONGODB-AWS |
| `auth.password` / `password_file` | neither or both for a password mechanism; either one for MONGODB-X509 or MONGODB-AWS |
| timeouts, pool | a timeout that isn't positive; `min_pool_size` above `max_pool_size` |

A `uri_file` is read when the client is built, not in `validate` (a binary that never opens MongoDB must still load the settings), so the definitive login check runs on the parsed options in `ClientOptions`.

- The URI is a secret when it carries a password (`sec-no-secrets-in-logs`): never log it, nor `opts` built from it. A URI without credentials (hosts and options only) may sit in the settings file in plain text.
- Options set in code after `ApplyURI` override the same option in the URI. Set in code only what the settings file names, so an operator can still tune the rest in the URI.
- `SetRetryWrites(true)` and `SetRetryReads(true)` are the defaults; leave them on.

## Opening

```go
// ClientOptions builds the client's options from the settings: the URI, the login, the app
// name, the timeouts and the pool. It refuses options that would connect without logging in.
func ClientOptions(cfg config.MongoDB) (*options.ClientOptions, error) {
	uri := cfg.URI
	if cfg.URIFile != "" {
		b, err := os.ReadFile(cfg.URIFile)
		if err != nil {
			return nil, fmt.Errorf("mongodb: read uri_file: %w", err)
		}
		uri = strings.TrimSpace(string(b))
	}
	opts := options.Client().ApplyURI(uri) // a mongodb+srv URI is resolved in DNS here
	if err := opts.Validate(); err != nil {
		return nil, fmt.Errorf("mongodb: %w", err) // the driver's message names the problem, not the URI
	}
	if cfg.Auth.Set() {
		if opts.Auth != nil {
			return nil, errors.New("mongodb: credentials in both the URI and mongodb.auth; keep them in one place")
		}
		cred, err := credential(cfg.Auth)
		if err != nil {
			return nil, err
		}
		opts.SetAuth(cred)
	}
	if err := checkLogin(opts); err != nil { // mongo-authenticated-connection
		return nil, err
	}
	opts.SetAppName(cfg.AppName). // after ApplyURI: an appName in the URI can't mislabel the service
		SetTimeout(cfg.Timeout).
		SetServerSelectionTimeout(cfg.ServerSelectionTimeout).
		SetConnectTimeout(cfg.ConnectTimeout).
		SetMaxConnIdleTime(cfg.MaxConnIdleTime).
		SetMinPoolSize(cfg.MinPoolSize).
		SetWriteConcern(writeconcern.Majority())
	if cfg.MaxPoolSize > 0 {
		opts.SetMaxPoolSize(cfg.MaxPoolSize)
	}
	return opts, opts.Validate()
}

// checkLogin refuses options that would connect anonymously, or send a password in clear.
// TLS is optional: SCRAM never sends the password.
func checkLogin(opts *options.ClientOptions) error {
	a := opts.Auth
	if a == nil {
		return errors.New("mongodb: no credentials: every client logs in (set mongodb.auth, or put them in the URI)")
	}
	switch a.AuthMechanism {
	case "MONGODB-X509", "MONGODB-AWS", "MONGODB-OIDC", "GSSAPI":
		return nil // the identity is a certificate, an AWS role, a token or a Kerberos ticket
	case "PLAIN":
		if opts.TLSConfig == nil {
			return errors.New("mongodb: PLAIN sends the password in clear: turn TLS on (tls=true) or use SCRAM-SHA-256")
		}
	}
	if a.Username == "" {
		return errors.New("mongodb: the credentials have no username")
	}
	return nil
}

func credential(a config.MongoAuth) (options.Credential, error) {
	c := options.Credential{AuthMechanism: a.Mechanism, AuthSource: a.Source, Username: a.Username}
	switch {
	case a.PasswordFile != "":
		b, err := os.ReadFile(a.PasswordFile)
		if err != nil {
			return c, fmt.Errorf("mongodb: read auth.password_file: %w", err)
		}
		c.Password, c.PasswordSet = strings.TrimRight(string(b), "\r\n"), true
	case a.Password != "":
		c.Password, c.PasswordSet = a.Password, true
	}
	return c, nil
}

func Open(ctx context.Context, cfg config.MongoDB, log *zap.Logger) (*Store, error) {
	opts, err := ClientOptions(cfg)
	if err != nil {
		return nil, err
	}
	client, err := mongo.Connect(opts.SetMonitor(otelmongo.NewMonitor())) // v2: no ctx; connects in the background
	if err != nil {
		return nil, fmt.Errorf("mongodb connect: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, readpref.Primary()); err != nil { // the first contact, and the login
		_ = client.Disconnect(context.Background())
		return nil, fmt.Errorf("mongodb ping: %w", err)
	}
	return &Store{client: client, db: client.Database(cfg.Database), log: log}, nil
}
```

`mongo.Connect` does not reach the server; the first `Ping` does, and it is also the first login, so wrong credentials fail there. Whether a failed ping at startup should stop the process or let it start unready is the project's choice: a service that can do nothing without MongoDB fails fast, one with other work starts and reports not-ready.

`ClientOptions` is tested without a server: an anonymous URI, PLAIN without TLS and credentials in both places are refused; SCRAM from the `auth` block (password file read), credentials in the URI, X509 over TLS and PLAIN over TLS are accepted, and `mongo.Connect` accepts the result.

## Logging in

- **Every client logs in** (`mongo-authenticated-connection`), local and CI included: the test server runs with authorization on (references/testing.md).
- **TLS is optional.** SCRAM-SHA-256 proves the password without sending it, so it is safe without TLS; PLAIN (LDAP) sends it as it is and needs TLS. Without TLS the documents themselves travel unencrypted: keep it on wherever the traffic leaves a network the team trusts (Atlas requires it). TLS settings live in the URI (`tls=true`, `tlsCAFile`, `tlsCertificateKeyFile`); never `tlsInsecure` or `tlsAllowInvalidCertificates` (`sec-tls-verify`).
- **The server enforces it:** `security.authorization: enabled`, and one user per service with the least role that works: `readWrite` on the service's database (it includes `createIndex` for `EnsureIndexes`), never `root`, `dbOwner` on other databases or an `*AnyDatabase` role.
- **Rotating the password** needs a restart, or a Client rebuilt from the new file; the driver keeps the credential it was built with.

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
