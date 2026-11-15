# Manual Constructor Injection

Manual DI is the simplest approach — pass dependencies through constructors. No library, no magic. It is the team's way at every project size.

## Complete Application Example

```go
func main() {
    if err := run(); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
}

func run() error {
    ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
    defer stop()

    // Layer 1: Configuration
    cfg := LoadConfig()
    logger, err := logging.NewLogger(cfg.Logging) // *zap.Logger, built once and injected
    if err != nil {
        return fmt.Errorf("logger: %w", err)
    }
    defer logger.Sync()

    // Layer 2: Infrastructure
    db, err := postgres.Connect(cfg.DatabaseURL)
    if err != nil {
        return fmt.Errorf("connect database: %w", err) // handled once, by main
    }
    defer db.Close()

    cache := redis.NewClient(cfg.RedisURL)
    defer cache.Close()

    mailer := smtp.NewMailer(cfg.SMTPAddr)

    // Layer 3: Repositories
    userRepo := postgres.NewUserRepository(db)
    orderRepo := postgres.NewOrderRepository(db)

    // Layer 4: Services
    userSvc := service.NewUserService(userRepo, cache, mailer, logger.Named("users"))
    orderSvc := service.NewOrderService(orderRepo, userSvc, logger.Named("orders"))
    paymentSvc := service.NewPaymentService(orderRepo, cfg.StripeKey, logger.Named("payments"))

    // Layer 5: Transport
    handler := http.NewHandler(userSvc, orderSvc, paymentSvc, logger)
    server := http.NewServer(cfg.Port, handler)

    // Run
    go server.ListenAndServe()
    <-ctx.Done()
    return server.Shutdown(context.Background())
}
```

## When Manual DI Works Well

- Projects of any size (the team adopts no DI library)
- Simple dependency graph with clear layering
- Lifecycle written once in the composition root
- Team prefers explicit, visible wiring

## What Manual DI Costs, and How the Team Handles It

- Adding a new service means editing `run()` (or `internal/app`) and getting the wiring order right: follow the layer order; a missing argument is a compile error
- Lifecycle management (health checks, graceful shutdown) must be hand-coded with `defer`: the composition root owns it, in the order of [go-concurrency](../../../go-concurrency/SKILL.md)
- No lazy initialization — all services are created at startup, even if unused: a service that owns an expensive client can create it on first use (`sync.OnceValues`)
- Cross-cutting concerns (logging, tracing) must be threaded through every constructor: that is intended; give each component a child logger (`logger.Named("orders")`)
- With 30+ services, the wiring code grows: move it to `internal/app` and group inputs in deps structs

Manual DI is the team's default at every size; no DI library is adopted. Dependencies MUST be initialized in order — infrastructure first, then repositories, then services, then transport.
