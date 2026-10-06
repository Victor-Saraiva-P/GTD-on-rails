# GTD CLI

`gtd` is the controlled command-line adapter used by agent harnesses to interact with GTD on Rails through the local API.

Canonical usage and behavior are documented in [`docs/30 - Guides and Manuals/Agent CLI.md`](../../docs/30%20-%20Guides%20and%20Manuals/Agent%20CLI.md).

Install the latest published production binary and configure scoped Antigravity and Codex headless access with:

```bash
make cli-install
```

Use `make cli-install v3.4.0` for a specific published release. For a binary built from the current checkout, use `make cli-install-dev`; `make cli-package` builds the standalone Linux release archive.
