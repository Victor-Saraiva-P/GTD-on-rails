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

test("Space h opens hint mode and Escape exits it", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("h");
  await expect(page.locator(".leader-menu")).not.toBeVisible();
  await expect(page.locator(".gtd-hint-overlay")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".gtd-hint-overlay")).not.toBeVisible();
});

test("Hint mode isolates keys and restores full keyboard navigation on target selection", async ({ page }) => {
  const item1 = uniqueLabel("Hint target 1");
  const item2 = uniqueLabel("Hint target 2");
  await openApp(page);
  await createInboxStuffFromKeyboard(page, item1);
  await createInboxStuffFromKeyboard(page, item2);

  // Open hint mode
  await page.keyboard.press("Space");
  await page.keyboard.press("h");
  await expect(page.locator(".gtd-hint-overlay")).toBeVisible();

  // Find badge for item1
  const badgeText = await page.evaluate((targetText) => {
    const buttons = Array.from(document.querySelectorAll("button.tree-entry"));
    const idx = buttons.findIndex((b) => b.textContent?.includes(targetText));
    if (idx === -1) return null;
    const badges = Array.from(document.querySelectorAll(".gtd-hint-badge"));
    return badges[idx]?.textContent ?? null;
  }, item1);

  expect(badgeText).toBeTruthy();
  for (const char of badgeText!) {
    await page.keyboard.press(char);
  }

  // Hint overlay should dismiss and item1 should be active
  await expect(page.locator(".gtd-hint-overlay")).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(item1) })).toHaveClass(/tree-entry--active/);

  // Keyboard navigation should work immediately (j/k)
  await page.keyboard.press("j");
  await expect(page.getByRole("button", { name: new RegExp(item1) })).not.toHaveClass(/tree-entry--active/);

  await page.keyboard.press("k");
  await expect(page.getByRole("button", { name: new RegExp(item1) })).toHaveClass(/tree-entry--active/);
});

test("Vim normal mode argument awaiting does not trigger leader menu", async ({ page }) => {
  const title = uniqueLabel("Vim argument awaiting");
  await openApp(page);
  await createInboxStuffFromKeyboard(page, title);
  await page.keyboard.press("l");
  await expect(page.locator(".cm-content")).toBeVisible();

  // Enter text
  await page.keyboard.press("i");
  await page.keyboard.type("abc");
  await page.keyboard.press("Escape");

  // Move back one char
  await page.keyboard.press("h");

  // Type 'r' then Space: replaces 'b' with Space. Leader menu should NOT open!
  await page.keyboard.press("r");
  await page.keyboard.press(" ");
  await expect(page.locator(".leader-menu")).not.toBeVisible();

  // Check content has space
  await expect(page.locator(".cm-content")).toContainText("a c");
});

