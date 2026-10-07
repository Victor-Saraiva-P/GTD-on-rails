# Project

A project is a GTD outcome that represents a desired result larger than one next action.

## Project Concept

A project has a title and may have a deadline. When a project originates from captured stuff, the project title comes from the stuff title.

An active project with a deadline appears as an all-day entry on the external Project agenda for the deadline date. An active project without a deadline does not appear on an external agenda.

The Project card remains compact and does not expose the captured body. Project Detail exposes the Project Brief instead: the canonical Markdown body of the Item backing the project. A project and its backing Item share one identity, so the brief can contain the desired outcome, constraints, reference material, and attachments without a project-specific content model.

Project Brief attachments use the same Item asset lifecycle as every other body attachment. They are stored and synchronized with the body, soft-deleted when the project is deleted, and reconciled from the restored body when the project is recovered.

## Workflow State

Projects can be active, done, or deleted.

An active project is a current commitment whose desired result has not yet been achieved.

A done project is a project whose desired result has been achieved and is no longer active.

A done project with a deadline appears as an all-day entry on the shared external Done agenda for the deadline date. A done project without a deadline does not appear on an external agenda.

A deleted project is a project removed from active operational use but kept as a recoverable project record. Recovering a deleted project returns it to the project state it had before deletion.

## Agent Processing Context

When processing stuff associated with a project, the Project Brief is read-only context for the processing agent. `gtd stuff show <stuff-id>` displays a delimited project-context block with the project title and Markdown body when that association exists. `gtd stuff project-context <stuff-id> --output <directory>` exports that body and only its referenced project-owned attachments for inspection.

The processing agent may use this context to clarify the associated stuff, but must not edit the project, its brief, or its attachments. Stuff without a project keeps the normal processing behavior and does not produce project context.
