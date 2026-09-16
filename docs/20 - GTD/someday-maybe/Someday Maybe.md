# Someday/Maybe

This page defines the Someday/Maybe GTD element and its dedicated workspace.

## Concept

Someday/Maybe represents ideas, projects, or items that you might want to act on in the future, but cannot or do not want to commit to right now (as described in the GTD methodology by David Allen).

In GTD on Rails, Someday/Maybe is a temporary holding state:
- When processing inbox stuff that cannot be acted upon right now, convert it to Someday/Maybe (`s`).
- When the impediment is resolved or the time comes to reconsider the item, return it back to the Inbox (`i`), allowing it to be clarified and processed normally as actionable work.

## Theme & Visual Identity

- **Active List Accent**: `#CA9849` (RGB: `202, 152, 73`)
- **Deleted List Accent**: `#9B9B9B` (RGB: `155, 155, 155`)
- **Glyph**: `S`

## Navigation

- Press `Space s` from anywhere in the application to open the Someday/Maybe page.
- In the Inbox processing dialog (`p`), press `s` to process the selected stuff into Someday/Maybe.

## Keybindings

### Master List

| Shortcut | Scope | Action |
| --- | --- | --- |
| `j` | List | Move selection down. |
| `k` | List | Move selection up. |
| `gg` | List | Move selection to the first item. |
| `G` | List | Move selection to the last item. |
| `Enter` | List | Edit selected item title. |
| `l` | List | Edit selected item body (focuses detail pane). |
| `h` | Detail | Focus master list. |
| `i` | List | Move selected item back to Inbox stuff (`STUFF`). |
| `d` | List | Soft-delete selected item. |
| `u` | List | Undo last action (e.g. deletion). |
| `Ctrl+r` | List | Redo last undone action. |
| `[` | List or detail | Cycle to previous subview (Active / Deleted). |
| `]` | List or detail | Cycle to next subview (Active / Deleted). |
| `P` | List or detail | Associate item with a project. |
| `gd` | List or detail | Navigate to owner project. |
| `Space k` | List or detail | Show available keybindings. |

### Deleted Subview

| Shortcut | Scope | Action |
| --- | --- | --- |
| `r` | List or detail | Recover deleted item back to active Someday/Maybe. |

## Lifecycle & API Endpoints

- `POST /inbox/{id}/someday-maybe`: Converts an inbox stuff item into a Someday/Maybe item.
- `GET /someday-maybe`: Lists all active Someday/Maybe items.
- `GET /someday-maybe/deleted`: Lists all deleted Someday/Maybe items.
- `GET /someday-maybe/{id}`: Retrieves a single Someday/Maybe item.
- `POST /someday-maybe/{id}/stuff`: Reverts the Someday/Maybe item back to an inbox stuff item.
- `DELETE /items/{id}`: Soft-deletes a Someday/Maybe item.
- `POST /items/{id}/restore`: Restores a soft-deleted Someday/Maybe item.
