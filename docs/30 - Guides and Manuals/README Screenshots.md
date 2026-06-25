# README Screenshots

Use the development demo seed before capturing README screenshots. The seed creates realistic GTD data, contexts, calendar items, and the PDF asset used by the rich detail screenshot.

## Prepare Data

Run the API in the `dev` profile, then recreate the screenshot dataset:

```sh
pnpm --filter @gtd-on-rails/api dev
pnpm demo:reset --confirm
```

`pnpm demo:reset` without `--confirm` only prints the target endpoint. Set `GTD_API_BASE_URL` when the API is not running on `http://127.0.0.1:8080`.

## Capture Scenes

1. Main workspace: open Next Actions and select `Review Tauri architecture slides before Friday demo`. Save as `docs/assets/screenshots/main-next-actions.png`.
2. Processing flow: open Inbox, select `Plan team offsite`, press `p`, then `n`, and capture the chosen wizard steps as `processing-choice.png`, `processing-deadline.png`, `processing-contexts.png`, and `processing-energy.png`.
3. Rich detail: open the full detail page for `Review Tauri architecture slides before Friday demo`, wait for the `TauriSlideshow.pdf` preview to render, and save as `docs/assets/screenshots/pdf-detail.png`.
4. External agenda mirror: open Google Calendar in week view after sync and save as `docs/assets/screenshots/google-calendar-mirror.png`.
5. Sync status: capture the footer status indicators when Git persistence, Google Drive asset sync, Google Calendar sync, and sidecar health are in the desired visible state. Save as `docs/assets/screenshots/sync-status.png`.

Save final README images under `docs/assets/screenshots/` and reference them with normal GitHub Markdown image syntax.
