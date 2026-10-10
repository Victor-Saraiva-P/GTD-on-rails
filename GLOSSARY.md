# GTD on Rails

Canonical domain language shared across the GTD on Rails workflow.

## Language

**Next Action Deadline**:
The date by which a Next Action must be completed. It does not schedule the action for that date.
_Avoid_: scheduled date, execution date, calendar date

**Calendar Item**:
Work that is bound to a specific date, with an optional time, rather than merely having a latest acceptable completion date.
_Avoid_: deadline item, due action

**Due Next Action**:
An unfinished Next Action whose deadline is today. It remains a Next Action even when surfaced in Calendar Today.
_Avoid_: calendar item, scheduled action

**Overdue Next Action**:
An unfinished Next Action whose deadline is before today. It remains overdue until completed or its deadline changes.
_Avoid_: late calendar item, expired action

**Calendar Projection**:
A date-based appearance of an existing domain item inside Calendar without creating a second item or changing the original item's identity.
_Avoid_: calendar copy, converted calendar item
