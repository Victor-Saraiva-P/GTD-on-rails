# Desktop

Minimal desktop app scaffold with Vite and Tauri 2.

## Commands

- `pnpm dev`: runs the desktop app through Tauri in development mode
- `pnpm build`: builds only the local web frontend
- `pnpm desktop:build`: builds the desktop bundle through Tauri
- `pnpm test`: runs the fast unit test suite
- `pnpm e2e`: runs the web end-to-end tests with Playwright using the real frontend and backend

Run the frontend unit test suite from the repository root with:

```sh
pnpm --filter @gtd-on-rails/desktop test
```

Run the frontend end-to-end test suite from the repository root with:

```sh
pnpm --filter @gtd-on-rails/desktop e2e
```

## Arch Linux Setup

For desktop development on Arch Linux, install Playwright from the AUR and
download the browsers used by the e2e tests:

```sh
yay -S playwright
pnpm install
pnpm exec playwright install
```

If `pnpm e2e` fails with `Executable doesn't exist` under
`~/.cache/ms-playwright`, the Playwright browser cache has not been downloaded
yet or is outdated. Run `pnpm exec playwright install` again.

## PostgreSQL client tools

Packaged production and staging startup checks for `pg_dump` and `pg_restore` before launching the Spring Boot sidecar. If either command is missing, the desktop shows an explicit installation action. The action invokes only the fixed Polkit command for Arch Linux `postgresql-libs`; it does not accept shell text and does not install silently.

If Polkit authorization is cancelled or unavailable, run the displayed manual fallback:

```sh
sudo pacman -S --needed postgresql-libs
```

After installation, restart the desktop so the dependency check runs before backup-dependent startup.
