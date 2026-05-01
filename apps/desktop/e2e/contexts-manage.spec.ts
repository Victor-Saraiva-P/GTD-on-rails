import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type ContextItem = {
  id: string;
  name: string;
};

const apiBaseUrl = "http://127.0.0.1:18080";

function uniqueContextName(): string {
  return `E2E context ${Date.now()}`;
}

async function focusApp(page: Page): Promise<void> {
  await page.locator("main").click();
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

async function resetTestData(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/test/reset`);
  expect(response.ok()).toBeTruthy();
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
