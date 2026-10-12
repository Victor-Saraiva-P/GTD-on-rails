import { expect, test } from "@playwright/test";
import { openApp, resetTestData } from "./support/app";

const checkInPlaceholder = "Describe how you're feeling and how much time you have...";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
  await page.keyboard.press(" ");
  await page.keyboard.press("n");
  await expect(page.locator(".list-pane__title", { hasText: "Next Actions" }).first()).toBeVisible();
});

test("keeps the availability check-in panel visible on Next Actions and focuses it from a", async ({ page }) => {
  const panel = page.locator('aside[aria-label="Availability check-in"]');
  const input = panel.getByPlaceholder(checkInPlaceholder);

  await expect(panel).toBeVisible();
  await page.locator("main").click();
  await page.keyboard.press("a");
  await expect(input).toBeFocused();
});

test("hides the panel outside Next Actions but restores its draft when returning", async ({ page }) => {
  const panel = page.locator('aside[aria-label="Availability check-in"]');
  const input = panel.getByPlaceholder(checkInPlaceholder);
  await input.fill("Tired after lunch, with about 40 minutes available.");
  await page.locator("main").click();

  await page.keyboard.press(" ");
  await page.keyboard.press("p");

  await expect(page.locator(".list-pane__title").first()).toHaveText("Projects");
  await expect(panel).toHaveCount(0);

  await page.keyboard.press(" ");
  await page.keyboard.press("n");

  await expect(page.locator(".list-pane__title", { hasText: "Next Actions" }).first()).toBeVisible();
  await expect(panel).toBeVisible();
  await expect(panel.getByPlaceholder(checkInPlaceholder)).toHaveValue("Tired after lunch, with about 40 minutes available.");
});

test("continues agent interpretation while navigating away from Next Actions", async ({ page }) => {
  await page.evaluate(() => {
    let resolveAvailability: ((value: unknown) => void) | null = null;
    const pendingAvailability = new Promise((resolve) => { resolveAvailability = resolve; });
    Object.assign(window, {
      __resolveAvailability: resolveAvailability,
      __TAURI_INTERNALS__: {
        invoke: (command: string) => {
          if (command !== "interpret_current_availability") return Promise.reject(new Error(`Unexpected native command: ${command}`));
          return pendingAvailability;
        }
      }
    });
  });

  const panel = page.locator('aside[aria-label="Availability check-in"]');
  await panel.getByPlaceholder(checkInPlaceholder).fill("Tired after lunch, with about 40 minutes available.");
  await panel.getByRole("button", { name: "Interpret my situation" }).click();
  await expect(panel).toContainText("Agent is interpreting your current energy and usable time");

  await page.keyboard.press(" ");
  await page.keyboard.press("p");

  await expect(page.locator(".list-pane__title").first()).toHaveText("Projects");
  await expect(panel).toHaveCount(0);

  await page.evaluate(() => {
    const resolver = (window as Window & typeof globalThis & { __resolveAvailability?: (value: unknown) => void }).__resolveAvailability;
    resolver?.({ energy: 3.5, timeMinutes: 40, rationale: "Low energy with a short usable window." });
  });

  await page.keyboard.press(" ");
  await page.keyboard.press("n");

  await expect(page.locator(".list-pane__title", { hasText: "Next Actions" }).first()).toBeVisible();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("3.5 / 10");
  await expect(panel).toContainText("40 min");
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
