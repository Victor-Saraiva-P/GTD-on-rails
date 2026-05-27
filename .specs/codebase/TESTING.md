# Testing

## Canonical Command

Run the full suite with:

```sh
pnpm test
```

This command runs script tests, workspace unit tests, integration tests, and e2e tests through the root package scripts.

## Supporting Commands

- `pnpm check`: static checks across the workspace.
- `pnpm lint`: lint/static validation tasks across the workspace.
- `pnpm e2e`: workspace e2e tests.
- `pnpm --filter @gtd-on-rails/api test`: API tests.
- `pnpm --filter @gtd-on-rails/api unitTest`: API unit tests.
- `pnpm --filter @gtd-on-rails/api integrationTest`: API integration tests.
- `pnpm --filter @gtd-on-rails/desktop test`: desktop unit tests.
- `pnpm --filter @gtd-on-rails/desktop e2e`: desktop Playwright e2e tests.
- `pnpm --filter @gtd-on-rails/desktop coverage`: desktop unit coverage.

## Test Locations

- API JUnit tests: `apps/api/src/test/java`.
- Desktop unit tests: `apps/desktop/test`.
- Desktop e2e tests: `apps/desktop/e2e`.
- Root script tests: `scripts/*.test.mjs`.

## Expectations

- Every new function gets a test.
- Bug fixes get a regression test.
- Tests must be fast, independent, repeatable, self-validating, and timely.
- Mock external I/O with named fake classes, not inline stubs.
- Use focused tests for narrow changes and broader tests for shared behavior, cross-module contracts, or user-facing flows.
- Run the smallest useful command while developing, then the relevant broader gate before finishing.

## E2E Environment

Desktop e2e tests use Playwright. On Arch Linux, install Playwright dependencies and browsers when needed:

```sh
yay -S playwright
pnpm install
pnpm exec playwright install
```

Canonical sources:

- [AGENTS.md](../../AGENTS.md)
- [README.md](../../README.md)
- [Desktop Execution](../../docs/30%20-%20Guides%20and%20Manuals/Desktop%20Execution.md)
- [API Execution](../../docs/30%20-%20Guides%20and%20Manuals/API%20Execution.md)
