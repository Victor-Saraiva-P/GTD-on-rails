# Concerns

## Sync Divergence

Persistence sync uses `git pull --ff-only` and intentionally fails on divergent histories. Do not add automatic merge commits, force-push recovery, or SQL-level merge behavior unless explicitly requested.

When touching sync, test failed Git states, local changes, unpushed commits, status reporting, and recovery paths.

## Asset Consistency

Assets require consistency between files, `item_assets`, and body `blockEntities`. The backend must own final storage, metadata, URL generation, validation, and sync scheduling.

When touching assets, test local-file sources, multipart sources, preview fallback behavior, invalid paths, missing metadata, and sync scheduling.

## Keybind Conflicts

The leader-key model is scope-sensitive. A shortcut may only be reused when screen, focus zone, modal scope, or modifiers make the separation explicit.

Before changing keybinds, inspect implementation and docs. Test the active screen and modal behavior.

## Modal Keyboard Isolation

Modal dialogs must prevent page-level handlers from running while active. This is especially important for processing, markdown link/asset dialogs, context icon editing, and calendar schedule editing.

## Processing Persistence Timing

Processing flows can be cancelled with `esc`. Backend requests and persistence must happen only at the final step.

Test cancellation from the first step, back navigation from later steps, state preservation across back/forward movement, and incompatible choice resets.

## Native Runtime And Updates

Production distribution is the native Linux tarball with sidecar API. Do not add AppImage, deb, rpm, or Tauri updater production flows unless explicitly requested.

When touching packaging or updates, verify sidecar jar inclusion, checksum validation, staging paths, rollback behavior, and install paths.

## Sidecar Readiness

The desktop depends on the sidecar readiness file to discover the API base URL. Changes around startup should handle slow startup, missing readiness data, failed sidecar startup, and retry/error display.

## Body Markdown Rendering

Preview mode and detail views must render the same supported elements as edit mode. Asset tokens must stay aligned with `blockEntities`.

When touching body content, test markdown formatting shortcuts, links, asset insertion, asset opening, previews, and serialization.

Canonical sources:

- [AGENTS.md](../../AGENTS.md)
- [Infrastructure](../../docs/10%20-%20Architecture/infrastructure.md)
- [Synchronization](../../docs/10%20-%20Architecture/synchronization.md)
- [Body Content](../../docs/20%20-%20GTD/shared/Body%20Content.md)
- [Global Shortcuts](../../docs/20%20-%20GTD/shared/Global%20Shortcuts.md)
