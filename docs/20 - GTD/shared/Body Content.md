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

The desktop edits Markdown directly. Saving is local and does not wait for the sync server.

Formatting/navigation includes ZenNotes-style commands such as bold, italic, code, link, strikethrough, highlight, math, checkbox, paragraph reflow, line movement and Markdown marker hopping while preserving GTD navigation and Vim semantics.
