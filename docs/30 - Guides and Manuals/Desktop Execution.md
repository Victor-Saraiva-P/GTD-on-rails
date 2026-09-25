# Desktop Execution

## Development

Install dependencies once from the repository root:

```sh
pnpm install
```

Run the application and sync process in separate terminals so their logs remain independently debuggable:

```sh
# terminal 1: desktop + local Spring Boot API
make gtd

# terminal 2: personal sync process
make client
```

Development is the default. Use a positional environment only when needed:

```sh
make gtd dev
make client dev

make gtd staging
make client staging
```

Development data lives under `dev-gtd-on-rails/` and `dev-gtd-sync-server/`. Staging uses `staging-gtd-on-rails/` and `staging-gtd-sync-server/`. The dev sync dashboard defaults to `http://127.0.0.1:9473/`; staging uses `http://127.0.0.1:9474/` so the two environments cannot accidentally converge against the same local sync process.

The Make test interface supports stage, project, and individual-test selection:

```sh
make test
make test unit
make test integration api
make test e2e desktop
make test unit desktop itemBodyPersistence
make test unit api DatabaseSyncServiceTests
make test unit client SnapshotBackupServiceTests
```

Arguments are positional: `make test [type] [scope] [test]`. Type accepts `all`, `unit`, `integration`, `e2e`, `check`, or `lint`. Scope accepts `all`, `desktop`, `api`, `client`/`sync-server`, or `scripts`. The optional test argument is a case-insensitive substring matched against test filenames/classes.

Short forms follow the same convention:

```sh
make unit desktop itemBodyPersistence
make integration api ProjectControllerTests
make e2e desktop vim-normal-mode-keybinds
make check desktop
make lint api
```

The desktop frontend, local Spring Boot API, and personal sync server all run natively. PostgreSQL and Supabase are not required.

## Packaged runtime

The native Tauri application starts the bundled `gtd-api` sidecar directly.

Startup sequence:

1. native update policy runs when applicable;
2. the local API sidecar starts with the configured runtime profile;
3. the desktop waits for the sidecar readiness file;
4. readiness verifies local SQLite/schema compatibility;
5. the main workspace opens.

There is no database setup wizard and no PostgreSQL client-tool installation step.

## Synchronization

Local editing works when the sync server is offline.

The sync-server dashboard exposes overview metrics, canonical objects, recent change-feed entries, physical files and backup snapshots. It can create backups, restore a snapshot and delete old snapshots.

If `GTD_SYNC_SERVER_AUTH_TOKEN` is configured, all `/v1/**` management and sync APIs require the same bearer token. The dashboard page remains loadable, but asks for the token before it can read or modify server state.

The sync server binds to `127.0.0.1` by default. To expose it through Tailscale, set `GTD_SYNC_SERVER_BIND_ADDRESS` to the machine's Tailscale IP or to `0.0.0.0` and protect access with Tailscale ACLs plus a bearer token.

The footer shows structured/file synchronization status. Clicking a conflict or rebootstrap-required indicator opens the synchronization recovery panel.

The recovery panel can:

- select local or remote for a conflict;
- merge Markdown manually;
- rebootstrap after a server restore.

Rebootstrap always creates a local recovery snapshot before replacing synchronized local state.

## Production installation

Production distribution remains the native Linux `.tar.gz` package. Extract it and run the included installer.

The application stores its normal user dataset under:

```text
~/Documents/gtd-on-rails
```

The personal sync client is deployed separately from the desktop package.

Build its standalone Linux archive with:

```sh
make client-package
```

The resulting files are written under `apps/sync-server/build/client-release/`. To install the current source build as the local user service, run:

```sh
make client-install
```

The installer creates `~/.local/share/gtd-on-rails-client`, `~/.local/bin/gtd-client`, `~/.config/gtd-on-rails-client.env`, and `~/.config/systemd/user/gtd-on-rails-client.service`. It enables and starts the `systemd --user` service when systemd is available.

The sync dataset remains separate at `~/.local/share/gtd-on-rails-sync-server` by default, so replacing or rolling back client binaries never replaces canonical data.

Managed client installations self-check GitHub releases. The administration dashboard's **Client** tab shows current/latest version and update state and allows manual check/install. Auto-update can be disabled with `GTD_CLIENT_AUTO_UPDATE_ENABLED=false` in `~/.config/gtd-on-rails-client.env`.
