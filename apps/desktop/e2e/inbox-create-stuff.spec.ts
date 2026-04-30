import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type InboxStuff = {
  id: string;
  title: string;
};

const apiBaseUrl = "http://127.0.0.1:18080";

function uniqueTitle(): string {
  return `E2E stuff ${Date.now()}`;
}

async function focusApp(page: Page) {
  await page.locator("main").click();
}

async function createStuffFromKeyboard(page: Page, title: string) {
  await page.keyboard.press("a");
  const input = page.locator("input.tree-entry__input");
  await expect(input).toBeVisible();
  await input.fill(title);
  await input.press("Enter");
}

async function fetchInboxByTitle(
  request: APIRequestContext,
  title: string
): Promise<InboxStuff | null> {
  const response = await request.get(`${apiBaseUrl}/inbox`);
  expect(response.ok()).toBeTruthy();
  const stuffs = (await response.json()) as InboxStuff[];
  return stuffs.find((stuff) => stuff.title === title) ?? null;
}

async function resetTestData(request: APIRequestContext) {
  const response = await request.post(`${apiBaseUrl}/test/reset`);
  expect(response.ok()).toBeTruthy();
}

test.beforeEach(async ({ request }) => {
  await resetTestData(request);
});

test("creates a new stuff from keyboard command using backend API", async ({
  page,
  request
}) => {
  const title = uniqueTitle();
  await page.goto("/");
  await focusApp(page);

  await createStuffFromKeyboard(page, title);

  await expect(page.getByRole("button", { name: title })).toBeVisible();
  await expect(page.locator(".inbox-detail__title")).toHaveText(title);
  await expect.poll(() => fetchInboxByTitle(request, title)).not.toBeNull();
});
