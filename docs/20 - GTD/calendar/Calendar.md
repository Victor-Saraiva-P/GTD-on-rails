# Calendar

The Calendar page is an operational view of date-bound work. It shows both [[Calendar Item]] records and date-based projections of [[Next Action]] records without changing either element's identity.

## Today

The primary pending panel is `Due`. It combines:

- active calendar items scheduled for today or earlier;
- available next actions whose deadline is today;
- available next actions whose deadline is before today.

A projected next action keeps the `N` glyph and is labeled as due today or overdue. A calendar item keeps the `C` glyph. Projected Next Actions also preserve their project marker and expose their original contexts, energy, estimated time, and body in detail/preview surfaces, but Calendar keeps its own page theme instead of restyling rows as a Next Actions list. Calendar projection ignores Current Availability filters such as context, available energy, and available time: a deadline remains temporally relevant even when the action is not currently executable under those constraints.

Pending items are grouped to protect today's hard landscape from overdue backlog. The groups are visible as non-focusable section headers when they contain at least one item, while `j` and `k` still navigate the combined Due list as a single sequence. `Scheduled today` comes first and contains today's timed Calendar Items in chronological order; a Calendar Item whose scheduled time has already passed remains in this group until the local date changes. `Overdue` follows and contains Calendar Items and Next Actions from earlier dates, ordered by their effective temporal limit from oldest to newest. `Due today` comes last and contains today's all-day Calendar Items and Next Actions whose deadline is today. Within the same date, timed Calendar Items come first in chronological order, followed by all-day Calendar Items, then Next Actions in stable creation order with a deterministic ID tie-breaker. Calendar ordering never uses Current Availability, energy, or available-time state. Weekly uses the same within-day precedence.

A next action projected into Due is not a copy. Completing, deleting, editing, associating a project, or pulling it into On Going operates on the original next action. Editing its temporal attribute changes its deadline, never a calendar schedule.

When a next action is completed on or after its deadline, it appears in `Done Today` for the local completion date while retaining the `N` glyph. This is derived from domain state rather than from the screen or client where completion occurred, and still applies when the action moved through On Going before completion. A next action completed before its deadline does not appear in Calendar Done Today. Done Today is one mixed `C`/`N` panel ordered by completion time, newest first, and projected next actions remain there only for that local completion date.

A completed Next Action projection preserves both source type and source state. Opening it goes to Completed Next Actions detail rather than active Next Action detail. Its available operations match the completed state: `r` restores the original Next Action and `d` deletes it; deadline editing and On Going transitions are unavailable until the item is restored. Restoring removes it from Done Today and recomputes its Due or Weekly projection from its current deadline.

## Weekly

Weekly shows only active obligations: active Calendar Items on their scheduled dates and available Next Actions on their deadline dates. A next action is never moved to an earlier day merely to provide advance warning.

Calendar Items and Next Actions leave Weekly when they become On Going, Completed, or Deleted. An overdue available next action remains associated with its original deadline date while also appearing as overdue in Today.

## Completed and Deleted

The persistent `Completed` and `Deleted` Calendar subviews remain archives of Calendar Items only. Completed or deleted Next Actions are not duplicated into those Calendar archives: after the local completion date passes, a completed Next Action remains only in Completed Next Actions, and a deleted Next Action remains only in Deleted Next Actions.

## Navigation and Operations

Calendar is an aggregating view, not the owner of the records it displays. Opening an active Calendar Item opens Calendar detail. Opening an active projected Next Action opens Next Action detail. Opening a completed projected Next Action from Done Today opens Completed Next Actions detail so navigation preserves both the source type and its workflow state.

For a projected next action:

- `e` edits its deadline; changing the date moves the projection, and clearing the deadline removes it from Calendar entirely while leaving it available in Next Actions;
- `o` moves the original next action to On Going and removes its Calendar projection;
- `x` completes the original next action;
- `d` deletes the original next action;
- undo and recovery restore the projection whenever the restored next action again satisfies the Due or Weekly rules.

Calendar exposes one user-visible undo/redo history for lifecycle operations tracked by the aggregated view, such as delete, complete, move to On Going, restore, and recover. `u` reverses the most recent tracked Calendar operation regardless of whether its source was `C` or `N`, and `Ctrl+r` reapplies that operation; the underlying mutation is still delegated to the owning entity type. Editing surfaces keep their existing local undo behavior.

Title search covers the complete aggregated Calendar sequence, including both Calendar Items and projected Next Actions. Selecting a matching projected Next Action preserves its `N` identity and opens Next Action detail when full detail is requested.

## External Calendar Projection

The local Due and Overdue projections do not rewrite external calendar history. A next action with a deadline remains an all-day entry on the external Next Action agenda on its original deadline date. Overdue status does not create copies on later dates.

Project deadlines are not included in Calendar Due. Projects represent desired outcomes rather than executable items and keep their existing project-specific deadline treatment.

These semantics apply to every client that exposes Calendar Today or Weekly. Clients may use different layouts and mutation capabilities, but the same records must qualify for the same Calendar projections. The mobile client therefore shows the same `C` and `N` projection semantics, including when rendering an offline snapshot, without being required to expose every Desktop operation in the same feature. The domain/API owns the projection qualification rules; clients provide the local calendar date used for classification instead of relying on an implicit server-side `today`. Calendar read APIs return an explicit aggregated read model whose entries discriminate `CALENDAR` from `NEXT_ACTION` and expose the temporal projection state needed by the client. The aggregation is read-only: mutations remain owned by the original Calendar Item or Next Action APIs rather than by a Calendar Projection endpoint.

Next Action deadlines are date-only in the user's local calendar semantics. A deadline remains `Due today` for the entire local date and becomes `Overdue` only when the next local date begins; no implicit hour or UTC cutoff is assigned. Different devices in different time zones may therefore classify the same stored deadline differently for a short period without changing the deadline itself. Calendar views must recompute date-dependent projections when the local date changes and when an app resumes after suspension. Offline clients may render from a stale data snapshot, but must still reclassify cached deadlines against the current local date.
