# GTD on Rails Project

## Vision

GTD on Rails is a local-first desktop application for running a personal Getting Things Done workflow. The app is optimized for one owner using two trusted Arch Linux machines, with a native Linux desktop runtime and no hosted production server.

The product should make it fast to capture unprocessed stuff, clarify it into concrete next actions or calendar items, execute selected work, and preserve recoverable history for deleted or completed items.

Canonical sources:

- [README.md](../../README.md)
- [GTD Elements](../../docs/20%20-%20GTD/GTD%20Elements.md)
- [Infrastructure](../../docs/10%20-%20Architecture/infrastructure.md)
- [Synchronization](../../docs/10%20-%20Architecture/synchronization.md)

## Product Goals

- Capture without premature decision-making through the inbox and stuff model.
- Process captured material only at the end of a cancellable flow, so `esc` can safely cancel or step back before persistence.
- Keep next actions concrete, executable, and filterable by context, time, energy, schedule, and workflow state.
- Support rich body content with markdown formatting, links, and backend-owned file assets.
- Keep persistence and assets local-first while syncing between the owner's two machines.
- Preserve simple keyboard-driven operation through discoverable, conflict-free keybindings.

## Runtime Assumptions

- The production app is a native Linux `.tar.gz` installation under `~/.local/share/gtd-on-rails`.
- The only production desktop environment target is the owner's Arch Linux and Hyprland setup.
- The Tauri desktop app starts a bundled Spring Boot sidecar API.
- The sidecar binds to localhost and stores data on the user's machine.
- SQLite is the application database.
- Structured persistence sync uses a private Git repository.
- File asset sync uses rclone and Google Drive remotes.

## Core Workflow

1. Capture new stuff into the inbox.
2. Add body content or assets when useful.
3. Process inbox stuff into a supported GTD outcome.
4. Pull actionable work into next actions, calendars, or on-going execution.
5. Mark finished work done, or delete/recover items as needed.
6. Let backend-owned sync move persistence and assets between trusted devices.

## Non-Goals

- Hosted multi-user production service.
- Cross-platform production packaging.
- AppImage, deb, rpm, or Tauri updater production flows.
- Concurrent divergent-edit reconciliation across devices.
- Frontend-owned final asset storage.
