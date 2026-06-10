import { expect, test, type Locator, type Page } from "@playwright/test";
import { createInboxStuffFromKeyboard, openApp, resetTestData, uniqueLabel } from "./support/app";

async function closeBodyEditor(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-content")).toHaveAttribute("data-vim-mode", "normal");
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-content")).not.toBeVisible();
}

async function startInboxTitleEdit(page: Page, title: string): Promise<Locator> {
  await page.getByRole("button", { name: title }).first().click();
  await page.keyboard.press("Enter");
  const titleInput = page.locator("input.tree-entry__input");
  await expect(titleInput).toBeFocused();
  return titleInput;
}

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("inline title edit saves on escape", async ({ page }) => {
  const title = uniqueLabel("Escape save");
  const editSuffix = " saved";

  await createInboxStuffFromKeyboard(page, title);
  await closeBodyEditor(page);

  const titleInput = await startInboxTitleEdit(page, title);
  await page.keyboard.type(editSuffix);
  await titleInput.press("Escape");

  await expect(page.getByRole("button", { name: `${title}${editSuffix}` })).toBeVisible();
  await expect(titleInput).not.toBeVisible();
});

test("inline title edit keeps draft and shows error when escape save fails", async ({ page }) => {
  const title = uniqueLabel("Escape failure");
  const editSuffix = " broken";

  await page.route("**/items/*/title", (route) => {
    void route.fulfill({ body: "boom", status: 500 });
  });

  await createInboxStuffFromKeyboard(page, title);
  await closeBodyEditor(page);

  const titleInput = await startInboxTitleEdit(page, title);
  await page.keyboard.type(editSuffix);
  await titleInput.press("Escape");

  await expect(titleInput).toBeVisible();
  await expect(titleInput).toHaveValue(`${title}${editSuffix}`);
  await expect(page.getByText("API request failed with status 500")).toBeVisible();
});
