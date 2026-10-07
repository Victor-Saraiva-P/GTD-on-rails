# Project Body Context Tasks

**Design**: `.specs/features/project-body-context/design.md`
**Status**: Completed

## Execution Plan

```text
T1 (CLI project context) ──→ T2 (agent instructions)
T3 (project attachment lifecycle) ──→ T6 (page integration)
T4 (desktop body controller) ──→ T5 (ProjectBrief component) ──→ T6
T6 ──→ T7 (docs and full validation)
```

## Task Breakdown

### T1: Add read-only project context to the GTD CLI

**What**: Show associated project title/body in `stuff show` and export that project's referenced body attachments through `stuff project-context`.
**Where**: `apps/cli/src/{args,api,commands,models}.rs` and co-located Rust tests.
**Depends on**: None
**Reuses**: existing `stuff export`, item body endpoint, and asset download code.
**Requirement**: PBC-04, PBC-05
**Tests**: unit
**Gate**: `cargo test --manifest-path apps/cli/Cargo.toml`

### T2: Require project-context inspection in processing runs

**What**: Change the launcher prompt and bundled processing skill to conditionally inspect project context without permitting project mutation.
**Where**: `apps/desktop/src-tauri/src/agent_processing.rs`, `.agents/skills/gtd-processing/SKILL.md`, Rust tests.
**Depends on**: T1
**Reuses**: existing agent prompt tests and controlled CLI instructions.
**Requirement**: PBC-04
**Tests**: unit
**Gate**: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`

### T3: Preserve project attachment lifecycle

**What**: Soft-delete project backing-Item attachments on project deletion and reconcile them on recovery.
**Where**: `apps/api/src/main/java/.../ProjectService.java` and API service/integration tests.
**Depends on**: None
**Reuses**: `ItemAssetService` lifecycle methods.
**Requirement**: PBC-06
**Tests**: unit + integration
**Gate**: `pnpm --filter @gtd-on-rails/api test`

### T4: Add project brief body state and API boundary

**What**: Load, persist, and expose the project backing-Item body to desktop Project Detail.
**Where**: `apps/desktop/src/features/projects/` and desktop unit tests.
**Depends on**: None
**Reuses**: existing item body API, editor persistence helpers, and project controller patterns.
**Requirement**: PBC-01
**Tests**: unit
**Gate**: `pnpm --filter @gtd-on-rails/desktop test`

### T5: Create the ProjectBrief component

**What**: Build the dedicated Brief component around the existing Markdown editor with preview/edit callbacks and an empty state.
**Where**: `apps/desktop/src/features/projects/` and desktop unit tests.
**Depends on**: T4
**Reuses**: `ItemBodyMarkdownEditor`.
**Requirement**: PBC-01, PBC-02
**Tests**: unit
**Gate**: `pnpm --filter @gtd-on-rails/desktop test`

### T6: Integrate Project Brief into Project Detail

**What**: Wire the selected three-pane layout, `g b`/`e`/`Ctrl+h` focus flow, formatting/asset dialogs, asset preloading, and an end-to-end owner flow.
**Where**: `ProjectDetailPage.tsx`, keybind types, project styles, desktop unit/e2e tests.
**Depends on**: T3, T5
**Reuses**: `MarkdownAssetComboDialog`, `buildFormattingBindings`, `ListView`, and native asset source handling.
**Requirement**: PBC-01, PBC-02, PBC-03, PBC-06
**Tests**: unit + e2e
**Gate**: `pnpm --filter @gtd-on-rails/desktop test && pnpm --filter @gtd-on-rails/desktop e2e`

### T7: Document and validate the vertical slice

**What**: Update canonical project/body/shortcut documentation and verify all requirements, including sync scheduling.
**Where**: `docs/20 - GTD/project/`, `docs/20 - GTD/shared/`, `.specs/features/project-body-context/`.
**Depends on**: T2, T6
**Reuses**: established body and asset documentation.
**Requirement**: PBC-01 through PBC-06
**Tests**: full
**Gate**: `pnpm test`

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | CLI project-context capability | ✅ Granular |
| T2 | Processing instruction contract | ✅ Granular |
| T3 | Project attachment lifecycle | ✅ Granular |
| T4 | Desktop body state boundary | ✅ Granular |
| T5 | ProjectBrief component | ✅ Granular |
| T6 | Project Detail integration | ✅ Cohesive integration |
| T7 | Docs and feature validation | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends on | Diagram | Status |
| --- | --- | --- | --- |
| T1 | None | Start | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | None | Start | ✅ Match |
| T4 | None | Start | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T3, T5 | T3/T5 → T6 | ✅ Match |
| T7 | T2, T6 | T2/T6 → T7 | ✅ Match |

## Test Co-location Validation

| Task | Layer | Required tests | Task tests | Status |
| --- | --- | --- | --- | --- |
| T1 | Rust CLI | Unit | Unit | ✅ |
| T2 | Tauri runtime | Unit | Unit | ✅ |
| T3 | Spring service/API | Unit + integration | Unit + integration | ✅ |
| T4 | Desktop controller/API | Unit | Unit | ✅ |
| T5 | Desktop component | Unit | Unit | ✅ |
| T6 | Desktop UI/keybind flow | Unit + e2e | Unit + e2e | ✅ |
| T7 | Documentation/integration | Full | Full | ✅ |
