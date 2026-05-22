import { expect, test, type Page } from "@playwright/test";
import { createInboxStuffFromKeyboard, focusApp, openApp, resetTestData, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("calendar GTD flow: creates, schedules, manages state, and deletes", async ({ page }) => {
  const title = uniqueLabel("Calendar meeting");

  // 1. Create stuff in Inbox
  await createStuff(page, title);

  // 2. Process into a calendar
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

  // 3. Verify it appears under Space c (Calendars page)
  await openCalendars(page);

  // By default, it opens the grouped Today subview.
  await expect(page.locator(".inbox-pane .list-pane__title").nth(0)).toHaveText("Calendar");
  await expect(page.locator(".inbox-pane .list-pane__title").nth(1)).toHaveText("Done");
  await expect(page.locator(".inbox-pane .list-pane__title").nth(2)).toHaveText("Calendar Detail");
  await verifyCalendarSubviewShortcuts(page);

  // Verify it appears in Today panel (1) (due/late)
  const panel1 = page.locator(".inbox-pane").nth(0);
  const dueCalendar = panel1.getByRole("button", { name: title, exact: false }).first();
  await expect(dueCalendar).toBeVisible();

  // Focus item and mark ongoing
  await page.keyboard.press("1");
  await expect(panel1).toHaveClass(/list-pane--active/);
  await dueCalendar.click();
  await page.keyboard.press("o");
  await expect(dueCalendar).not.toBeVisible();

  // 4. Verify in On Going page
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("o");
  await expect(page.locator(".list-pane__title", { hasText: "On Going" }).first()).toBeVisible();

  const ongoingPanel2 = page.locator(".inbox-pane").nth(1);
  const ongoingCalendar = ongoingPanel2.getByRole("button", { name: title, exact: false }).first();
  await expect(ongoingCalendar).toBeVisible();

  // 5. Mark done and verify in Today panel (2)
  await page.keyboard.press("2");
  await expect(ongoingPanel2).toHaveClass(/list-pane--active/);
  await ongoingCalendar.click();
  await page.keyboard.press("x");

  await expect(ongoingCalendar).not.toBeVisible();

  // Go back to Calendars Today
  await openCalendars(page);

  const todayPanel2 = page.locator(".inbox-pane").nth(1);
  const doneCalendar = todayPanel2.getByRole("button", { name: title, exact: false }).first();
  await expect(doneCalendar).toBeVisible();

  // 6. Verify Completed and Deleted subviews
  await page.keyboard.press("]");
  await expect(page.getByText("Mon").first()).toBeVisible();
  await page.keyboard.press("]");
  await expect(page.getByText("Completed").first()).toBeVisible();

  const completedCalendar = page.locator(".inbox-pane").nth(0).getByRole("button", { name: title, exact: false }).first();
  await expect(completedCalendar).toBeVisible();

  // Delete the item
  await page.keyboard.press("1");
  await expect(page.locator(".inbox-pane").nth(0)).toHaveClass(/list-pane--active/);
  await completedCalendar.click();
  await page.keyboard.press("d");

  await expect(completedCalendar).not.toBeVisible();

  // Verify in deleted
  await page.keyboard.press("]");
  await expect(page.getByText("Deleted").first()).toBeVisible();
  await expect(page.locator(".inbox-pane").nth(0).getByRole("button", { name: title, exact: false }).first()).toBeVisible();
});

async function openCalendars(page: Page): Promise<void> {
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("c");
  await expect(page.locator(".leader-menu")).not.toBeVisible();
  await expect(page.locator(".inbox-pane .list-pane__title").nth(0)).toHaveText("Calendar");
}

async function verifyCalendarSubviewShortcuts(page: Page): Promise<void> {
  await expectCalendarSubviewAfterKey(page, "]", "Mon");
  await expectCalendarSubviewAfterKey(page, "]", "Completed");
  await expectCalendarSubviewAfterKey(page, "]", "Deleted");
  await expectCalendarSubviewAfterKey(page, "]", "Calendar");
  await expectCalendarSubviewAfterKey(page, "[", "Deleted");
  await expectCalendarSubviewAfterKey(page, "[", "Completed");
  await expectCalendarSubviewAfterKey(page, "[", "Mon");
  await expectCalendarSubviewAfterKey(page, "[", "Calendar");
}

async function expectCalendarSubviewAfterKey(page: Page, key: string, title: string): Promise<void> {
  await page.keyboard.press(key);
  await expect(page.locator(".inbox-pane .list-pane__title").nth(0)).toHaveText(title);
}

async function createStuff(page: Page, title: string): Promise<void> {
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
}
