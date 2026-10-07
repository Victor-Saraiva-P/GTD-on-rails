# Project Body Context Design

**Spec**: `.specs/features/project-body-context/spec.md`
**Status**: Approved by the chosen prototypes: dedicated pane B + command-first editing A.

## Architecture Overview

`Project` uses `@MapsId` to share the backing `Item` identifier. The feature deliberately keeps `items/<id>/body.md`, `item_assets`, and the existing body/file sync object types as the sole persistence contract.

```text
Project Detail
  └─ Project Brief pane (project.id is item id)
       ├─ GET/PATCH /items/{project.id}/body
       ├─ POST /items/{project.id}/assets[ /local-file]
       └─ ItemBodyMarkdownEditor + MarkdownAssetComboDialog

Associated Stuff → gtd stuff show / project-context export → Project backing Item body + referenced assets
```

## Code Reuse Analysis

| Existing component | Location | Reuse |
| --- | --- | --- |
| Canonical body API | `apps/desktop/src/features/inbox/api.ts` | Fetch and update the project backing Item body. |
| Markdown editor | `apps/desktop/src/features/inbox/ItemBodyMarkdownEditor.tsx` | Identical preview/edit, Vim, Markdown decorations, persistence callbacks, and assets. |
| Asset dialog | `apps/desktop/src/features/inbox/MarkdownAssetComboDialog.tsx` | Existing multipart/local-file sources against the project ID. |
| Body backend | `apps/api/.../ItemService.java`, `ItemBodyDocumentService.java` | Existing Item body persistence, asset reconciliation, and file outbox. |
| Asset backend | `apps/api/.../ItemAssetService.java` | Existing ownership validation, storage, metadata, and file sync. |
| CLI API client | `apps/cli/src/api.rs` | Fetch project backing Item body and referenced files using the project ID. |

## Components

### Project brief controller

- **Location**: `apps/desktop/src/features/projects/`
- **Purpose**: Load the backing Item body for the selected project and expose existing autosave/commit semantics.
- **Interface**: receives `Project | null`; returns loaded body, edit state, focus actions, and asset owner ID.
- **Reuses**: `itemBodyLoader`, `ItemBodyMarkdownEditor` callback contract, project detail active-zone state.

### Project Brief pane

- **Location**: `apps/desktop/src/pages/ProjectDetailPage.tsx` and focused project feature components.
- **Purpose**: Render the third dedicated pane, enter editing with `e`, focus with `g b`, and return with `Ctrl+h`.
- **Reuses**: `ListView`, shared formatting bindings, existing asset/link dialogs.

### Agent project-context CLI command

- **Location**: `apps/cli/src/args.rs`, `commands.rs`, `api.rs`.
- **Purpose**: Read and export the project body/attachments associated with one stuff item.
- **Interface**: `gtd stuff project-context <stuff-id> --output <directory>`.
- **Rule**: Export only the associated project's Markdown and asset paths referenced by that Markdown; never mutate the project.

### Agent prompt and skill

- **Location**: `apps/desktop/src-tauri/src/agent_processing.rs`, `.agents/skills/gtd-processing/SKILL.md`.
- **Purpose**: Require conditional project-context inspection during associated-stuff processing.

## Data Model

No new persistence model is introduced.

```text
Project.id == Item.id
Item body: items/<project-id>/body.md
Item assets: items/<project-id>/assets/<asset-id>/<filename>
```

The existing `item_assets.item_id` remains the ownership boundary. Project attachment metadata and file sync use the same Item-owned records and `item_asset_file` outbox entries.

## Lifecycle Adjustment

`ProjectService.deleteProject` and `recoverProject` must delegate attachment handling to `ItemAssetService`: delete soft-deletes active assets; recovery reconciles the restored body to restore only referenced assets.

## Keyboard Design

| Scope | Shortcut | Behavior |
| --- | --- | --- |
| Project Actions | `g b` | Focus Project Brief preview. |
| Project Brief preview | `e` | Enter the Markdown editor. |
| Project Brief editor | `Esc` | Existing Vim mode transition only. |
| Project Brief editor | `Ctrl+h` | Flush editor, exit brief editing, and focus Project Actions. |
| Project Brief editor | Existing `Space m …`, `Space t …`, `Ctrl+Enter` | Existing Markdown formatting and task behavior. |

`g b` does not collide with the existing `g g` and `g d` sequences. Existing leader formatting remains isolated to the new `project-brief` focus zone.

## Error Handling

| Scenario | Handling |
| --- | --- |
| Project backing body unavailable | Reuse the existing retry/error rendering. |
| Invalid or cancelled asset input | Reuse Item asset validation; no body reference or sync enqueue is created. |
| Stuff has no project | CLI prints the normal stuff detail and project-context export rejects with an explicit expected association error. |
| Missing referenced project asset | Reuse the existing Markdown broken-reference diagnostic. |

## Technical Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Persistence | Reuse backing Item | Avoids duplicate bodies, metadata, storage, and sync objects. |
| Layout | Dedicated third pane | User selected prototype B. |
| Editing | Command-first | User selected prototype A; preserves action navigation and current Vim model. |
| Agent context | CLI read/export command | Keeps evidence access inside the controlled `gtd` contract and allows attachment inspection. |
