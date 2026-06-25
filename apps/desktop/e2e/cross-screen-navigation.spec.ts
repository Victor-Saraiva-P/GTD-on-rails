import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { apiBaseUrl, convertStuffToNextActionApi, createInboxStuffFromKeyboard, createStuffApi, openApp, resetTestData, todayIsoValue, uniqueLabel } from "./support/app";

test("returns to stuff detail zone when navigating back from contexts while editing body", async ({ page }) => {
  const title = uniqueLabel("E2E nav");
  await openApp(page);

  await createInboxStuffFromKeyboard(page, title);
  await expect(page.getByRole("button", { name: title })).toBeVisible();

  // Open edit body
  await page.keyboard.press("l");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-content")).toBeVisible();

  // Navigate to contexts
  await page.keyboard.press(" ");
  await page.keyboard.press("C");
  
  // Wait for contexts page to be visible
  await expect(page.getByText("No contexts yet.").or(page.locator(".contexts-pane").first())).toBeVisible();

  // Navigate back to inbox
  await page.keyboard.press(" ");
  await page.keyboard.press("i");

  // Wait for inbox page to be visible
  await expect(page.getByRole("button", { name: title })).toBeVisible();

  // Verify that the detail pane is active, not the list pane
  const listPane = page.locator(".inbox-pane--list");
  const detailPane = page.locator(".inbox-pane--detail");

  await expect(listPane).toHaveClass(/list-pane--active/);
  await expect(detailPane).not.toHaveClass(/list-pane--active/);

  // The editor should be closed now since it was reset
  await expect(page.locator(".cm-content")).not.toBeVisible();
});

test("Space n from on going detail returns to next actions list focus", async ({ page, request }) => {
  const promotedTitle = uniqueLabel("Promoted next action");
  const remainingTitle = uniqueLabel("Remaining next action");
  await resetTestData(request);
  await createNextActionApi(request, promotedTitle);
  await createNextActionApi(request, remainingTitle);
  await openApp(page);
  await openNextActions(page);
  await page.getByRole("button", { name: promotedTitle, exact: false }).first().click();

  await page.keyboard.press("o");
  await expect(page.locator(".list-pane__title", { hasText: "On Going Detail" })).toBeVisible();
  await openNextActions(page);

  await expect(page.locator(".inbox-pane--list")).toHaveClass(/list-pane--active/);
  await expect(page.locator(".inbox-pane--detail")).not.toHaveClass(/list-pane--active/);
  await expect(page.getByRole("button", { name: remainingTitle, exact: false }).first()).toBeVisible();
});

test("Space n after leaving next action detail returns to list mode", async ({ page, request }) => {
  const editedTitle = uniqueLabel("Edited detail next action");
  const ongoingTitle = uniqueLabel("Existing ongoing action");
  await resetTestData(request);
  await createNextActionApi(request, editedTitle);
  await createOnGoingNextActionApi(request, ongoingTitle);
  await openApp(page);
  await openNextActions(page);
  await page.getByRole("button", { name: editedTitle, exact: false }).first().click();
  await openFocusedDetail(page, "Next Action Detail");

  await openOnGoing(page);
  await openNextActions(page);

  await expect(page.locator(".inbox-pane--list")).toHaveClass(/list-pane--active/);
  await expect(page.locator(".cm-content")).not.toBeVisible();
});

test("Space o from on going detail returns to on going list mode", async ({ page, request }) => {
  const title = uniqueLabel("Edited ongoing action");
  await resetTestData(request);
  await createOnGoingNextActionApi(request, title);
  await openApp(page);
  await openOnGoing(page);
  await page.getByRole("button", { name: title, exact: false }).first().click();
  await openFocusedDetail(page, "On Going Detail");

  await openOnGoing(page);

  await expect(page.locator(".list-pane__title", { hasText: "On Going" }).first()).toBeVisible();
  await expect(page.locator(".inbox-pane").nth(0)).toHaveClass(/list-pane--active/);
  await expect(page.locator(".cm-content")).not.toBeVisible();
});



async function createNextActionApi(request: APIRequestContext, title: string): Promise<string> {
  const stuff = await createStuffApi(request, title);
  await convertStuffToNextActionApi(request, stuff.id);
  return stuff.id;
}

async function createOnGoingNextActionApi(request: APIRequestContext, title: string): Promise<void> {
  const id = await createNextActionApi(request, title);
  const response = await request.post(`${apiBaseUrl}/next-actions/${id}/ongoing`);
  expect(response.ok()).toBeTruthy();
}

async function createOnGoingCalendarApi(request: APIRequestContext, title: string): Promise<void> {
  const stuff = await createStuffApi(request, title);
  const created = await request.post(`${apiBaseUrl}/inbox/${stuff.id}/calendar`, { data: { scheduledDate: todayIsoValue() } });
  expect(created.ok()).toBeTruthy();
  const ongoing = await request.post(`${apiBaseUrl}/calendars/${stuff.id}/ongoing`);
  expect(ongoing.ok()).toBeTruthy();
}

async function openNextActions(page: Page): Promise<void> {
  await page.keyboard.press("Space");
  await page.keyboard.press("n");
}

async function openOnGoing(page: Page): Promise<void> {
  await page.keyboard.press("Space");
  await page.keyboard.press("o");
}

async function openFocusedDetail(page: Page, title: string): Promise<void> {
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(page.locator(".list-pane__title", { hasText: title })).toBeVisible();
  await expect(page.locator(".cm-content")).toBeVisible();
}
