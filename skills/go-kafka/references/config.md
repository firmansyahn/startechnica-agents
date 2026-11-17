# The kafka settings block and the client options

Part of [go-kafka](../SKILL.md); its rules win where this file is less strict. The block follows [go-knadh-koanf](../../go-knadh-koanf/SKILL.md): it lives in the config package (`internal/config/kafka.go`, the only package that imports koanf), strict decoding refuses unknown keys, and `validate` names the file and the key in every error. The Platform package `internal/kafka` turns it into franz-go options. The code below compiles and its tests pass against franz-go v1.22.3 and koanf v2.

## The settings file

```yaml
kafka:
  brokers: [kafka-0.example.com:9093, kafka-1.example.com:9093, kafka-2.example.com:9093]
  client_id: orders-service        # required: the service's name, same on every replica
  # instance: set per pod with -kafka-instance=$(POD_NAME); only for static membership and transactions
  dial_timeout: 10s
  tls:                             # optional; without it sasl.mechanism must be SCRAM
    enabled: true
    ca_file: /etc/kafka/ca.crt     # empty: the system roots
    # cert_file / key_file: client certificate for mTLS
  sasl:                            # required: every client logs in
    mechanism: SCRAM-SHA-512       # SCRAM-SHA-512, SCRAM-SHA-256, or PLAIN (TLS only)
    username: orders-service
    password_file: /var/run/secrets/kafka/password   # or password:, not both
  producer:
    enabled: true
    compression: zstd              # default snappy
    record_timeout: 2m             # default: no limit
  consumers:
    billing:
      group: billing-order-events  # fixed, this service's own
      topics: [orders.v1]
      start: earliest              # where a new group starts: earliest or latest
      static_membership: true      # needs instance
      retry: {attempts: 5, backoff: 500ms, max_backoff: 30s}
      # dead_letter_topic: default orders.v1.dlq
    price-cache:
      broadcast: true              # every replica reads every record, no group
      topics: [prices.v1]
      start: latest
```

- **One connection, several consumers.** The connection (brokers, client ID, TLS, login) is shared; each consumer is named (`consumers.billing`) with its own group, topics and start, and no two consumers of the service share a group.
- **Per-instance values come from one flag.** `instance` is this replica's stable name (a StatefulSet pod name), set in `main` with `-kafka-instance=$(POD_NAME)` after `Load` (the services don't read the environment, `go-knadh-koanf`). The static-membership ID and the transactional ID (`<client_id>-<instance>`) both come from it, so neither can be shared by two replicas by mistake.
- **Zero means franz-go's default** for the producer's tuning, so only what the file names changes; the safe defaults (all-ISR acks, idempotent writes) stay.

## The config package

