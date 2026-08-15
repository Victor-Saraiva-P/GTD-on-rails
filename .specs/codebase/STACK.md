# Stack

## Monorepo

- Package manager: `pnpm@10.32.1`.
- Workspace orchestration: Turbo.
- Workspace packages: `apps/*` and `packages/*`.
- Tool versions are pinned in `mise.toml`.

## Pinned Tools

- Node.js 22.
- Java 21 through Temurin.
- Rust stable.

## Desktop App

- Location: `apps/desktop`.
- Shell: Tauri 2.
- UI: React 19.
- Build: Vite.
- Language: TypeScript.
- Native layer: Rust.
- Tauri plugins include filesystem and HTTP support.
- CodeMirror powers markdown editing.
- Playwright covers desktop e2e flows.

## API

- Location: `apps/api`.
- Runtime: Java 21.
- Framework: Spring Boot 4.
- Build tool: Gradle.
- Persistence: Spring Data JPA, Hibernate, PostgreSQL.
- Migrations: Flyway.
- Test framework: Gradle/JUnit.

## Commands

- `pnpm dev`: run development tasks through Turbo.
- `pnpm build`: build workspace packages.
- `pnpm test`: run unit, integration, and e2e tests.
- `pnpm check`: run static checks.
- `pnpm build:prod`: build the production sidecar desktop release.
- `pnpm build:staging`: build the staging sidecar desktop release.

Canonical sources:

- [README.md](../../README.md)
- [Infrastructure](../../docs/10%20-%20Architecture/infrastructure.md)
- [Desktop Execution](../../docs/30%20-%20Guides%20and%20Manuals/Desktop%20Execution.md)
- [API Execution](../../docs/30%20-%20Guides%20and%20Manuals/API%20Execution.md)
