# Conventions

## Code Shape

- Functions should be at most 20 lines.
- Files should stay under 500 lines.
- Keep one responsibility per function and module.
- Prefer specific names with low grep collision.
- Use explicit types; avoid `any`, `Dict`, and untyped functions.
- Extract shared logic instead of duplicating behavior.
- Prefer early returns over nested control flow.
- Keep indentation to two levels where practical.
- Exception messages must include the offending value and expected shape.

## Comments And Docs

- Preserve existing comments during refactors.
- Write comments that explain why, not what.
- Public functions need docstrings with intent and one usage example.
- Reference issue numbers or commit SHAs when code exists because of a specific bug or upstream constraint.
- All documentation must be English.

## Dependencies

- Inject dependencies through constructors or parameters.
- Wrap third-party libraries behind thin project-owned interfaces.
- Prefer existing local helpers and patterns over new abstractions.

## UI

- Follow the existing React/TypeScript page, feature, component, and style organization.
- All user-facing text must be English.
- Preview mode and detail views must render body elements identically to edit mode.
- Deleted item pages use `#9B9B9B` as the predominant color.
- Completed item pages use `#7F8D3F` as the predominant color.
- Modal scopes must prevent page-level keybinds from running while a modal is active.

## Keybindings

- Inspect current keybind definitions and docs before adding or changing a shortcut.
- Never assign two actions to the same input sequence in the same screen, focus zone, and modifier scope.
- If the same physical keys are reused, the scope separation must be explicit.
- `Space m a` inserts an asset in body/detail zones and must not be reused there.

## Processing

- Processing can be cancelled at any time with `esc`.
- Backend requests and persistence must happen only at the final step.
- In wizard flows, `esc` cancels on the first step and goes back on later steps.
- Wizard flows preserve previous choices when moving backward and forward.
- Later state should be cleared only when an earlier change makes it incompatible.

Canonical sources:

- [AGENTS.md](../../AGENTS.md)
- [Global Shortcuts](../../docs/20%20-%20GTD/shared/Global%20Shortcuts.md)
- [Lists and Pages](../../docs/20%20-%20GTD/Lists%20and%20Pages.md)
