import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { apiBaseUrl, focusApp, resetTestData, uniqueLabel } from "./support/app";

type ContextItem = {
  id: string;
  name: string;
};

function uniqueContextName(): string {
  return uniqueLabel("E2E context");
}

async function createContextFromKeyboard(page: Page, name: string): Promise<void> {
  await page.keyboard.press("a");
  const input = page.locator("input.tree-entry__input");
  await expect(input).toBeVisible();
  await input.fill(name);
  await input.press("Enter");
}

async function fetchContextByName(
  request: APIRequestContext,
  name: string
): Promise<ContextItem | null> {
  const response = await request.get(`${apiBaseUrl}/contexts`);
  expect(response.ok()).toBeTruthy();
  const contexts = (await response.json()) as ContextItem[];
  return contexts.find((ctx) => ctx.name === name) ?? null;
}

test.beforeEach(async ({ request }) => {
  await resetTestData(request);
});

test("creates a new context from keyboard command using backend API", async ({
  page,
  request
}) => {
  const contextName = uniqueContextName();
  await page.goto("/");
  await focusApp(page);

  await page.keyboard.press(" ");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("C");

  await expect(page.getByText("No contexts yet.")).toBeVisible();

  await createContextFromKeyboard(page, contextName);

  await expect(page.getByRole("button", { name: contextName })).toBeVisible();
  await expect.poll(() => fetchContextByName(request, contextName)).not.toBeNull();
});
