# Synchronization

This document describes the current GTD on Rails synchronization model for structured data, Google integration configuration, and file assets.

The application is built for one owner using two trusted Arch Linux desktop machines. The expected operating discipline is simple: let one device finish syncing before editing the same persistence state on the other device. The app does not implement multi-user merge resolution or concurrent divergent-edit reconciliation.

The infrastructure that hosts these sync processes is described in [Infrastructure](infrastructure.md). The decision to replace Git persistence sync with rclone data sync is recorded in [ADR 0001](../adr/0001-use-rclone-data-sync-instead-of-git-persistence-sync.md).

---

## 1. Sync Boundaries

The system has two synchronization channels.

- Data sync uses `rclone bisync` to move the whole `gtd.data.root-directory` between trusted machines and Google Drive.
- Google Calendar sync mirrors GTD items to external agendas after local domain changes.

The backend owns both channels. The frontend observes status and can request manual data sync.

---

## 2. Data Root

Structured data, integration configuration, assets, and the dataset marker live under:

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
gtd-on-rails.db
google.properties
assets/
gtd-on-rails-sync-check
```

The SQLite database path is:

```text
${gtd.data.root-directory}/gtd-on-rails.db
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

## 3. Data Sync Flow

Data sync is handled by `DataSyncService` and `RcloneDataSyncService`.

Startup behavior:

- The backend creates the data root directory when needed.
- If rclone data sync is enabled, startup runs blocking data sync before SQLite opens.
- If `gtd-on-rails-sync-check` is missing, startup runs bootstrap sync from remote to local.
- If the SQLite database is still missing after successful startup sync, the backend creates an empty database file and Flyway initializes the schema.
- When a new empty database was created, the backend queues asynchronous data sync after application startup so the migrated schema is uploaded.

Runtime behavior:

- Application services request data sync after committed domain changes.
- Google Integration Configuration saves write `google.properties` locally and request asynchronous data sync.
- Scheduled data sync runs every `gtd.sync.interval-ms`.
- Manual data sync enqueues work through `POST /sync/data`.
- Data sync runs in a single-thread executor and coalesces pending requests while one sync is already running.

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

First publication or migration of local data to the remote is manual. The automatic bootstrap path always treats the remote as source.

---

## 5. Configuration

Current rclone remotes are profile-specific:

- `prod`: `gdrive:gtd-on-rails`
- `dev`: `gdrive:dev-gtd-on-rails`
- `staging`: `gdrive:dev-gtd-on-rails`

Current data sync defaults are profile-specific:

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

- `data`: data sync status.
- `googleCalendar`: Google Calendar sync status.

Data status includes:

- `state`: `DISABLED`, `BOOTSTRAPPING`, `SYNCED`, `PENDING`, `SYNCING`, or `FAILED`.
- `pending`
- `running`
- `lastStartedAt`
- `lastFinishedAt`
- `lastSuccessfulSyncAt`
- `lastError`

Manual data sync is requested at:

```text
POST /sync/data
```

The endpoint enqueues sync and returns `202 Accepted` with the current data sync status.

The desktop footer renders one Data sync indicator and one Google Calendar sync indicator.

---

## 7. Failure Behavior

Startup data sync is blocking when enabled. In production and staging, a startup rclone failure prevents the API from becoming ready.

Runtime data sync failures do not block local editing. The data sync state becomes `FAILED`, the footer exposes the error state, and later scheduled, manual, or mutation-triggered sync can recover.

Google Integration Configuration saves do not roll back when data sync fails later. They are local writes followed by asynchronous data sync.

---

## 8. Operational Rules

Because the project targets one owner and trusted machines, the synchronization model depends on these rules:

- Do not edit the same persistence state on two devices before the first device has synced and the second device has synced.
- Keep `rclone` configured for the expected Google Drive remotes.
- Treat `FAILED` sync states as operational issues to resolve before continuing long editing sessions.
- Do not manually edit the SQLite database, `google.properties`, assets, or sync marker while the app is running.

---

## 9. Summary

GTD on Rails currently synchronizes data with:

- `rclone bisync` over `${gtd.data.root-directory}`.
- Blocking startup sync before SQLite opens.
- Async coalesced runtime data sync after domain changes.
- Async Google Integration Configuration sync after local save.
- UI sync indicators backed by `/sync/status`.
