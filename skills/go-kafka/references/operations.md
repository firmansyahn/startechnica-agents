# Settings, security, topics, schemas and telemetry

Part of [go-kafka](../SKILL.md); its rules win where this file is less strict.

## The settings block

One `kafka` block in the service's settings file ([go-knadh-koanf](../../go-knadh-koanf/SKILL.md)), decoded into the Platform package's `Config`. A service with several consumers gives each its own block (`kafka_billing`, `kafka_audit`) or a list, each with its own group and topics.

```yaml
kafka:
  brokers: [kafka-0.example.com:9093, kafka-1.example.com:9093, kafka-2.example.com:9093]
  client_id: orders-service            # required: the service's name, same on every replica
  tls: true                            # optional; without it the mechanism must be SCRAM
  ca_file: /etc/kafka/ca.crt           # empty: the system roots
  sasl:                                # required: every client logs in
    mechanism: SCRAM-SHA-512           # or SCRAM-SHA-256; PLAIN only with tls: true
    username: orders-service
    password_file: /var/run/secrets/kafka/password
  dial_timeout: 10s
  group: billing-order-events          # consumers only: fixed, this service's own
  topics: [orders.v1]                  # consumers only
```

- **Login** is required (`kafka-authenticated-connection`): `validate` refuses an empty mechanism, a missing username or password file, and PLAIN without TLS, so a service never falls back to connecting anonymously.
- **Client ID** is required (`kafka-client-id`): the service's name, appended with the role when one service runs several clients (`orders-service-relay`). It labels requests for broker logs, metrics and client-ID quotas; the SASL user is the identity. Per-instance IDs are `instance_id` (static membership) and `transactional_id`, set by the deployment.
- **Secrets** come from a mounted file (`password_file`) or the settings file kept out of the image, never from flags or the code, and never logged ([go-security](../../go-security/SKILL.md), `sec-no-secrets-in-logs`).
- **Group IDs** are settings, not code: `<service>-<purpose>`, the same in every replica and across deploys, and not used by any other service (`kafka-stable-consumer-group`).
- **Topics** in settings, not as constants spread through the code, so an environment can rename them.

## SASL and TLS

```go
func (s SASL) mechanism() (sasl.Mechanism, error) {
	pass, err := readSecret(s.PasswordFile) // trims the trailing newline
	if err != nil {
		return nil, err
	}
	switch s.Mechanism {
	case "SCRAM-SHA-512":
		return scram.Auth{User: s.Username, Pass: pass}.AsSha512Mechanism(), nil
	case "SCRAM-SHA-256":
		return scram.Auth{User: s.Username, Pass: pass}.AsSha256Mechanism(), nil
	case "PLAIN":
		return plain.Auth{User: s.Username, Pass: pass}.AsMechanism(), nil
	default:
		return nil, fmt.Errorf("sasl.mechanism %q: want SCRAM-SHA-512, SCRAM-SHA-256 or PLAIN", s.Mechanism)
	}
}
```

- Packages: `github.com/twmb/franz-go/pkg/sasl/scram`, `.../sasl/plain`, `.../sasl/oauth` (OAUTHBEARER, with a token function that refreshes), `.../sasl/aws` (MSK IAM).
- **SASL always; TLS when the network needs it.** SCRAM proves the password without sending it, so it is safe without TLS; PLAIN and OAUTHBEARER send the secret as it is and need TLS. TLS through `kgo.DialTLSConfig(&tls.Config{MinVersion: tls.VersionTLS12, RootCAs: pool})`; never `InsecureSkipVerify` (`sec-tls-verify`). A cluster with self-signed certificates gets its CA in `ca_file`. Without TLS the records themselves travel unencrypted: keep TLS on wherever the traffic leaves a network the team trusts.
- **The broker enforces it.** No `PLAINTEXT` listener reachable by services, an authorizer on, `allow.everyone.if.no.acl.found=false`, and ACLs per service principal: Write on the topics it produces to, Read on the topics and the group it consumes, Describe where `kadm` needs it.
- The settings name the mechanism; the client doesn't guess. Rotation of a password file needs a restart unless the project wires a refreshing `scram.Sha512(func(ctx) (scram.Auth, error))`.

## Topics

Topics are declared where the platform declares infrastructure: Terraform, a Kubernetes operator's `KafkaTopic` resource, or a migration-like admin step the service runs at deploy with `kadm`. Never `AllowAutoTopicCreation()` in service code (`kafka-durable-writes`).

