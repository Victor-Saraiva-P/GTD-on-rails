# Staging, Snapshot Refresh, and Production Promotion

## Environment boundaries

The canonical production sync server runs on Solanum and listens on port `9475`.
Staging must run as a **separate sync-server process**, with its own data root,
SQLite `canonical.db`, files, backup directory, bearer token, and network port.
The suggested staging port is `9476`. Development's local ports remain `9473`
and `9474`; they are not Solanum service ports.

Configure the staging sync server with separate environment variables:

```sh
GTD_SYNC_SERVER_DEPLOYMENT_ENVIRONMENT=staging
GTD_SYNC_SERVER_DATA_ROOT=/home/victor/.local/share/gtd-on-rails-sync-server-staging
GTD_SYNC_SERVER_PORT=9476
GTD_SYNC_SERVER_AUTH_TOKEN=<distinct-staging-bearer-token>
GTD_SYNC_SERVER_RCLONE_ENABLED=false
GTD_GOOGLE_CALENDAR_PROJECTION_ENABLED=false
GTD_SYNC_SERVER_GOOGLE_CALLBACK_LISTENER_ENABLED=false
GTD_CLIENT_AUTO_UPDATE_ENABLED=false
```

Keep `GTD_SYNC_SERVER_BIND_ADDRESS` behind Tailscale and avoid exposing
personal GTD data over the public Internet. Production must use a **different**
data root, auth token, backup directory, and process. Do not copy the Google
OAuth credentials directory into staging. Google Calendar projection is
explicitly disabled when the sync-server environment is `staging`, even if a
projection flag is mistakenly set to true. Staging's Google outbox remains
stored for diagnostics but is never sent to Google.

For a local staging desktop, use `make gtd staging`. When connecting to Solanum
staging, set `GTD_SYNC_SERVER_BASE_URL` to the staging service endpoint and
`GTD_SYNC_SERVER_AUTH_TOKEN` to the distinct staging token. The runtime checks
that the configured staging URL is not the production endpoint. Set
`GTD_PRODUCTION_SYNC_SERVER_BASE_URL` when production uses a custom URL.

## Refreshing staging from production

The refresh process uses the existing consistent snapshot/restore APIs rather
than copying a live SQLite database. Run it **on Solanum**, where the production
and staging backup directories are available on the same host.

The refresh process:

1. Checks that production and staging endpoints and backup directories differ.
2. Calls `GET /v1/backups/environment` on the staging process and requires its
   configured environment to be exactly `staging`.
3. Requests a consistent production snapshot using `POST /v1/backups`.
4. Copies the snapshot ZIP to the separate staging backup directory.
5. Takes a recovery snapshot of staging before replacement.
6. Calls `POST /v1/backups/restore` on staging, rotating its `datasetEpoch`.

Provide the configuration to the process environment (never commit tokens):

```sh
GTD_PRODUCTION_SYNC_SERVER_BASE_URL=http://127.0.0.1:9475
GTD_STAGING_SYNC_SERVER_BASE_URL=http://127.0.0.1:9476
GTD_PRODUCTION_SYNC_SERVER_BACKUP_DIRECTORY=/home/victor/.local/share/gtd-on-rails-sync-server/backups
GTD_STAGING_SYNC_SERVER_BACKUP_DIRECTORY=/home/victor/.local/share/gtd-on-rails-sync-server-staging/backups
GTD_PRODUCTION_SYNC_SERVER_AUTH_TOKEN=<production-token>
GTD_STAGING_SYNC_SERVER_AUTH_TOKEN=<staging-token>
```

The paths above are illustrative; verify the actual systemd service settings
before any restore. The backup ZIP contains personal data and must be protected.

```sh
make staging-refresh           # Validate paths and endpoints; no API calls
make staging-refresh APPLY=1   # Destructive staging refresh
```

**After each refresh**, the staging desktop must use its existing sync recovery
panel to rebootstrap from the staging server. Rebootstrap creates a local
recovery snapshot before replacing synchronized state. Staging edits not
included in the production snapshot will not be retained in the refreshed
canonical dataset. Avoid automatic daily refresh during active tests; schedule
a maintenance window once Solanum staging is running.

Never target production with the staging restore operation. The API identity
preflight is a mandatory safety check and requires the new staging sync-server
version.

## Candidate builds and approval

The `main` CI pipeline tests and builds desktop, CLI, and sync-client
archives. On success it publishes:

- `candidate-<full-commit-sha>`: the validated, commit-specific release
  containing binaries, checksums, and `main-update.json`.
- `staging-latest`: the rolling candidate channel for staging.

**Merging into `main` does not publish to `main-latest`.** Production
continues reading `main-latest` until an explicit promotion.

Validate the chosen commit on the staging environment, including sync and
migration behavior against refreshed production-like data. The staging desktop
must use the staging runtime profile and separate staging data root; do not
install the ordinary production desktop archive into the production app
directory as a staging shortcut.

For an approved candidate, run the GitHub Actions workflow **Promote Staging to
Production** with the full commit SHA and confirmation `PROMOTE`. Configure
the `production` GitHub Environment with required reviewers for an additional
approval gate. Promotion verifies the commit belongs to `main`, downloads the
immutable release by SHA, verifies checksums, and copies the **same binaries**
to `main-latest`. It does not rebuild. The production manifest is uploaded
last to activate the promoted revision.

Versioned releases from explicit version tags remain available as checkpoints.
Rollback is another deliberate promotion of a previously validated candidate.
Always account for one-way schema migrations and sync protocol compatibility.

## Remaining Solanum setup

The repository provides runtime checks, clone orchestration and release
promotion; it does not provision Solanum yet. The next deployment phase must
create the staging systemd unit, persistent data root, distinct secret, Tailscale
routing, and maintenance schedule. Run a full staging refresh and rebootstrap
test on Solanum before enabling any timer.
