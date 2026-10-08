# Agent CLI

The `gtd` command is the controlled interface for agent harnesses that clarify and process GTD on Rails inbox stuff.

The CLI talks to the Spring Boot API. Agents do not mutate the database or GTD persistence files directly. Domain validation, persistence, synchronization, and external integrations remain owned by the application.

## Install

Install the latest validated `main` CLI binary:

```bash
make cli-install
```

Install a specific checkpoint or rollback release with `make cli-install v3.4.0`. The installer downloads the standalone `GTD.on.Rails.CLI_<version>_linux-x86_64.tar.gz` asset, verifies its SHA-256 checksum, stores the managed binary under `${XDG_DATA_HOME:-~/.local/share}/gtd-on-rails-cli/`, and links it as `~/.local/bin/gtd`.

For development against the current checkout, use `make cli-install-dev`. `make cli-package` creates the standalone production archive under `apps/cli/target/release-package/`.

Both production and development installers configure supported headless agent harnesses. For Antigravity they add only `command(gtd)` to `~/.gemini/antigravity-cli/settings.json`, remove the obsolete `unsandboxed(gtd)` rule from older installations, and install the shared `gtd-processing` skill under `~/.gemini/config/skills/gtd-processing/SKILL.md`. Headless Antigravity processing intentionally runs without its terminal sandbox so the controlled `gtd` command can reach the desktop loopback sidecar. For Codex they install a scoped `gtd` prefix rule under `$CODEX_HOME/rules/gtd-on-rails.rules` (default `~/.codex/rules/gtd-on-rails.rules`) and install the same skill under `$CODEX_HOME/skills/gtd-processing/SKILL.md`. Existing unrelated settings and permission rules are preserved.

Development falls back to `http://127.0.0.1:8080`; override it with `GTD_API_URL` or the top-level `--api-url` option. When the packaged desktop is running, the CLI discovers its live sidecar endpoint from the desktop readiness marker, so an agent does not need to know the random production port.

The production desktop installer also installs the CLI and applies the same Antigravity permission configuration automatically. The configuration can be reapplied idempotently with:

```bash
gtd agent configure-antigravity
gtd agent configure-codex
```

Codex headless runs should use `codex exec`. A restrictive automation profile can use `--sandbox workspace-write --ask-for-approval never`; the installed prefix rule allows only commands beginning with `gtd` to cross the sandbox boundary without an interactive approval. The globally installed skill makes `gtd-processing` discoverable even when Codex is launched outside this repository.

## Desktop processing preferences

Open `Space I a` in the desktop to configure the headless processor. The screen selects Antigravity or Codex as the processing agent and stores an optional model and thinking/reasoning effort for each harness. Leaving either field blank delegates that choice to the harness CLI default.

The settings are machine-local and are persisted under `${XDG_CONFIG_HOME:-~/.config}/gtd-on-rails/agent-processing.json`. Opening the page never starts Antigravity or Codex processes. Antigravity model choices are loaded from a GTD on Rails cache and refreshed from `agy models` only after explicit user action; Codex model and supported reasoning choices are read directly from the local Codex model cache when available. The desktop launcher embeds the repository `gtd-processing` instructions into every processing prompt, so a run does not need permission to read project skill files at runtime. These preferences are separate from synchronized GTD domain data and are consumed by the desktop headless-processing launcher.

Press `Space a` on a selected Inbox stuff item to start headless processing. The keybind is the explicit token-spending boundary: the desktop starts one run for that stuff with the configured harness/model/thinking settings and a prompt scoped to its ID. A second run for the same stuff is ignored while the first is active, while different stuff items may run in parallel. The child process receives `GTD_API_URL` for the same backend used by the desktop, preventing another live packaged sidecar from redirecting `gtd` to a different dataset.

Run state is tracked above individual Inbox components, so processing remains observable while navigating to other stuff or screens. The shared footer shows active run count, stuff title, current GTD activity, and elapsed time. Returning to the originating stuff shows provider/model/thinking, PID, live activity, elapsed time, final outcome, and the raw log path. Run output is written under `${XDG_CONFIG_HOME:-~/.config}/gtd-on-rails/agent-runs/`, and the inbox reloads when a run finishes. The UI distinguishes a confirmed `gtd stuff process ...` mutation from a headless run that exited without processing or encountered a denied action.

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
