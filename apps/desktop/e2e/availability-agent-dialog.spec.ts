import { expect, test } from "@playwright/test";
import { openApp, resetTestData } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
  await page.keyboard.press(" ");
  await page.keyboard.press("n");
  await expect(page.locator(".list-pane__title", { hasText: "Next Actions" }).first()).toBeVisible();
});

test("opens availability check-in from a without a persistent on-screen trigger", async ({ page }) => {
  await expect(page.getByRole("button", { name: /check in/i })).toHaveCount(0);

  await page.keyboard.press("a");

  const dialog = page.getByRole("dialog", { name: "Availability check-in" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder("Describe how you're feeling and how much time you have...")).toBeFocused();
  await expect(page.getByRole("button", { name: /check in/i })).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("restores machine-local energy and time after reopening the app", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("gtd.current-availability.v1", JSON.stringify({ currentEnergy: 4.5, currentTimeMinutes: 75 }));
  });

  await openApp(page);
  await page.keyboard.press(" ");
  await page.keyboard.press("n");

  await expect(page.locator(".next-actions-footer-label")).toContainText("Availability: 75 min / 4.5");
});
