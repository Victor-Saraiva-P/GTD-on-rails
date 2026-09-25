# ADR 0004: Use local SQLite plus a revisioned personal sync server

Status: Accepted

Supersedes:

- ADR 0001, which used `rclone bisync` for mutable application state.
- ADR 0002, which proposed shared PostgreSQL/Supabase persistence.

## Decision

Every desktop keeps a complete local SQLite database for structured GTD metadata and physical Markdown/assets for body content.

A separate personal sync server provides the cross-device convergence authority. It also uses SQLite for its canonical object/revision metadata and stores synchronized files physically.

Clients synchronize logical objects and files through an optimistic revision protocol. They do not synchronize raw live SQLite files.

## Reasons

Local SQLite preserves instant reads/writes and offline operation.

Raw SQLite file synchronization is unsuitable for concurrent local-first editing because locks, WAL state and whole-file replacement make conflicts destructive.

A shared PostgreSQL database would make availability of a remote database part of every normal desktop interaction, weakening the local-first requirement.

The revisioned server provides a narrow synchronization contract while allowing each client and the server to use SQLite independently.

## Conflict behavior

Every mutation includes an idempotent operation UUID and expected base revision.

Markdown uses conservative three-way merge. Binary conflicts and overlapping Markdown edits require explicit resolution.

A server restore rotates `datasetEpoch`; clients from the previous history must rebootstrap before pushing again.

## Backup behavior

Backups are immutable server snapshots containing canonical SQLite plus the physical file tree.

Google Drive publication uses one-way `rclone copy`. Rclone is backup transport, not live synchronization.

## Consequences

The system now owns a small synchronization protocol and conflict-resolution surface.

In exchange, desktop editing remains independent of server availability, mutable SQLite files are never copied between machines, and restore semantics are explicit and testable.
