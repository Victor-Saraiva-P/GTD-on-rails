import { expect, test } from "@playwright/test";
import { createInboxStuffFromKeyboard, openApp, uniqueLabel } from "./support/app";

test("direct global keybinds do not override vim normal mode keys", async ({ page }) => {
  const title = uniqueLabel("Vim normal keys");
  await openApp(page);

  await createInboxStuffFromKeyboard(page, title);
  await expect(page.getByRole("button", { name: title })).toBeVisible();

  // Open edit body
  await page.keyboard.press("l");
  await expect(page.locator(".cm-content")).toBeVisible();

  // In CodeMirror 6 Vim, we start in normal mode.
  // Press 'i' to enter insert mode
  await page.keyboard.press("i");
  await page.keyboard.type("hello world");
  
  // Press Escape to return to normal mode
  await page.keyboard.press("Escape");

  // Press 'h' which globally focuses the inbox list, but in Vim it should move cursor left
  await page.keyboard.press("h");

  // Verify we are still in the stuff detail pane
  const listPane = page.locator(".inbox-pane--list");
  const detailPane = page.locator(".inbox-pane--detail");
  await expect(detailPane).toHaveClass(/list-pane--active/);
  await expect(listPane).not.toHaveClass(/list-pane--active/);

  // Press 'd' then 'd' to delete the line in vim. 
  // Globally 'd' deletes the stuff. We want to ensure it DOES NOT delete the stuff.
  await page.keyboard.press("d");
  await page.keyboard.press("d");

  // Verify the stuff is still in the list
  await expect(page.getByRole("button", { name: title })).toBeVisible();
});
