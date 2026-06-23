import { expect, test, type Page } from "@playwright/test";
import { createAndSelectInboxStuff, createInboxStuffFromKeyboard, focusApp, openApp, openCalendars, resetTestData, uniqueLabel, focusPanelAndSelectItem, processIntoCalendar } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("calendar GTD flow: creates, schedules, manages state, and deletes", async ({ page }) => {
  const title = uniqueLabel("Calendar meeting");

  // 1. Create stuff in Inbox
  await createAndSelectInboxStuff(page, title);

  // 2. Process into a calendar
  await processIntoCalendar(page);

  // By default, it opens the grouped Today subview.
  await expect(page.locator(".inbox-pane .list-pane__title").nth(0)).toHaveText("Calendar");
  await expect(page.locator(".inbox-pane .list-pane__title").nth(1)).toHaveText("Done");
  await expect(page.locator(".inbox-pane .list-pane__title").nth(2)).toHaveText("Calendar Detail");
  await verifyCalendarSubviewShortcuts(page);

  // Verify it appears in Today panel (1) (due/late)
  const { panel: panel1, item: dueCalendar } = await focusPanelAndSelectItem(page, 0, title);
  await page.keyboard.press("o");
  await expect(dueCalendar).not.toBeVisible();
  await expect(page.locator(".list-pane__title", { hasText: "On Going Calendar Detail" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.down("Control");
  await page.keyboard.press("h");
  await page.keyboard.up("Control");

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
  await expect(page.getByText("Recurring").first()).toBeVisible();
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


async function verifyCalendarSubviewShortcuts(page: Page): Promise<void> {
  await expectCalendarSubviewAfterKey(page, "]", "Mon");
  await expectCalendarSubviewAfterKey(page, "]", "Recurring");
  await expectCalendarSubviewAfterKey(page, "]", "Completed");
  await expectCalendarSubviewAfterKey(page, "]", "Deleted");
  await expectCalendarSubviewAfterKey(page, "]", "Calendar");
  await expectCalendarSubviewAfterKey(page, "[", "Deleted");
  await expectCalendarSubviewAfterKey(page, "[", "Completed");
  await expectCalendarSubviewAfterKey(page, "[", "Recurring");
  await expectCalendarSubviewAfterKey(page, "[", "Mon");
  await expectCalendarSubviewAfterKey(page, "[", "Calendar");
}

async function expectCalendarSubviewAfterKey(page: Page, key: string, title: string): Promise<void> {
  await page.keyboard.press(key);
  if (title === "Mon") {
    await expect(page.locator(".weekly-column-day").nth(0)).toHaveText(title);
    return;
  }
  await expect(page.locator(".inbox-pane .list-pane__title").nth(0)).toHaveText(title);
}