```go
adm := kadm.NewClient(cl)
resp, err := adm.CreateTopic(ctx, 12, 3, map[string]*string{
	"min.insync.replicas": kadm.StringPtr("2"),
	"retention.ms":        kadm.StringPtr("604800000"), // 7 days
	"cleanup.policy":      kadm.StringPtr("delete"),
}, "orders.v1")
if err != nil && !errors.Is(err, kerr.TopicAlreadyExists) {
	return fmt.Errorf("create topic %s: %w", resp.Topic, err)
}
```

- **Partitions:** enough for the most consumers you expect in one group (a partition is consumed by one member at a time), counted with growth in mind; adding partitions later moves keys to new partitions and breaks per-key order across the change.
- **Replication 3, `min.insync.replicas=2`** in production. Single-broker development clusters use 1 and 1, from the environment's settings.
- **Names:** `<domain>.<event-stream>.v<major>` (`orders.v1`, `payments.refunds.v1`), dead letters `<topic>.dlq`, retries `<topic>.retry`.
- **Compaction** (`cleanup.policy=compact`) for topics that carry the latest state per key; then a record with a nil value deletes the key.

## Schemas

- **JSON envelope** (team decision 3):

  ```go
  type Envelope struct {
      ID         uuid.UUID       `json:"id"`          // event ID, the dedup key
      Type       string          `json:"type"`        // "order.placed"
      Version    int             `json:"version"`     // payload version within the topic's major
      OccurredAt time.Time       `json:"occurred_at"`
      Data       json.RawMessage `json:"data"`
  }
  ```

  Adding an optional field is compatible; renaming or removing one, or changing its type, is a new topic major (`orders.v2`), produced in parallel until every consumer has moved.
- **With a schema registry:** `github.com/twmb/franz-go/pkg/sr` has the client (`sr.NewClient(sr.URLs(url), sr.BasicAuth(user, pass))`) and `sr.Serde`, which writes and reads the registry's wire header (magic byte and schema ID). Register schemas through CI with the subject's compatibility set to `BACKWARD` or stricter; the service looks up the ID at start (`SchemaByVersion(ctx, subject, -1)`) and registers its types with `serde.Register(id, OrderPlaced{}, sr.EncodeFn(...), sr.DecodeFn(...))`.
- Decoding failures are permanent errors: they go to the dead-letter topic at once, without retries.

## Logs

`kgo.WithLogger(kzap.New(log.Named("kafka"), kzap.Level(kgo.LogLevelInfo)))`: connection, group and rebalance events at `Info`, warnings and errors above. `Debug` logs every request; turn it on per environment, never by default. The service's own lines name `topic`, `partition` and `offset`, never the record value.

## Traces

```go
tracer := kotel.NewTracer(
	kotel.TracerProvider(tp),
	kotel.TracerPropagator(propagation.TraceContext{}),
	kotel.ConsumerGroup(cfg.Group),
)
cl, err := kgo.NewClient(append(opts, kgo.WithHooks(kotel.NewKotel(kotel.WithTracer(tracer)).Hooks()...))...)
```

`kotel` injects `traceparent` into produced records and extracts it on fetch into `r.Context`. In the handler, start the process span from the record and attach it to the worker's own (cancelable) context:

```go
_, span := tracer.WithProcessSpan(r)
defer span.End()
ctx = trace.ContextWithSpan(ctx, span)
```

The process span's context is built from `r.Context`, which is not canceled at shutdown; keep the worker's context for the work.

## Metrics

- `kprom.NewMetrics("<namespace>", kprom.Registerer(reg))` passed to `kgo.WithHooks` gives connection, request, produce and fetch byte counters and buffered-record gauges; `plugin/kotel` has an OpenTelemetry meter (`kotel.NewMeter`) for projects on OpenTelemetry metrics.
- The service adds what only it knows: records handled and failed per topic, handler duration, dead-lettered records.
- Lag from outside the consumer ([consumer.md](consumer.md), "Lag").

## Health

Readiness may check `cl.Ping(ctx)` with a short deadline for a producer that a request path needs. Liveness never checks Kafka: a broker outage would restart every pod and make it worse. A consumer that can't reach the brokers shows up as lag and fetch errors, not as a failing probe ([go-observability](../../go-observability/SKILL.md), `obs-kubernetes-probe-paths`).
