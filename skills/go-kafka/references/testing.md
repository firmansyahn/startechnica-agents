# Testing Kafka code

Part of [go-kafka](../SKILL.md); its rules win where this file is less strict. Test style (table tests, `t.Context()`, no sleeps) is [go-testing](../../go-testing/SKILL.md).

## What each level proves

| Level | Runs against | Proves | Doesn't prove |
|---|---|---|---|
| Handler | nothing: a decoded event in, effects out (a real database where the handler writes one, `test-real-database`) | Decoding, validation, the Domain call, idempotency (`kafka-idempotent-handler`), which errors are permanent | Anything about offsets |
| Client wiring | `kfake`, in the test process, with SASL on | The SASL login, the poll loop, commits after processing, the dead-letter path, rebalances between two members, shutdown order | Broker configs, the production ACLs, TLS, real transaction markers |
| Broker | the broker image production runs, through testcontainers, with SASL on | Transactions end to end, the login against a real authorizer, TLS settings, topic configs, compaction | Production sizing |

Tests log in like production (`kafka-authenticated-connection`): an unauthenticated test cluster would let a client that skips the login pass.

All three run in plain `go test ./...` and block the merge. The broker level may sit behind the project's existing switch for container tests (an env var naming the Docker host); it is never skipped silently in CI.

**Why `kfake` is not a mock.** `test-real-database` forbids expectations on query text because they pass while the real query is wrong. `kfake` is different: it is an in-process cluster that speaks the Kafka wire protocol, maintained with franz-go and used for its own tests, so the test runs the real `kgo` client, real group membership and real commits. What it can't vouch for is the broker's own behaviour, which is what the broker level is for. A hand-written fake of `*kgo.Client` with call expectations is not adopted.

## A kfake cluster per test

```go
const (
	testUser = "orders-test"
	testPass = "test-secret"
)

// newCluster starts a one-broker fake cluster with SASL on and the topics, closed on cleanup.
func newCluster(t *testing.T, partitions int32, topics ...string) []string {
	t.Helper()
	c, err := kfake.NewCluster(
		kfake.NumBrokers(1),
		kfake.EnableSASL(),
		kfake.Superuser("SCRAM-SHA-512", testUser, testPass),
		kfake.SeedTopics(partitions, topics...),
	)
	if err != nil {
		t.Fatalf("kfake: %v", err)
	}
	t.Cleanup(c.Close)
	return c.ListenAddrs()
}

// testSASL writes the password to a file, as production mounts it, and returns the settings block.
func testSASL(t *testing.T) kafka.SASL {
	t.Helper()
	path := filepath.Join(t.TempDir(), "password")
	if err := os.WriteFile(path, []byte(testPass+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	return kafka.SASL{Mechanism: "SCRAM-SHA-512", Username: testUser, PasswordFile: path}
}

func TestConsumerCommitsAfterHandling(t *testing.T) {
	t.Parallel()
	brokers := newCluster(t, 3, "orders.v1", "orders.v1.dlq")
	ctx := t.Context()

	producer, err := kgo.NewClient(
		kgo.SeedBrokers(brokers...),
		kgo.SASL(scram.Auth{User: testUser, Pass: testPass}.AsSha512Mechanism()),
	)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(producer.Close)
	for i := range 10 {
		rec := &kgo.Record{Topic: "orders.v1", Key: []byte(fmt.Sprintf("order-%d", i)), Value: []byte(`{"type":"order.placed"}`)}
		if err := producer.ProduceSync(ctx, rec).FirstErr(); err != nil {
			t.Fatal(err)
		}
	}

	handled := make(chan string, 10)
	handler := func(_ context.Context, r *kgo.Record) error {
		handled <- string(r.Key)
		return nil
	}
	cfg := kafka.Config{Brokers: brokers, ClientID: "billing-test", Group: "billing-test", Topics: []string{"orders.v1"}, SASL: testSASL(t)}
	c, err := kafka.NewConsumer(cfg, producer, handler, zaptest.NewLogger(t))
	if err != nil {
		t.Fatal(err)
	}
	runCtx, stop := context.WithCancel(ctx)
	done := make(chan error, 1)
	go func() { done <- c.Run(runCtx) }()

	for range 10 {
		select {
		case <-handled:
		case <-time.After(10 * time.Second):
			t.Fatal("timed out waiting for records")
		}
	}
	stop()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	c.Close() // final commit

	offsets, err := kadm.NewClient(producer).FetchOffsets(ctx, "billing-test")
	if err != nil {
		t.Fatal(err)
	}
	var committed int64
	for _, ps := range offsets {
		for _, o := range ps {
			committed += o.At
		}
	}
	if committed != 10 {
		t.Fatalf("committed offsets sum to %d, want 10", committed)
	}
}
```

- Each test gets its own cluster: tests run in parallel without sharing topics or groups.
- Wait on a channel with a deadline, never `time.Sleep` (`test-no-sleep`).
- Cases worth a test each: a handler that fails permanently sends the record to `<topic>.dlq` and still commits; a handler that fails during shutdown leaves the offset uncommitted; a second consumer joining takes partitions and nothing is handled twice except across the rebalance; a produce error (inject one with `c.ControlKey(int16(kmsg.Produce), ...)`) reaches the caller.
- `kfake` is a separate module (`github.com/twmb/franz-go/pkg/kfake`), versioned by pseudo-versions; pin it in `go.mod` like any test dependency.

## A real broker

```go
func startBroker(t *testing.T) []string {
	t.Helper()
	// SASL on, with a SCRAM-SHA-256 service account as the superuser.
	ctr, err := redpanda.Run(t.Context(), "docker.redpanda.com/redpandadata/redpanda:<version production runs>",
		redpanda.WithEnableSASL(),
		redpanda.WithEnableKafkaAuthorization(),
		redpanda.WithNewServiceAccount(testUser, testPass),
		redpanda.WithSuperusers(testUser),
	)
	testcontainers.CleanupContainer(t, ctr)
	if err != nil {
		t.Fatalf("start broker: %v", err)
	}
	seed, err := ctr.KafkaSeedBroker(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	return []string{seed}
}
```

- Apache Kafka: `github.com/testcontainers/testcontainers-go/modules/kafka` (`kafka.Run(ctx, image, kafka.WithClusterID("test"))`, then `ctr.Brokers(ctx)`). Redpanda: `modules/redpanda` (`redpanda.Run`, `KafkaSeedBroker`, `SchemaRegistryAddress`). Use the broker production runs, at its version.
- Clients of the container log in with `SCRAM-SHA-256` (`scram.Auth{...}.AsSha256Mechanism()`, or `testSASL` with that mechanism). To test the service's own ACLs, add a second, non-super account and grant it only what production grants.
- One container per package (started in `TestMain` or a `sync.OnceValue`), with a unique topic and group name per test, keeps the suite fast.
- Create topics in the test with `kadm`, as production does; don't turn on auto-creation to save a line.
