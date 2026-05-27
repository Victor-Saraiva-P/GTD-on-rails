# Integrations

## Persistence Git Sync

Structured application data is stored in SQLite inside a private Git repository. The backend bootstraps the repository when the database is missing and syncs committed domain changes with Git.

Production uses the `main` persistence branch. Development and staging use the `dev` branch.

## Asset Sync

File assets sync separately from structured persistence through `rclone bisync`.

- Production remote: `gdrive:gtd-on-rails`.
- Development and staging remote: `gdrive:dev-gtd-on-rails`.
- Asset sync state lives under the data root.
- The backend queues startup, scheduled, and requested sync work.

## Tauri Native Layer

The desktop app uses Tauri for the native Linux shell, sidecar startup, filesystem access, HTTP access, clipboard/drop local-file paths, and native update behavior.

Local-file asset sources from Tauri should call `POST /items/{id}/assets/local-file`. Byte-backed sources should call multipart `POST /items/{id}/assets`.

## API Surface

Postman collections and environments under `postman/` document and exercise local API endpoints for inbox, items, next actions, contexts, sync, assets, and test utilities.

## CI And Release

GitHub Actions run CI, quality, and release workflows.

- CI installs dependencies, Playwright browsers, runs tests/checks, verifies native desktop build behavior, and packages native Linux tarballs.
- Release workflow builds the production-like sidecar app and uploads `.tar.gz` plus `.sha256` assets.

## Optional Local Infrastructure

`infra/compose.yaml` defines optional local Postgres/API infrastructure for development experiments. It is not the canonical production runtime.

Canonical sources:

- [Infrastructure](../../docs/10%20-%20Architecture/infrastructure.md)
- [Synchronization](../../docs/10%20-%20Architecture/synchronization.md)
- [Body Content](../../docs/20%20-%20GTD/shared/Body%20Content.md)
