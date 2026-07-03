# GTD on Rails

[![Version](https://img.shields.io/badge/version-1.3.0-blue)](./VERSION)
[![CI](https://github.com/Victor-Saraiva-P/GTD-on-rails/actions/workflows/ci.yml/badge.svg)](https://github.com/Victor-Saraiva-P/GTD-on-rails/actions/workflows/ci.yml)
[![CD](https://github.com/Victor-Saraiva-P/GTD-on-rails/actions/workflows/release.yml/badge.svg)](https://github.com/Victor-Saraiva-P/GTD-on-rails/actions/workflows/release.yml)
[![Desktop](https://img.shields.io/badge/platform-linux%20desktop-333333)](#architecture)
[![Stack](https://img.shields.io/badge/stack-tauri%20%2B%20react%20%2B%20spring-6f42c1)](#built-with)

GTD on Rails is a local-first personal GTD system for capturing information, processing it into next actions, planning daily and weekly work, and executing fast from keyboard-driven lists.

It is also a portfolio-grade full-stack desktop app: Tauri 2 and React 19 on the frontend, a Spring Boot backend sidecar, SQLite local persistence, rclone data sync, and Google Calendar mirroring.

![Next Actions workspace with selected detail and PDF preview](docs/assets/screenshots/main-next-actions.png)
> Main workspace showing a next-actions list, selected item detail, keyboard focus state, and sync indicators in the footer.

## Project Status

GTD on Rails is under active development. The core workflow is already in daily use as my main organizer, while more GTD elements, keybind refinements, bug fixes, and integrations are still planned.

## Why I Built This

I built GTD on Rails because existing tools did not match the system I wanted. Some apps support GTD, but do not fully follow its principles. Other personal management apps have Vim-like speed, but are not built around GTD.

GTD on Rails combines both: an opinionated, keyboard-first system that keeps the workflow "on rails" instead of becoming another loose todo list.

The name is about the philosophy of the project: the app keeps GTD decisions on rails.

## Features

- GTD workflow: capture stuff, process it into next actions, move work to On Going, and close it as Done.
- Keyboard-first UI: Vim-style navigation, leader-key shortcuts.
- Current availability filtering: choose next actions by current context, available energy, and available time.
- Rich supporting material: markdown bodies with formatting, links, file assets, image previews, and PDF previews.
- Local-first sync: SQLite structured data, Google Integration Configuration, and file assets sync through Google Drive via `rclone`.
- External agenda mirror: Google Calendar reflects deadlines, On Going work, and Done items while local GTD items remain the source of truth.

## Screenshots

### Processing Workflow

<table>
  <tr>
    <td><img src="docs/assets/screenshots/processing-choice.png" alt="Processing wizard action type choice"></td>
    <td><img src="docs/assets/screenshots/processing-deadline.png" alt="Processing wizard deadline step"></td>
  </tr>
  <tr>
    <td><img src="docs/assets/screenshots/processing-contexts.png" alt="Processing wizard contexts step"></td>
    <td><img src="docs/assets/screenshots/processing-energy.png" alt="Processing wizard energy step"></td>
  </tr>
</table>

> Inbox processing flow showing captured stuff being converted into a next action with deadline, contexts, and energy choices.

### Rich Supporting Material

![Next Action detail with PDF preview](docs/assets/screenshots/pdf-detail.png)
> Detail view showing markdown body content with a link and an attached PDF preview.

### External Agenda Mirror

![Google Calendar week view mirrored from GTD on Rails](docs/assets/screenshots/google-calendar-mirror.png)
> Google Calendar week view mirroring GTD deadlines, calendar items, On Going work, and Done items from local data.

## Architecture

The production target is a Linux desktop environment: a native Tauri package with a bundled backend sidecar and local data on the user's machine.

```text
Desktop UI (Tauri + React)
        |
Local HTTP API on 127.0.0.1
        |
Spring Boot sidecar
        |
SQLite + Google config + asset files
        |
rclone data sync
```

- Desktop shell: Tauri starts the bundled backend sidecar and connects to it through a local readiness file.
- Backend: Spring Boot exposes the local HTTP API, owns persistence, migrations, sync scheduling, assets, and integrations.
- Persistence: structured data lives in SQLite under the synchronized local data root.
- Assets: item attachments live as local files with SQLite metadata and sync as part of rclone data sync.
- External agenda mirror: Google Calendar receives derived calendar events; the local GTD system remains the source of truth.

![Synchronization status indicators](docs/assets/screenshots/sync-status.png)
> Sync/status area showing Data sync, Google Calendar sync, and local sidecar health.

## Engineering Highlights

- Full-stack desktop architecture with Tauri 2, React 19, Rust native commands, and a Spring Boot 4 sidecar.
- Local-first persistence using SQLite, Flyway migrations, Spring Data JPA, and Hibernate.
- Two-channel sync model: Google Drive through `rclone` for local data and Google Calendar for the external agenda mirror.
- Google Calendar integration with OAuth configuration, encrypted token storage, event queueing, and external agenda mirroring.
- Native Linux release packaging with a bundled executable, backend sidecar launcher, Spring Boot JAR, and installer script.
- Automated quality gates covering version drift, TypeScript checks, API tests, integration tests, and Playwright e2e workflows.

## Built With

- Desktop: Tauri 2, React 19, TypeScript, Vite, Rust
- Backend: Spring Boot 4, Java 21, Gradle
- Persistence: SQLite, Flyway, Spring Data JPA, Hibernate
- Sync and integrations: `rclone`, Google Drive, Google Calendar API
- Tooling: pnpm, Turbo, Playwright

## Run Locally

```bash
pnpm install
pnpm dev
pnpm test
pnpm build:prod
```

Useful root commands:

- `pnpm dev`: runs the desktop and API development workflows through Turbo.
- `pnpm test`: runs unit, integration, and e2e tests.
- `pnpm check`: validates TypeScript and API checks.
- `pnpm build:prod`: creates the production Tauri build with the backend sidecar.
- `pnpm build:staging`: creates the staging build using development data defaults.

Tauri builds generate the binary at `apps/desktop/src-tauri/target/release/desktop`.

## Repository Structure

- `apps/desktop`: Tauri 2 desktop shell with React, Vite, TypeScript, and Rust native commands.
- `apps/api`: Spring Boot backend with Gradle, SQLite persistence, sync services, and integrations.
- `docs/`: project knowledge base covering GTD rules, architecture, sync, and execution guides.
- `infra/`: optional local infrastructure for development experiments.
- `packages/`: reserved workspace for future shared packages.

## Documentation

Detailed architecture, GTD rules, synchronization behavior, and app setup live in `docs/`. The docs use wiki-style links and are easiest to navigate from Obsidian.

Start with `docs/00 - Home/Dashboard.md`.

## Roadmap

- Expand coverage of GTD elements beyond the current core flow.
- Refine Vim motions and leader-key workflows.
- Improve reliability and polish around existing daily-use flows.
- Add more integrations around planning and external systems.
