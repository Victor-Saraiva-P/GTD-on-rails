# Project Body Context Specification

## Problem Statement

Projects already have a backing Item, but the desktop does not expose its canonical Markdown body or attachments. Consequently, a project cannot be maintained as context in the chosen dedicated pane, and a processing agent only sees the selected stuff rather than the project evidence that should guide its decision.

## Goals

- [ ] Expose the backing Item body and attachments as the Project Brief in Project Detail using the chosen dedicated pane and command-first editing model.
- [ ] Make project body and referenced attachments available as read-only context to an agent processing associated stuff.
- [ ] Preserve the existing backend-owned storage, reconciliation, sync, and deletion semantics for project attachments.

## Out of Scope

| Feature | Reason |
| --- | --- |
| A project-specific body or asset schema | A Project already shares its ID and Item-owned body/assets. |
| A new agent-processing UI in Project Detail | The existing Inbox agent action processes associated stuff. |
| Editing project context from an agent | Project context informs a decision and remains owner-authored. |
| New Markdown or attachment formats | Existing item-body behavior is reused unchanged. |

## User Stories

### P1: Maintain a Project Brief ⭐ MVP

**User Story**: As the project owner, I want a dedicated Project Brief pane beside project actions so that I can keep the outcome, constraints, and reference attachments available without leaving the project.

**Why P1**: Project context is useful only when it is a first-class part of the project workspace.

**Acceptance Criteria**:

1. WHEN I open Project Detail THEN the system SHALL render a Project Brief pane beside actions and item detail using the backing Item body.
2. WHEN the Project Brief is focused and I press `e` THEN the system SHALL enter the existing Markdown editor in that pane; `Esc` SHALL preserve normal Vim behavior and `Ctrl+h` SHALL flush/leave editing and focus project actions.
3. WHEN I use a supported Markdown formatting, link, or asset command in the Project Brief THEN the system SHALL use the same editor, dialogs, upload paths, previews, and body persistence behavior as an item body.
4. WHEN a project body is empty THEN the pane SHALL provide an English empty state and allow editing.

**Independent Test**: Open a project, edit and persist its brief, insert an attachment, reopen the project, and inspect the same preview.

### P1: Give associated Stuff project context during agent processing ⭐ MVP

**User Story**: As the project owner, I want an agent processing associated stuff to inspect my Project Brief and its relevant attachments so that its GTD decision reflects the project's desired outcome and constraints.

**Why P1**: This is the purpose of adding a project body rather than merely a visual note.

**Acceptance Criteria**:

1. WHEN an agent inspects associated stuff with `gtd stuff show` THEN the CLI SHALL display a clearly delimited, read-only Project context block containing the associated project title and Markdown body.
2. WHEN that project body references attachments THEN `gtd stuff project-context <stuff-id> --output <directory>` SHALL export only the project body and its referenced project-owned attachments into the requested directory.
3. WHEN a processing run starts for associated stuff THEN its prompt and processing skill SHALL instruct the agent to inspect this project context, while forbidding mutations to it.
4. WHEN stuff has no project THEN existing agent processing behavior and CLI output SHALL remain unchanged.

**Independent Test**: Associate stuff to a project with a brief and attachment, run the CLI commands, and verify that the agent-facing output identifies and exports the project evidence.

### P1: Preserve attachment lifecycle and sync ⭐ MVP

**User Story**: As the project owner, I want project attachments to be deleted, recovered, and synchronized like item attachments so that no context files become orphaned or disappear across my devices.

**Why P1**: Project attachment safety is required before exposing attachments in the normal workspace.

**Acceptance Criteria**:

1. WHEN a project body or project attachment changes THEN existing Item body/file outboxes SHALL schedule the canonical files for sync.
2. WHEN I delete a project THEN the system SHALL soft-delete its active Item-owned attachments.
3. WHEN I recover a project THEN the system SHALL reconcile the restored project body references and restore only referenced attachments.

**Independent Test**: Upload a project attachment, delete/recover its project, and verify the attachment metadata lifecycle plus scheduled sync behavior.

## Edge Cases

- WHEN a project has no body THEN the body editor SHALL start empty without creating an attachment record.
- WHEN a Project Brief references a missing attachment THEN preview SHALL use the same broken-reference diagnostic as an item body.
- WHEN a project attachment upload is cancelled or invalid THEN no Markdown reference, final file, metadata row, or sync entry SHALL be created.
- WHEN an agent processes stuff without a project THEN it SHALL not attempt project-context export.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PBC-01 | Maintain a Project Brief | Design | Pending |
| PBC-02 | Maintain a Project Brief | Design | Pending |
| PBC-03 | Maintain a Project Brief | Design | Pending |
| PBC-04 | Give associated Stuff project context | Design | Pending |
| PBC-05 | Give associated Stuff project context | Design | Pending |
| PBC-06 | Preserve attachment lifecycle and sync | Design | Pending |

## Success Criteria

- [ ] A project brief with a Markdown attachment survives reload, deletion/recovery, and sync scheduling through the existing Item contract.
- [ ] Project Detail supports the chosen `g b`, `e`, `Esc`, and `Ctrl+h` keyboard flow without collisions.
- [ ] The agent can read, but cannot be instructed to change, context for associated stuff.