```go
// internal/config/kafka.go
package config

import (
	"errors"
	"fmt"
	"net"
	"slices"
	"strings"
	"time"
)

// Kafka is the kafka block: one connection, shared by the service's producer and its consumers.
type Kafka struct {
	// Brokers are the seed brokers, host:port. Required.
	Brokers []string `koanf:"brokers"`
	// ClientID names the service in broker logs, metrics and quotas: the same on every replica.
	// Required. It is a label, not an identity; the identity is the SASL user.
	ClientID string `koanf:"client_id"`
	// Instance is this replica's stable name (a StatefulSet pod name), set per pod with the
	// -kafka-instance flag. Needed only for static membership and transactions.
	Instance string `koanf:"instance"`
	// DialTimeout bounds each connection attempt. Default 10s.
	DialTimeout time.Duration `koanf:"dial_timeout"`

	TLS       KafkaTLS                 `koanf:"tls"`
	SASL      KafkaSASL                `koanf:"sasl"`
	Producer  KafkaProducer            `koanf:"producer"`
	Consumers map[string]KafkaConsumer `koanf:"consumers"` // by name: billing, audit
}

// KafkaTLS is optional. Without it, SASL must be SCRAM, which never sends the password.
type KafkaTLS struct {
	Enabled    bool   `koanf:"enabled"`
	CAFile     string `koanf:"ca_file"`     // empty: the system roots
	CertFile   string `koanf:"cert_file"`   // client certificate (mTLS), together with key_file
	KeyFile    string `koanf:"key_file"`    //
	ServerName string `koanf:"server_name"` // empty: the broker's host name
}

// KafkaSASL is required: every client logs in.
type KafkaSASL struct {
	Mechanism    string `koanf:"mechanism"`     // SCRAM-SHA-512, SCRAM-SHA-256, or PLAIN (with TLS only)
	Username     string `koanf:"username"`      //
	Password     string `koanf:"password"`      // or password_file, not both
	PasswordFile string `koanf:"password_file"` // a mounted secret; read when the client is built
}

// KafkaProducer tunes the producing client. Zero values keep franz-go's defaults
// (acks from all in-sync replicas, idempotent writes).
type KafkaProducer struct {
	Enabled            bool          `koanf:"enabled"`
	Linger             time.Duration `koanf:"linger"`               // 0: franz-go's default
	Compression        string        `koanf:"compression"`          // snappy (default), zstd, lz4, gzip, none
	MaxBufferedRecords int           `koanf:"max_buffered_records"` // 0: franz-go's default
	RecordTimeout      time.Duration `koanf:"record_timeout"`       // fail a record not acknowledged in time; 0: no limit
	Transactional      bool          `koanf:"transactional"`        // exactly-once; transactional ID <client_id>-<instance>
}

// KafkaConsumer is one consumer of the service.
type KafkaConsumer struct {
	// Group is the consumer group: fixed, this service's own, shared by all its replicas.
	// Required unless Broadcast.
	Group  string   `koanf:"group"`
	Topics []string `koanf:"topics"` // required
	// Start is where a new group, or a broadcast consumer, starts reading: earliest or latest.
	// Required: the right answer depends on the consumer.
	Start string `koanf:"start"`
	// Broadcast makes every replica read every record, without a group (cache invalidation).
	Broadcast bool `koanf:"broadcast"`
	// StaticMembership joins the group as <instance>, so a rolling restart causes no rebalance.
	StaticMembership bool `koanf:"static_membership"`
	// MaxPollRecords bounds one poll. Default 500.
	MaxPollRecords int        `koanf:"max_poll_records"`
	Retry          KafkaRetry `koanf:"retry"`
	// DeadLetterTopic receives records that still fail after the retries. Default <first topic>.dlq.
	DeadLetterTopic string `koanf:"dead_letter_topic"`
}

// KafkaRetry bounds the retries of a failing record before it is dead-lettered.
type KafkaRetry struct {
	Attempts   int           `koanf:"attempts"`    // default 3
	Backoff    time.Duration `koanf:"backoff"`     // default 1s, doubled per attempt
	MaxBackoff time.Duration `koanf:"max_backoff"` // default 30s
}

// DefaultKafka holds the block's defaults; Defaults() sets Kafka: DefaultKafka().
func DefaultKafka() Kafka {
	return Kafka{DialTimeout: 10 * time.Second}
}

var (
	kafkaMechanisms  = []string{"SCRAM-SHA-512", "SCRAM-SHA-256", "PLAIN"}
	kafkaCompression = []string{"", "snappy", "zstd", "lz4", "gzip", "none"}
)

// validate checks the kafka block and fills the per-consumer defaults. path names the file in errors.
func (k *Kafka) validate(path string) error {
	fail := func(format string, args ...any) error {
		return fmt.Errorf("config %s: kafka."+format, append([]any{path}, args...)...)
	}
	if len(k.Brokers) == 0 && len(k.Consumers) == 0 && !k.Producer.Enabled {
		return nil // Kafka not used by this binary
	}

	if len(k.Brokers) == 0 {
		return fail("brokers is required")
	}
	for _, b := range k.Brokers {
		if _, _, err := net.SplitHostPort(b); err != nil {
			return fail("brokers: %q is not host:port", b)
		}
	}
	if k.ClientID == "" {
		return fail("client_id is required: the service's name, e.g. orders-service")
	}

	// Login is required; TLS is optional, PLAIN only over it.
	k.SASL.Mechanism = strings.ToUpper(k.SASL.Mechanism)
	switch {
	case k.SASL.Mechanism == "":
		return fail("sasl.mechanism is required: every client logs in (%s)", strings.Join(kafkaMechanisms, ", "))
	case !slices.Contains(kafkaMechanisms, k.SASL.Mechanism):
		return fail("sasl.mechanism %q: want one of %s", k.SASL.Mechanism, strings.Join(kafkaMechanisms, ", "))
	case k.SASL.Mechanism == "PLAIN" && !k.TLS.Enabled:
		return fail("sasl.mechanism PLAIN sends the password in clear: set kafka.tls.enabled or use SCRAM-SHA-512")
	case k.SASL.Username == "":
		return fail("sasl.username is required")
	case (k.SASL.Password == "") == (k.SASL.PasswordFile == ""):
		return fail("sasl.password and sasl.password_file are alternatives: set one")
	}
	if (k.TLS.CertFile == "") != (k.TLS.KeyFile == "") {
		return fail("tls.cert_file and tls.key_file go together")
	}
	if !k.TLS.Enabled && (k.TLS.CAFile != "" || k.TLS.CertFile != "" || k.TLS.ServerName != "") {
		return fail("tls: files or server_name set but tls.enabled is false")
	}

	k.Producer.Compression = strings.ToLower(k.Producer.Compression)
	if !slices.Contains(kafkaCompression, k.Producer.Compression) {
		return fail("producer.compression %q: want snappy, zstd, lz4, gzip or none", k.Producer.Compression)
	}
	if k.Producer.Transactional && k.Instance == "" {
		return fail("producer.transactional needs kafka.instance (set per pod with -kafka-instance)")
	}

	groups := map[string]string{}
	for name, c := range k.Consumers {
		key := "consumers." + name
		if len(c.Topics) == 0 {
			return fail("%s.topics is required", key)
		}
		switch {
		case c.Broadcast && c.Group != "":
			return fail("%s: broadcast and group exclude each other", key)
		case c.Broadcast && c.StaticMembership:
			return fail("%s: static_membership needs a group", key)
		case !c.Broadcast && c.Group == "":
			return fail("%s.group is required (or set broadcast: true)", key)
		}
		if c.Group != "" {
			if other, ok := groups[c.Group]; ok {
				return fail("%s.group %q is already used by consumers.%s", key, c.Group, other)
			}
			groups[c.Group] = name
		}
		c.Start = strings.ToLower(c.Start)
		if c.Start != "earliest" && c.Start != "latest" {
			return fail("%s.start %q: want earliest or latest", key, c.Start)
		}
		if c.StaticMembership && k.Instance == "" {
			return fail("%s.static_membership needs kafka.instance (set per pod with -kafka-instance)", key)
		}
		if c.MaxPollRecords == 0 {
			c.MaxPollRecords = 500
		}
		if c.Retry.Attempts == 0 {
			c.Retry.Attempts = 3
		}
		if c.Retry.Backoff == 0 {
			c.Retry.Backoff = time.Second
		}
		if c.Retry.MaxBackoff == 0 {
			c.Retry.MaxBackoff = 30 * time.Second
		}
		if c.MaxPollRecords < 1 || c.Retry.Attempts < 1 || c.Retry.Backoff > c.Retry.MaxBackoff {
			return fail("%s: max_poll_records and retry.attempts must be at least 1, retry.backoff at most retry.max_backoff", key)
		}
		if c.DeadLetterTopic == "" && !c.Broadcast {
			c.DeadLetterTopic = c.Topics[0] + ".dlq"
		}
		if slices.Contains(c.Topics, c.DeadLetterTopic) {
			return fail("%s.dead_letter_topic %q is also a source topic", key, c.DeadLetterTopic)
		}
		k.Consumers[name] = c
	}
	return nil
}

// errKafkaNoConsumer is returned when code asks for a consumer the settings don't define.
var errKafkaNoConsumer = errors.New("no such kafka consumer in the settings")

// Consumer returns the named consumer's settings.
func (k Kafka) Consumer(name string) (KafkaConsumer, error) {
	c, ok := k.Consumers[name]
	if !ok {
		return KafkaConsumer{}, fmt.Errorf("kafka.consumers.%s: %w", name, errKafkaNoConsumer)
	}
	return c, nil
}
```

