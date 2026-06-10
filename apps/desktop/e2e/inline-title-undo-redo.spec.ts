import { expect, test, type Locator, type Page } from "@playwright/test";
import { createInboxStuffFromKeyboard, openApp, resetTestData, uniqueLabel } from "./support/app";

async function closeBodyEditor(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-content")).toHaveAttribute("data-vim-mode", "normal");
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-content")).not.toBeVisible();
}

async function startInboxTitleEdit(page: Page, title: string): Promise<Locator> {
  await page.getByRole("button", { name: title }).first().click();
  await page.keyboard.press("Enter");
  const titleInput = page.locator("input.tree-entry__input");
  await expect(titleInput).toBeFocused();
  return titleInput;
}

async function pressCtrlKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down("Control");
  await page.keyboard.press(key);
  await page.keyboard.up("Control");
}

async function pressCtrlShiftKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down("Control");
  await page.keyboard.down("Shift");
  await page.keyboard.press(key);
  await page.keyboard.up("Shift");
  await page.keyboard.up("Control");
}

async function expectUndoRedoCycle(page: Page, title: string, editSuffix: string): Promise<void> {
  const titleInput = page.locator("input.tree-entry__input");
  await pressCtrlKey(page, "z");
  await expect(titleInput).toHaveValue(title);
  await pressCtrlKey(page, "y");
  await expect(titleInput).toHaveValue(`${title}${editSuffix}`);
}

async function expectShiftRedoCycle(page: Page, title: string, editSuffix: string): Promise<void> {
  const titleInput = page.locator("input.tree-entry__input");
  await pressCtrlKey(page, "z");
  await expect(titleInput).toHaveValue(title);
  await pressCtrlShiftKey(page, "z");
  await expect(titleInput).toHaveValue(`${title}${editSuffix}`);
}

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("inbox inline title editing keeps native undo and redo in the focused input", async ({ page }) => {
  const title = uniqueLabel("Undoable title");
  const editSuffix = " typo";
  await createInboxStuffFromKeyboard(page, title);
  await closeBodyEditor(page);

  const titleInput = await startInboxTitleEdit(page, title);
  await page.keyboard.type(editSuffix);
  await expect(titleInput).toHaveValue(`${title}${editSuffix}`);
  await expectUndoRedoCycle(page, title, editSuffix);
  await expectShiftRedoCycle(page, title, editSuffix);
});
