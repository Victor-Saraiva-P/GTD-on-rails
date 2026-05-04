import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:18080";

function uniqueTitle(): string {
  return `E2E body autosave ${Date.now()}`;
}

async function resetTestData(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/test/reset`);
  expect(response.ok()).toBeTruthy();
}

async function createStuffFromApi(request: APIRequestContext, title: string): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/items`, {
    data: { body: "", title }
  });
  expect(response.ok()).toBeTruthy();
}

async function openBodyEditor(page: Page, request: APIRequestContext, title: string): Promise<void> {
  await createStuffFromApi(request, title);
  await page.goto("/");
  await page.locator("main").click();
  await expect(page.getByRole("button", { name: title })).toBeVisible();
  await page.getByRole("button", { name: title }).click();
  await page.keyboard.press("l");
  await page.keyboard.press("Enter");
  await expect(page.locator(".inbox-detail__codemirror .cm-editor")).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await resetTestData(request);
});

test("keeps editing open after escaping insert mode with autosaved changes", async ({ page, request }) => {
  await openBodyEditor(page, request, uniqueTitle());

  await page.keyboard.press("i");
  await page.keyboard.type("famosas frases do grandiosissimo");
  await page.keyboard.press("Escape");

  const editor = page.locator(".inbox-detail__codemirror .cm-editor");
  await expect(editor).toBeVisible();
  await expect(page.locator(".inbox-detail__codemirror .cm-editor.cm-focused")).toBeVisible();
  await expect(page.locator(".inbox-detail__body-preview")).toHaveCount(0);
  await expect(page.locator(".inbox-detail__codemirror .cm-fat-cursor, .inbox-detail__codemirror .cm-cursor").first()).toBeVisible();

  await page.keyboard.press("o");
  await page.keyboard.type("nova linha em insert mode");
  await expect(page.locator(".inbox-detail__codemirror .cm-line").filter({ hasText: "nova linha em insert mode" })).toBeVisible();
});
