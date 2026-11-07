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

## Native staging desktop on Omarchy

The `main` CI also builds a **separate staging desktop** after the production
archives are packaged. It uses `tauri.staging.conf.json`, embeds the staging
asset root, and publishes `GTD.on.Rails.Staging_<version>_linux-x86_64.tar.gz`
plus its SHA-256 checksum to `staging-latest` and the immutable `candidate-<sha>`.
The production promotion workflow ignores this staging-only archive.

The staging desktop package uses **its own** `install.sh` and intentionally
does not install the global `gtd` CLI or modify the production desktop.
On Omarchy, download both staging archive assets from a CI-validated release,
verify SHA-256, extract, and execute its bundled installer:

```sh
sha256sum -c GTD.on.Rails.Staging_3.6.1_linux-x86_64.tar.gz.sha256
tar -xzf GTD.on.Rails.Staging_3.6.1_linux-x86_64.tar.gz
bash GTD.on.Rails.Staging_3.6.1_linux-x86_64/install.sh
```

The installer requires Tailscale connectivity and an SSH session authorized for
`victor@solanum`. It fetches **only** the staging bearer token into
`~/.config/gtd-on-rails-staging.env` (mode `0600`) and checks that the remote
server explicitly identifies itself as staging. The installed application lives
under `~/.local/share/gtd-on-rails-staging` and creates a separate launcher
`~/.local/bin/gtd-on-rails-staging` plus the application-menu entry
**GTD on Rails (Staging)**. Its SQLite dataset lives in
`~/Documents/staging-gtd-on-rails` and syncs to Solanum port `9476`.

Launch with `gtd-on-rails-staging` or the Omarchy application menu. The staging
Tauri identifier is distinct from production and its built-in native updater
is disabled, because the existing updater writes to production-only paths.
The staging package installer refuses to overwrite a different revision
without an explicit upgrade procedure; close the staging app before any upgrade.
Do not run the production `make gtd-install` command for staging.

## Automatic updates of staging releases

Both staging machines poll the rolling `staging-latest` channel without touching
`main-latest` or production installations. The updater follows the current
commit SHA to `candidate-<full-sha>`, checks the candidate manifest and commit,
downloads only the native package for that machine, validates SHA-256, then
checks the embedded `VERSION` and `REVISION` before replacing binaries.

The **Solanum** `gtd-on-rails-client-staging-update.timer` checks about every
15 minutes. It stops **only** the staging sync service, copies the staging data
root and current runtime into an isolated rollback area, starts the verified
candidate and checks `/health` plus the authenticated
`/v1/backups/environment`. A failed startup restores the previous staging
binary **and** data snapshot; production is never stopped. Its separate
`gtd-on-rails-client.service` is checked for availability before the update.

The **Omarchy** `gtd-on-rails-staging-update.timer` checks about every
20 minutes. If the staging app or sidecar is running, it defers the update.
Otherwise it backs up `~/Documents/staging-gtd-on-rails` and replaces only
`~/.local/share/gtd-on-rails-staging`. It retains the previous installation
and local data for a manual rollback if the GUI fails to launch after updating.
Newly packaged desktop launchers also check for a staging update at launch.
The existing production desktop, CLI, services and credentials are not touched.

To provision a new machine, install the staging package, which now bundles
`staging-release-updater.py` and creates its staging-only systemd user timer.
For an existing installation or Solanum provisioned by `server-infra`, use the
same updater scripts directly:

```sh
# Examine the latest CI candidate without changing installed files.
python3 scripts/staging-release-updater.py --target desktop
python3 scripts/staging-release-updater.py --target server

# Download and fully verify the candidate, without swapping the runtime.
python3 scripts/staging-release-updater.py --target desktop --verify

# Apply the update only to the requested staging target.
python3 scripts/staging-release-updater.py --target desktop --apply

# Manual rollback discards staging changes since the pre-upgrade snapshot.
python3 scripts/staging-release-updater.py --target desktop \
  --rollback --confirm ROLLBACK_STAGING
```

Run `--target server` **on Solanum**, never on the Omarchy machine. The
server-infra repo manages its systemd unit and operational installation.
Inspect timers with `systemctl --user list-timers` and their results with
`journalctl --user -u gtd-on-rails-staging-update.service` (Omarchy) or
`journalctl --user -u gtd-on-rails-client-staging-update.service` (Solanum).
Retain rollback snapshots only in private staging paths (permissions 0700).

The staging channel's rolling pointer is updated only when the publishing CI
commit is still the current tip of `main`; late-running older workflows must
not downgrade staging. No timer copies production data or triggers a refresh:
that remains the separate, guarded manual snapshot-restore workflow below.

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
