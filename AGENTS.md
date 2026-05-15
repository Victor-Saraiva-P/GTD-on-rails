## Code style

- Functions: at most 20 lines. Split if longer.
- Files: under 500 lines. Split by responsibility.
- One thing per function, one responsibility per module (SRP).
- Names: specific and unique. Avoid `data`, `handler`, `Manager`.
  Prefer names that return <5 grep hits in the codebase.
- Types: explicit. No `any`, no `Dict`, no untyped functions.
- No code duplication. Extract shared logic into a function/module.
- Early returns over nested ifs. Max 2 levels of indentation.
- Exception messages must include the offending value and expected shape.

## Comments

- Keep your own comments. Don't strip them on refactor — they carry
  intent and provenance.
- Write WHY, not WHAT. Skip `// increment counter` above `i++`.
- Docstrings on public functions: intent + one usage example.
- Reference issue numbers / commit SHAs when a line exists because
  of a specific bug or upstream constraint.

## Tests

- Tests run with a single command: `pnpm test`.
- Every new function gets a test. Bug fixes get a regression test.
- Mock external I/O (API, DB, filesystem) with named fake classes,
  not inline stubs.
- Tests must be F.I.R.S.T: fast, independent, repeatable,
  self-validating, timely.

## Dependencies

- Inject dependencies through constructor/parameter, not global/import.
- Wrap third-party libs behind a thin interface owned by this project.

## Runtime Environment

- The Tauri desktop app is used only on two Arch Linux computers running Hyprland. Prefer Linux/Arch/Hyprland-specific native integrations when they simplify the implementation, and do not add cross-platform fallbacks unless explicitly requested.

## Asset System

- Item assets are persisted as files plus database metadata. The file lives under `gtd.assets.local-directory`, while metadata lives in `item_assets` and item body references live in `items.body.blockEntities`.
- The markdown body stores an asset token like `⟦asset:<uuid>⟧`; the matching `blockEntities` entry stores `assetId`, `relativePath`, `url`, `contentType`, and display metadata.
- `Space m a` opens the asset dialog. Clipboard or dropped local files on Arch/Hyprland should use Tauri native commands to return a local source path, then call `POST /items/{id}/assets/local-file` so the backend copies the file, creates `item_assets`, and schedules asset sync.
- Clipboard images that do not exist as OS files should continue through multipart upload to `POST /items/{id}/assets`.
- The frontend chooses the endpoint from the asset source type: `localFile` sources returned by Tauri clipboard/drop commands call `POST /items/{id}/assets/local-file`; byte-backed `file` sources such as clipboard-only images, browser clipboard blobs, or HTML file input call multipart `POST /items/{id}/assets`.
- Do not copy assets directly from the frontend into the final asset directory. The backend must own final storage, database metadata, public URL generation, validation, and sync scheduling.
- Asset previews should prefer local Documents storage through the Tauri fs plugin and fall back to `/assets/<relativePath>` HTTP URLs when local files are unavailable.

## Structure

- Follow the Java/Spring boot and Typescript/React conventions.
- Prefer small focused modules over god files.
- Predictable paths: controller/model/view, src/lib/test, etc.

## Formatting

- Use the language default formatter (`cargo fmt`, `gofmt`, `prettier`,
  `black`, `rubocop -A`). Don't discuss style beyond that.

## Logging

- Structured JSON when logging for debugging / observability.
- Plain text only for user-facing CLI output.

## Commits

- Use Conventional Commit subjects: `feat:`, `fix:`, `test:`, `chore:`,
  `docs:`, or the closest accurate type.
- Write the subject in lowercase imperative style after the type.
- Keep the subject specific and concise: describe the project behavior or
  area changed, not the implementation mechanics.
- Commit unrelated concerns separately. Code fixes, test-only work, and
  documentation updates should be separate commits unless one cannot stand
  without the other.
- Before committing, check `git status --short` and stage only files that
  belong to the intended change.

## UI Consistency

- All user-facing application text must be written in English, including errors, empty states, loading states, and offline/sync status screens.
- The preview mode and the stuff detail views must be visually identical and render all elements (e.g. PDF previews, images) identically to the edit mode. This applies to all elements.
- Pages that visualize deleted items must use `#9B9B9B` as the predominant color. Pages that visualize completed items must use `#7F8D3F` as the predominant color.
- Modal keybind scopes must isolate keyboard handling: while a modal dialog is active, page-level keybinds outside that modal must not run.

## Processing

- During processing, it is possible to cancel at any time by pressing `esc`. Therefore, backend requests and data persistence must only be performed at the very end of the flow.
- Wizard flows must treat `esc` contextually: the first step cancels the flow, while later steps go back one step.
- Wizard flows must preserve previous choices when moving backward and forward. Clear later state only when a change is incompatible with the existing path, such as choosing a different GTD element type.
