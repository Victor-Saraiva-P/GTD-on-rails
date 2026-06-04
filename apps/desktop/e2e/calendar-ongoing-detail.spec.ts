import { expect, test } from "@playwright/test";
import { createAndSelectInboxStuff, focusPanelAndSelectItem, openApp, processIntoCalendar, resetTestData, uniqueLabel } from "./support/app";

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
  await page.keyboard.press("Escape");
  await page.keyboard.down("Control");
  await page.keyboard.press("h");
  await page.keyboard.up("Control");

  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");

  await expect(page.locator(".list-pane__title", { hasText: "On Going Calendar Detail" })).toBeVisible();
  await expect(page.getByText(title).first()).toBeVisible();
});
