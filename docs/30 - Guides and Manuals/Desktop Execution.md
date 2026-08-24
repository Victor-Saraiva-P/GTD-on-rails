# Desktop

Minimal desktop app scaffold with Vite and Tauri 2.

## Commands

- `pnpm dev`: runs the desktop app through Tauri in development mode
- `pnpm build`: builds only the local web frontend
- `pnpm desktop:build`: builds the desktop bundle through Tauri
- `pnpm test`: runs the fast unit test suite
- `pnpm e2e`: runs the web end-to-end tests with Playwright using the real frontend and backend

Run the frontend unit test suite from the repository root with:

```sh
pnpm --filter @gtd-on-rails/desktop test
```

Run the frontend end-to-end test suite from the repository root with:

```sh
pnpm --filter @gtd-on-rails/desktop e2e
```

## Arch Linux Setup

For desktop development on Arch Linux, install Playwright from the AUR and
download the browsers used by the e2e tests:

```sh
yay -S playwright
pnpm install
pnpm exec playwright install
```

If `pnpm e2e` fails with `Executable doesn't exist` under
`~/.cache/ms-playwright`, the Playwright browser cache has not been downloaded
yet or is outdated. Run `pnpm exec playwright install` again.

## PostgreSQL client tools

Packaged production and staging startup checks for `pg_dump` and `pg_restore` before launching the Spring Boot sidecar. If either command is missing, the desktop shows an explicit installation action. The action invokes only the fixed Polkit command for Arch Linux `postgresql-libs`; it does not accept shell text and does not install silently.

If Polkit authorization is cancelled or unavailable, run the displayed manual fallback:

```sh
sudo pacman -S --needed postgresql-libs
```

After installation, restart the desktop so the dependency check runs before backup-dependent startup.

## Packaged Production Installation and Rollout

Production distribution is the native Linux package `GTD.on.Rails_<version>_linux-x86_64.tar.gz`.

### Package Installation

Extract the archive and run the included installer:

```sh
tar -xzf GTD.on.Rails_<version>_linux-x86_64.tar.gz
cd GTD.on.Rails_<version>_linux-x86_64
./install.sh
```

The installer copies binaries to `~/.local/share/gtd-on-rails`, creates launchers under `~/.local/bin` (`gtd-on-rails` and `gtd-cutover`), and installs the desktop menu entry.

### Primary Computer Rollout Flow

1. Launch `gtd-on-rails`.
2. First-run startup runs File Sync and detects missing `database.properties`.
3. The desktop presents **Database Setup**. Enter the Supabase session pooler JDBC URL (`jdbc:postgresql://<host>:5432/<db>?sslmode=verify-full`), `postgres` administrative username, and password.
4. The backend provisions the `gtd` schema, limited application role `gtd_app`, marks cutover state `AWAITING_LEGACY_IMPORT` when `gtd-on-rails.db` is present, saves `database.properties` (mode `0600`), and publishes it via File Sync.
5. Desktop restarts into the normal sidecar. The desktop shows the PostgreSQL readiness blocker while awaiting cutover import.
6. Run the offline cutover command in a terminal:

```sh
gtd-cutover
```

7. `gtd-cutover` validates production identity, syncs files, makes an immutable backup of `gtd-on-rails.db` (`gtd-legacy-sqlite-<timestamp>.db` with mode `0400`), imports records into PostgreSQL, validates table counts and foreign keys, and marks cutover state `READY`.
8. The desktop unblocks and opens the main workspace.

### Second Computer Rollout Flow

1. Install or update to the matching package release on the second computer.
2. Launch `gtd-on-rails`.
3. Startup File Sync pulls `database.properties` synchronized from the primary computer.
4. The sidecar validates the configuration and connects directly to the shared PostgreSQL database.
5. Since cutover state is already `READY` in PostgreSQL, the app opens immediately without performing any local SQLite import.

### Agent Interactive Driver

For interactive agent UI validation on desktop:

```sh
pnpm agent:driver
```

The driver controls a local Chromium instance via keyboard-first endpoints at `http://127.0.0.1:3199`.

