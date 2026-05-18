import { expect, test, type Page } from "@playwright/test";
import { createContextApi, createInboxStuffFromKeyboard, openApp, resetTestData, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("p opens processing command page for focused inbox stuff", async ({ page }) => {
  const title = uniqueLabel("Processing flow");
  await createStuff(page, title);

  await page.keyboard.press("p");

  const dialog = page.getByRole("dialog", { name: "Processing" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Processing");
  await expect(dialog).toContainText("n");
  await expect(dialog).toContainText("Next actions");

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("selects multiple next action contexts with keyboard", async ({ page, request }) => {
  const title = uniqueLabel("Processing flow");
  const firstContext = `A processing ${Date.now()}`;
  const secondContext = `B processing ${Date.now()}`;
  await createContextApi(request, firstContext);
  await createContextApi(request, secondContext);
  await createStuff(page, title);

  await page.keyboard.press("p");
  await page.keyboard.press("n");

  const dialog = page.getByRole("dialog", { name: "Processing" });
  await expect(dialog.getByText(firstContext)).toBeVisible();
  await expect(dialog.getByText(secondContext)).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("j");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(dialog.getByText("Energy level")).toBeVisible();
});

async function createStuff(page: Page, title: string): Promise<void> {
  await page.keyboard.press("h");
  await createInboxStuffFromKeyboard(page, title);
  await page.locator("main").click();
  await expect(page.getByRole("button", { name: title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Editing mode")).toContainText("NORMAL");
  await page.keyboard.down("Control");
  await page.keyboard.press("h");
  await page.keyboard.up("Control");
  await expect(page.locator(".cm-content")).not.toBeVisible();
  await page.getByRole("button", { name: title }).click();
}
