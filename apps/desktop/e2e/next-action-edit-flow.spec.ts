import { expect, test } from "@playwright/test";
import { convertStuffToNextActionApi, createContextApi, createStuffApi, openApp, resetTestData, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("edits selected next action contexts with keyboard flow", async ({ page, request }) => {
  const title = uniqueLabel("Next action edit");
  const firstContext = uniqueLabel("A edit context");
  const secondContext = uniqueLabel("B edit context");
  const stuff = await createStuffApi(request, title);
  await createContextApi(request, firstContext);
  await createContextApi(request, secondContext);
  await convertStuffToNextActionApi(request, stuff.id);

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
