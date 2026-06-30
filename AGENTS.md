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
- See also: [Desktop Execution](docs/30%20-%20Guides%20and%20Manuals/Desktop%20Execution.md) and [API Execution](docs/30%20-%20Guides%20and%20Manuals/API%20Execution.md).
- Every new function gets a test. Bug fixes get a regression test.
- For desktop features that can be exercised through keybindings and do not depend on external integrations such as Google Calendar, run a real user-like flow with the Agent Interactive Driver (`pnpm agent:driver`) before considering the work complete. The validation must use the feature the way the owner would: navigate by keybinds, perform the main action, observe the resulting UI state, and continue far enough to catch broken focus, modal, persistence, or follow-up navigation behavior.
- Mock external I/O (API, DB, filesystem) with named fake classes,
  not inline stubs.
- Tests must be F.I.R.S.T: fast, independent, repeatable,
  self-validating, timely.

## Dependencies

- Inject dependencies through constructor/parameter, not global/import.
- Wrap third-party libs behind a thin interface owned by this project.

## Runtime Environment

- See also: [Infrastructure](docs/10%20-%20Architecture/infrastructure.md) and [Desktop Execution](docs/30%20-%20Guides%20and%20Manuals/Desktop%20Execution.md).
- The Tauri desktop app is used only on two Arch Linux computers running Hyprland. Prefer Linux/Arch/Hyprland-specific native integrations when they simplify the implementation, and do not add cross-platform fallbacks unless explicitly requested.
- Production desktop distribution is always the native Linux `.tar.gz` package installed under `~/.local/share/gtd-on-rails`. Do not add AppImage, deb, rpm, or Tauri updater production flows unless explicitly requested.
- The only end user is the project owner. They will not edit persistence data on one device before waiting for the other device to finish pushing sync changes, so do not add multi-user or concurrent divergent-edit reconciliation unless explicitly requested.

## Asset System

- See also: [Body Content](docs/20%20-%20GTD/shared/Body%20Content.md), [Infrastructure](docs/10%20-%20Architecture/infrastructure.md), and [Synchronization](docs/10%20-%20Architecture/synchronization.md).
- Item assets are persisted as files plus database metadata. The file lives under `gtd.assets.local-directory`, while metadata lives in `item_assets` and item body references live in `items.body.blockEntities`.
- The markdown body stores an asset token like `⟦asset:<uuid>⟧`; the matching `blockEntities` entry stores `assetId`, `relativePath`, `url`, `contentType`, and display metadata.
- `Space m a` opens the asset dialog. Clipboard or dropped local files on Arch/Hyprland should use Tauri native commands to return a local source path, then call `POST /items/{id}/assets/local-file` so the backend copies the file, creates `item_assets`, and schedules asset sync.
- Clipboard images that do not exist as OS files should continue through multipart upload to `POST /items/{id}/assets`.
- The frontend chooses the endpoint from the asset source type: `localFile` sources returned by Tauri clipboard/drop commands call `POST /items/{id}/assets/local-file`; byte-backed `file` sources such as clipboard-only images, browser clipboard blobs, or HTML file input call multipart `POST /items/{id}/assets`.
- Do not copy assets directly from the frontend into the final asset directory. The backend must own final storage, database metadata, public URL generation, validation, and sync scheduling.
- Asset previews should prefer local Documents storage through the Tauri fs plugin and fall back to `/assets/<relativePath>` HTTP URLs when local files are unavailable.

## Structure

- See also: [Infrastructure](docs/10%20-%20Architecture/infrastructure.md).
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

- Use Git Flow for project development. Create `feature/...`, `bugfix/...`, `release/...`, or `hotfix/...` branches as appropriate.
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

