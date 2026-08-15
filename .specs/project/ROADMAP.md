# Roadmap

## Purpose

This roadmap is the lightweight planning index for `tlc-spec-driven`. It should summarize current product areas and near-term planning buckets, while detailed requirements stay in `.specs/features/*` and canonical behavior stays in `docs/`.

## Current Product Areas

- Inbox and stuff capture, detail editing, deletion, recovery, and processing.
- Next actions with contexts, time, energy, deadlines, priority ordering, on-going state, completion, deletion, and recovery.
- Context management with context icons and related item views.
- Calendar workflows for scheduled items, today/weekly/completed/deleted views, and GTD processing paths.
- Environment-specific PostgreSQL persistence and identity management.
- File synchronization (assets, configurations, backups) through rclone.
- Native Linux packaging, installation, and update flow.

## Existing Feature Specs

- `calendar`
- `calendar-keybinds`
- `calendar-page-refactor`
- `calendar-ux-fixes`
- `calendar-weekly-view`
- `next-action-priority-availability`
- `segmented-processing-calendar-date`

## Planning Buckets

- Calendar usability: keep weekly/today/completed/deleted calendar flows consistent with next-action and inbox list behavior.
- Processing flow: preserve contextual `esc` behavior and defer backend persistence until the final confirmation step.
- Body content and assets: keep preview and edit rendering identical, with backend-owned storage and sync scheduling.
- Sync resilience: improve observability and recovery around File Sync and database connectivity without adding automatic divergent-edit reconciliation.
- Native runtime: keep production release behavior aligned with the Linux tarball sidecar model.

## Maintenance Notes

- Update this file manually when priorities change.
- Keep implementation details in feature specs, design docs, or tasks.
- Keep long-form product behavior in `docs/`.
