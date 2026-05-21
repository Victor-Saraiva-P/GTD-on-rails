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
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dateInput = page.getByLabel("Scheduled date");
  await expect(dateInput).toBeVisible();
  await dateInput.fill(today);
  await dateInput.press("Enter");

  // Time step
  await expect(page.getByText("Scheduled time (optional)")).toBeVisible();
  // Ensure we wait a tiny bit for React to focus the time input
  await page.waitForTimeout(1000);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("button", { name: title, exact: false }).first()).not.toBeVisible();

  // 3. Verify it appears under Space c t (Calendars page)
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("c");
  await expect(page.locator(".leader-menu__title")).toHaveText("Space c");
  await page.keyboard.press("t");

  // By default, it opens Today subview
  await expect(page.getByText("Due / Late").first()).toBeVisible();

  // Verify it appears in Today panel (1) (due/late)
  const panel1 = page.locator(".inbox-pane").nth(0);
  await expect(panel1.getByRole("button", { name: title, exact: false }).first()).toBeVisible();

  // Focus item and mark ongoing
  await page.keyboard.press("1");
  await expect(panel1).toHaveClass(/list-pane--active/);
  await page.keyboard.press("j");
  await page.keyboard.press("o");
  await expect(panel1.getByRole("button", { name: title, exact: false }).first()).not.toBeVisible();

  // 4. Verify in On Going page
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("o");
  await expect(page.locator(".list-pane__title", { hasText: "On Going" }).first()).toBeVisible();

  const ongoingPanel2 = page.locator(".inbox-pane").nth(1);
  await expect(ongoingPanel2.getByRole("button", { name: title, exact: false }).first()).toBeVisible();

  // 5. Mark done and verify in Today panel (2)
  await page.keyboard.press("2");
  await expect(ongoingPanel2).toHaveClass(/list-pane--active/);
  await page.keyboard.press("x");

  await expect(ongoingPanel2.getByRole("button", { name: title, exact: false }).first()).not.toBeVisible();

  // Go back to Calendars Today
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("c");
  await expect(page.locator(".leader-menu__title")).toHaveText("Space c");
  await page.keyboard.press("t");

  const todayPanel2 = page.locator(".inbox-pane").nth(1);
  await expect(todayPanel2.getByRole("button", { name: title, exact: false }).first()).toBeVisible();

  // 6. Verify Completed and Deleted subviews
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("c");
  await expect(page.locator(".leader-menu__title")).toHaveText("Space c");
  await page.keyboard.press("c");
  
  await expect(page.locator(".inbox-pane").nth(0).getByRole("button", { name: title, exact: false }).first()).toBeVisible();

  // Delete the item
  await page.keyboard.press("1");
  await expect(page.locator(".inbox-pane").nth(0)).toHaveClass(/list-pane--active/);
  await page.keyboard.press("d");

  await expect(page.locator(".inbox-pane").nth(0).getByRole("button", { name: title, exact: false }).first()).not.toBeVisible();

  // Verify in deleted
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("c");
  await expect(page.locator(".leader-menu__title")).toHaveText("Space c");
  await page.keyboard.press("d");
  await expect(page.locator(".inbox-pane").nth(0).getByRole("button", { name: title, exact: false }).first()).toBeVisible();
});

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
