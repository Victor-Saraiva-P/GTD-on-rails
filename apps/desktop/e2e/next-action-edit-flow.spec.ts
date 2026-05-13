import { expect, test, type APIRequestContext } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:18080";

type CreatedResource = {
  id: string;
};

function uniqueLabel(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}

async function createContext(request: APIRequestContext, name: string): Promise<CreatedResource> {
  const response = await request.post(`${apiBaseUrl}/contexts`, { data: { name } });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<CreatedResource>;
}

async function createStuff(request: APIRequestContext, title: string): Promise<CreatedResource> {
  const response = await request.post(`${apiBaseUrl}/inbox`, { data: { title } });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<CreatedResource>;
}

async function convertStuffToNextAction(request: APIRequestContext, stuffId: string): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/inbox/${stuffId}/next-action`, {
    data: { contextIds: [], energy: 1.0, estimatedTime: { hours: 0, minutes: 5 } }
  });
  expect(response.ok()).toBeTruthy();
}

async function resetTestData(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/test/reset`);
  expect(response.ok()).toBeTruthy();
}

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await page.goto("/");
  await page.locator("main").click();
});

test("edits selected next action contexts with keyboard flow", async ({ page, request }) => {
  const title = uniqueLabel("Next action edit");
  const firstContext = uniqueLabel("A edit context");
  const secondContext = uniqueLabel("B edit context");
  const stuff = await createStuff(request, title);
  await createContext(request, firstContext);
  await createContext(request, secondContext);
  await convertStuffToNextAction(request, stuff.id);

  await page.reload();
  await page.locator("main").click();
  await page.keyboard.press(" ");
  await page.keyboard.press("n");
  await expect(page.getByRole("button", { name: title })).toBeVisible();
  await page.keyboard.press("e");

  const dialog = page.getByRole("dialog", { name: "Edit next action" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Context");
  await page.keyboard.press("c");
  await expect(dialog.getByText(firstContext)).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("j");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(dialog).not.toBeVisible();
  await expect(page.locator("input.tree-entry__input")).not.toBeVisible();
  await expect(page.getByText(firstContext)).toBeVisible();
  await expect(page.getByText(secondContext)).toBeVisible();
});
