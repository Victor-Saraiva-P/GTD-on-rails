# API Context

This context defines backend domain language for GTD item persistence, lifecycle transitions, synchronization, and external calendar mirroring.

## Language

**Next Action**:
A concrete action that is available to do and may optionally have a deadline. A next action without a deadline has no active date on an external agenda.
_Avoid_: Task, todo

**Deadline**:
The date a next action should be done by. When present, it is the date used to represent the active next action on an external agenda.
_Avoid_: Due date, scheduled date

**External Agenda Mirror**:
A derived calendar representation of GTD items outside the local GTD system. The local GTD item remains the source of truth.
_Avoid_: Calendar source, remote truth

**GTD Google Calendar**:
One of the external agendas owned by the GTD system, including Calendar, Next Action, On Going, and Done. A GTD item should appear on at most one of these agendas at a time.
_Avoid_: Google agenda set, remote GTD state

**Token Encryption Key**:
A user-controlled secret that allows stored external integration tokens to be read by trusted local app installations while avoiding casual plaintext token exposure.
_Avoid_: Token, password, Google credential

**Google Integration Configuration**:
The synced local secrets that allow trusted app installations to connect to the same Google Calendar integration.
_Avoid_: Google account, environment config

**Configuration Status**:
The health of a local integration configuration, including whether required secrets are missing, ready, invalid, or failed to repair.
_Avoid_: Connected status, sync status

**On Going**:
An item state for work that has been pulled into active execution. On going items are represented on the shared on-going external agenda.
_Avoid_: In progress, active task

**Schedule Window**:
The actual execution window of an item, beginning when it becomes on going and ending when it is done. For on-going items, only the beginning is known.
_Avoid_: Planned schedule, appointment time

**Done**:
An item state for work that has been completed. Done items are represented on the shared done external agenda using their actual schedule window.
_Avoid_: Completed task, finished todo

**Recurring Calendar Template**:
A non-executable GTD calendar pattern that owns recurrence details and spawns normal calendar items for each occurrence. It is not pulled on going or marked done itself.
_Avoid_: Recurring calendar, calendar recurrence, template calendar

**Recurring Calendar Occurrence**:
A normal calendar item spawned from a recurring calendar template for one intended date and time. It keeps a stable relationship to its template so template changes can update the right calendar items unless the occurrence has been personalized.
_Avoid_: Spawned calendar, recurrence instance, generated calendar

**Personalized Occurrence**:
A recurring calendar occurrence that the user has edited directly, making it independent from future template content and schedule changes. Lifecycle changes such as deleting, recovering, moving on going, or marking done do not make an occurrence personalized.
_Avoid_: Manual override, detached instance, customized calendar
