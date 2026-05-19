import { expect, test, type Page } from "@playwright/test";
import { createInboxStuffFromKeyboard, openApp, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

async function createStuff(page: Page, title: string) {
  await createInboxStuffFromKeyboard(page, title);
  await expect(page.getByRole("button", { name: title })).toBeVisible();
}

async function exitBodyEditor(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-content")).toHaveAttribute("data-vim-mode", "normal");
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-content")).not.toBeVisible();
}

async function deleteStuff(page: Page, title: string) {
  await page.getByRole("button", { name: title }).click();
  await page.keyboard.press("d");
  await expect(page.getByRole("button", { name: title })).not.toBeVisible();
  await page.waitForTimeout(200);
}

async function undoDeletion(page: Page, title: string) {
  await page.keyboard.press("u");
  await expect(page.getByRole("button", { name: title })).toBeVisible();
}

test("undoing a deletion restores the item", async ({ page }) => {
  const title = uniqueLabel("Undo redo test");
  await createStuff(page, title);
  await exitBodyEditor(page);
  await deleteStuff(page, title);
  await undoDeletion(page, title);
});

test("redoing an undo deletes the item again", async ({ page }) => {
  const title = uniqueLabel("Undo redo test");
  await createStuff(page, title);
  await exitBodyEditor(page);
  await deleteStuff(page, title);
  await undoDeletion(page, title);
  await page.keyboard.press("Control+r");
  await expect(page.getByRole("button", { name: title })).not.toBeVisible();
});
