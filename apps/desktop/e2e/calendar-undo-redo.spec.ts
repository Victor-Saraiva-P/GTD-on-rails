import { expect, test, type Page } from "@playwright/test";
import { createAndSelectInboxStuff, createInboxStuffFromKeyboard, focusApp, openApp, openCalendars, resetTestData, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

async function createCalendar(page: Page, title: string): Promise<void> {
  // Create stuff in Inbox
  await createAndSelectInboxStuff(page, title);

  // Process into a calendar
  await page.keyboard.press("p");
  await page.keyboard.press("c");

  // Date step
  const dateControl = page.getByRole("textbox", { name: "Scheduled date:" });
  await expect(dateControl).toBeVisible();
  await page.keyboard.press("Enter");

  // Time step
  await expect(page.getByText("Scheduled time (optional)")).toBeVisible();
  const calendarResponsePromise = page.waitForResponse((response) => response.url().endsWith("/calendar") && response.request().method() === "POST" && response.ok());
  await page.locator(".processing-dialog__input--time").press("Enter");
  await calendarResponsePromise;

  // Open Calendars page
  await openCalendars(page);
}

async function deleteAndUndoCalendar(page: Page, title: string) {
  await createCalendar(page, title);

  const panel1 = page.locator(".inbox-pane").nth(0);
  const dueCalendar = panel1.getByRole("button", { name: title, exact: false }).first();
  await expect(dueCalendar).toBeVisible();

  // Focus panel and select item
  await page.keyboard.press("1");
  await expect(panel1).toHaveClass(/list-pane--active/);
  await dueCalendar.click();

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
