> **Absorbed into `go-project-layout`.** This is `samber/cc-skills-golang@golang-dependency-injection` (MIT, Samuel Berthe; commit in [UPSTREAM.md](../UPSTREAM.md)), kept as the depth for dependency injection. The team's rules and decisions in [SKILL.md](../SKILL.md) win where the two differ.

**Persona:** You are a Go software architect. You guide teams toward testable, loosely coupled designs — you choose the simplest DI approach that solves the problem, and you never over-engineer.

**Orchestration mode:** Fan out the three sub-agents described in Refactor mode (global/init discovery, concrete-dependency mapping, service-locator detection) when refactoring a large coupled codebase toward dependency injection, and consolidate into one migration plan. To opt in explicitly: `ultracode` on Claude Code; `orchestrate` on oh-my-pi (`workflowz` for a deterministic multi-subagent workflow); on OpenCode, ask the agent to delegate to subagents, or mention one (`@general`).

**Modes:**

- **Design mode** (new project, new service, or adding a service to an existing DI setup): assess the existing dependency graph and lifecycle needs; wire it by hand through constructors (the team adopts no DI library); then generate the wiring code.
- **Refactor mode** (existing coupled code): use up to 3 parallel sub-agents — Agent 1 identifies global variables and `init()` service setup, Agent 2 maps concrete type dependencies that should become interfaces, Agent 3 locates service-locator anti-patterns (container passed as argument) — then consolidate findings and propose a migration plan.

# Dependency Injection in Go

Dependency injection (DI) means passing dependencies to a component rather than having it create or find them. In Go, this is how you build testable, loosely coupled applications — your services declare what they need, and the caller (the composition root) provides it.

This skill is not exhaustive. The DI libraries (google/wire, uber-go/dig, uber-go/fx, samber/do) are not adopted by the team; they are described below only for reading code that already uses one, and the library's official documentation has the current API signatures.

For interface-based design foundations (accept interfaces, return structs), see the `samber/cc-skills-golang@golang-structs-interfaces` skill.

## Best Practices Summary

1. Dependencies MUST be injected via constructors — NEVER use global variables or `init()` for service setup
2. Projects of every size MUST use manual constructor injection — no DI library (the team adopts none)
3. Interfaces MUST be defined where consumed, not where implemented — accept interfaces, return structs
4. NEVER use global registries or package-level service locators
5. Wiring MUST only happen at the composition root (`main()`/`run()` or `internal/app`) — NEVER pass a container or registry as a dependency
6. **Build in layer order at startup** — infrastructure, repositories, services, transport; a broken dependency fails the start, not the first request
7. **Construct stateful services once** (DB connections, caches) and share them; stateless helpers can be built where they are used
8. **Mock at the interface boundary** — DI makes this trivial
9. **Keep the dependency graph shallow** — deep chains signal design problems
10. **Grow the wiring, not a container** — past about four dependencies use a deps struct or functional options, and a larger service moves the wiring to `internal/app`

## Why Dependency Injection?

| Problem without DI | How DI solves it |
| --- | --- |
| Functions create their own dependencies | Dependencies are injected — swap implementations freely |
| Testing requires real databases, APIs | Pass mock implementations in tests |
| Changing one component breaks others | Loose coupling via interfaces — components don't know each other's internals |
| Services initialized everywhere | The composition root builds each service once and owns its lifecycle |
| Global state and `init()` functions | Explicit wiring at startup — predictable, debuggable |

DI shines in applications with many interconnected services — HTTP servers, microservices, CLI tools with plugins. For a small script with 2-3 functions, manual wiring is fine. Don't over-engineer.

## Manual Constructor Injection (No Library)

Pass dependencies through constructors, at every project size. See [Manual DI examples](dependency-injection/manual-di.md) for a complete application example.

