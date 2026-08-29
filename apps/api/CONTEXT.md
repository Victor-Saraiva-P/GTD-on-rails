# API Context

This context defines backend domain language for GTD item persistence, lifecycle transitions, synchronization, and external calendar mirroring.

## Language

**Next Action**:
A concrete action that is available to do and may optionally have a deadline. A next action without a deadline has no active date on an external agenda.
_Avoid_: Task, todo

**Deadline**:
The date a next action should be done by. When present, it is the date used to represent the active next action on an external agenda.
_Avoid_: Due date, scheduled date

**Project**:
A GTD outcome that represents a desired result with a title and optional deadline. A project may originate from captured stuff, but the project view is concerned with the result rather than the original captured body.
_Avoid_: On going, task

**Project Item**:
A GTD item associated with a project and shown as part of that project's operational work. In the current project detail flow, a project item can be stuff, a next action, or a calendar item.
_Avoid_: subtask, child task, project task

**Active Project**:
A project whose desired result has not yet been achieved and remains part of current commitments.
_Avoid_: In-progress project, on going project

**Done Project**:
A project whose desired result has been achieved and is no longer active. On an external agenda, it is represented by its deadline when a deadline exists.
_Avoid_: Completed Project, concluded project

**Deleted Project**:
A project removed from active operational use but kept as a recoverable project record. Recovering a deleted project returns it to the project state it had before deletion.
_Avoid_: Removed project, trashed project

**External Agenda Mirror**:
A derived calendar representation of GTD items outside the local GTD system. The local GTD item remains the source of truth.
_Avoid_: Calendar source, remote truth

**GTD Google Calendar**:
One of the external agendas owned by the GTD system, including Calendar, Next Action, Project, On Going, and Done. A GTD item should appear on at most one of these agendas at a time.
_Avoid_: Google agenda set, remote GTD state

**Token Encryption Key**:
A user-controlled secret that allows stored external integration tokens to be read by trusted local app installations while avoiding casual plaintext token exposure.
_Avoid_: Token, password, Google credential

**Google Integration Configuration**:
The synced local secrets that allow trusted app installations to connect to the same Google Calendar integration.
_Avoid_: Google account, environment config

**Database Connection Configuration**:
The local secret configuration that allows a trusted app installation to connect to the structured persistence database assigned to its runtime environment. Production and staging installations share it through File Sync.
_Avoid_: Database credentials, Supabase config, environment config

**Configuration Status**:
The health of a local integration configuration, including whether required secrets are missing, ready, invalid, or failed to repair.
_Avoid_: Connected status, sync status

**File Sync**:
The movement of file-backed application state, including assets and trusted local configuration, between app installations. Structured GTD data is shared through the database instead.
_Avoid_: Persistence Sync, Data Sync, database backup

**On Going**:
An item state for work that has been pulled into active execution. On going items are represented on the shared on-going external agenda.
_Avoid_: In progress, active task

**Schedule Window**:
The actual execution window of an item, beginning when it becomes on going and ending when it is done. For on-going items, only the beginning is known.
_Avoid_: Planned schedule, appointment time

**Done**:
An item state for work that has been completed. Done items are represented on the shared done external agenda using their actual schedule window.
_Avoid_: Completed task, finished todo

**Domain Cache**:
The in-memory cache managed by the local Spring Boot sidecar that serves active read queries with sub-millisecond latency.
_Avoid_: Redis, local database, offline store

**Cache Eviction**:
The invalidation of cached query projections across affected domain aggregates following entity mutations or explicit maintenance operations.
_Avoid_: Cache purge, database wipe

