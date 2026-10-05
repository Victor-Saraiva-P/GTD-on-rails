# Agent CLI

The `gtd` command is the controlled interface for agent harnesses that clarify and process GTD on Rails inbox stuff.

The CLI talks to the Spring Boot API. Agents do not mutate the database or GTD persistence files directly. Domain validation, persistence, synchronization, and external integrations remain owned by the application.

## Install

```bash
make cli-install
```

The binary is installed at `~/.local/bin/gtd`. `make cli-install` also configures supported headless agent harnesses. For Antigravity it adds only `command(gtd)` and `unsandboxed(gtd)` to `~/.gemini/antigravity-cli/settings.json`, preserving all existing settings and permission rules. For Codex it installs a scoped `gtd` prefix rule under `$CODEX_HOME/rules/gtd-on-rails.rules` (default `~/.codex/rules/gtd-on-rails.rules`) and installs the shared `gtd-processing` skill under `$CODEX_HOME/skills/gtd-processing/SKILL.md`.

Development falls back to `http://127.0.0.1:8080`; override it with `GTD_API_URL` or the top-level `--api-url` option. When the packaged desktop is running, the CLI discovers its live sidecar endpoint from the desktop readiness marker, so an agent does not need to know the random production port.

The production desktop installer also installs the CLI and applies the same Antigravity permission configuration automatically. The configuration can be reapplied idempotently with:

```bash
gtd agent configure-antigravity
gtd agent configure-codex
```

Codex headless runs should use `codex exec`. A restrictive automation profile can use `--sandbox workspace-write --ask-for-approval never`; the installed prefix rule allows only commands beginning with `gtd` to cross the sandbox boundary without an interactive approval. The globally installed skill makes `gtd-processing` discoverable even when Codex is launched outside this repository.

## Inspect stuff

```bash
gtd inbox list
gtd stuff show <stuff-id>
gtd contexts list
```

The inbox list is intentionally compact. `stuff show` loads the canonical Markdown body only for the selected active stuff item.

## Inspect attachments

When clarification depends on images, PDFs, or documents referenced by the body, export the item into a temporary workspace:

```bash
gtd stuff export <stuff-id> --output /tmp/gtd-stuff
```

The export contains `body.md` and its referenced files under the same relative `assets/...` paths used by the body.

## Normalize captured writing

An agent may improve rushed wording and Markdown without changing the captured meaning:

```bash
gtd stuff title <stuff-id> "Clearer title"
gtd stuff body <stuff-id> --file /tmp/gtd-stuff/body.md
```

Both commands verify that the item is still active inbox stuff before mutation. Body replacement also rejects removal of an existing attachment reference, so normalization cannot silently discard captured evidence.

## Process stuff

```bash
gtd stuff process next-action <stuff-id> \
  --energy 4.5 \
  --minutes 30 \
  --context <context-id> \
  --deadline 2026-10-12

gtd stuff process project <stuff-id> --deadline 2026-10-31
gtd stuff process someday-maybe <stuff-id>
gtd stuff process calendar <stuff-id> --date 2026-10-08 --time 14:30
```

The CLI validates UUID shapes, energy range and precision, and date/time argument shapes before sending a request. The API remains authoritative for domain validation.

If clarification is insufficient or multiple destinations remain materially plausible, leave the stuff in the inbox and ask the user instead of performing a speculative mutation.

## Agent behavior

Repository-aware harnesses should use `.agents/skills/gtd-processing/SKILL.md`. That skill defines the clarification sequence and the boundary between writing normalization and changing meaning.
