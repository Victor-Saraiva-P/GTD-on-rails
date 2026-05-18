import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { apiBaseUrl, createInboxStuffFromKeyboard, focusApp, resetTestData, uniqueLabel } from "./support/app";

type InboxStuff = {
  id: string;
  title: string;
};

function uniqueTitle(): string {
  return uniqueLabel("E2E stuff");
}

async function createStuffFromKeyboard(page: Page, title: string): Promise<void> {
  await createInboxStuffFromKeyboard(page, title);
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
