import { expect, test } from "@playwright/test";
import { createStuffApi, openApp, resetTestData, uniqueLabel } from "./support/app";

test.beforeEach(async ({ request }) => {
  await resetTestData(request);
});

test("processes stuff into someday/maybe, navigates via Space s, and reverts to inbox with i", async ({ page, request }) => {
  const title = uniqueLabel("Learn Piano");
  await createStuffApi(request, title);
  await openApp(page);

  const inboxItem = page.getByRole("button", { name: title, exact: false });
  await expect(inboxItem).toBeVisible();

  // Open processing dialog
  await page.keyboard.press("p");
  const dialog = page.getByRole("dialog", { name: "Processing" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Someday/Maybe");

  // Press 's' to convert to Someday/Maybe
  const somedayMaybeResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/someday-maybe") && response.request().method() === "POST" && response.ok()
  );
  await page.keyboard.press("s");
  await somedayMaybeResponsePromise;
  await expect(dialog).not.toBeVisible();

  // Item should no longer be in inbox
  await expect(page.getByRole("button", { name: title, exact: false })).not.toBeVisible();

  // Navigate to Someday/Maybe with Space s
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("s");
  await expect(page.locator(".leader-menu")).not.toBeVisible();

  // Verify Someday/Maybe page loaded with the item
  await expect(page.locator(".list-pane__title").first()).toHaveText("Someday/Maybe");
  const somedayItem = page.getByRole("button", { name: title, exact: false });
  await expect(somedayItem).toBeVisible();

  // Revert back to inbox with 'i'
  const revertResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/stuff") && response.request().method() === "POST" && response.ok()
  );
  await page.keyboard.press("i");
  await revertResponsePromise;
  await expect(page.getByText("No someday/maybe items.")).toBeVisible();

  // Navigate back to inbox with Space i
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("i");
  await expect(page.locator(".leader-menu")).not.toBeVisible();

  // Verify item is back in inbox
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();
});

test("deletes someday/maybe item, switches to deleted subview with ], and restores it with r", async ({ page, request }) => {
  const title = uniqueLabel("Learn Archery");
  await createStuffApi(request, title);
  await openApp(page);

  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();

  // Convert to Someday/Maybe
  await page.keyboard.press("p");
  const somedayMaybeResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/someday-maybe") && response.request().method() === "POST" && response.ok()
  );
  await page.keyboard.press("s");
  await somedayMaybeResponsePromise;

  // Navigate to Someday/Maybe
  await page.keyboard.press("Space");
  await page.keyboard.press("s");
  await expect(page.locator(".list-pane__title").first()).toHaveText("Someday/Maybe");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();

  // Delete item with 'd'
  const deleteResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/items/") && response.request().method() === "DELETE" && response.ok()
  );
  await page.keyboard.press("d");
  await deleteResponsePromise;
  await expect(page.getByText("No someday/maybe items.")).toBeVisible();

  // Switch to deleted subview with ']'
  await page.keyboard.press("]");
  await expect(page.locator(".list-pane__title").first()).toHaveText("Deleted Someday/Maybe");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();

  // Recover item with 'r'
  const restoreResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/restore") && response.request().method() === "POST" && response.ok()
  );
  await page.keyboard.press("r");
  await restoreResponsePromise;
  await expect(page.getByText("No deleted someday/maybe items.")).toBeVisible();

  // Switch back to active subview with '['
  await page.keyboard.press("[");
  await expect(page.locator(".list-pane__title").first()).toHaveText("Someday/Maybe");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();
});
