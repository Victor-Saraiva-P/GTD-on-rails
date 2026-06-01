# Context Map

This repo uses multiple domain contexts. Read the context file that matches the area being changed.

The `docs` directory is the canonical knowledge base.

## Contexts

| Area | Context file | Scope |
| --- | --- | --- |
| API | `apps/api/CONTEXT.md` | Spring Boot backend, persistence, synchronization, assets, and HTTP API behavior. |
| Desktop | `apps/desktop/CONTEXT.md` | Tauri desktop app, React UI, local desktop integration, keybindings, and frontend asset handling. |

If a context file does not exist yet, use the canonical `docs/` files that match the area being changed.

## Shared Decisions

System-wide ADRs live in `docs/adr/` when they exist. Context-specific ADRs live under each context's `docs/adr/` directory when they exist.