- See also: [Lists and Pages](docs/20%20-%20GTD/Lists%20and%20Pages.md), [Inbox](docs/20%20-%20GTD/stuff/Inbox.md), and [Next Actions](docs/20%20-%20GTD/next-action/Next%20Actions.md).
- All user-facing application text must be written in English, including errors, empty states, loading states, and offline/sync status screens.
- The preview mode and the stuff detail views must be visually identical and render all elements (e.g. PDF previews, images) identically to the edit mode. This applies to all elements.
- Pages that visualize deleted items must use `#9B9B9B` as the predominant color. Pages that visualize completed items must use `#7F8D3F` as the predominant color.
- Modal keybind scopes must isolate keyboard handling: while a modal dialog is active, page-level keybinds outside that modal must not run.

## Keybindings

- See also: [Global Shortcuts](docs/20%20-%20GTD/shared/Global%20Shortcuts.md).
- Before adding or changing a keybind, inspect the existing keybind definitions and documentation to verify the shortcut is unused in the same screen, focus zone, leader sequence, and modifier scope.
- Never create two keybinds that can resolve to the same input sequence in the same scope. For example, do not assign another action to `Space m a` where it already inserts an asset.
- If two actions need the same physical keys, they must be separated by a different screen, focus zone, modal scope, or modifier combination, and the separation must be explicit in the keybind definition.

## Processing

- See also: [GTD Elements](docs/20%20-%20GTD/GTD%20Elements.md) and [Inbox](docs/20%20-%20GTD/stuff/Inbox.md).
- During processing, it is possible to cancel at any time by pressing `esc`. Therefore, backend requests and data persistence must only be performed at the very end of the flow.
- Wizard flows must treat `esc` contextually: the first step cancels the flow, while later steps go back one step.
- Wizard flows must preserve previous choices when moving backward and forward. Clear later state only when a change is incompatible with the existing path, such as choosing a different GTD element type.

## Documentation

- All documentation files (READMEs, Markdown files in `docs/`, inline code documentation, etc.) must be written exclusively in English.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `Victor-Saraiva-P/GTD-on-rails`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a multi-context domain documentation layout with a root `CONTEXT-MAP.md`. See `docs/agents/domain.md`.

<!-- ai-memory:start -->
## Long-term memory (ai-memory)

