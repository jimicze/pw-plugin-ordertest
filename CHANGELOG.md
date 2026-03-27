# Changelog

All notable changes to `@playwright-ordertest/core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.1.0] — 2026-03-27

### Added

- `defineOrderedConfig()` — synchronous config transformer entry point
- `defineOrderedConfigAsync()` — async entry point for external manifest loading
- Three execution modes: `serial` (workers:1), `parallel`, `fullyParallel`
- Project dependency chain generation — enforces file ordering via native Playwright `projects[].dependencies`
- Shard guard with `collapse`, `warn`, and `fail` strategies
- External manifest loading from JSON, YAML, and TypeScript files
- Auto-discovery of `ordertest.config.{ts,json,yaml,yml}` in project root
- Per-file and per-sequence test filtering via `tests[]` and `tags[]`
- Ordered HTML reporter (`orderedHtmlReporter`) wrapping Playwright's built-in HTML reporter
- Sequence tracker for per-sequence progress tracking in reporters
- Pino-based persistent activity logging to `.ordertest/activity.log`
- Log rotation via pino-roll (configurable `maxSize` and `maxFiles`)
- Debug console output to stderr via `[ordertest:debug]` prefix
- Env var support: `ORDERTEST_LOG_LEVEL`, `ORDERTEST_LOG_DIR`, `ORDERTEST_LOG_STDOUT`, `ORDERTEST_DEBUG`, `PLAYWRIGHT_SHARD`
- Full TypeScript support with dual ESM/CJS output
- JSON Schema for external manifest auto-completion (`schema/ordertest-manifest.schema.json`)
- 493 tests (459 unit + 34 integration) with full coverage of all execution modes and shard strategies

[Unreleased]: https://github.com/playwright-ordertest/core/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/playwright-ordertest/core/releases/tag/v0.1.0
