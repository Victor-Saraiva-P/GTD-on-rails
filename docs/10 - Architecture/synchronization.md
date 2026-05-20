# Synchronization

This document describes the current GTD on Rails synchronization model for structured data and file assets.

The application is built for one owner using two trusted Arch Linux desktop machines. The expected operating discipline is simple: let one device finish syncing before editing the same persistence state on the other device. The app does not implement multi-user merge resolution or concurrent divergent-edit reconciliation.

The infrastructure that hosts these sync processes is described in [Infrastructure](infrastructure.md).

---

## 1. Sync Boundaries

The system has two separate synchronization channels.

- Persistence sync uses Git to move the SQLite database repository between devices.
- Asset sync uses `rclone bisync` to move file-backed item assets between local storage and Google Drive.

The backend owns both channels. The frontend only observes status and requests manual asset sync when needed.

---

## 2. Persistence Repository

Structured data lives in a SQLite database inside a private Git repository.

The default database path is:

```text
${gtd.persistence.bootstrap.clone-directory}/db/gtd-on-rails.db
```

The clone directory defaults to:

```text
${gtd.data.root-directory}/persistence
```

The persistence repository URL is configured by:

```text
gtd.persistence.bootstrap.repository-url
```

Current branch defaults are profile-specific:

- `prod`: `main`
- `dev`: `dev`
- `staging`: `dev`
- `ci` and `test`: sync disabled by default

---

## 3. Persistence Bootstrap

When the configured SQLite database is missing, the backend bootstraps persistence from Git.

The bootstrap flow is:

1. Resolve the configured SQLite JDBC path.
2. Require the database path to be inside the configured clone directory.
3. Clone the configured repository branch into a temporary sibling directory.
4. Move the temporary clone into the configured clone directory.
5. Require the SQLite database file to exist in the clone.

The host machine must already have non-interactive Git access to the persistence repository. The app does not prompt for credentials.

---

## 4. Persistence Sync Flow

Persistence sync is handled by `PersistenceGitSyncService`.

The service uses a single-thread executor so Git tasks run serially.

Startup behavior:

- The backend initializes sync paths from the JDBC URL and clone directory.
- The backend performs a startup `git pull --ff-only`.
- Startup pull failures are logged and later recovery is left to scheduled sync.

Scheduled behavior:

- The backend queues a pull-only sync every `gtd.persistence.sync.interval-ms`.
- The default interval is `300000` ms.

Mutation behavior:

- Application services request sync after committed domain changes.
- The sync service checks `git status --porcelain`.
- If the repository is dirty, it stages all repository changes with `git add -A .`.
- It creates a Git commit with the configured author name and email.
- It runs `git pull --ff-only`.
- It pushes the local commit.

If there are no local changes but there are unpushed commits, the service retries `git push`.

---

## 5. Conflict And Failure Behavior

The current implementation intentionally avoids automatic merge commits and SQL-level conflict resolution.

Git pulls use:

```text
git pull --ff-only
```

If local and remote histories diverge, Git fails instead of creating a merge commit. The sync service records that failure in its status.

The current behavior is:

- No SQL attach/merge flow is implemented.
- No last-write-wins merge is implemented.
- No force-push or hard-reset conflict resolution UI is implemented.
- The sync state becomes `FAILED` and exposes the last error through the sync status endpoint.

This matches the project assumption that the single owner avoids divergent edits across devices.

---

## 6. Persistence Status

The API exposes combined sync status at:

```text
GET /sync/status
```

Persistence status includes:

- `state`: `IDLE`, `SYNCING`, `FAILED`, or `DISABLED`.
- `lastStartedAt`
- `lastFinishedAt`
- `lastSuccessfulSyncAt`
- `lastError`
- `hasLocalChanges`
- `hasUnpushedCommits`

The desktop footer renders Git persistence sync indicators from this status.

---

## 7. Persistence Commit Messages

Persistence commits use fixed messages based on the domain change type.

Current message examples:

- `feat(data): create item`
- `feat(data): update item`
- `feat(data): delete item`
- `feat(data): create context`
- `feat(data): update context`
- `feat(data): delete context`
- `feat(data): update context icon`
- `feat(data): delete context icon`

The author identity comes from:

- `gtd.persistence.sync.commit-author-name`
- `gtd.persistence.sync.commit-author-email`

---

## 8. Database Shape For Sync

Database rows use stable identifiers and soft deletion so repository snapshots remain portable and recoverable.

- Primary entity IDs are UUID values stored as SQLite blobs.
- Audited tables include `created_at`, `updated_at`, and `deleted_at` where applicable.
- Soft deletion uses `deleted_at` instead of physically deleting rows during normal workflows.
- Flyway migrations define the schema under `apps/api/src/main/resources/db/migration`.

These properties support safe file-based snapshots, but they are not currently used for automatic cross-device row-level merge resolution.

---

## 9. Asset Sync

File assets are synchronized separately from the SQLite persistence repository.

The local asset directory defaults to:

```text
${gtd.data.root-directory}/assets
```

Asset sync state defaults to:

```text
${gtd.data.root-directory}/asset-sync-state
```

`AssetSyncService` creates the local asset directory on startup. When `gtd.assets.rclone.enabled` is true, it queues startup sync and scheduled sync.

Current remote defaults are profile-specific:

- `prod`: `gdrive:gtd-on-rails`
- `dev`: `gdrive:dev-gtd-on-rails`
- `staging`: `gdrive:dev-gtd-on-rails`
- `ci` and `test`: rclone disabled by default

---

## 10. Rclone Flow

Asset sync uses `rclone bisync`.

On the first run, when the baseline marker is missing, the backend runs bootstrap sync:

```text
rclone bisync <local-assets> <remote> --resync --resync-mode path2
```

After bootstrap succeeds, the backend writes a baseline marker in the asset sync state directory.

Later runs use incremental bisync:

```text
rclone bisync <local-assets> <remote>
```

When `gtd.assets.sync.force` is true, the backend adds:

```text
--force
```

Asset sync runs in a single-thread executor and coalesces pending requests while one sync is already running.

---

## 11. Asset Status And Manual Sync

The API exposes asset status at:

```text
GET /assets/sync/status
```

It also accepts manual asset sync requests at:

```text
POST /assets/sync
```

Asset status includes:

- `state`: `DISABLED`, `BOOTSTRAPPING`, `SYNCED`, `PENDING`, `SYNCING`, or `FAILED`.
- `pending`
- `running`
- `lastStartedAt`
- `lastFinishedAt`
- `lastSuccessfulSyncAt`
- `lastError`

The combined `GET /sync/status` endpoint includes both asset and persistence status.

---

## 12. Operational Rules

Because the project targets one owner and trusted machines, the synchronization model depends on these rules:

- Do not edit the same persistence state on two devices before the first device has pushed and the second device has pulled.
- Keep non-interactive Git credentials available on both machines.
- Keep `rclone` configured for the expected Google Drive remotes.
- Treat `FAILED` sync states as operational issues to resolve before continuing long editing sessions.
- Do not manually edit the SQLite database or asset sync state directories while the app is running.

---

## 13. Summary

GTD on Rails currently synchronizes data with:

- Git bootstrap for the SQLite persistence repository.
- Fast-forward-only Git pull for remote persistence changes.
- Git commits and pushes after local domain changes.
- Failure status instead of automatic merge resolution when histories diverge.
- `rclone bisync` for file assets.
- UI sync indicators backed by `/sync/status`.
