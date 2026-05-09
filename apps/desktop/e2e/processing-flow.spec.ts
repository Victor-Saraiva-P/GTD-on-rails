import { expect, test, type Page } from "@playwright/test";

function uniqueTitle(): string {
  return `Processing flow ${Date.now()}`;
}

test.beforeEach(async ({ page }) => {
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

async function createStuff(page: Page, title: string) {
  await page.keyboard.press("h");
  await page.keyboard.press("a");
  const input = page.locator("input.tree-entry__input");
  await expect(input).toBeVisible();
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByRole("button", { name: title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-content")).not.toBeVisible();
}
