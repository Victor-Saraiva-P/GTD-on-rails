import { expect, test, type Page } from "@playwright/test";
import { createAndSelectInboxStuff, createInboxStuffFromKeyboard, focusApp, openApp, openCalendars, resetTestData, uniqueLabel, focusPanelAndSelectItem, processIntoCalendar } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

async function createCalendar(page: Page, title: string): Promise<void> {
  // Create stuff in Inbox
  await createAndSelectInboxStuff(page, title);

  // Process into a calendar
  await processIntoCalendar(page);
}

async function deleteAndUndoCalendar(page: Page, title: string) {
  await createCalendar(page, title);

  const { item: dueCalendar } = await focusPanelAndSelectItem(page, 0, title);

  // Delete
  await page.keyboard.press("d");
  await expect(dueCalendar).not.toBeVisible();
  await page.waitForTimeout(200);

  // Undo
  await page.keyboard.press("u");
  await expect(dueCalendar).toBeVisible();
  
  return dueCalendar;
}

test("undoing a calendar deletion restores the item", async ({ page }) => {
  const title = uniqueLabel("Calendar undo test");
  await deleteAndUndoCalendar(page, title);
});

test("redoing a calendar undo deletes the item again", async ({ page }) => {
  const title = uniqueLabel("Calendar redo test");
  const dueCalendar = await deleteAndUndoCalendar(page, title);
  await page.waitForTimeout(200);

  // Redo
  await page.keyboard.press("Control+r");
  await expect(dueCalendar).not.toBeVisible();
});
