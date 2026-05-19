# GTD on Rails

Base monorepo of the project, kept minimalistic in this phase.

>  **Documentation Note:** All detailed documentation (architecture, GTD rules, synchronization, and app-specific setup) lives in the `docs/` folder. We recommend that you **open the root of this project (or the `docs/` folder) in Obsidian** to navigate the links and have the best reading experience.

## Structure

- `apps/desktop`: desktop shell with Tauri 2
- `apps/api`: Spring Boot backend with Gradle
- `packages/`: reserved space for shared code
- `infra/`: minimal local infrastructure
- `docs/`: Knowledge Base. Start with `docs/00 - Home/Dashboard.md`.

## Commands

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm build:prod`
- `pnpm build:staging`
- `pnpm staging`
- `pnpm e2e`
- `pnpm lint`
- `pnpm check`

In the root:

- `pnpm dev`: spins up `desktop` and `api`
- `pnpm build`: builds the desktop frontend and the backend
- `pnpm build:prod`: creates the release Tauri build with backend sidecar using `prod,sidecar`
- `pnpm build:staging`: creates the release Tauri build with backend sidecar using `staging,sidecar`
- `pnpm staging`: creates the staging build and runs the release binary
- `pnpm check`: validates TypeScript on the desktop and runs API tests

Tauri builds generate the binary at `apps/desktop/src-tauri/target/release/desktop`.

Use `pnpm build:prod` for the real runtime (`gtd-on-rails`, `main` branch, `gdrive:gtd-on-rails` remote) and `pnpm build:staging` to test the same sidecar flow with development data (`dev-gtd-on-rails`, `dev` branch, `gdrive:dev-gtd-on-rails` remote).
