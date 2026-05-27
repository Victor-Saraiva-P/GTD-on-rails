# Architecture

## Runtime Shape

GTD on Rails is desktop-first and local-first. Production runs as a native Linux Tauri desktop app that starts a bundled Spring Boot sidecar API.

The sidecar binds to localhost on an ephemeral port, writes a readiness file with the selected base URL, and the desktop reads that file before sending API requests.

## Persistence

The normal application database is SQLite. The database file lives inside a Git-backed persistence clone under the data root.

The backend owns database bootstrapping, Flyway migration, data integrity, and persistence sync scheduling. Application services request sync after committed domain changes.

## Assets

Item assets are files plus database metadata.

- Metadata lives in SQLite.
- Files live under the configured local asset directory.
- Body content references assets through markdown tokens and `blockEntities`.
- The backend owns final storage, metadata creation, validation, URL generation, and sync scheduling.

## Synchronization

Structured persistence and file assets use separate channels.

- Persistence sync uses Git with `git pull --ff-only` and push.
- Asset sync uses `rclone bisync`.
- The app intentionally avoids automatic merge commits, SQL-level merge flows, and force-push conflict recovery.

## Release Runtime

Production distribution is the native Linux `.tar.gz` package. It includes the desktop executable, sidecar launcher, backend jar, icon, and installer script.

The project-owned native update flow downloads release assets, verifies checksums, stages a next installation, preserves a rollback copy, and replaces the active installation after the current process exits.

Canonical sources:

- [Infrastructure](../../docs/10%20-%20Architecture/infrastructure.md)
- [Synchronization](../../docs/10%20-%20Architecture/synchronization.md)
- [Body Content](../../docs/20%20-%20GTD/shared/Body%20Content.md)
