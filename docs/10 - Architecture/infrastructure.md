# Infrastructure

This document describes the current technical infrastructure of GTD on Rails: repository layout, runtime topology, persistence, synchronization, release packaging, and CI/CD.

The application is desktop-first. The production runtime is a native Linux desktop app that starts a bundled local backend sidecar and stores file-backed state locally while shared structured state lives in PostgreSQL.

---

## 1. Repository Layout

The project is a `pnpm` monorepo orchestrated with Turbo.

- `apps/desktop`: Tauri 2 desktop shell with React, Vite, TypeScript, and Rust native commands.
- `apps/api`: Spring Boot backend built with Gradle.
- `docs`: project documentation and GTD knowledge base.
- `infra`: optional local infrastructure for development experiments.
- `packages`: reserved workspace for future shared packages.

The root `package.json` exposes the main workflows:

- `pnpm dev`: runs the development tasks through Turbo.
- `pnpm dev:reset`: safely recreates the development database and assets before starting development.
- `pnpm build`: builds the workspace.
- `pnpm test`: runs unit, integration, and e2e tests.
- `pnpm check`: runs static checks.
- `pnpm build:prod`: builds the production desktop sidecar release.
- `pnpm build:staging`: builds the staging desktop sidecar release.
- `pnpm staging`: builds and launches the staging release binary.

Tool versions are pinned in `mise.toml`:

- Node.js 22
- Java 21
- Rust stable

---

## 2. Application Stack

### Desktop

The desktop app lives in `apps/desktop`.

- Tauri 2 provides the native Linux shell and Rust command layer.
- React 19 renders the UI.
- Vite builds the web frontend.
- TypeScript is used for frontend application code.
- Rust is used for native integrations, sidecar startup, and native update handling.

The Tauri build embeds a backend sidecar launcher named `gtd-api` and a backend jar at `binaries/gtd-api.jar`.

### Backend

The backend lives in `apps/api`.

- Spring Boot 4 runs the HTTP API.
- Java 21 is the runtime language.
- Gradle builds, tests, and packages the backend.
- Flyway manages database migrations.
- Spring Data JPA and Hibernate persist application entities.
- PostgreSQL is the application database for development and shared environments.

The backend package scripts wrap Gradle commands so workspace workflows can call it through `pnpm --filter @gtd-on-rails/api ...`.

### Database

The development application database is PostgreSQL in the persistent local Compose volume.

The development JDBC URL defaults to:

```text
jdbc:postgresql://127.0.0.1:5432/gtd_on_rails
```

Flyway initializes new development databases with the baseline in schema `gtd` and records the `DEVELOPMENT` database identity.

The PostgreSQL baseline migration lives under `apps/api/src/main/resources/db/postgresql-migration`. Legacy SQLite migrations are not selected by normal runtime startup and remain available for the one-time cutover implementation.

---

## 3. Runtime Topology

### Development Runtime

`pnpm dev` starts or reuses PostgreSQL, waits for its health check, and then starts the desktop frontend and Spring Boot API as native host processes. Compose contains PostgreSQL infrastructure only.

- The desktop dev server runs on `127.0.0.1:1420`.
- The API runs through Gradle with the `dev` Spring profile.
- CORS allows the local desktop dev origin.
- Development data and assets live in the Git-ignored repository-local `dev-gtd-on-rails` directory.
- Development rclone File Sync is disabled by default.

`pnpm dev:reset` first confirms the persistent database identity is exactly `DEVELOPMENT`. A mismatch restores a previously stopped PostgreSQL container and stops before changing the PostgreSQL volume or development assets. A development database must first be initialized through `pnpm dev`; a missing container fails without starting one. After a successful check, the command recreates both state stores and starts the normal development workflow; the dev profile seeds its deterministic fake dataset and representative PDF asset on startup.

### Production Runtime

Production is a self-contained local desktop runtime.

- The user launches the native Linux desktop binary.
- The Tauri app starts the bundled `gtd-api` sidecar.
- The sidecar starts Spring Boot with `prod,sidecar` profiles by default.
- The sidecar runs blocking File Sync before the shared database opens.
- The sidecar binds to `127.0.0.1` on an ephemeral port.
- The backend writes a readiness file with its selected local base URL.
- The desktop app reads that readiness file and sends API requests to the sidecar.

This keeps the backend local to the user's machine and avoids a hosted production server.

### Staging Runtime

Staging uses the same sidecar flow as production, but with `staging,sidecar` profiles.

Staging uses the repository-local, Git-ignored `staging-gtd-on-rails` root and the dedicated `gdrive:staging-gtd-on-rails` remote. `pnpm staging` sets these values explicitly, then the bootstrap sidecar performs blocking File Sync before connecting to the isolated Supabase PostgreSQL project. It does not reset the database, assets, or Google Integration Configuration; use an explicit reset workflow when one is added.

