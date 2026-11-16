---
title: Import only downward through the layers
impact: MEDIUM
tags: architecture, layering, imports
check: test (architecture test)
---

## Import only downward through the layers

**Impact: MEDIUM** (upward imports tie business rules to HTTP and wiring, create import cycles, and make packages impossible to test or move alone)

Root → Surface → Domain → Platform → Kernel ([go-project-layout](../SKILL.md), "Layers"). A package imports only its own layer (where the project allows) and the layers below. Domain and Kernel never use server-side HTTP types (`http.ResponseWriter`, `http.Handler`, `ServeMux`); an outbound `http.Client` is fine. A new package gets its layer classification in the same change.

**Incorrect:**

```go
// internal/billing (Domain)
import "example.com/app/internal/api/console/billing" // Surface

func (s *Service) Charge(w http.ResponseWriter, r *http.Request) { /* ... */ }
```

**Correct:**

```go
// internal/billing (Domain)
func (s *Service) Charge(ctx context.Context, in ChargeInput) (Receipt, error) { /* ... */ }

// internal/api/console/billing (Surface)
func (h *Handler) charge(w http.ResponseWriter, r *http.Request) {
	rcpt, err := h.billing.Charge(r.Context(), in)
	// ...
}
```

**How to check:** the project's architecture test (a `go test` that runs `go list -deps -json ./...`, maps every package to a layer and fails on an upward import or an unclassified package). Without one, check the imports of each changed package by hand and suggest adding the test. Never add an allowlist entry to make a new violation pass.
