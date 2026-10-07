# Agent CLI Context

This context defines the controlled command-line boundary that agent harnesses use to interact with GTD on Rails.

## Responsibility

The `gtd` CLI is an adapter over the local Spring Boot API. The API remains the owner of GTD domain rules, validation, persistence, synchronization, and external integrations.

The CLI exposes narrow commands instead of generic HTTP, database, or filesystem mutation. Agent instructions should compose these commands rather than bypassing them.

## Stuff clarification

Agents may inspect inbox stuff, export its canonical Markdown and referenced attachments, improve rushed wording without changing meaning, and then process the stuff through an existing GTD conversion.

When clarification is insufficient, the correct result is no GTD mutation. The agent asks the user for the missing decision and leaves the stuff in the inbox.

Body normalization must preserve existing attachment references. The CLI rejects a body replacement that removes an existing `assets/...` reference.

## Supported processing destinations

The CLI mirrors the processing destinations currently owned by the API:

- Next Action
- Calendar
- Project
- Someday/Maybe

It does not invent additional GTD states. New destinations must first become domain behavior in the API and application before being exposed here.

## Runtime

Without an explicit endpoint, the CLI first discovers a live packaged desktop sidecar from its readiness marker and otherwise falls back to the development endpoint `http://127.0.0.1:8080`. `GTD_API_URL` or `--api-url` always overrides discovery.

`make cli-install [tag]` downloads the published standalone CLI release, verifies its SHA-256 checksum, installs the managed binary under the user data directory, links it as `~/.local/bin/gtd`, and configures supported headless harnesses idempotently. `make cli-install-dev` builds the current checkout instead. Antigravity receives the scoped `command(gtd)` permission and runs the controlled CLI outside Antigravity's terminal sandbox so it can reach the desktop loopback sidecar. Codex receives a dedicated `gtd` prefix rule under `$CODEX_HOME/rules` plus the shared `gtd-processing` skill under `$CODEX_HOME/skills`. The production desktop installer and native updater perform the same harness setup while installing the CLI bundled with the desktop package.
