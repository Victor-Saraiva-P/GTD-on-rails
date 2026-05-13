import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:18080";

function uniqueTitle(): string {
  return `Processing flow ${Date.now()}`;
}

async function createContext(request: APIRequestContext, name: string): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/contexts`, { data: { name } });
  expect(response.ok()).toBeTruthy();
}

async function resetTestData(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/test/reset`);
  expect(response.ok()).toBeTruthy();
}

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await page.goto("/");
  await page.locator("main").click();
});

test("p opens processing command page for focused inbox stuff", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);

  await page.keyboard.press("p");

  const dialog = page.getByRole("dialog", { name: "Processing" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Processing");
  await expect(dialog).toContainText("n");
  await expect(dialog).toContainText("Next actions");

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("selects multiple next action contexts with keyboard", async ({ page, request }) => {
  const title = uniqueTitle();
  const firstContext = `A processing ${Date.now()}`;
  const secondContext = `B processing ${Date.now()}`;
  await createContext(request, firstContext);
  await createContext(request, secondContext);
  await createStuff(page, title);

  await page.keyboard.press("p");
  await page.keyboard.press("n");

  const dialog = page.getByRole("dialog", { name: "Processing" });
  await expect(dialog.getByText(firstContext)).toBeVisible();
  await expect(dialog.getByText(secondContext)).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("j");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(dialog.getByText("Energy level")).toBeVisible();
});

async function createStuff(page: Page, title: string): Promise<void> {
  await page.keyboard.press("h");
  await page.keyboard.press("a");
  const input = page.locator("input.tree-entry__input");
  await expect(input).toBeVisible();
  await input.fill(title);
  await page.locator("main").click();
  await expect(page.getByRole("button", { name: title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Editing mode")).toContainText("NORMAL");
  await page.keyboard.down("Control");
  await page.keyboard.press("h");
  await page.keyboard.up("Control");
  await expect(page.locator(".cm-content")).not.toBeVisible();
  await page.getByRole("button", { name: title }).click();
}
