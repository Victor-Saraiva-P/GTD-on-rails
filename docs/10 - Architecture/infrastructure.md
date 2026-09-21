# Infrastructure

GTD on Rails is a native Linux desktop application with a local Spring Boot sidecar and an optional personal sync server.

## Repository

- `apps/desktop`: Tauri 2 + React + TypeScript.
- `apps/api`: local Spring Boot sidecar.
- `apps/sync-server`: personal synchronization authority.
- `docs`: architecture and product documentation.

## Desktop runtime

The packaged Tauri application starts exactly one `gtd-api` sidecar process.

The sidecar:

- binds to `127.0.0.1` on an ephemeral port;
- publishes its local base URL through the readiness file;
- uses local SQLite only;
- does not require PostgreSQL tools, Supabase credentials or a database setup wizard.

Normal production data root:

```text
~/Documents/gtd-on-rails
```

Structured metadata lives in:

```text
<root>/gtd.db
```

Canonical body/assets live in:

```text
<root>/items/<item-uuid>/body.md
<root>/items/<item-uuid>/assets/<asset-uuid>/<filename>
```

## Local database

SQLite is the only application database used by the desktop sidecar.

Runtime characteristics:

- WAL journal mode.
- single-writer Hikari pool.
- Flyway migrations from `db/sqlite-migration`.
- transactional outbox for structured sync.

No secondary PostgreSQL/Supabase datasource is configured.

## Sync server

`apps/sync-server` is a separate Spring Boot application intended to run on the owner's personal server/PC.

Default port:

```text
9473
```

Its data root contains:

- `canonical.db`
- `files/`
- `backups/`

The server provides optimistic object revisions, idempotent operation IDs, ordered cursors, physical file storage, immutable snapshots and restore.

## Backup transport

Google Drive is backup transport only.

The server optionally publishes completed immutable snapshots with `rclone copy`. Live SQLite databases and mutable file trees are never bisynced through rclone.

## Readiness

Desktop readiness means the local SQLite database is accessible and the schema version is compatible with the application.

Sync-server availability is not required for local editing. Offline mutations remain in their outboxes until connectivity returns.

A server restore is different from temporary unavailability: the epoch mismatch forces explicit client rebootstrap before any new push is accepted from that client.

## Development and staging

Development and staging also use SQLite data roots. They do not require PostgreSQL Compose infrastructure.

Tests should use isolated SQLite files/directories and an isolated sync-server fixture where synchronization behavior is under test.
