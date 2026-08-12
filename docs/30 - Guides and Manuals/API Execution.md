# API

Minimal Spring Boot backend scaffold.

## Commands

- `pnpm --filter @gtd-on-rails/api dev`
- `pnpm --filter @gtd-on-rails/api test`

## Backup and staging restore

In a production sidecar, `POST /maintenance/backups` creates a closed logical `gtd` archive under the configured `backups/` directory and queues File Sync only after successful dump validation. Production also creates one daily archive and a pre-Flyway recovery point.

In the staging sidecar, `POST /maintenance/backups/restore` accepts an archive file name such as `{"archiveName":"gtd-backup-2026-08-11T02-00-00Z-daily.dump"}`. The archive is validated before a single-transaction restore and the target remains guarded by the `STAGING` database identity.