```go
// ✓ Good — explicit dependencies, testable
type UserService struct {
    db     UserStore
    mailer Mailer
    log    *zap.Logger
}

func NewUserService(db UserStore, mailer Mailer, log *zap.Logger) *UserService {
    return &UserService{db: db, mailer: mailer, log: log}
}

// main.go — manual wiring; main calls run() and is the only place that exits
func run(cfg config.Config) error {
    log, err := logging.NewLogger(cfg.Logging)
    if err != nil {
        return fmt.Errorf("logger: %w", err)
    }
    defer log.Sync()

    db := postgres.NewUserStore(cfg.Database.URL)
    mailer := smtp.NewMailer(cfg.SMTP.Addr)
    userSvc := NewUserService(db, mailer, log.Named("users"))
    orderSvc := NewOrderService(db, log.Named("orders"))
    api := NewAPI(userSvc, orderSvc, log)
    return api.ListenAndServe(":8080")
}
```

```go
// ✗ Bad — hardcoded dependencies, untestable
type UserService struct {
    db *sql.DB
}

func NewUserService() *UserService {
    db, _ := sql.Open("postgres", os.Getenv("DATABASE_URL")) // hidden dependency
    return &UserService{db: db}
}
```

When manual wiring grows, it stays manual:

- 15+ services with cross-dependencies: move the wiring to `internal/app` and group a service's inputs in a deps struct
- Lifecycle management (health checks, graceful shutdown): the composition root starts and stops services in order (shutdown order is in [go-concurrency](../../go-concurrency/SKILL.md))
- Lazy initialization: the service that owns an expensive client creates it on first use (`sync.OnceValues`), still from injected config
- Fragile wiring order: build in layer order; a missing constructor argument is a compile error

## DI Library Comparison

> **Not adopted by the team:** this comparison is background for reading code that already uses a DI library; new wiring is by hand, as above.

Go has three main approaches to DI libraries:

- [google/wire examples](dependency-injection/google-wire.md) — Compile-time code generation
- [uber-go/dig + fx examples](dependency-injection/uber-dig-fx.md) — Reflection-based framework
- [samber/do examples](dependency-injection/samber-do.md) — Generics-based, no code generation

### Decision Table

| Criteria | Manual | google/wire | uber-go/dig + fx | samber/do |
| --- | --- | --- | --- | --- |
| **Project size** | Small (< 10 services) | Medium-Large | Large | Any size |
| **Type safety** | Compile-time | Compile-time (codegen) | Runtime (reflection) | Compile-time (generics) |
| **Code generation** | None | Required (`wire_gen.go`) | None | None |
| **Reflection** | None | None | Yes | None |
| **API style** | N/A | Provider sets + build tags | Struct tags + decorators | Simple, generic functions |
| **Lazy loading** | Manual | N/A (all eager) | Built-in (fx) | Built-in |
| **Singletons** | Manual | Built-in | Built-in | Built-in |
| **Transient/factory** | Manual | Manual | Built-in | Built-in |
| **Scopes/modules** | Manual | Provider sets | Module system (fx) | Built-in (hierarchical) |
| **Health checks** | Manual | Manual | Manual | Built-in interface |
| **Graceful shutdown** | Manual | Manual | Built-in (fx) | Built-in interface |
| **Container cloning** | N/A | N/A | N/A | Built-in |
| **Debugging** | Print statements | Compile errors | `fx.Visualize()` | `ExplainInjector()`, web interface |
| **Go version** | Any | Any | Any | 1.18+ (generics) |
| **Learning curve** | None | Medium | High | Low |

### Quick Comparison: Wiring Style

The same graph — `Config -> Database -> UserStore -> UserService -> API` — wired by hand and by a container. The contrast is what the wiring code encodes: an ordered call sequence you maintain, versus a set of providers the container orders for you.

```go
// Manual — you own the order; adding a dependency means editing every call site downstream
cfg := NewConfig()
db := NewDatabase(cfg)
store := NewUserStore(db)
svc := NewUserService(store)
api := NewAPI(svc)
api.Run()
// No shutdown hooks, health checks, or lazy loading — add them yourself

// Container (samber/do) — order is derived from the constructor signatures
i := do.New()
do.Provide(i, NewConfig)
do.Provide(i, NewDatabase)
do.Provide(i, NewUserStore)
do.Provide(i, NewUserService)
api := do.MustInvoke[*API](i)
api.Run()
defer i.Shutdown() // shutdown and health checks come from the container
```

