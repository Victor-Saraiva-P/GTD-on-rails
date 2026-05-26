import { expect, test, type Page } from "@playwright/test";
import {
  createAndSelectInboxStuff,
  createInboxStuffFromKeyboard,
  openApp,
  openCalendars,
  resetTestData,
  uniqueLabel
} from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("edits calendar schedule with e and trims displayed seconds", async ({ page }) => {
  const title = await createCalendarFromKeyboard(page, "Edit schedule", "2100");
  await openCalendars(page);

  const card = page.getByRole("button", { name: title, exact: false }).first();
  await expect(card).toContainText("21:00");
  await expect(card).not.toContainText("21:00:00");
  await expect(card.locator(".calendar-entry__time")).toBeVisible();

  await card.click();
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog", { name: "Edit calendar schedule" })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("2130");

  const patch = page.waitForRequest((request) => request.url().includes("/calendars/") && request.method() === "PATCH");
  await page.keyboard.press("Enter");
  expect((await patch).postDataJSON()).toMatchObject({ scheduledTime: "21:30" });
  await expect(card).toContainText("21:30");
});

test("long calendar titles truncate but keep time visible", async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 680 });
  const longPrefix = "Long calendar title ".repeat(8);
  const title = await createCalendarFromKeyboard(page, longPrefix, "2100");
  await openCalendars(page);

  const card = page.getByRole("button", { name: title, exact: false }).first();
  const label = card.locator(".tree-entry__label");
  await expect(label).toBeVisible();
  await expect(card.locator(".calendar-entry__time")).toBeVisible();

  // Ensure the title can truncate without pushing the time off-screen.
  const hasOverflow = await label.evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(hasOverflow).toBe(true);
});

test("moves Today calendar to Done immediately after x", async ({ page }) => {
  const title = await createCalendarFromKeyboard(page, "Today done", "");
  await openCalendars(page);

  const dueCard = page.locator(".inbox-pane").nth(0).getByRole("button", { name: title, exact: false }).first();
  await dueCard.click();
  const doneResponse = page.waitForResponse((response) => response.url().endsWith("/done") && response.request().method() === "POST" && response.ok());
  await page.keyboard.press("x");
  await doneResponse;

  await expect(dueCard).not.toBeVisible();
  await expect(page.locator(".inbox-pane").nth(1).getByRole("button", { name: title, exact: false }).first()).toBeVisible();
});

test("weekly H L t Enter and Space Enter keep separate behavior", async ({ page }) => {
  const title = await createCalendarFromKeyboard(page, "Weekly shortcuts", "");
  await openCalendars(page);
  await page.keyboard.press("]");

  const mondayDate = page.locator(".weekly-column-date").first();
  const initialMonday = await mondayDate.textContent();
  await page.keyboard.press("H");
  await expect(mondayDate).not.toHaveText(initialMonday ?? "");
  await page.keyboard.press("L");
  await expect(mondayDate).toHaveText(initialMonday ?? "");
  await page.keyboard.press("t");

  await page.getByRole("button", { name: title, exact: false }).first().click();
  await page.keyboard.press("Enter");
  await expect(page.locator("input.tree-entry__input")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(page.locator(".list-pane__title", { hasText: "Calendar Detail" })).toBeVisible();
});

async function createCalendarFromKeyboard(page: Page, prefix: string, timeDigits: string): Promise<string> {
  const title = uniqueLabel(prefix);
  await createAndSelectInboxStuff(page, title);
  await page.keyboard.press("p");
  await page.keyboard.press("c");
  await page.keyboard.press("Enter");
  if (timeDigits) await page.keyboard.type(timeDigits);
  const response = page.waitForResponse((response) => response.url().endsWith("/calendar") && response.request().method() === "POST" && response.ok());
  await page.keyboard.press("Enter");
  await response;
  return title;
}
