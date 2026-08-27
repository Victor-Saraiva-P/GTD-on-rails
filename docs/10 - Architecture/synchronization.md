# Synchronization

This document describes the current GTD on Rails synchronization model for PostgreSQL-backed structured data, Google integration configuration, and file assets.

The application is built for one owner using two trusted Arch Linux desktop machines. The expected operating discipline is simple: let one device finish syncing before editing the same persistence state on the other device. The app does not implement multi-user merge resolution or concurrent divergent-edit reconciliation.

The infrastructure that hosts these sync processes is described in [Infrastructure](infrastructure.md). The decision to replace Git persistence sync with rclone data sync is recorded in [ADR 0001](../adr/0001-use-rclone-data-sync-instead-of-git-persistence-sync.md).

---

## 1. Sync Boundaries

The system has three synchronization channels.

- Database Sync pushes local SQLite mutations to the remote Supabase PostgreSQL database using a Transactional Outbox pattern.
- File Sync uses `rclone bisync` to move file-backed state under the trusted data root between machines and Google Drive.
- Google Calendar sync mirrors GTD items to external agendas after local domain changes.

The backend owns all three channels. The frontend observes status and renders visual indicators in the workspace footer.

---

## 2. Data Root

File-backed state, integration configuration, assets, and the dataset marker live under:

```text
${gtd.data.root-directory}
```

Production defaults to:

```text
~/Documents/gtd-on-rails
```

Development and staging default to:

```text
~/Documents/dev-gtd-on-rails
```

The data root contains:

```text
google.properties
database.properties
assets/
gtd-on-rails-sync-check
```

Asset files live under:

```text
${gtd.data.root-directory}/assets
```

Google Integration Configuration lives at:

```text
${gtd.data.root-directory}/google.properties
```

---

## 3. File Sync Flow

File Sync is exposed by `FileSyncService`.

Startup behavior:

- The backend creates the data root directory when needed.
- If rclone File Sync is enabled, startup runs blocking File Sync before PostgreSQL opens.
- If `gtd-on-rails-sync-check` is missing, startup runs bootstrap sync from remote to local.
- After successful startup sync, the backend validates Database Connection Configuration and connects to the configured PostgreSQL environment.

Runtime behavior:

- File-backed mutations (such as item assets, context icons, backups, and configuration saves) request File Sync after commit. Structured-only domain changes are persisted directly to PostgreSQL and do not trigger File Sync.
- Google Integration Configuration saves write `google.properties` locally and request asynchronous File Sync.
- Scheduled File Sync runs every `gtd.sync.interval-ms`.
- Manual File Sync enqueues work through `POST /sync/files`.
- File Sync runs in a single-thread executor and coalesces pending requests while one sync is already running.

---

## 4. Sync Check Marker

The marker path is:

```text
${gtd.data.root-directory}/gtd-on-rails-sync-check
```

When the marker exists, the backend runs incremental bisync:

```text
rclone bisync <remote> <data-root> --check-access --check-filename gtd-on-rails-sync-check
```

When the marker is missing, the backend treats the remote as the source and runs:

```text
rclone bisync <remote> <data-root> --resync
```

If the marker is still missing after a successful bootstrap, the backend creates it locally and runs one bisync without `--check-access` to publish the marker.

First publication or migration of local file-backed state to the remote is manual. The automatic bootstrap path always treats the remote as source.

---

## 5. Configuration

Current rclone remotes are profile-specific:

- `prod`: `gdrive:gtd-on-rails`
- `dev`: `gdrive:dev-gtd-on-rails`
- `staging`: `gdrive:dev-gtd-on-rails`

Current File Sync defaults are profile-specific:

- `prod` and `staging`: rclone enabled by default
- `dev`, `ci`, and `test`: rclone disabled by default

Key properties:

- `gtd.sync.rclone.enabled`
- `gtd.sync.rclone.command`
- `gtd.sync.rclone.remote`
- `gtd.sync.interval-ms`
- `gtd.sync.force`
- `gtd.sync.sync-check-filename`

When `gtd.sync.force` is true, the backend adds:

```text
--force
```

---

## 6. Status And Manual Sync

The API exposes combined sync status at:

```text
GET /sync/status
```

The response contains:

- `file`: File Sync status.
- `googleCalendar`: Google Calendar sync status.
- `database`: Database outbox sync status.

Database Sync status includes:

- `state`: `DISABLED`, `SYNCED`, `PENDING`, `SYNCING`, or `FAILED`.
- `pending`: whether a sync cycle is requested.
- `running`: whether an async worker is actively processing events.
- `pendingCount`: number of mutations waiting in `sync_outbox`.
- `lastStartedAt`
- `lastFinishedAt`
- `lastSuccessfulSyncAt`
- `lastError`

The desktop footer renders three sync indicators: File Sync, Google Calendar sync, and Database Sync.

---

## 7. Failure Behavior

Startup File Sync is blocking when enabled. In production and staging, a startup rclone failure prevents the API from becoming ready.

Runtime Database and File Sync failures do not block local editing. Database mutations are always safely persisted to the local SQLite database first. If the remote Supabase push fails, events remain in `sync_outbox` with incremented retry counts, and the background worker retries periodically.

---

## 8. Operational Rules

Because the project targets one owner and trusted machines, the synchronization model depends on these rules:

- Allow pending outbox events to sync to Supabase before switching devices.
- Keep `rclone` configured for the expected Google Drive remotes.
- Treat `FAILED` sync states as operational issues to resolve before continuing long editing sessions.
- Do not manually edit `database.properties`, `google.properties`, assets, or the sync marker while the app is running.

---

## 9. Summary

GTD on Rails currently synchronizes data with:

- Local-first SQLite database for instant UI reads and writes.
- Async Transactional Outbox pushing mutations to remote Supabase PostgreSQL.
- `rclone bisync` over file-backed state under `${gtd.data.root-directory}`.
- Blocking startup File Sync before the application opens.
- Async coalesced runtime File Sync after file-backed changes.
- UI sync indicators backed by `/sync/status`.