`validate` refuses, naming the key:

| Key | Refused when |
|---|---|
| `brokers` | empty, or an entry isn't `host:port` |
| `client_id` | empty (`kafka-client-id`) |
| `sasl.mechanism` | empty, unknown, or PLAIN without `tls.enabled` (`kafka-authenticated-connection`) |
| `sasl.username`, `sasl.password` / `password_file` | no username; neither or both of the password keys |
| `tls.cert_file` / `key_file` | one without the other; TLS files or `server_name` set while `tls.enabled` is false |
| `producer.compression` | not snappy, zstd, lz4, gzip or none |
| `producer.transactional`, `consumers.<name>.static_membership` | set without `instance` |
| `consumers.<name>.group` | missing without `broadcast`, set with `broadcast`, or already used by another consumer (`kafka-stable-consumer-group`) |
| `consumers.<name>.topics`, `.start` | no topics; `start` not `earliest` or `latest` |
| `consumers.<name>.retry`, `.dead_letter_topic` | fewer than one attempt, a backoff above its maximum; a dead-letter topic that is also a source topic |

It also fills each consumer's defaults: 500 records per poll, 3 attempts with a 1s backoff doubling to 30s, and `<first topic>.dlq`.

## The client options

```go
// internal/kafka/options.go
// Package kafka builds the service's Kafka clients from the kafka settings block.
package kafka

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"strings"

	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"
	"github.com/twmb/franz-go/plugin/kzap"
	"go.uber.org/zap"

	"example.com/orders/internal/config"
)

// baseOpts are the options every client of the service shares: seeds, client ID, TLS and the login.
func baseOpts(cfg config.Kafka, log *zap.Logger) ([]kgo.Opt, error) {
	mech, err := mechanism(cfg.SASL)
	if err != nil {
		return nil, fmt.Errorf("kafka sasl: %w", err)
	}
	opts := []kgo.Opt{
		kgo.SeedBrokers(cfg.Brokers...),
		kgo.ClientID(cfg.ClientID),
		kgo.DialTimeout(cfg.DialTimeout),
		kgo.SASL(mech),
		kgo.WithLogger(kzap.New(log.Named("kafka"), kzap.Level(kgo.LogLevelInfo))),
	}
	if cfg.TLS.Enabled {
		tc, err := tlsConfig(cfg.TLS)
		if err != nil {
			return nil, fmt.Errorf("kafka tls: %w", err)
		}
		opts = append(opts, kgo.DialTLSConfig(tc))
	}
	return opts, nil
}

// ProducerOpts are the options of the service's producing client.
func ProducerOpts(cfg config.Kafka, log *zap.Logger) ([]kgo.Opt, error) {
	opts, err := baseOpts(cfg, log)
	if err != nil {
		return nil, err
	}
	p := cfg.Producer
	if p.Linger > 0 {
		opts = append(opts, kgo.ProducerLinger(p.Linger))
	}
	if p.Compression != "" {
		opts = append(opts, kgo.ProducerBatchCompression(codec(p.Compression)))
	}
	if p.MaxBufferedRecords > 0 {
		opts = append(opts, kgo.MaxBufferedRecords(p.MaxBufferedRecords))
	}
	if p.RecordTimeout > 0 {
		opts = append(opts, kgo.RecordDeliveryTimeout(p.RecordTimeout))
	}
	if p.Transactional {
		opts = append(opts, kgo.TransactionalID(TransactionalID(cfg)))
	}
	return opts, nil
}

// TransactionalID is unique per instance and stable across its restarts: two replicas with the
// same ID would fence each other. validate requires kafka.instance when it is used.
func TransactionalID(cfg config.Kafka) string { return cfg.ClientID + "-" + cfg.Instance }

// NewProducer returns the producing client and checks that a broker answers (and the login works).
func NewProducer(ctx context.Context, cfg config.Kafka, log *zap.Logger) (*kgo.Client, error) {
	opts, err := ProducerOpts(cfg, log)
	if err != nil {
		return nil, err
	}
	cl, err := kgo.NewClient(opts...)
	if err != nil {
		return nil, fmt.Errorf("kafka producer: %w", err)
	}
	if err := cl.Ping(ctx); err != nil {
		cl.Close()
		return nil, fmt.Errorf("kafka producer: ping: %w", err)
	}
	return cl, nil
}

// ConsumerOpts are the options of the named consumer. Commits are left to the caller's
// strategy (kafka-commit-after-processing): add DisableAutoCommit or AutoCommitMarks there.
func ConsumerOpts(cfg config.Kafka, name string, log *zap.Logger) ([]kgo.Opt, error) {
	c, err := cfg.Consumer(name)
	if err != nil {
		return nil, err
	}
	opts, err := baseOpts(cfg, log)
	if err != nil {
		return nil, err
	}
	start := kgo.NewOffset().AtStart()
	if c.Start == "latest" {
		start = kgo.NewOffset().AtEnd()
	}
	opts = append(opts, kgo.ConsumeTopics(c.Topics...), kgo.ConsumeStartOffset(start))
	if c.Broadcast {
		return opts, nil // no group on purpose: every replica reads every record
	}
	opts = append(opts, kgo.ConsumerGroup(c.Group))
	if c.StaticMembership {
		opts = append(opts, kgo.InstanceID(cfg.Instance))
	}
	return opts, nil
}

func mechanism(s config.KafkaSASL) (sasl.Mechanism, error) {
	pass := s.Password
	if s.PasswordFile != "" {
		b, err := os.ReadFile(s.PasswordFile)
		if err != nil {
			return nil, fmt.Errorf("read password_file: %w", err)
		}
		pass = strings.TrimRight(string(b), "\r\n")
	}
	switch s.Mechanism {
	case "SCRAM-SHA-512":
		return scram.Auth{User: s.Username, Pass: pass}.AsSha512Mechanism(), nil
	case "SCRAM-SHA-256":
		return scram.Auth{User: s.Username, Pass: pass}.AsSha256Mechanism(), nil
	case "PLAIN":
		return plain.Auth{User: s.Username, Pass: pass}.AsMechanism(), nil
	}
	return nil, fmt.Errorf("mechanism %q not supported", s.Mechanism) // validate already refused it
}

func tlsConfig(t config.KafkaTLS) (*tls.Config, error) {
	tc := &tls.Config{MinVersion: tls.VersionTLS12, ServerName: t.ServerName} // never InsecureSkipVerify
	if t.CAFile != "" {
		pem, err := os.ReadFile(t.CAFile)
		if err != nil {
			return nil, fmt.Errorf("read ca_file: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return nil, fmt.Errorf("ca_file %s: no certificate found", t.CAFile)
		}
		tc.RootCAs = pool
	}
	if t.CertFile != "" {
		cert, err := tls.LoadX509KeyPair(t.CertFile, t.KeyFile)
		if err != nil {
			return nil, fmt.Errorf("load client certificate: %w", err)
		}
		tc.Certificates = []tls.Certificate{cert}
	}
	return tc, nil
}

func codec(name string) kgo.CompressionCodec {
	switch name {
	case "zstd":
		return kgo.ZstdCompression()
	case "lz4":
		return kgo.Lz4Compression()
	case "gzip":
		return kgo.GzipCompression()
	case "none":
		return kgo.NoCompression()
	}
	return kgo.SnappyCompression()
}
```

