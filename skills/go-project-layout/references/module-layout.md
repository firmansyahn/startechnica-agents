# Module and directory layout for a Go server

Sources: the official [Organizing a Go module](https://go.dev/doc/modules/layout) guide and [golang-standards/project-layout](https://github.com/golang-standards/project-layout) (a community collection, explicitly not an official standard).

## The official guide, applied

The Go team's guide describes several shapes. A service is the **server project**:

> Server projects typically won't have packages for export ... keep the Go packages implementing the server's logic in the `internal` directory ... keep all Go commands together in a `cmd` directory.

| Guide rule | In practice |
|---|---|
| `go.mod` at the module root; path is where it's hosted | `<module-root>/go.mod`, `module <host>/<group>/<repo>` (add the subfolder when the module isn't at the repo root, e.g. a repo that also holds a frontend app, `deploy/`, `docs/`) |
| Commands under `cmd/<binary>/`, `package main` | `cmd/<service>/` builds the service binary; tools get their own `cmd/<tool>/` |
| Server logic in `internal/` | everything in `internal/<pkg>/`; the compiler stops other modules importing it |
| Split shareable code into a separate module | if another repo must reuse something, give it its own module; never add `pkg/` |
| One package per directory; files in it share the package name | `internal/customer/*.go` are all `package customer`; tests may use `package customer_test` for black-box tests |

A second binary (a CLI tool, a migration runner, a data conversion) is a new `cmd/<name>/main.go` that imports `internal/` packages; it belongs to the Root layer. A code generator that is `package main` may live beside the code it generates (`internal/database/gen/`).

## golang-standards/project-layout, filtered

| Directory | Verdict | Why |
|---|---|---|
| `/cmd` | **use** | same as the official guide; keep `main` small |
| `/internal` | **use** | compiler-enforced privacy; all of a server's Go code |
| `/internal/app` | **use** for a service with more than a few components | the composition root: builds and wires everything, owns startup and shutdown |
| `/internal/pkg` | **don't** | split by layer, not shared/non-shared |
| `/pkg` | **don't** | a server exports nothing; `internal` is stronger |
| `/vendor` | **don't** | modules plus the CI module cache (`GOMODCACHE`) |
| `/src` | **don't** | a Java habit the official guide warns against |
| `/api` | **use** for API specs (OpenAPI, protobuf) | generate a spec from the route table where possible, and never hand-edit a generated one |
| `/web` | not used: the frontend is its own app folder | a frontend is a separate app beside the module, not inside it |
| `/configs` | `.env.example` or a config template | the real `.env` is gitignored |
| `/build/package`, `/build/ci` | Dockerfiles and CI files, wherever the project keeps them | keep existing names |
| `/deployments` | repo-level `deploy/` | the guide notes `/deploy` as the common alias |
| `/scripts`, `/tools` | repo-level `tools/` or `scripts/` | |
| `/test` | package-local `testdata/` and a `dbtest` helper package | Go ignores `testdata/`; a separate external test app is rarely needed |
| `/docs` | repo-level `docs/` | an architecture doc that maps the layers belongs here |

Don't create empty directories "for the layout". Add one only when there's a file to put in it.

## Packages

- Name a package for what it provides, short and singular: `customer`, `notify`, `invoice`. No `util`, `common`, `helpers`, `base`, `types`.
- The package name is the last path element; no import alias needed. Alias only on a real clash.
- Don't stutter: `customer.Store`, not `customer.CustomerStore`.
- Each package has one doc comment (`// Package customer ...`) in its main file.
- One concept per package. A package that both serves HTTP and holds business rules gets split into a Domain package and a Surface handler.

## Layers

| Layer | Typical packages | May import |
|---|---|---|
| Root | `cmd/<binary>`, `internal/app` | everything |
| Surface | `internal/api/<surface>/<area>` (one per API surface: public, console/admin, internal callbacks) | Domain, Platform, Kernel |
| Domain | `internal/<feature>` (billing, notify, sessions, a vendor client) | Platform, Kernel, and other Domain packages where the project allows |
| Platform | `internal/database` (+`dbtest`), `internal/config`, `internal/health`, `internal/httpx` | Kernel |
| Kernel | `internal/models` or per-concept value packages | standard library only |

Enforce it with an architecture test in `internal/archtest`: list every package (`go list -deps -json ./...` or `golang.org/x/tools/go/packages`), require each to be classified into a layer (an unclassified package fails), and fail on an import that points up, or on a server-side `net/http` type in a layer that may not serve HTTP. Keep any temporary exceptions in an allowlist that only shrinks: an entry that no longer matches a violation fails too.

## Where new code goes

1. Pure entity, value type, rule or unit conversion, no I/O → Kernel (`internal/models` or a small value package).
2. Schema, migration, connection pool, shared query or row accessor → `internal/database` (Platform).
3. Cross-cutting HTTP plumbing (reply envelopes, error mapping, tenant resolution, route mounting, access log, auth middleware) → `internal/httpx` (Platform).
4. Business logic, vendor client, poller or background job → `internal/<feature>` (Domain). No `http.ResponseWriter`, `http.HandlerFunc` or `http.ServeMux`; an outbound `http.Client` is fine.
5. An endpoint → `internal/api/<surface>/<area>` (Surface), delegating to Domain. Two surfaces exposing the same thing (a console API and a public API) reuse the same Domain code; only the request/response shapes and auth differ.
6. Flags, wiring, process lifecycle → `internal/app`, called from a thin `cmd/<service>`.

Then classify the package in the architecture test (if there is one) and run it.

## Worker shape (Domain)

```go
// Package reaper closes sessions whose client stopped reporting.
package reaper

type Reaper struct {
	db       *database.DB
	log      *slog.Logger
	interval time.Duration
	now      func() time.Time

	stop chan struct{}
	done chan struct{}
}

func New(db *database.DB, log *slog.Logger, interval time.Duration) *Reaper {
	return &Reaper{db: db, log: log, interval: interval, now: time.Now}
}

// Start runs the loop until ctx ends or Stop is called.
func (r *Reaper) Start(ctx context.Context) {
	r.stop = make(chan struct{})
	r.done = make(chan struct{})
	go func() {
		defer close(r.done)
		t := time.NewTicker(r.interval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-r.stop:
				return
			case <-t.C:
				if err := r.sweep(ctx); err != nil {
					r.log.Warn("reap stale sessions", "error", err)
				}
			}
		}
	}()
}

// Stop signals the loop and waits for it to exit.
func (r *Reaper) Stop() {
	close(r.stop)
	<-r.done
}
```

The composition root constructs it, calls `Start(ctx)`, and calls `Stop()` during shutdown before closing the database.

## `main` shape

```go
func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	// parse flags, load config, open db, build services (internal/app), serve,
	// wait for ctx, shut down in reverse order
	return nil
}
```
