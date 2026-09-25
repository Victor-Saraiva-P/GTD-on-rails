# Body Content

Item body content is canonical Markdown stored as a physical file.

For an item UUID `<id>`:

```text
items/<id>/body.md
```

The SQLite `items.body` column is currently retained only as a temporary rollback mirror during migration. Application reads use `body.md` as the authority.

## Assets

Item assets use stable UUID directories:

```text
items/<item-id>/assets/<asset-id>/<filename>
```

Markdown references them with relative links:

```markdown
![Architecture](assets/<asset-id>/architecture.png)
[Specification.pdf](assets/<asset-id>/Specification.pdf)
```

The editor resolves those relative paths at runtime for previews without rewriting the Markdown file.

## Migration

Legacy `ItemBody` JSON is materialized into Markdown idempotently. The migration preserves supported formatting and converts legacy asset entities to relative Markdown references.

Missing physical assets remain visible as broken references/diagnostics instead of being silently discarded.

## Editing

The desktop edits Markdown directly. Read-only body preview reuses the CodeMirror rendering pipeline but is non-interactive: it has no Vim mode, visible cursor, active-line state, or focusable editor surface. Vim and editing behavior are installed only after the user explicitly enters body editing.

For an item with an existing body, preview and edit reuse the same CodeMirror EditorView. CodeMirror compartments reconfigure read-only state, editability, DOM attributes, Vim, and editing keymaps in place instead of destroying and recreating the editor. Selection and editor state therefore survive the mode transition without a React remount.

CodeMirror owns the authoritative working document while an editor session is active; React state and persistence do not control individual keystrokes. Rich live-preview decorations are remapped cheaply during document transactions and recomputed on the next animation frame, keeping syntax-tree and asset-decoration work off the immediate keystroke path.

Document changes enqueue immutable body snapshots for local persistence. The editor coalesces rapid changes with a short debounce, serializes writes, and persists only the latest pending snapshot after an in-flight save completes. Explicit save and editor exit flush the current snapshot before navigation continues.

Saving is local and does not wait for the sync server. This editor-first persistence model applies to item body Markdown only; structured GTD mutations keep their existing mutation behavior.

Formatting/navigation includes ZenNotes-style commands such as bold, italic, code, link, strikethrough, highlight, math, checkbox, paragraph reflow, line movement and Markdown marker hopping while preserving GTD navigation and Vim semantics.