- `ConsumerOpts` leaves the commit options to the consumer loop, which knows its strategy ([consumer.md](consumer.md), "Choosing a commit strategy"): `NewConsumer` appends `AutoCommitMarks`, `BlockRebalanceOnPoll` and the rebalance callbacks.
- The password file is read when the client is built, not in `validate`: a binary that never talks to Kafka must still load the settings.

## Tests

```go
// internal/config/kafka_test.go
package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func write(t *testing.T, body string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "settings.yaml")
	if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestExampleLoads(t *testing.T) {
	body, err := os.ReadFile("../../config.example.yaml")
	if err != nil {
		t.Fatal(err)
	}
	// instance comes from a flag in main; the test stands in for it.
	cfg, err := Load(write(t, strings.Replace(string(body), "  dial_timeout:", "  instance: orders-0\n  dial_timeout:", 1)))
	if err != nil {
		t.Fatal(err)
	}
	b := cfg.Kafka.Consumers["billing"]
	if b.DeadLetterTopic != "orders.v1.dlq" || b.MaxPollRecords != 500 || b.Retry.Attempts != 5 {
		t.Fatalf("billing defaults not filled: %+v", b)
	}
}

func TestKafkaRefuses(t *testing.T) {
	base := `kafka:
  brokers: [kafka-0.example.com:9093]
  client_id: orders-service
  sasl: {mechanism: SCRAM-SHA-512, username: u, password: p}
