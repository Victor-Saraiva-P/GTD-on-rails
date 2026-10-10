# Desktop

The Desktop context covers the local keyboard-driven application experience, including workspaces, lists, detail views, modal flows, and availability filtering.

## Language

**Current Availability State**:
The volatile next-action list filter that represents the user's current execution constraints: contexts, available energy, and available time. It can include multiple simultaneous contexts and is not persisted on a next action. It never hides or reorders Calendar projections whose temporal obligation must remain visible.
_Avoid_: current state, item state, next-action attributes

**Calendar Projection**:
A Calendar view of an existing Calendar Item or Next Action that preserves the source entity's identity. Projected Next Actions keep the `N` glyph and route edits, lifecycle transitions, detail navigation, and recovery to Next Action behavior rather than Calendar Item behavior.
_Avoid_: calendar copy, converted calendar item

**Due Next Action**:
An available Next Action whose deadline is the local calendar date. Calendar Today surfaces it as `Due today` without converting it to a Calendar Item.
_Avoid_: scheduled next action, calendar task

**Overdue Next Action**:
An available Next Action whose deadline is before the local calendar date. Calendar Today keeps it visible until completion, deadline change/removal, or another lifecycle transition removes it from the available state.
_Avoid_: expired action, late calendar item

**On Going Item**:
An active execution item shown in the On Going list. It can be either an on going next action or an on going calendar item.
_Avoid_: on going thing, on going row, active panel item

**Project Card**:
A compact project representation in the Projects page that shows the project title and project glyph. It does not expose the captured stuff body that may have originated the project.
_Avoid_: project preview

**Project Detail Page**:
A fullscreen project-focused page used to inspect and operate the items associated with one active project.
_Avoid_: Project Workspace, project preview

**Project Brief**:
The read-only preview or editable canonical Markdown body of the Item backing the active project, shown as a dedicated pane in Project Detail. It follows normal Item body formatting, asset, persistence, synchronization, and Vim editing behavior.
_Avoid_: project notes, project description, project-specific body

**Project Actions View**:
The project detail subview that lists actionable or clarifiable project items. It includes project stuff, active calendar items, next actions with deadlines, and next actions without deadlines.
_Avoid_: Actions, project task list, project backlog

**Active Project**:
A project whose desired result has not yet been achieved and remains part of current commitments.
_Avoid_: In-progress project, on going project

**Done Project**:
A project whose desired result has been achieved and is no longer active.
_Avoid_: Completed Project, concluded project

**Deleted Project**:
A project removed from active operational use but kept as a recoverable project record. Recovering a deleted project returns it to the project state it had before deletion.
_Avoid_: Removed project, trashed project

**Agent Processing Settings**:
Machine-local desktop preferences that select which supported headless harness processes GTD stuff and which model/thinking options that harness receives. These preferences are stored outside synchronized GTD domain data under the user configuration directory. Opening the screen must not start external agent CLIs; Antigravity model discovery is cached and refreshed only by explicit user action, while Codex options come from its local model cache. Starting a token-spending processing run requires the explicit `Space a` Inbox keybind on a concrete stuff item; active runs remain observable across page navigation through shared run state and footer activity.
_Avoid_: AI project settings, synced agent preferences

**Database Setup**:
The first-installation flow that provisions a runtime environment's structured persistence after successful File Sync confirms that no Database Connection Configuration exists.
_Avoid_: Database login, connection screen, Supabase setup

**Database Connection Repair**:
The explicit bootstrap flow that validates a fresh administrative connection and rotates a broken limited application role without treating an existing configuration as first installation.
_Avoid_: Database Setup, automatic credential recovery

**Optimistic Mutation**:
A desktop state transition applied immediately in the user interface for high-frequency keyboard operations before the local backend write confirms success. Remote synchronization is independent and may remain pending in the sync outbox while the sync server is unavailable.
_Avoid_: draft, remote write-through

**Project-associated item**:
An item linked to exactly one project. Lists and detail views identify it with the purple `P` project glyph followed by the project's literal title, and allow direct keyboard navigation to its owner project via `gd`.
_Avoid_: project label, project breadcrumb

**Project association marker**:
The visual `P project title` marker shown only for project-associated items. It is informational, is not a clickable navigation control, and is omitted when no valid project title is available.
_Avoid_: project link, project action
