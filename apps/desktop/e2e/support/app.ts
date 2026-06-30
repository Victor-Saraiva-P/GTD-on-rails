import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const apiBaseUrl = "http://127.0.0.1:18080";

export type CreatedResource = {
  id: string;
};

export function uniqueLabel(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}

export function todayDisplayValue(): string {
  const today = new Date();
  return `${datePart(today.getDate(), 2)}/${datePart(today.getMonth() + 1, 2)}/${datePart(today.getFullYear(), 4)}`;
}

export function todayIsoValue(): string {
  const today = new Date();
  return `${datePart(today.getFullYear(), 4)}-${datePart(today.getMonth() + 1, 2)}-${datePart(today.getDate(), 2)}`;
}

function datePart(value: number, width: number): string {
  return value.toString().padStart(width, "0");
}

export async function focusApp(page: Page): Promise<void> {
  await page.locator("main").click();
}

export async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  await focusApp(page);
}

export async function resetTestData(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/test/reset`);
  expect(response.ok()).toBeTruthy();
}

export async function createContextApi(request: APIRequestContext, name: string): Promise<CreatedResource> {
  const response = await request.post(`${apiBaseUrl}/contexts`, { data: { name } });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<CreatedResource>;
}

export async function createStuffApi(request: APIRequestContext, title: string): Promise<CreatedResource> {
  const response = await request.post(`${apiBaseUrl}/inbox`, { data: { title } });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<CreatedResource>;
}

export async function convertStuffToNextActionApi(request: APIRequestContext, stuffId: string, contextIds: string[] = [], energy = 1): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/inbox/${stuffId}/next-action`, {
    data: { contextIds, energy, estimatedTime: { hours: 0, minutes: 5 } }
  });
  expect(response.ok()).toBeTruthy();
}

export async function convertStuffToProjectApi(request: APIRequestContext, stuffId: string, deadline: string | null = null): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/inbox/${stuffId}/project`, { data: { deadline } });
  expect(response.ok()).toBeTruthy();
}

export async function createInboxStuffFromKeyboard(page: Page, title: string): Promise<void> {
  await focusApp(page);
  await page.keyboard.press("a");
  const input = page.locator("input.tree-entry__input");
  await expect(input).toBeVisible();
  await input.fill(title);
  await input.press("Enter");
}

export async function createAndSelectInboxStuff(page: Page, title: string): Promise<void> {
  await page.keyboard.press("h");
  await createInboxStuffFromKeyboard(page, title);
  await page.locator("main").click();
  const inboxItem = page.getByRole("button", { name: title, exact: false }).first();
  await expect(inboxItem).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Editing mode")).toContainText("NORMAL");
  await page.keyboard.down("Control");
  await page.keyboard.press("h");
  await page.keyboard.up("Control");
  await expect(page.locator(".cm-content")).not.toBeVisible();
  await inboxItem.click();
}

export async function openCalendars(page: Page): Promise<void> {
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("c");
  await expect(page.locator(".leader-menu")).not.toBeVisible();
  await expect(page.locator(".inbox-pane .list-pane__title").nth(0)).toHaveText("Calendar");
}

export async function focusPanelAndSelectItem(page: Page, panelIndex: number, title: string) {
  const panel = page.locator(".inbox-pane").nth(panelIndex);
  const item = panel.getByRole("button", { name: title, exact: false }).first();
  await expect(item).toBeVisible();

  await page.keyboard.press((panelIndex + 1).toString());
  await expect(panel).toHaveClass(/list-pane--active/);
  await item.click();

  return { panel, item };
}

export async function processIntoCalendar(page: Page) {
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
