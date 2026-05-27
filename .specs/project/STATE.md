# Project State

## Decisions

- Production is a native Linux `.tar.gz` desktop app installed under `~/.local/share/gtd-on-rails`.
- The production app targets the owner's Arch Linux and Hyprland machines.
- The app is single-user and assumes the owner waits for one device to finish syncing before editing on the other.
- Do not add multi-user behavior or concurrent divergent-edit reconciliation unless explicitly requested.
- The backend owns final asset storage, database metadata, public URL generation, validation, and sync scheduling.
- The frontend must not copy assets directly into the final asset directory.
- Clipboard or dropped local files should use Tauri native commands and `POST /items/{id}/assets/local-file`.
- Byte-backed clipboard images and HTML file inputs should use multipart `POST /items/{id}/assets`.
- All user-facing application text and documentation must be English.
- Deleted item pages use `#9B9B9B` as the predominant color.
- Completed item pages use `#7F8D3F` as the predominant color.
- Modal keybind scopes must isolate keyboard handling from page-level handlers.
- Before adding or changing keybindings, inspect existing definitions and docs for conflicts.
- Processing flows must persist only at the end because `esc` can cancel or go back.

## Preferences

- Keep `.specs` files concise and link to canonical docs instead of duplicating them.
- Prefer implementation choices that fit the existing Java/Spring and TypeScript/React conventions.
- Prefer Arch/Hyprland-specific native integrations when they simplify the implementation.

## Blockers

- None recorded.

## Todos

- Refine `.specs/project/ROADMAP.md` priorities when the project owner chooses the next planning horizon.
- Keep this file updated when future sessions discover durable decisions, blockers, lessons, or deferred ideas.

## Deferred Ideas

- None recorded.

## Lessons

- `.specs` should act as a compact agent context layer; `docs/` remains the canonical knowledge base.
