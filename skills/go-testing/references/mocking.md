# Mocking and Test Fixtures

## Table of Contents

- [Hand-Written Fakes](#hand-written-fakes)
- [Fake Organization](#fake-organization)
- [Test Fixtures](#test-fixtures)
- [Time Mocking](#time-mocking)

## Hand-Written Fakes

Create small interfaces for your dependencies where they are consumed, then write a fake that implements them: canned answers in, recorded calls out. No mock library and no mock generator: a fake is a few lines of plain Go, compile-checked against the interface, and the test asserts on what it recorded.

```go
// Define the interface
type Database interface {
    GetUser(id string) (*User, error)
    CreateUser(user *User) error
}

// Hand-written fake
type fakeDatabase struct {
    users   map[string]*User // canned answers for GetUser
    getErr  error            // forced error for GetUser
    created []*User          // recorded CreateUser calls
}

func (f *fakeDatabase) GetUser(id string) (*User, error) {
    if f.getErr != nil {
        return nil, f.getErr
    }
    u, ok := f.users[id]
    if !ok {
        return nil, ErrNotFound
    }
    return u, nil
}

func (f *fakeDatabase) CreateUser(user *User) error {
    f.created = append(f.created, user)
    return nil
}

// Usage in tests
func TestService_GetUser(t *testing.T) {
    expectedUser := &User{ID: "1", Name: "John"}
    db := &fakeDatabase{users: map[string]*User{"1": expectedUser}}
    service := NewService(db)

    user, err := service.GetUser("1")

    if err != nil {
        t.Fatalf("GetUser: %v", err)
    }
    if user != expectedUser {
        t.Errorf("GetUser = %+v, want %+v", user, expectedUser)
    }
}

func TestService_GetUser_NotFound(t *testing.T) {
    service := NewService(&fakeDatabase{})

    user, err := service.GetUser("999")

    if !errors.Is(err, ErrNotFound) {
        t.Fatalf("GetUser error = %v, want ErrNotFound", err)
    }
    if user != nil {
        t.Errorf("GetUser user = %+v, want nil", user)
    }
}
```

A fake called from several goroutines guards its recorded fields with a `sync.Mutex`, or `-race` will flag the test.

## Fake Organization

For larger codebases, keep fakes beside the tests of the code that consumes the interface:

```go
// user_service.go
type UserService struct {
    db    Database
    email EmailService
}
type Database interface {
    GetUser(id string) (*User, error)
    CreateUser(user *User) error
}
type EmailService interface {
    SendWelcomeEmail(to string) error
}
```

```go
// user_service_test.go
package mypackage_test

import (
    "slices"
    "testing"
    "path/to/mypackage"
)

// fakeDatabase implements mypackage.Database
type fakeDatabase struct {
    created []*mypackage.User
}
func (f *fakeDatabase) GetUser(id string) (*mypackage.User, error) {
    return nil, mypackage.ErrNotFound
}
func (f *fakeDatabase) CreateUser(user *mypackage.User) error {
    f.created = append(f.created, user)
    return nil
}

// fakeEmailService implements mypackage.EmailService
type fakeEmailService struct {
    sent []string
    err  error
}
func (f *fakeEmailService) SendWelcomeEmail(to string) error {
    f.sent = append(f.sent, to)
    return f.err
}

// Compile-time checks that the fakes still match the interfaces.
var (
    _ mypackage.Database     = (*fakeDatabase)(nil)
    _ mypackage.EmailService = (*fakeEmailService)(nil)
)

func TestUserService_CreateUser(t *testing.T) {
    db := &fakeDatabase{}
    email := &fakeEmailService{}
    service := mypackage.NewUserService(db, email)

    user := &mypackage.User{Name: "Test", Email: "test@example.com"}

    if err := service.CreateUser(user); err != nil {
        t.Fatalf("CreateUser: %v", err)
    }
    if len(db.created) != 1 || db.created[0] != user {
        t.Errorf("created users = %+v, want [%+v]", db.created, user)
    }
    if want := []string{"test@example.com"}; !slices.Equal(email.sent, want) {
        t.Errorf("welcome emails sent to %q, want %q", email.sent, want)
    }
}
```

A fake shared by several packages' tests goes in a small test-support package (like `net/http/httptest`), not in a generated `mocks/` folder.

## Test Fixtures

Create reusable test data in a separate package or file:

```go
package fixtures

import "time"

var (
    DefaultUser = &User{
        ID:        "user-123",
        Name:      "Jane Doe",
        Email:     "jane@example.com",
        CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
    }

    AdminUser = &User{
        ID:        "admin-1",
        Name:      "Admin User",
        Email:     "admin@example.com",
        Role:      "admin",
        CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
    }
)

func NewUser(name, email string) *User {
    return &User{
        ID:        "user-" + uuid.New().String(),
        Name:      name,
        Email:     email,
        CreatedAt: time.Now(),
    }
}
```

## Time Mocking

Use `clockwork` to test time-dependent code without `time.Sleep()`:

```go
import (
    "testing"
    "time"
    "github.com/jonboulle/clockwork"
)

func TestScheduler_AddJob(t *testing.T) {
    fakeClock := clockwork.NewFakeClock()
    scheduler := NewScheduler(fakeClock)

    job := &Job{ID: "1", RunAt: time.Now().Add(1 * time.Hour)}
    scheduler.AddJob(job)

    if got := scheduler.PendingCount(); got != 1 {
        t.Fatalf("pending before advance = %d, want 1", got)
    }

    // Advance fake time
    fakeClock.Advance(2 * time.Hour)

    if got := scheduler.PendingCount(); got != 0 {
        t.Errorf("pending after advance = %d, want 0", got)
    }
}
```

Install clockwork:

```bash
go get github.com/jonboulle/clockwork
```
