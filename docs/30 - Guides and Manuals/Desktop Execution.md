# Desktop Execution

## Development

From the repository root:

```sh
pnpm install
pnpm dev
```

The desktop frontend and local Spring Boot API run natively. PostgreSQL and Supabase are not required.

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
