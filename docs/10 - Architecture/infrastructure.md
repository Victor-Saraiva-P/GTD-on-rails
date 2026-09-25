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

The desktop keeps its current local UI state when the application window loses and regains focus. Window focus is not a data-refresh boundary: returning from another application must not evict backend caches, force a query reload, or replace the current screen with a loading state.

Domain collections use a normalized in-memory entity store shared across screens. A previously loaded collection renders immediately from its local snapshot while navigation and explicit invalidation revalidate it in the background. Revalidation does not replace an existing screen with a loading state.

Remote synchronization is event-driven at the UI boundary. After the sidecar applies a remote structured or file change, it evicts the affected local query cache and publishes a server-sent domain-change event. The desktop keeps one event stream open and silently revalidates only collections affected by that object type. Sync-status polling remains status and observability infrastructure rather than the source of domain UI consistency.

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
- `google-calendar.properties` when Google Calendar is configured

The server provides optimistic object revisions, idempotent operation IDs, ordered cursors, physical file storage, immutable snapshots and restore. It is also the single writer for shared external integrations such as Google Calendar.

The sync client is distributed independently from the desktop application as `GTD.on.Rails.Client_<version>_linux-x86_64.tar.gz`. The package contains only the client launcher, a `jpackage` app-image with its private Java runtime and sync-server JAR, version metadata and installer. The target machine therefore does not need Java, Gradle, Node, pnpm or the repository checkout. The installer places runtime binaries under `~/.local/share/gtd-on-rails-client`, keeps canonical data under the separate sync-server data root, installs a `systemd --user` service and exposes `gtd-client` through `~/.local/bin`.

Managed installations check the project's latest GitHub release on a schedule. Updates are downloaded to a cache directory, SHA-256 verified, staged beside the active installation and swapped only after the running process exits. The previous installation is retained during the swap. After restart the updater polls `/health`; if the new version does not become healthy, it restores the previous installation and restarts it. Repository development via `make client` does not set `GTD_CLIENT_INSTALL_DIR`, so development checkouts never self-update.

It also serves an administration dashboard at `/`. Administrative APIs live under `/v1/admin/**` and therefore use the same optional bearer-token protection as the synchronization API. The dashboard includes client version/update state and manual check/install actions.

Runtime network configuration:

- `GTD_SYNC_SERVER_BIND_ADDRESS`: bind address, default `127.0.0.1`.
- `GTD_SYNC_SERVER_PORT`: HTTP port, default `9473`.
- `GTD_SYNC_SERVER_AUTH_TOKEN`: optional bearer token required for `/v1/**`.
- `GTD_SYNC_SERVER_DATA_ROOT`: canonical server data directory.
- `GTD_SYNC_SERVER_PUBLIC_BASE_URL`: browser-reachable base URL used for OAuth callbacks.
- `GTD_GOOGLE_CALENDAR_SYNC_INTERVAL_MS`: retry interval for pending Google Calendar projections.
- `GTD_CLIENT_INSTALL_DIR`: marks a managed client installation and points to its active runtime directory.
- `GTD_CLIENT_AUTO_UPDATE_ENABLED`: enables scheduled self-update checks for managed installations, default `true`.
- `GTD_CLIENT_AUTO_UPDATE_INTERVAL_MS`: update-check interval, default six hours.
- `GTD_CLIENT_RELEASE_URL`: release metadata endpoint, default GitHub `releases/latest`.
- `GTD_CLIENT_HEALTH_URL`: optional health URL used by the external updater when validating a restarted client.

## Backup transport

Google Drive is backup transport only.

The server optionally publishes completed immutable snapshots with `rclone copy`. Live SQLite databases and mutable file trees are never bisynced through rclone.

## Readiness

Desktop readiness means the local SQLite database is accessible and the schema version is compatible with the application.

Sync-server availability is not required for local editing. Offline mutations remain in their outboxes until connectivity returns.

A server restore is different from temporary unavailability: the epoch mismatch forces explicit client rebootstrap before any new push is accepted from that client.

## Development and staging

Development and staging also use SQLite data roots. They do not require PostgreSQL Compose infrastructure.

Run the local application and sync client independently:

```sh
make gtd
make client
```

Development is the default environment; `make gtd dev` and `make client dev` are equivalent explicit forms. Staging uses `make gtd staging` and `make client staging`. Dev defaults the client to port `9473`; staging uses `9474` so the environments cannot accidentally share one canonical server.

Tests should use isolated SQLite files/directories and an isolated sync-server fixture where synchronization behavior is under test.
