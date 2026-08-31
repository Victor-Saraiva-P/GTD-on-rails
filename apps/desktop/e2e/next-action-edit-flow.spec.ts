import { expect, test, type Page } from "@playwright/test";
import { createContextApi, createAndSelectInboxStuff, openApp, resetTestData, todayDisplayValue, todayIsoValue, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("edits selected next action contexts with keyboard flow", async ({ page, request }) => {
  const title = uniqueLabel("Next action edit");
  const firstContext = uniqueLabel("A edit context");
  const secondContext = uniqueLabel("B edit context");
  await createContextApi(request, firstContext);
  await createContextApi(request, secondContext);
  await createNextActionFromKeyboard(page, title);

  await openSelectedNextActionEditDialog(page, title);

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

test("edits selected next action deadline with segmented keyboard flow", async ({ page }) => {
  const title = uniqueLabel("Next action deadline");
  await createNextActionFromKeyboard(page, title);

  await openSelectedNextActionEditDialog(page, title);

  const dialog = page.getByRole("dialog", { name: "Edit next action" });
  await page.keyboard.press("d");
  const dateControl = dialog.getByRole("textbox", { name: "Deadline:" });
  await expect(dateControl).toHaveText("__/__/____");
  const deadlineRequestPromise = page.waitForRequest((request) => request.url().includes("/next-actions/") && request.method() === "PATCH");
  await page.keyboard.type("29022028");
  await page.keyboard.press("Enter");

  const deadlineRequest = await deadlineRequestPromise;
  expect(deadlineRequest.postDataJSON()).toEqual({ deadline: "2028-02-29" });
  await expect(dialog).not.toBeVisible();
});

test("sets selected next action deadline to today with keyboard flow", async ({ page }) => {
  const title = uniqueLabel("Next action today deadline");
  await createNextActionFromKeyboard(page, title);

  await openSelectedNextActionEditDialog(page, title);

  const dialog = page.getByRole("dialog", { name: "Edit next action" });
  await page.keyboard.press("d");
  const dateControl = dialog.getByRole("textbox", { name: "Deadline:" });
  await page.keyboard.type("29022028");
  await page.keyboard.press("t");
  await expect(dateControl).toHaveText(todayDisplayValue());
  await expect(dialog.getByText("Energy")).not.toBeVisible();

  const deadlineRequestPromise = page.waitForRequest((request) => request.url().includes("/next-actions/") && request.method() === "PATCH");
  await page.keyboard.press("Enter");

  const deadlineRequest = await deadlineRequestPromise;
  expect(deadlineRequest.postDataJSON()).toEqual({ deadline: todayIsoValue() });
  await expect(dialog).not.toBeVisible();
});

async function createNextActionFromKeyboard(page: Page, title: string): Promise<void> {
  await page.keyboard.press(" ");
  await page.keyboard.press("i");
  await createAndSelectInboxStuff(page, title);
  await page.keyboard.press("p");
  await page.keyboard.press("n");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  const response = page.waitForResponse((response) => response.url().endsWith("/next-action") && response.request().method() === "POST" && response.ok());
  await page.keyboard.press("Enter");
  await response;
}

async function openNextActions(page: Page): Promise<void> {
  await page.keyboard.press(" ");
  await page.keyboard.press("n");
  await expect(page.locator(".list-pane__title", { hasText: "Next Actions" }).first()).toBeVisible();
}

async function selectNextAction(page: Page, title: string): Promise<void> {
  const nextAction = page.getByRole("button", { name: title }).first();
  await expect(nextAction).toBeVisible();
  await nextAction.click();
}

async function openSelectedNextActionEditDialog(page: Page, title: string): Promise<void> {
  await openNextActions(page);
  await selectNextAction(page, title);
  await page.keyboard.press("Shift+E");
}
