import { expect, test, type APIRequestContext } from "@playwright/test";
import { apiBaseUrl, convertStuffToNextActionApi, createAndSelectInboxStuff, createStuffApi, focusApp, focusPanelAndSelectItem, openApp, openCalendars, processIntoCalendar, resetTestData, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("pressing o on a due calendar opens its on going detail in body editing", async ({ page }) => {
  const title = uniqueLabel("Calendar on going detail");
  await createAndSelectInboxStuff(page, title);
  await processIntoCalendar(page);
  const { item } = await focusPanelAndSelectItem(page, 0, title);

  await page.keyboard.press("o");

  await expect(item).not.toBeVisible();
  await expect(page.locator(".list-pane__title", { hasText: "On Going Calendar Detail" })).toBeVisible();
  await expect(page.getByText(title).first()).toBeVisible();
  await expect(page.locator(".cm-content")).toBeVisible();
});

test("pressing o edits the promoted calendar when another calendar is already on going", async ({ page, request }) => {
  const existingTitle = uniqueLabel("Existing on going calendar");
  const promotedTitle = uniqueLabel("Promoted on going calendar");
  await createCalendarApi(request, existingTitle);
  await createCalendarApi(request, promotedTitle);
  await openCalendars(page);
  await focusPanelAndSelectItem(page, 0, existingTitle);
  await page.keyboard.press("o");
  await expect(page.locator(".list-pane__title", { hasText: "On Going Calendar Detail" })).toBeVisible();
  await openApp(page);
  await openCalendars(page);
  await focusPanelAndSelectItem(page, 0, promotedTitle);

  await page.keyboard.press("o");

  await expect(page.getByRole("heading", { name: promotedTitle })).toBeVisible();
  await expect(page.locator(".cm-content")).toBeVisible();
});

async function createCalendarApi(request: APIRequestContext, title: string): Promise<void> {
  const stuff = await createStuffApi(request, title);
  const response = await request.post(`${apiBaseUrl}/inbox/${stuff.id}/calendar`, { data: { scheduledDate: todayIsoDate() } });
  expect(response.ok()).toBeTruthy();
}

function todayIsoDate(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

test("pressing o on a weekly calendar opens its on going detail", async ({ page }) => {
  const title = uniqueLabel("Weekly calendar on going");
  await createAndSelectInboxStuff(page, title);
  await processIntoCalendar(page);
  await page.keyboard.press("]");
  await page.keyboard.press("t");
  await page.getByRole("button", { name: title, exact: false }).first().click();

  await page.keyboard.press("o");

  await expect(page.locator(".list-pane__title", { hasText: "On Going Calendar Detail" })).toBeVisible();
  await expect(page.getByText(title).first()).toBeVisible();
});

test("Space Enter on the on going calendar list opens calendar detail", async ({ page }) => {
  const title = uniqueLabel("Open on going calendar");
  await createAndSelectInboxStuff(page, title);
  await processIntoCalendar(page);
  await focusPanelAndSelectItem(page, 0, title);
  await page.keyboard.press("o");
  await expect(page.locator(".cm-content")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Panel: Calendars")).toBeVisible();

  await focusApp(page);
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(page.locator(".list-pane__title", { hasText: "On Going Calendar Detail" })).toBeVisible();
  await expect(page.getByText(title).first()).toBeVisible();
});

test("Escape from on going calendar detail returns to the calendar list focus", async ({ page, request }) => {
  const nextActionTitle = uniqueLabel("Existing on going next action");
  const title = uniqueLabel("Return to on going calendar");
  await createOnGoingNextActionApi(request, nextActionTitle);
  await createAndSelectInboxStuff(page, title);
  await processIntoCalendar(page);
  await focusPanelAndSelectItem(page, 0, title);
  await page.keyboard.press("o");
  await expect(page.locator(".cm-content")).toBeVisible();

  await page.keyboard.press("Escape");

  const calendarPanel = page.locator(".inbox-pane").nth(1);
  await expect(page.locator(".list-pane__title", { hasText: "On Going Calendars" })).toBeVisible();
  await expect(calendarPanel).toHaveClass(/list-pane--active/);
  await expect(page.getByText("Panel: Calendars")).toBeVisible();
  await expect(page.locator(".inbox-pane").nth(0).getByRole("button", { name: nextActionTitle, exact: false }).first()).not.toHaveClass(/tree-entry--active/);
  await expect(calendarPanel.getByRole("button", { name: title, exact: false }).first()).toBeVisible();
});

async function createOnGoingNextActionApi(request: APIRequestContext, title: string): Promise<void> {
  const stuff = await createStuffApi(request, title);
  await convertStuffToNextActionApi(request, stuff.id);
  const response = await request.post(`${apiBaseUrl}/next-actions/${stuff.id}/ongoing`);
  expect(response.ok()).toBeTruthy();
}