google/wire and uber-go/fx express the same graph differently: wire generates the manual sequence above at build time from a `wire.Build` provider list (cleanup via `func()` returned by providers, no lifecycle hooks), while fx registers providers with `fx.Provide` and resolves them by reflection at runtime with `OnStart`/`OnStop` hooks. Full wiring examples for each: [google/wire](dependency-injection/google-wire.md), [uber-go/dig + fx](dependency-injection/uber-dig-fx.md), [samber/do](dependency-injection/samber-do.md).

## Testing with DI

DI makes testing straightforward — inject mocks instead of real implementations:

```go
// Define a mock
type MockUserStore struct {
    users map[string]*User
}

func (m *MockUserStore) FindByID(ctx context.Context, id string) (*User, error) {
    u, ok := m.users[id]
    if !ok {
        return nil, ErrNotFound
    }
    return u, nil
}

// Test with manual injection
func TestUserService_GetUser(t *testing.T) {
    mock := &MockUserStore{
        users: map[string]*User{"1": {ID: "1", Name: "Alice"}},
    }
    svc := NewUserService(mock, nil, zap.NewNop())

    user, err := svc.GetUser(context.Background(), "1")
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if user.Name != "Alice" {
        t.Errorf("got %q, want %q", user.Name, "Alice")
    }
}
```

### Testing with Real Services and One Mock

Build the real constructors in the test and pass a mock only for the boundary you need to replace:

```go
func TestUserService_WithRealMailer(t *testing.T) {
    // The mock replaces only the UserStore boundary
    store := &MockUserStore{
        users: map[string]*User{"1": {ID: "1", Name: "Alice"}},
    }

    // Other dependencies are the real ones, built by their constructors
    mailer := smtp.NewMailer(testSMTPAddr)
    log := zaptest.NewLogger(t)

    svc := NewUserService(store, mailer, log)
    user, err := svc.GetUser(context.Background(), "1")
    // ... assertions
}
```

This is particularly useful for integration tests where you want most services to be real but need to mock a specific boundary (database, external API, mailer).

## When the Wiring Grows

The team doesn't adopt a DI library at any size; the wiring changes shape instead.

| Signal | Action |
| --- | --- |
| < 10 services, simple dependencies | Constructor calls in `run()` |
| 10-20 services, some cross-cutting concerns | Move the wiring to `internal/app`; deps structs for long parameter lists |
| 20+ services, lifecycle management needed | `internal/app` starts and stops services in order |
| Need health checks, graceful shutdown | Written in the composition root (see [go-concurrency](../../go-concurrency/SKILL.md) for shutdown order) |
| Code already uses a DI library | Read it with the comparison above; new code is wired by hand |

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Global variables as dependencies | Pass through constructors |
| `init()` for service setup | Explicit initialization in `main()`/`run()` or `internal/app` |
| Depending on concrete types | Accept interfaces at consumption boundaries |
| Passing the container everywhere (service locator) | Inject specific dependencies, not the container |
| Deep dependency chains (A->B->C->D->E) | Flatten — most services should depend on repositories and config directly |
| Building the service graph per request | Build once at startup; pass request-scoped values as arguments or in the request context |

## Cross-References

- → See `samber/cc-skills-golang@golang-structs-interfaces` skill for interface design and composition
- → See `samber/cc-skills-golang@golang-testing` skill for testing with dependency injection
- → See `samber/cc-skills-golang@golang-project-layout` skill for DI initialization placement

## References

Library documentation, for reading code that already uses one (not adopted by the team):

- [samber/do/v2 documentation](https://do.samber.dev) | [github.com/samber/do/v2](https://github.com/samber/do)
- [google/wire user guide](https://github.com/google/wire/blob/main/docs/guide.md)
- [uber-go/fx documentation](https://uber-go.github.io/fx/)
- [uber-go/dig](https://github.com/uber-go/dig)
