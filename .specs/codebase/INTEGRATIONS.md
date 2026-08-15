# Integrations

## PostgreSQL Persistence

Structured application data is stored in PostgreSQL (local Compose PostgreSQL in development, isolated Supabase in staging, and shared Supabase in production). The backend manages schema migrations, database setup, repair, and identity verification.

## File Sync

File assets, configuration files, database backups, and the sync marker synchronize through `rclone bisync`.

- Production remote: `gdrive:gtd-on-rails`.
- Development and staging remote: `gdrive:dev-gtd-on-rails`.
- File sync state lives under the data root.
- The backend queues startup, scheduled, and requested sync work.

## Google Calendar Integration

The backend synchronizes calendar and time-bound next action items with Google Calendar via OAuth2 integration.

## Tauri Native Layer

The desktop app uses Tauri for the native Linux shell, sidecar startup, filesystem access, HTTP access, clipboard/drop local-file paths, and native update behavior.

Local-file asset sources from Tauri call `POST /items/{id}/assets/local-file`. Byte-backed sources call multipart `POST /items/{id}/assets`.

## API Surface

Postman collections and environments under `postman/` document and exercise local API endpoints for inbox, items, next actions, contexts, sync, assets, and test utilities.

## CI And Release

GitHub Actions run CI, quality, and release workflows.

- CI installs dependencies, Playwright browsers, runs tests/checks, verifies native desktop build behavior, and packages native Linux tarballs.
- Release workflow builds the production-like sidecar app and uploads `.tar.gz` plus `.sha256` assets.

Canonical sources:

- [Infrastructure](../../docs/10%20-%20Architecture/infrastructure.md)
- [Synchronization](../../docs/10%20-%20Architecture/synchronization.md)
- [Body Content](../../docs/20%20-%20GTD/shared/Body%20Content.md)