This project uses [ai-memory](https://github.com/akitaonrails/ai-memory)
for cross-session continuity.

**Default to the current project — always.** Every ai-memory tool
auto-scopes to the project resolved from your session's working
directory. **Do NOT pass `project` or `cwd` arguments unless the user
explicitly references a *different* project by name** (e.g. "what did we
decide in the `other-app` project?"). Phrases like "this project",
"here", "we", "our work", "where did we leave off" all mean the *current*
project — call the tool with no scoping args. If the user asks about a
handoff and the SessionStart auto-fetched block is already in your
context, just answer from it; do not re-call the tool to "find it again"
in another project.

**Lifecycle hooks already capture every prompt + tool call
automatically.** You never need to manually write routine notes; the
SessionStart hook auto-fetches pending handoffs, and on session end
ai-memory writes a session-summary page and a handoff.
LLM consolidation (compiling observations into topical wiki pages) runs
on PreCompact, on demand via `memory_consolidate`, and at session end
only when the server sets `AI_MEMORY_CONSOLIDATE_ON_SESSION_END`. Only
write a durable wiki page when the user explicitly asks to remember or
annotate something permanently.

### When to reach for each tool

The user can express any of the intents below in plain English —
match the intent to the tool. They do not need to name the tool.

| User says / situation | Tool |
|---|---|
| "have we discussed X?" / "search memory for Y" / before proposing architecture | `memory_query` (current project; `scopes` for named siblings; `global=true` to search every project) |
| "what's been going on" / "show recent activity" (light) | `memory_recent` |
| "is ai-memory healthy?" / "how big is the wiki?" | `memory_status` |
| "give me the stats" / structured snapshot for the agent to consume | `memory_briefing` (read-only; never creates handoffs) |
| "catch me up" / "I've been away" / "what's important right now?" / open-ended exploration | `memory_explore` |
| "where did we leave off?" — and you see a `📥 ai-memory: pending handoff` block in your context | already done — answer from that block; do NOT re-call `memory_handoff_accept` |
| "where did we leave off?" — and no such block is visible | `memory_handoff_accept` (rare; the SessionStart hook usually got there first) |
| "save context for the next session" / wrapping up / ending this session | `memory_handoff_begin` (session-end only; do **not** use for status/briefing; single-use handoff; terse summary; put detail in `open_questions` + `next_steps` bullets) |
| "discard that handoff" / "I created a handoff by mistake" | `memory_handoff_cancel` (requires exact `handoff_id` from `memory_handoff_begin`; marks it expired before the next session sees it) |
| "consolidate this session" / "compile what we learned" (also runs on PreCompact; at session end only if `AI_MEMORY_CONSOLIDATE_ON_SESSION_END` is set) | `memory_consolidate` |
| "remember this permanently" / "save a note" / "add an annotation" / durable project knowledge | `memory_write_page` (write a wiki page; do **not** use handoff for permanent notes; put the title as a `# H1` on the first line of `body` and omit the `title` arg — ai-memory derives it from the H1) |
| "read the page about X" / "show me the full content of Y" / "open the page on Z" | `memory_read_page` (full body; pass a query to search or `path` for a direct lookup; pass `workspace` + `project` together only for a named sibling workspace/project) |
| "delete the page X" / "remove that note" | `memory_delete_page` (by exact `path`; idempotent; pass `workspace` + `project` together only for a named sibling workspace/project) |
| "audit the wiki" / "find contradictions" / "what rules should we add?" | `memory_lint` |
| "prune old pages" / "memory cleanup" | `memory_forget_sweep` |

`memory_explore` is the right default for the "I want to know what's
going on" use case — it returns a prose digest whose verbosity
scales automatically to how long it's been since the last activity
(< 1 h → one line; > 30 days → full catchup).

### When the current project comes up empty — broaden the search

`memory_query` searches only the **current** project by default. If a
search comes back empty or thin, the knowledge may live in a **sibling
project** — shared `infra`, `ops`, or a related app. Don't conclude
"we never recorded it" after a single project misses; broaden instead:

- **Know which projects to check?** Re-run with explicit `scopes`, e.g.
  `scopes: [{ "workspace": "default", "project": "infra" }]`.
- **Don't know where it lives?** Pass `global=true` to search every
  project in every workspace at once. Each hit is annotated with its
  workspace + project so you can tell where it came from. `global=true`
  cannot be combined with `scopes`/`project`/`workspace`.

`memory_query` returns **snippets, not full page bodies** — an empty or
short snippet does **not** mean the page is empty (a large page can
match outside the snippet window). To read the whole page, use
`memory_read_page` (by `path`, or pass a `query` to fetch the top hit's
full body; add `workspace` + `project` together only when the user names
a sibling workspace/project).

### When you write a project rule, write it here

If you're about to write a durable project rule ("always X", "never
Y", "all PRs must …"), this rules file (CLAUDE.md for Claude Code;
AGENTS.md for Codex / OpenCode / Cursor / Gemini CLI; whichever
convention your agent uses) is where it belongs. ai-memory's lint
pass surfaces the same hint automatically when a `kind: rule` page
lands in `_rules/`.

### Refreshing this snippet

This block is maintained by ai-memory. Two ways to refresh it with
the latest binary's recommended copy:

- **From the agent** (no terminal needed): ask "refresh the ai-memory
  routing in this project" — the agent calls
  `memory_install_self_routing`, picks the right filename for itself
  (Claude Code → `CLAUDE.md`; Codex / OpenCode / Cursor / Gemini →
  `AGENTS.md`), and uses its Write / Edit tool to land the block.
- **From the CLI**: `ai-memory install-instructions` (defaults to
  `CLAUDE.md`; pass `--target AGENTS.md` for non-Claude agents).

Both are idempotent: re-runs replace the block bracketed by
`<!-- ai-memory:start -->` / `<!-- ai-memory:end -->` markers
without disturbing the rest of the file.
<!-- ai-memory:end -->
