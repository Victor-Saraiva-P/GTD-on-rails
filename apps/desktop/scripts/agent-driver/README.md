# Agent Interactive Driver

The Agent Interactive Driver is a development-only playground for agents that need to operate GTD on Rails through the real UI. It keeps one Playwright-controlled Chromium session alive and exposes local HTTP endpoints for incremental keyboard-first interaction.

It is not an E2E test suite. It does not reset app data, does not create domain-specific shortcuts, and does not call backend endpoints to manipulate GTD items directly.

## Run

Start the desktop development app first:

```bash
pnpm dev
```

Start the driver in another terminal:

```bash
pnpm agent:driver
```

The driver listens only on `127.0.0.1` and targets `http://127.0.0.1:1420` by default.

The driver refuses to run in production-like runtimes. It exits when `NODE_ENV=production`, when `GTD_SIDECAR_PROFILES` contains `prod`, or when the target URL is not `localhost`, `127.0.0.1`, or `[::1]`.

## Configuration

```bash
GTD_AGENT_TARGET_URL=http://127.0.0.1:1420
GTD_AGENT_DRIVER_PORT=3199
GTD_AGENT_HEADLESS=true
```

Headed Chromium is used by default. Set `GTD_AGENT_HEADLESS=true` only when a visible browser is not needed.

## Example Flow

```bash
curl http://127.0.0.1:3199/observe
curl -X POST http://127.0.0.1:3199/press -H "Content-Type: application/json" -d '{"key":"g"}'
curl -X POST http://127.0.0.1:3199/press -H "Content-Type: application/json" -d '{"key":"i"}'
curl -X POST http://127.0.0.1:3199/type -H "Content-Type: application/json" -d '{"text":"New item from the agent"}'
```

Each command operates on the same browser session while the driver process stays alive.

## Endpoints

`GET /health` returns driver status, configured target URL, and whether a page is open.

`POST /start` opens or reuses the browser session. Pass `{"force":true}` to close the current session and open a new one. Pass `{"url":"http://127.0.0.1:1420"}` to override the target URL.

`POST /goto` navigates the current page to a URL. Body: `{"url":"http://127.0.0.1:1420"}`.

`POST /press` sends a Playwright-compatible key or key combination. Body: `{"key":"Enter"}`. Optional `repeat` and `delayMs` are supported.

Action responses are compact by default to keep agent loops fast and low-token. Pass `{"key":"Enter","compact":false}` only when a full observation is needed after one action.

`POST /type` types text into the currently focused element. Body: `{"text":"Buy rice"}`. It does not focus or clear fields automatically.

`POST /wait` waits for an interval. Body: `{"ms":500}`.

`GET /observe` returns the current URL, title, visible text, text preview, focused element, main region text, dialogs, toasts, errors, and console or network errors seen since the previous observation.

Use `GET /observe?compact=true` for routine loops. It returns the preview, focus, dialogs, toasts, and error counts without the full page text dump.

`GET /state` reads `window.__GTD_AGENT_STATE__` when the dev-only frontend bridge is available.

`POST /close` closes the controlled browser. Pass `{"exitProcess":true}` to also stop the driver process.

## Low-Token Agent Loop

Prefer this loop for exploratory UI work:

```bash
curl -s http://127.0.0.1:3199/observe?compact=true
curl -s -X POST http://127.0.0.1:3199/press -H "Content-Type: application/json" -d '{"key":"a"}'
curl -s -X POST http://127.0.0.1:3199/type -H "Content-Type: application/json" -d '{"text":"New inbox item"}'
curl -s -X POST http://127.0.0.1:3199/press -H "Content-Type: application/json" -d '{"key":"Enter"}'
```

Use full `GET /observe` only at checkpoints where the complete visible text or complete error list is needed.

## Limits

The driver controls the browser UI only. It intentionally avoids endpoints such as `create-task`, `delete-task`, or `process-inbox` because those would bypass the keyboard-first experience the driver is meant to validate.

The driver is development-only. It does not accept remote target hosts and should not be used against packaged production builds.

The driver intentionally does not expose screenshot endpoints. Use textual observation through `/observe?compact=true` and `/state` so agent loops stay fast and low-token.
