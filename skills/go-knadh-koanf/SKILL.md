---
name: go-knadh-koanf
description: "Use when a Go service's settings are loaded, added, changed, validated or tested with koanf (github.com/knadh/koanf/v2): the one config package and its Config struct with koanf tags, defaults from a Defaults() struct through the structs provider, the YAML settings file through the file provider, several YAML files layered in order (a repeatable -config flag, a base plus a secrets file, a conf.d directory), the logging block every service carries (level, ECS json or console format, probe logging off by default), strict decoding (unknown keys refused, durations like 5m, weakly typed numbers), validating and normalising each block with errors that name the file and key, an optional default path versus an explicit -config flag, flags that override a setting, secrets inline or as a mounted *_file, the documented example file, and the tests that pin all of it. Also when choosing between koanf and viper, or reviewing a config change. The team uses koanf, not spf13/viper."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go projects that load settings with koanf v2.
metadata:
  author: firmansyahn
  version: "0.2.2"
---

# koanf: loading a Go service's settings

**Principle:** Settings come from one typed Config loaded by koanf, with defaults in code, strict decoding, and errors that name the file and the key.

The team loads settings with [koanf](https://github.com/knadh/koanf) v2, not `spf13/viper`: keys keep their case, each provider and parser is its own module (no dependency tree pulled in for formats you don't use), and decoding goes through `mapstructure`, which can refuse unknown keys. This skill is the team's pattern for it. No established public koanf skill exists to vendor; the samber `golang-spf13-viper` skill is about viper and isn't vendored (`go-how-to`, rule 9).

The project wins where it differs (`go-how-to`, rule 1). Read `go.mod` first: the paths below are koanf v2 (`github.com/knadh/koanf/v2`) with its v1 provider and parser modules and `github.com/go-viper/mapstructure/v2`.

Related: `go-project-layout` (where the config package sits, how settings reach constructors), `go-security` and `sec-no-secrets-in-logs` (secrets in settings), `go-testing` (test style).

## When to use

- Adding, renaming or removing a setting, or a whole block of them
- Setting up configuration in a new Go service
- A service that starts with the wrong value, ignores a key, or refuses its file
- Reviewing a diff that touches the config package, the example file or a `-config`/override flag

## 1. Shape

- **One package**, `internal/config`, in the Platform layer. It reads the file, applies defaults, validates, and returns a plain `Config` value. Nothing else imports koanf.
- **One `Config` struct**, a field per top-level key and a nested struct per block (`PostgreSQL`, `Redis`, `Logging`, ...), each in its own file when it has rules (`postgresql.go`, `redis.go`). Every field has a `koanf:"snake_case"` tag that is its key in the file, and a doc comment saying what it does, its unit and its default.
- **Typed fields:** `time.Duration` for periods (the file says `5m`, `90s`), `int` for ports and counts, `bool` for switches, `[]string` for lists. No `map[string]any` and no `koanf.Koanf` kept after loading.
- **`Defaults() Config`** returns every default in one place. A key the file leaves out keeps its default; a setting with no usable default (a public URL, a key) is checked by `validate`, not given a fake default.
- **Read once, at the root.** `main` calls `config.Load` and hands the blocks to constructors (`NewStore(cfg.PostgreSQL, log)`, `layer-inject-dependencies`). No package-level config variable, no `k.String("a.b")` lookups spread through the code, no reload at runtime (koanf's file watching is not in use).

## 2. Load

```go
// Load reads the YAML file at path over the defaults and checks it. A missing file is an
// error unless optional is set.
func Load(path string, optional bool) (Config, error) {
	k := koanf.New(".")
	if err := k.Load(structs.Provider(Defaults(), "koanf"), nil); err != nil {
		return Defaults(), fmt.Errorf("load defaults: %w", err)
	}
	if err := k.Load(file.Provider(path), yaml.Parser()); err != nil {
		if optional && errors.Is(err, fs.ErrNotExist) {
			cfg := Defaults()
			if err := cfg.validate(path); err != nil {
				return Defaults(), err
			}
			return cfg, nil
		}
		return Defaults(), fmt.Errorf("read config %s: %w", path, err)
	}
	cfg := Defaults()
	err := k.UnmarshalWithConf("", &cfg, koanf.UnmarshalConf{
		Tag: "koanf",
		DecoderConfig: &mapstructure.DecoderConfig{
			Result:           &cfg,
			TagName:          "koanf",
			ErrorUnused:      true,                                        // a misspelled key is an error, not a silent default
			WeaklyTypedInput: true,                                        // port: "8080" as well as port: 8080
			DecodeHook:       mapstructure.StringToTimeDurationHookFunc(), // conn_max_lifetime: 5m
		},
	})
	if err != nil {
		return Defaults(), fmt.Errorf("parse config %s: %w", path, err)
	}
	if err := cfg.validate(path); err != nil {
		return Defaults(), err
	}
	return cfg, nil
}
```

Imports: `github.com/knadh/koanf/v2`, `github.com/knadh/koanf/providers/structs`, `github.com/knadh/koanf/providers/file`, `github.com/knadh/koanf/parsers/yaml`, `github.com/go-viper/mapstructure/v2`.

- **Defaults first, the file over them.** Each `Load` merges into what is there: a later source wins key by key, nested blocks merge, and a list or scalar is replaced whole (a `trusted_proxies:` list in the file replaces the default list, it doesn't add to it).
- **`ErrorUnused: true` is required.** Without it a typo (`max_open_con: 10`) loads silently and the default stays. With it the core refuses to start and names the key.
- **A custom `DecoderConfig` replaces koanf's default one.** koanf still fills in `Result` and the tag name, but its default hooks (durations, `encoding.TextUnmarshaler` types such as `netip.Addr`) and `WeaklyTypedInput` are gone, so the config must list every hook it needs. Add a hook here for any other text type (`mapstructure.ComposeDecodeHookFunc(StringToTimeDurationHookFunc(), StringToSliceHookFunc(","))`); don't parse strings by hand in `validate`.
- **The delimiter is `.`**, so a key can't contain a dot. Keys are case-sensitive.
- Return `Defaults()` with every error, so a caller that logs and exits never sees a half-filled value.

## 3. Validate

`validate(path)` runs after decoding: one method per block that has rules, called in order from `Config.validate`, the first error returned.

- **Check what has no default:** required keys, values from a fixed set (`environment` is `production` or `development`), ranges (`pool_size` at least 1), URLs that must parse, pairs set together (`username` with `password`), alternatives (`key` or `key_file`, not both).
- **Normalise once, here:** fill an empty value that means "the default" (`""` → `production`), lower-case what is compared later, canonicalise URLs and CIDRs. Code that reads `Config` then trusts it.
- **Errors name the file and the dotted key**, as the user writes it, and say what is allowed: `config /etc/app/settings.yaml: secrets.key and secrets.key_file are alternatives, set one`.
- A check that needs the outside world (opening the database, reading a key file the service may not need) stays out of `Load` unless every binary that reads the settings needs it; tools that never touch that part must still load the file.

## 4. The file and its path

- **One YAML file**, path from a `-config` flag with a default path. The default path may be missing (all defaults, then `validate`); a path the user gave must exist. Detect "given" with `flag.Visit`, never by comparing to the default string:

  ```go
  explicit := false
  flag.Visit(func(f *flag.Flag) { explicit = explicit || f.Name == "config" })
  cfg, err := config.Load(*configPath, !explicit)
  ```
- **Several files** layer over each other when one file isn't enough (section 4a).
- **Flags that override a setting** (`-port`, `-db-dsn`) are applied in `main` after `Load`, each documented in its usage text as "overrides `<key>`". The `posflag` provider is not in use.
- **The process environment is not read** (the `env` provider is not in use): a deployment mounts the file, so one place holds every value. If a project adds it, load it after the file with a prefix and a key transform, keep `ErrorUnused`, and document each variable next to its key.
- **Secrets:** a key that holds a secret also takes a `<name>_file` alternative pointing at a mounted secret (`key` / `key_file`), so the settings file and its backups need not carry it. Never log `Config` or a block of it with `%+v`; log the settings you need by name (`sec-no-secrets-in-logs`).
- **The example file** (`.env.example`, `config.example.yaml`) sits beside `go.mod`, lists every key with a comment saying what it does and its default, uses placeholders for hosts and secrets, and is loaded by a test.

## 4a. Several YAML files

koanf merges every source loaded into the same instance, so several YAML files layer the same way the file layers over the defaults. Not in use yet: the services load one file. Reach for it when one file can't serve every case: a base file from a ConfigMap plus a secrets file from a Secret, loaded last (an alternative to `<name>_file` keys), or a shared base plus a small file per environment.

```go
// Files is a repeatable -config flag: each file is loaded over the ones before it.
type Files []string

func (f *Files) String() string     { return strings.Join(*f, ",") }
func (f *Files) Set(v string) error { *f = append(*f, v); return nil }

// Load reads the files in order over the defaults; a later file wins.
func Load(paths []string, optional bool) (Config, error) {
	k := koanf.New(".")
	if err := k.Load(structs.Provider(Defaults(), "koanf"), nil); err != nil {
		return Defaults(), fmt.Errorf("load defaults: %w", err)
	}
	for _, p := range paths {
		if err := k.Load(file.Provider(p), yaml.Parser()); err != nil {
			if optional && len(paths) == 1 && errors.Is(err, fs.ErrNotExist) {
				break // the default path alone may be missing
			}
			return Defaults(), fmt.Errorf("read config %s: %w", p, err)
		}
	}
	name := strings.Join(paths, ", ")
	// ... UnmarshalWithConf and validate(name) exactly as in section 2
}
```

```go
var files config.Files
flag.Var(&files, "config", "YAML settings file; repeat it to layer files, a later one wins")
flag.Parse()
optional := len(files) == 0
if optional {
	files = config.Files{config.DefaultPath}
}
cfg, err := config.Load(files, optional)
```

- **Order is the contract.** A later file wins key by key and nested blocks merge, but a list or scalar is replaced whole: to drop one entry from a list, the later file repeats the whole list without it. Leaving a key out of a later file keeps the earlier value; it never resets to the default.
- **Every file given must exist.** Only the default path, used alone, may be missing.
- **Decoding and `validate` run once, on the merged result.** `ErrorUnused` still refuses a misspelled key in any file, but the merged map no longer knows which file set it, so the error names the list of files. A read or YAML error names its own file.
- **A directory of files** (`conf.d/*.yaml`) works the same way: `filepath.Glob` returns the names sorted, so number them (`10-base.yaml`, `90-secrets.yaml`) and load them in that order. Refuse an empty match rather than starting on defaults.
- **Keep koanf's default merge.** Don't set `koanf.Conf{StrictMerge: true}` over the structs defaults: it refuses a value whose Go type differs from the earlier one, and `conn_max_lifetime: 5m` (a string) differs from the default's `time.Duration`; the decoder already refuses wrong types. Don't add `koanf.WithMergeFunc` to append lists: whoever reads the files would have to know about it.
- **The secrets file is never committed.** The example shows its keys with placeholders.
- **Tests:** an overlay replaces one key and keeps the rest, replaces a list whole, a typo in the overlay is refused, and a missing second file is an error.

## 4b. The logging block

Every service's settings carry a `logging` block with at least these keys; the example file shows them with these comments:

```yaml
logging:
  # Lowest level written: debug, info, warn or error.
  level: info
  # json writes one Elastic Common Schema object per line to stdout; console is for reading
  # in a terminal.
  format: json
  probe:
    # Log the Kubernetes probe requests (/livez, /readyz). Off keeps the kubelet's checks, one
    # every few seconds per pod, out of the log.
    enabled: false
```

- **`level`** is one of `debug`, `info`, `warn`, `error` — checked in the block's `validate`, not a free string.
- **`format`** is `json` or `console`: `json` writes one [Elastic Common Schema](https://elastic.co/guide/en/ecs/current/index.html) object per line to stdout (what a deployment collects); `console` is for reading in a terminal. The default is `json`.
- **`probe.enabled`** defaults to `false`: the kubelet calls `/livez` and `/readyz` every few seconds per pod, and those requests belong in the log only while debugging them.
- The block is a nested struct (`Logging` with a nested `Probe`), its fields typed and defaulted like any other block (section 1), and the logger is built from it once at the root and injected (`go-code-style`, structured logging).

## 5. Tests

`config_test.go` beside the package, standard library `testing`, each test writing its own file under `t.TempDir()`:

```go
func write(t *testing.T, body string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "settings.yaml")
	if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}
```

Cover, for every new key or block:
- a value in the file is read, durations and numbers included;
- an empty file keeps the defaults (compare against `Defaults()`, not literals copied from it);
- an unknown key is refused (`TestLoadRefusesUnknownKey`);
- a missing file is an error at an explicit path and all defaults at the optional one;
- each `validate` rule refuses its bad value with an error naming the key, and normalises what it should;
- the example file loads and agrees with `Defaults()` where it repeats them (`TestExampleLoads`).

## Adding a setting

1. Field with its `koanf` tag and doc comment in the block's struct.
2. Its default in `Defaults()`, or a check in the block's `validate` when it has none.
3. The key, commented, in the example file.
4. A test that reads it, and one per new validation rule.
5. Pass it to the constructor that needs it from `main` or the composition root.
6. Renaming or removing a key breaks every deployed file (`ErrorUnused` refuses the old name): change the deployment's settings in the same release and say so in the merge request.

## Review checklist

- [ ] `ErrorUnused` still on; no new silent default for a misspelled key
- [ ] New field has a `koanf` tag, a doc comment, a default or a validation, an example entry and a test
- [ ] Durations are `time.Duration` decoded by the hook, not strings or bare ints without a unit in the name
- [ ] Errors name the file and the dotted key
- [ ] No koanf instance, package global or `k.Get` outside the config package; blocks passed to constructors
- [ ] Secrets have a `_file` alternative where they come from a secret store, and `Config` isn't logged whole
- [ ] A renamed or removed key comes with the deployment's settings change
- [ ] With several files: the load order is documented, every given file must exist, lists are repeated whole in an overlay, and no `StrictMerge` over the struct defaults
