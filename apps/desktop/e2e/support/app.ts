import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const apiBaseUrl = "http://127.0.0.1:18080";

export type CreatedResource = {
  id: string;
};

export function uniqueLabel(prefix: string): string {
  return `${prefix} ${Date.now()}`;
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

export async function convertStuffToNextActionApi(request: APIRequestContext, stuffId: string): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/inbox/${stuffId}/next-action`, {
    data: { contextIds: [], energy: 1.0, estimatedTime: { hours: 0, minutes: 5 } }
  });
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
