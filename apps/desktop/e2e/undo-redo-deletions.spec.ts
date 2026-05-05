import { expect, test } from "@playwright/test";

function uniqueTitle(): string {
  return `Undo redo test ${Date.now()}`;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("main").click();
});

async function createStuff(page: any, title: string) {
  await page.keyboard.press("a");
  const input = page.locator("input.tree-entry__input");
  await expect(input).toBeVisible();
  await input.fill(title);
  await input.press("Enter");
  await expect(input).not.toBeVisible();
  await expect(page.getByRole("button", { name: title })).toBeVisible();
}

test("undoing a deletion restores the item", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  
  // Ensure we are not in edit mode
  await page.keyboard.press("Escape");
  
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
  
  // Ensure we are not in edit mode
  await page.keyboard.press("Escape");

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
