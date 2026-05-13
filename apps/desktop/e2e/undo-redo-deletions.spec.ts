import { expect, test, type Page } from "@playwright/test";

function uniqueTitle(): string {
  return `Undo redo test ${Date.now()}`;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("main").click();
});

async function createStuff(page: Page, title: string) {
  await page.keyboard.press("a");
  const input = page.locator("input.tree-entry__input");
  await expect(input).toBeVisible();
  await input.fill(title);
  await input.press("Enter");
  await expect(input).not.toBeVisible();
  await expect(page.getByRole("button", { name: title })).toBeVisible();
}

async function exitBodyEditor(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-content")).toHaveAttribute("data-vim-mode", "normal");
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-content")).not.toBeVisible();
}

test("undoing a deletion restores the item", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  
  await exitBodyEditor(page);
  
  // Select and delete
  await page.getByRole("button", { name: title }).click();
  await page.keyboard.press("d");
  await expect(page.getByRole("button", { name: title })).not.toBeVisible();
  await page.waitForTimeout(200);
  
  // Undo: press 'u'
  await page.keyboard.press("u");
  await expect(page.getByRole("button", { name: title })).toBeVisible();
});

test("redoing an undo deletes the item again", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  
  await exitBodyEditor(page);

  // Delete
  await page.getByRole("button", { name: title }).click();
  await page.keyboard.press("d");
  await expect(page.getByRole("button", { name: title })).not.toBeVisible();
  await page.waitForTimeout(200);
  
  // Undo
  await page.keyboard.press("u");
  await expect(page.getByRole("button", { name: title })).toBeVisible();
  
  // Redo: press 'Ctrl+r'
  await page.keyboard.press("Control+r");
  await expect(page.getByRole("button", { name: title })).not.toBeVisible();
});
