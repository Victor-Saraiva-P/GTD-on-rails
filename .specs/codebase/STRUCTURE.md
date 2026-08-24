# Structure

## Repository

- `apps/desktop`: Tauri desktop shell, React frontend, Rust native integration, tests, and e2e tests.
- `apps/api`: Spring Boot backend, Gradle build, Flyway migrations, and API tests.
- `docs`: canonical project documentation and GTD knowledge base.
- `infra`: optional local infrastructure for development experiments.
- `packages`: reserved workspace for future shared packages.
- `.specs`: agent-facing project context, feature specs, quick tasks, and persistent planning memory.

## API Layout

- `controllers`: HTTP endpoints for assets, calendars, contexts, inbox, items, next actions, sync, and test reset.
- `dtos`: request and response types grouped by domain.
- `entities`: JPA entities and auditable base model.
- `enums`: domain status values.
- `exceptions`: business and not-found/conflict exception types.
- `mappers`: conversion between entities and DTOs.
- `persistence`: schema initialization, converters, and database utilities.
- `repositories`: Spring Data repository interfaces.
- `services`: domain behavior, asset storage/sync, cleanup, and after-commit execution.
- `sidecar`: sidecar readiness payload and file publishing.
- `types`: value objects and body-content model types.
- `src/main/resources/db/postgresql-migration`: Flyway PostgreSQL schema migrations.

## Desktop Layout

- `src/pages`: top-level page components and app shell.
- `src/features`: domain features such as inbox, next actions, calendar, contexts, keybinds, sync status, processing, connectivity, and history.
- `src/components`: reusable shell, list, dialog, view, retry, and loading components.
- `src/lib`: API client and Tauri runtime helpers.
- `src/config`: runtime environment and app metadata.
- `src/styles*.css` and `src/styles`: global and feature-level styles.
- `src-tauri`: Tauri configuration, Rust commands, sidecar support, and release build output.
- `test`: fast Node test-runner unit tests.
- `e2e`: Playwright end-to-end tests.

Canonical sources:

- [README.md](../../README.md)
- [Infrastructure](../../docs/10%20-%20Architecture/infrastructure.md)
