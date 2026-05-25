# Next Action Priority Availability

## Requirements

- NA-PRIO-001: Next actions have an optional `deadline` date, exposed in read and patch APIs.
- NA-PRIO-002: The next actions list supports page-level current context, available time, and available energy selectors.
- NA-PRIO-003: Page-level `t` opens available-time selection and page-level `e` opens available-energy selection.
- NA-PRIO-004: Page-level edit attributes moves from `e` to `E`.
- NA-PRIO-005: The next actions list supports `orderBy=priority`.
- NA-PRIO-006: Priority score is `2.2 * urgency + 1.2 * viability`.
- NA-PRIO-007: Urgency is based on days from today to the action deadline: no deadline `0`, due/past due `1`, 1-2 days `.9`, 3-5 days `.7`, 6-10 days `.45`, 11-21 days `.2`, beyond 21 days `0`.
- NA-PRIO-008: Viability is `0.55 * time fit + 0.45 * energy fit`.
- NA-PRIO-009: Time fit is `1` when no current time is set or estimate fits; otherwise `max(0, 1 - (estimated - current) / max(current, 15))`.
- NA-PRIO-010: Energy fit is `1` when no current energy is set or required energy fits; otherwise `max(0, 1 - (required - current) / 3)`.

## Notes

- Current time and energy are list availability inputs, not persisted next-action attributes.
- Deadline is persisted as a next-action attribute and edited from the existing next-action attributes modal.
