# Desktop Execution

## Development

From the repository root:

```sh
pnpm install
pnpm dev
```

The desktop frontend, local Spring Boot API, and personal sync server run natively. PostgreSQL and Supabase are not required.

During development, `pnpm dev` starts the sync server first, waits for its dashboard to become available, then starts the local API and desktop. The default dashboard is:

```text
http://127.0.0.1:9473/
```

Development sync-server data is kept separately under `dev-gtd-sync-server/`. `pnpm dev:reset` clears both the local desktop development dataset and the development sync-server dataset.

Useful checks:

```sh
pnpm --filter @gtd-on-rails/desktop test
pnpm --filter @gtd-on-rails/desktop run check
pnpm agent:driver
```

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

The personal sync server is deployed separately from the desktop package.