`
	for name, tc := range map[string]struct{ yaml, want string }{
		"no client id": {strings.Replace(base, "client_id: orders-service", "client_id: \"\"", 1), "client_id is required"},
		"no login":     {strings.Replace(base, "mechanism: SCRAM-SHA-512", "mechanism: \"\"", 1), "sasl.mechanism is required"},
		"plain no tls": {strings.Replace(base, "SCRAM-SHA-512", "PLAIN", 1), "PLAIN sends the password in clear"},
		"no group":     {base + "  consumers:\n    billing: {topics: [orders.v1], start: earliest}\n", "consumers.billing.group is required"},
		"no start":     {base + "  consumers:\n    billing: {group: g, topics: [orders.v1]}\n", "start \"\": want earliest or latest"},
		"shared group": {base + "  consumers:\n    a: {group: g, topics: [x.v1], start: latest}\n    b: {group: g, topics: [y.v1], start: latest}\n", "is already used"},
		"static no id": {base + "  consumers:\n    a: {group: g, topics: [x.v1], start: latest, static_membership: true}\n", "needs kafka.instance"},
		"typo key":     {base + "  consumer:\n    a: {group: g}\n", "has invalid keys: consumer"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := Load(write(t, tc.yaml))
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("got %v, want an error containing %q", err, tc.want)
			}
		})
	}
}
```

