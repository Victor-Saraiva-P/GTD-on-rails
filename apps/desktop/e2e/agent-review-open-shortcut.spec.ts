import { expect, test } from "@playwright/test";
import { createStuffApi, openApp, resetTestData } from "./support/app";

// Local Arch workstations can use system Chromium; CI uses the pinned browser.
test.use({ launchOptions: process.env.GTD_E2E_CHROMIUM ? { executablePath: process.env.GTD_E2E_CHROMIUM } : {} });

test("v opens and reopens the selected pending review without editing the Stuff title", async ({ page, request }) => {
  await resetTestData(request);
  const title = "Plan team offsite";
  const stuff = await createStuffApi(request, title);
  const suggestion = {
    stuffId: stuff.id,
    sourceTitle: title,
    reason: "This requires several steps.",
    questions: [],
    options: [{
      kind: "project", title: "Organize team offsite", body: "Review venues and budgets",
      reason: "Multiple actions", energy: null, minutes: null, contextIds: [],
      deadline: null, scheduledDate: null, scheduledTime: null
    }],
    recommendedIndex: 0
  };
  await page.route("**/src/features/agent-processing/native.ts*", async (route) => {
    const response = await route.fetch();
    const code = await response.text();
    const original = "if (!isTauriRuntime()) return [];";
    expect(code).toContain(original);
    await route.fulfill({ response, body: code.replace(original, `return [${JSON.stringify(suggestion)}];`) });
  });

  await openApp(page);
  const review = page.locator(".agent-review__content");
  await expect(page.getByText("Awaiting your decision · agent suggestion available")).toBeVisible();

  await page.keyboard.press("v");
  await expect(review).toBeVisible();
  await expect(page.getByRole("heading", { name: "Title preview" })).toContainText("Organize team offsite");
  await expect(page.locator(".tree-entry__edit")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(review).toHaveCount(0);
  await page.keyboard.press("v");
  await expect(review).toBeVisible();
  await expect(page.locator(".tree-entry__edit")).toHaveCount(0);
});
