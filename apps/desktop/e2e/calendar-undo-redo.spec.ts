import { expect, test, type Page } from "@playwright/test";
import { createInboxStuffFromKeyboard, focusApp, openApp, resetTestData, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

async function createCalendar(page: Page, title: string): Promise<void> {
  // Create stuff in Inbox
  await page.keyboard.press("h");
  await createInboxStuffFromKeyboard(page, title);
  await page.locator("main").click();
  await expect(page.getByRole("button", { name: title, exact: false }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Editing mode")).toContainText("NORMAL");
  await page.keyboard.down("Control");
  await page.keyboard.press("h");
  await page.keyboard.up("Control");
  await expect(page.locator(".cm-content")).not.toBeVisible();
  await page.getByRole("button", { name: title, exact: false }).first().click();

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
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("c");
  await expect(page.locator(".leader-menu")).not.toBeVisible();
  await expect(page.locator(".inbox-pane .list-pane__title").nth(0)).toHaveText("Calendar");
}

test("undoing a calendar deletion restores the item", async ({ page }) => {
  const title = uniqueLabel("Calendar undo test");
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
});

test("redoing a calendar undo deletes the item again", async ({ page }) => {
  const title = uniqueLabel("Calendar redo test");
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
  await page.waitForTimeout(200);

  // Redo
  await page.keyboard.press("Control+r");
  await expect(dueCalendar).not.toBeVisible();
});