```go
// internal/kafka/options_test.go: the options log in against a kfake cluster with SASL on
package kafka

import (
	"testing"

	"github.com/twmb/franz-go/pkg/kfake"
	"github.com/twmb/franz-go/pkg/kgo"
	"go.uber.org/zap/zaptest"

	"example.com/orders/internal/config"
)

func TestClientsLogIn(t *testing.T) {
	c, err := kfake.NewCluster(kfake.NumBrokers(1), kfake.EnableSASL(),
		kfake.Superuser("SCRAM-SHA-512", "orders-test", "test-secret"), kfake.SeedTopics(3, "orders.v1"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(c.Close)
	cfg := config.Kafka{
		Brokers: c.ListenAddrs(), ClientID: "orders-test",
		SASL: config.KafkaSASL{Mechanism: "SCRAM-SHA-512", Username: "orders-test", Password: "test-secret"},
		Consumers: map[string]config.KafkaConsumer{
			"billing": {Group: "billing-test", Topics: []string{"orders.v1"}, Start: "earliest"},
		},
	}
	log := zaptest.NewLogger(t)
	for name, build := range map[string]func() ([]kgo.Opt, error){
		"producer": func() ([]kgo.Opt, error) { return ProducerOpts(cfg, log) },
		"consumer": func() ([]kgo.Opt, error) { return ConsumerOpts(cfg, "billing", log) },
	} {
		opts, err := build()
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		cl, err := kgo.NewClient(opts...)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if err := cl.Ping(t.Context()); err != nil {
			t.Fatalf("%s: ping: %v", name, err)
		}
		cl.Close()
	}
}
```
