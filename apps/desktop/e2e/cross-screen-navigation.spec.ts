import { expect, test } from "@playwright/test";

function uniqueTitle(): string {
  return `E2E nav ${Date.now()}`;
}

test("returns to stuff detail zone when navigating back from contexts while editing body", async ({ page }) => {
  const title = uniqueTitle();

  await page.goto("/");
  await page.locator("main").click();

  // Create a stuff
  await page.keyboard.press("a");
  const input = page.locator("input.tree-entry__input");
  await expect(input).toBeVisible();
  await input.fill(title);
  await input.press("Enter");
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
