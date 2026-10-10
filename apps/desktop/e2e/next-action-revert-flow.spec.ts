import { expect, test, type Page } from "@playwright/test";
import {
  createAndSelectInboxStuff,
  openApp,
  resetTestData,
  uniqueLabel
} from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("processes stuff into next action, navigates via Space n, and reverts to inbox with R", async ({ page }) => {
  const title = uniqueLabel("Prepare presentation slides");
  await createNextActionFromKeyboard(page, title);
  await openNextActions(page);

  const nextActionItem = page.getByRole("button", { name: title, exact: false }).first();
  await expect(nextActionItem).toBeVisible();

  const revertResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/next-actions/") && response.url().endsWith("/stuff") && response.request().method() === "POST" && response.ok()
  );
  await page.keyboard.press("Shift+R");
  await revertResponsePromise;

  await expect(page.getByText("No next actions for this filter.")).toBeVisible();

  await navigateToInbox(page);
  const inboxItem = page.locator(".inbox-pane--list").getByRole("button", { name: title, exact: false }).first();
  await expect(inboxItem).toBeVisible();
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
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith("/next-action") &&
      response.request().method() === "POST" &&
      response.ok()
  );
  await page.keyboard.press("Enter");
  await response;
}

async function openNextActions(page: Page): Promise<void> {
  await page.keyboard.press(" ");
  await page.keyboard.press("n");
  await expect(
    page.locator(".list-pane__title", { hasText: "Next Actions" }).first()
  ).toBeVisible();
}

async function navigateToInbox(page: Page): Promise<void> {
  await page.keyboard.press(" ");
  await page.keyboard.press("i");
  await expect(page.locator(".leader-menu")).not.toBeVisible();
}
