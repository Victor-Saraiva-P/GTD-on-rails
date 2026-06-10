import { expect, type Locator, type Page } from "@playwright/test";

export async function closeBodyEditor(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-content")).toHaveAttribute("data-vim-mode", "normal");
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-content")).not.toBeVisible();
}

export async function startInboxTitleEdit(page: Page, title: string): Promise<Locator> {
  await page.getByRole("button", { name: title }).first().click();
  await page.keyboard.press("Enter");
  const titleInput = page.locator("input.tree-entry__input");
  await expect(titleInput).toBeFocused();
  return titleInput;
}
