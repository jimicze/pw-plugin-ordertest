# Changelog

All notable changes to `@jimicze-pw/ordertest-core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] — 2026-03-29

### Added

- `sequence.browser` field now produces `use: { browserName }` on generated Playwright projects, allowing per-sequence browser selection (e.g., `browser: 'firefox'`)
- `use` field on `GeneratedProject` interface — strategies can now set arbitrary Playwright `use` options on generated projects
- `toPlaywrightProject()` propagates `use` from generated projects to the final Playwright config
- 16 new unit tests for browser field propagation across all three strategies and the config transformer

### Fixed

- All 8 example configs now correctly place `trace` and `screenshot` inside `use: {}` (Playwright ignores these at config root level)
- `with-html-reporter` example: moved `trace: 'on'` and `screenshot: 'on'` from root level into `use` block
- All examples rewritten to use saucedemo.com demo site with real selectors and assertions

---

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
- Pino-based persistent activity logging to `.ordertest/activity.log`
- Log rotation via pino-roll (configurable `maxSize` and `maxFiles`)
- Debug console output to stderr via `[ordertest:debug]` prefix
- Env var support: `ORDERTEST_LOG_LEVEL`, `ORDERTEST_LOG_DIR`, `ORDERTEST_LOG_STDOUT`, `ORDERTEST_DEBUG`, `PLAYWRIGHT_SHARD`
- Full TypeScript support with dual ESM/CJS output
- JSON Schema for external manifest auto-completion (`schema/ordertest-manifest.schema.json`)
- 476 tests (442 unit + 34 integration) with full coverage of all execution modes and shard strategies

### Removed

- **BREAKING**: Removed `orderedHtmlReporter` — the built-in Playwright HTML reporter works out of the box with ordered test projects
- **BREAKING**: Removed `customHtmlReporter` and all related types (`ReportData`, `CustomHtmlReporterOptions`)
- Removed `sequenceTracker` module (was internal to reporters)
- Removed subpath exports `@jimicze-pw/ordertest-core/reporter` and `@jimicze-pw/ordertest-core/custom-reporter`

### Changed

- Package is now a pure config transformer with no reporter component
- `SequenceMetadata` and `OrderTestProjectMetadata` types are retained as public API for custom tooling

[0.2.0]: https://github.com/jimicze/pw-plugin-ordertest/releases/tag/v0.2.0
[0.1.0]: https://github.com/jimicze/pw-plugin-ordertest/releases/tag/v0.1.0
