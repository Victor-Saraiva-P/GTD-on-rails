import { expect, test, type Page } from "@playwright/test";
import { createStuffApi, openApp, resetTestData, uniqueLabel } from "./support/app";

async function seedSearchItems(request: Parameters<typeof createStuffApi>[0]) {
  const prefix = uniqueLabel("SearchTest");
  const titles = [
    `${prefix} Alpha item first`,
    `${prefix} Beta item middle`,
    `${prefix} Alpha item second`
  ];

  for (const title of titles) {
    await createStuffApi(request, title);
  }

  return { prefix, titles };
}

function inboxItems(page: Page) {
  return page.locator(".tree-list--inbox .tree-entry");
}

test("list title search flow: opens with slash, navigates with n/N, focuses with Enter, exits with Escape", async ({ page, request }) => {
  await resetTestData(request);
  const { prefix } = await seedSearchItems(request);
  await openApp(page);

  await expect(inboxItems(page)).toHaveCount(3);

  // Press / to open title search
  await page.keyboard.press("/");
  const searchBar = page.locator(".list-title-search-bar");
  await expect(searchBar).toBeVisible();

  const searchInput = page.locator(".list-title-search__input");
  await expect(searchInput).toBeFocused();

  // Type search query
  await page.keyboard.type("Alpha");
  await expect(page.locator(".list-title-search__count")).toHaveText("[1/2]");

  // First matching item is highlighted and active
  const firstItem = inboxItems(page).first();
  await expect(firstItem).toHaveClass(/tree-entry--active/);
  await expect(firstItem.locator(".title-search-badge")).toHaveText("[1/2]");
  await expect(firstItem.locator(".title-search-match--active")).toBeVisible();

  // Press Enter to move focus to the list
  await page.keyboard.press("Enter");
  await expect(searchInput).not.toBeFocused();

  // Press n to jump to next match
  await page.keyboard.press("n");
  const thirdItem = inboxItems(page).nth(2);
  await expect(thirdItem).toHaveClass(/tree-entry--active/);
  await expect(thirdItem.locator(".title-search-badge")).toHaveText("[2/2]");
  await expect(page.locator(".list-title-search__count")).toHaveText("[2/2]");

  // Press n again to wrap around to first match
  await page.keyboard.press("n");
  await expect(firstItem).toHaveClass(/tree-entry--active/);
  await expect(firstItem.locator(".title-search-badge")).toHaveText("[1/2]");

  // Press N to move backward to second match
  await page.keyboard.press("N");
  await expect(thirdItem).toHaveClass(/tree-entry--active/);
  await expect(thirdItem.locator(".title-search-badge")).toHaveText("[2/2]");

  // Press Escape to exit search mode
  await page.keyboard.press("Escape");
  await expect(searchBar).not.toBeVisible();
  await expect(page.locator(".title-search-badge")).toHaveCount(0);
  await expect(page.locator(".title-search-match")).toHaveCount(0);
});
