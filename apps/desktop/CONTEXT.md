# Desktop

The Desktop context covers the local keyboard-driven application experience, including workspaces, lists, detail views, modal flows, and availability filtering.

## Language

**Current Availability State**:
The volatile next-action list filter that represents the user's current execution constraints: contexts, available energy, and available time. It can include multiple simultaneous contexts and is not persisted on a next action.
_Avoid_: current state, item state, next-action attributes

**On Going Item**:
An active execution item shown in the On Going list. It can be either an on going next action or an on going calendar item.
_Avoid_: on going thing, on going row, active panel item

**Project Card**:
A compact project representation in the Projects page that shows the project title and project glyph. It does not expose the captured stuff body that may have originated the project.
_Avoid_: project preview

**Project Detail Page**:
A fullscreen project-focused page used to inspect and operate the items associated with one active project.
_Avoid_: Project Workspace, project preview

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
