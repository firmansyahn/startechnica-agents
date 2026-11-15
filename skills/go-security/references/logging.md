# Logging Security Rules

Logging sensitive information can lead to data exposure and compliance violations.

**Rules:**

1. PII MUST NEVER be logged — filter passwords, tokens, emails, and personal data.
2. Log injection MUST be prevented — sanitize user input before logging.
3. Error messages MUST NOT expose internals to users — log details server-side, return generic messages.

---

## Table of Contents

- [Sensitive Data in Logs — Medium](#sensitive-data-in-logs--medium)
- [Log Injection — Low](#log-injection--low)
- [Information Leakage in Error Messages — Medium](#information-leakage-in-error-messages--medium)
- [General Logger Security — Low](#general-logger-security--low)
- [Log Security Checklist](#log-security-checklist)
- [CWE References](#cwe-references)

## Sensitive Data in Logs — Medium

**Bad:**

```go
type User struct {
    ID       string
    Username string
    Password string
    Token    string
}

func logUserLogin(user *User) {
    log.Printf("User logged in: %+v\n", user)  // DON'T: Logs password, token
}
```

**Good:**

```go
import "go.uber.org/zap"

func logUserLogin(logger *zap.Logger, user *User) {
    logger.Info("user_login",
        zap.String("user_id", user.ID),
        zap.String("username", user.Username),
        // Don't log: password, token
    )
}
```

---

## Log Injection — Low

User input in logs can lead to log injection attacks.

**Bad:**

```go
log.Printf("User logged in: %s\n", username)  // DON'T: No sanitization
```

**Good:**

```go
import "go.uber.org/zap"

// Sanitize user input before logging
func sanitizeLogInput(input string) string {
    // Remove control characters
    var result strings.Builder
    for _, r := range input {
        if !unicode.IsControl(r) || r == '\n' || r == '\t' {
            result.WriteRune(r)
        }
    }
    return result.String()
}

func logUsername(logger *zap.Logger, username string) {
    sanitized := sanitizeLogInput(username)
    logger.Info("user_login", zap.String("username", sanitized))
}
```

---

## Information Leakage in Error Messages — Medium

**Bad:**

```go
func handleDatabaseError(err error) error {
    return fmt.Errorf("database error: %v", err)  // DON'T: Leaks internal details
}

func dbErrorToHTTP(err error) {
    http.Error(w, "Error: "+err.Error(), 500)  // DON'T
}
```

**Good:**

```go
func handleDatabaseError(logger *zap.Logger, err error) error {
    // Log detailed error for debugging
    logger.Error("database_error", zap.Error(err))
    // Return generic message to client
    return errors.New("database operation failed")
}

func dbErrorToHTTP(w http.ResponseWriter, logger *zap.Logger, err error) {
    logger.Error("database_error", zap.Error(err))
    http.Error(w, "Internal server error", http.StatusInternalServerError)
}
```

---

## General Logger Security — Low

**Bad:**

```go
import "log"
log.Println("User logged in:", user.ID, password)  // DON'T: Logs password
fmt.Printf("DEBUG: %+v\n", data)  // DON'T: Raw data
```

**Good:**

```go
import (
    "go.elastic.co/ecszap"
    "go.uber.org/zap"
    "go.uber.org/zap/zapcore"
)

// json (ECS) to stdout at info, built once in main and injected
core := ecszap.NewCore(ecszap.NewDefaultEncoderConfig(), zapcore.Lock(os.Stdout), zapcore.InfoLevel)
logger := zap.New(core)

logger.Info("user_login",
    zap.String("user_id", userID),
    zap.String("ip_address", request.RemoteIP),
)
```

---

## Log Security Checklist

- [ ] No passwords, tokens, or secrets in logs
- [ ] No PII/PHI in production logs
- [ ] Sanitize user input before logging
- [ ] Use structured logging (JSON)
- [ ] Implement log level strategy
- [ ] Separate access logs from error logs
- [ ] Log file permissions restricted (e.g., 600)
- [ ] Log rotation prevents disk exhaustion
- [ ] Generic error messages to clients
- [ ] Detailed errors only in internal logs

---

## CWE References

- **CWE-532**: Insertion of Sensitive Information into Log File
- **CWE-117**: Improper Output Neutralization for Logs
- **CWE-209**: Information Exposure Through an Error Message
- **CWE-200**: Exposure of Sensitive Information
- **CWE-312**: Cleartext Storage of Sensitive Information
