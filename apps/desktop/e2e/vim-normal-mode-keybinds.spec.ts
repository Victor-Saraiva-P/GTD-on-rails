import { expect, test } from "@playwright/test";
import { createInboxStuffFromKeyboard, createStuffApi, openApp, uniqueLabel } from "./support/app";

test("direct global keybinds do not override vim normal mode keys", async ({ page }) => {
  const title = uniqueLabel("Vim normal keys");
  await openApp(page);
  await page.locator(".inbox-pane--list").click();

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

test("Hint mode isolates keys and restores full keyboard navigation on target selection", async ({ page, request }) => {
  await createStuffApi(request, uniqueLabel("Hint 1"));
  await createStuffApi(request, uniqueLabel("Hint 2"));
  await openApp(page);
  const items = page.locator("button.tree-entry");

  const item1Button = items.first();
  const item2Button = items.nth(1);
  await expect(item1Button).toBeVisible();
  await expect(item2Button).toBeVisible();

  // Open hint mode
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("h");
  await expect(page.locator(".gtd-hint-overlay")).toBeVisible();

  // Find badge for item1 using data-hint-label
  const getBadgeText = () => item1Button.evaluate((btn) => btn.getAttribute("data-hint-label"));

  await expect.poll(getBadgeText).not.toBeNull();
  const badgeText = (await getBadgeText())!;

  for (const char of badgeText) {
    await page.keyboard.press(char);
  }

  // Hint overlay should dismiss and item1 should be active with orange accent
  await expect(page.locator(".gtd-hint-overlay")).not.toBeVisible();
  await expect(item1Button).toHaveClass(/tree-entry--active/);
  const boxShadow = await item1Button.evaluate((el) => window.getComputedStyle(el).boxShadow);
  expect(boxShadow).toContain("204, 120, 47");

  // Keyboard navigation should work immediately (j/k)
  await page.keyboard.press("j");
  await expect(item1Button).not.toHaveClass(/tree-entry--active/);
  // Verify unselected item1 does not retain a gray ghost highlight
  const item1Bg = await item1Button.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(item1Bg).toBe("rgba(0, 0, 0, 0)");

  // Item2 should now be active and have DOM focus
  await expect(item2Button).toHaveClass(/tree-entry--active/);
  await expect(item2Button).toBeFocused();

  await page.keyboard.press("k");
  await expect(item1Button).toHaveClass(/tree-entry--active/);
  await expect(item1Button).toBeFocused();
});

test("Vim normal mode argument awaiting does not trigger leader menu", async ({ page }) => {
  const title = uniqueLabel("Vim argument awaiting");
  await openApp(page);
  await page.locator(".inbox-pane--list").click();
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

test("Vim editor supports heading motions and display boundary actions", async ({ page }) => {
  const title = uniqueLabel("Vim editor motions");
  await openApp(page);
  await page.locator(".inbox-pane--list").click();
  await createInboxStuffFromKeyboard(page, title);
  await page.keyboard.press("l");
  await expect(page.locator(".cm-content")).toBeVisible();

  // Enter structured markdown text
  await page.keyboard.press("i");
  await page.keyboard.type("Intro\n# First Header\nBody\n# Second Header");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Editing mode")).toContainText("NORMAL");

  // Jump to first line
  await page.keyboard.press("g");
  await page.keyboard.press("g");

  // Heading motion forward: ]] jumps to "# First Header"
  await page.keyboard.press("]");
  await page.keyboard.press("]");

  // A enters insert mode at end of the line
  await page.keyboard.press("A");
  await expect(page.getByLabel("Editing mode")).toContainText("INSERT");
  await page.keyboard.type(" - edited");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Editing mode")).toContainText("NORMAL");
  await expect(page.locator(".cm-content")).toContainText("# First Header - edited");

  // Heading motion forward to second header
  await page.keyboard.press("]");
  await page.keyboard.press("]");

  // Heading motion backward to first header
  await page.keyboard.press("[");
  await page.keyboard.press("[");

  // Exit editor with Escape and return to list
  await page.keyboard.press("Escape");
  await expect(page.locator(".inbox-pane--list.list-pane--active")).toBeVisible();
});

test("Space k opens which-key cheat sheet dialog, filters shortcuts, and closes on Escape", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("k");
  await expect(page.locator(".leader-menu")).not.toBeVisible();
  await expect(page.locator(".which-key-dialog")).toBeVisible();
  await expect(page.locator(".which-key-dialog__badge")).toContainText("Which-Key");

  await page.locator(".which-key-dialog__search").fill("Add new stuff");
  await expect(page.locator(".which-key-dialog__item")).toHaveCount(1);
  await expect(page.locator(".which-key-dialog__desc")).toContainText("Add new stuff");

  await page.keyboard.press("Escape");
  await expect(page.locator(".which-key-dialog")).not.toBeVisible();
});

test("Vim insert mode exits to normal mode on typing jk sequence", async ({ page }) => {
  const title = uniqueLabel("Vim jk insert escape");
  await openApp(page);
  await page.locator(".inbox-pane--list").click();
  await createInboxStuffFromKeyboard(page, title);
  await page.keyboard.press("l");
  await expect(page.locator(".cm-content")).toBeVisible();

  await page.keyboard.press("i");
  await expect(page.getByLabel("Editing mode")).toContainText("INSERT");
  await page.keyboard.type("quick test");

  await page.keyboard.type("jk");
  await expect(page.getByLabel("Editing mode")).toContainText("NORMAL");
  await expect(page.locator(".cm-content")).toContainText("quick test");
  await expect(page.locator(".cm-content")).not.toContainText("jk");
});

test("Space z toggles Zen Mode expanding detail pane and hiding side list", async ({ page }) => {
  const title = uniqueLabel("Zen Mode toggle");
  await openApp(page);
  await page.locator(".inbox-pane--list").click();
  await createInboxStuffFromKeyboard(page, title);

  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("z");

  await expect(page.locator(".list-workspace")).toHaveClass(/list-workspace--zen/);
  await expect(page.locator(".inbox-pane--list")).not.toBeVisible();
  await expect(page.locator(".inbox-pane--detail")).toBeVisible();
  await expect(page.locator(".zen-mode-exit-button")).toBeVisible();

  await page.keyboard.press("Space");
  await page.keyboard.press("z");
  await expect(page.locator(".list-workspace")).not.toHaveClass(/list-workspace--zen/);
  await expect(page.locator(".inbox-pane--list")).toBeVisible();
});

test("Zen Mode exits cleanly when pressing Escape", async ({ page }) => {
  const title = uniqueLabel("Zen Mode exit");
  await openApp(page);
  await page.locator(".inbox-pane--list").click();
  await createInboxStuffFromKeyboard(page, title);

  await page.keyboard.press("Space");
  await page.keyboard.press("z");
  await expect(page.locator(".list-workspace")).toHaveClass(/list-workspace--zen/);

  await page.keyboard.press("Escape");
  await expect(page.locator(".list-workspace")).not.toHaveClass(/list-workspace--zen/);
  await expect(page.locator(".inbox-pane--list")).toBeVisible();
});



