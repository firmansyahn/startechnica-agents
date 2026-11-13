# Application Configuration with Cobra + Viper

> **Team:** settings are loaded with koanf by one `internal/config` package in the Platform layer, not Viper in `cmd/`; `main` calls `config.Load` and hands each block to the constructors. See the `go-knadh-koanf` skill, which wins where this page differs. The Viper shape below is upstream's, kept for reading a project that already uses it.

## Where Config Lives

```
myapp/
├── cmd/myapp/
│   ├── main.go                # Entry point
│   ├── root.go                # Root command + Viper init
│   ├── serve.go               # Subcommand with flags
│   └── config.go              # Config struct + loader
└── configs/
    └── config.yaml            # Default config file
```

## Config Struct

Define configuration as a struct with `mapstructure` tags matching your YAML keys:

```go
// cmd/myapp/config.go
package main

import (
    "fmt"

    "github.com/spf13/viper"
)

type Config struct {
    Port     int    `mapstructure:"port"`
    Host     string `mapstructure:"host"`
    LogLevel string `mapstructure:"log-level"`
    Database struct {
        DSN     string `mapstructure:"dsn"`
        MaxConn int    `mapstructure:"max-conn"`
    } `mapstructure:"database"`
}

func loadConfig() (Config, error) {
    var cfg Config
    if err := viper.Unmarshal(&cfg); err != nil {
        return Config{}, fmt.Errorf("unmarshaling config: %w", err)
    }
    return cfg, nil
}
```

Configuration MUST be loaded from env vars, files, or flags — NEVER hardcoded. Sensitive values MUST come from env vars or secret managers, NEVER committed config files. (Team, with koanf: the settings file is mounted and never committed, and a secret key also takes a `<name>_file` alternative pointing at a mounted secret.)