---

## 4. Data Directories

The backend resolves the data root from Spring profiles and environment variables.

Production defaults to:

```text
~/Documents/gtd-on-rails
```

Staging defaults to:

```text
~/Documents/dev-gtd-on-rails
```

Development defaults to the repository-local directory:

```text
dev-gtd-on-rails
```

The data root contains:

- PostgreSQL structured data: persistent local Compose volume during development or the configured Supabase project in staging and production.
- `google.properties`: Google Integration Configuration.
- `assets`: local item asset files.
- `gtd-on-rails-sync-check`: synchronized dataset marker and rclone access check file.

Environment variables can override these paths when needed, but the default runtime is optimized for the owner's Arch Linux desktop machines.

---

## 5. Data Synchronization

Assets, Google Integration Configuration, Database Connection Configuration, certificates, backups, and the File Sync marker are synchronized by `rclone`. Structured GTD data is never synchronized as a live database file; it is stored in the configured PostgreSQL environment.

- Production remote: `gdrive:gtd-on-rails`.
- Development and staging remote: `gdrive:dev-gtd-on-rails`.
- The backend owns startup data sync, database initialization, sync scheduling, and data integrity.

The app is designed for a single owner using two devices. It does not implement multi-user or concurrent divergent-edit reconciliation beyond the project-specific assumptions described in [Synchronization](synchronization.md).

---

## 6. Asset Storage

Item assets are stored as files plus database metadata.

- Asset metadata lives in PostgreSQL.
- Asset files live under `gtd.assets.local-directory`.
- The default asset directory is `${gtd.data.root-directory}/assets`.

The backend owns final asset storage, metadata creation, validation, and sync scheduling.

Assets are synchronized as part of data sync because the asset directory lives under the synchronized data root.

The body model that references these assets is described in [Body Content](../20%20-%20GTD/shared/Body%20Content.md).

---

## 7. Local Development Infrastructure

`infra/compose.yaml` defines the persistent local PostgreSQL service used by `pnpm dev`.

It intentionally contains no API or desktop container. Native Spring Boot and Tauri processes connect through localhost.

---

## 8. Release And Installation

Production distribution is the native Linux `.tar.gz` package.

The package contains:

- `gtd-on-rails`: desktop executable.
- `gtd-api`: sidecar launcher.
- `binaries/gtd-api.jar`: Spring Boot backend jar.
- `icon.png`: desktop icon.
- `install.sh`: native Linux installer script.

The installer writes files to:

```text
~/.local/share/gtd-on-rails
```

It also creates:

- `~/.local/bin/gtd-on-rails`
- `~/.local/share/applications/gtd-on-rails.desktop`

The project does not use AppImage, deb, rpm, or the built-in Tauri updater for production distribution.

---

## 9. Native Update Flow

The desktop app contains a project-owned native update flow for Linux tarball releases.

- It checks the latest GitHub release.
- It downloads the Linux `.tar.gz` and `.sha256` assets.
- It verifies the checksum.
- It stages the next installation under `~/.local/share/gtd-on-rails.next`.
- It preserves a rollback copy under `~/.local/share/gtd-on-rails.previous`.
- It replaces the active installation under `~/.local/share/gtd-on-rails` after the current process exits.

This flow is specific to the native Linux package layout.

---

## 10. CI/CD

GitHub Actions define the current CI and release pipelines.

### CI

The CI workflow runs on `main` pushes and pull requests.

It performs:

- dependency installation with `pnpm install --frozen-lockfile`.
- Playwright browser installation.
- `pnpm test`.
- `pnpm check`.
- native desktop build verification.
- native Linux tarball packaging.

The CI environment installs Node.js 22, Java 21, Rust stable, and Linux Tauri build dependencies.

### Release

The release workflow runs for version tags.

It performs:

- production-like Tauri sidecar build.
- GitHub release creation when missing.
- native Linux tarball packaging.
- upload of `.tar.gz` and `.tar.gz.sha256` assets.

---

## 11. Security Baseline

The normal runtime is local-first.

- The backend binds to localhost in sidecar mode.
- Database Connection Configuration is protected by owner-only operating-system file permissions.
- File Sync remote access is outside the application database.
- File Sync depends on the local `rclone` configuration.
- GitHub release publishing uses GitHub Actions permissions and repository secrets when needed.

---

## 12. Summary

GTD on Rails currently uses:

- a `pnpm` and Turbo monorepo.
- a Tauri 2 desktop app with React, Vite, TypeScript, and Rust.
- a Spring Boot 4 backend with Java 21 and Gradle.
- PostgreSQL for normal application persistence.
- rclone-based File Sync for file-backed state.
- filesystem-backed assets under the synchronized data root.
- native Linux `.tar.gz` production packaging.
- GitHub Actions for CI and release automation.
