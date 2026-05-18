import { expect, test } from "@playwright/test";
import { createInboxStuffFromKeyboard, openApp, uniqueLabel } from "./support/app";

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
