import { expect, test, type Page } from "@playwright/test";
import { createStuffApi, openApp, resetTestData, uniqueLabel } from "./support/app";

async function createInboxMotionItems(request: Parameters<typeof createStuffApi>[0]) {
  const label = uniqueLabel("Inbox motion");
  const titles = [`${label} first`, `${label} middle`, `${label} last`];

  for (const title of titles) {
    await createStuffApi(request, title);
  }

  return titles;
}

function inboxItems(page: Page) {
  return page.locator(".tree-list--inbox .tree-entry");
}

test("gg selects the first inbox item", async ({ page, request }) => {
  await resetTestData(request);
  await createInboxMotionItems(request);
  await openApp(page);

  await expect(inboxItems(page)).toHaveCount(3);
  await inboxItems(page).nth(1).click();
  await expect(inboxItems(page).nth(1)).toHaveClass(/tree-entry--active/);
  await page.keyboard.press("g");
  await page.keyboard.press("g");

  await expect(inboxItems(page).first()).toHaveClass(/tree-entry--active/);
});

test("G selects the last inbox item", async ({ page, request }) => {
  await resetTestData(request);
  await createInboxMotionItems(request);
  await openApp(page);

  await expect(inboxItems(page)).toHaveCount(3);
  await inboxItems(page).nth(1).click();
  await expect(inboxItems(page).nth(1)).toHaveClass(/tree-entry--active/);
  await page.keyboard.press("G");

  await expect(inboxItems(page).last()).toHaveClass(/tree-entry--active/);
});
