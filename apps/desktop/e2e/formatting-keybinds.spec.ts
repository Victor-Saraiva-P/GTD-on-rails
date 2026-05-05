import { expect, test } from "@playwright/test";

function uniqueTitle(): string {
  return `Formatting test ${Date.now()}`;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("main").click();
});

async function createStuff(page: any, title: string) {
  await page.keyboard.press("a");
  const input = page.locator("input.tree-entry__input");
  await expect(input).toBeVisible();
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByRole("button", { name: title })).toBeVisible();
}

async function focusDetail(page: any) {
  await page.keyboard.press("l");
  const detailPane = page.locator(".inbox-pane--detail");
  await expect(detailPane).toHaveClass(/list-pane--active/);
}

async function openFullDetail(page: any) {
  // We might be in editing mode after creating stuff, so we press Escape
  // to go to normal mode, and Escape again to go back to inbox list
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  
  // The binding is Space (leader) + Enter from the inbox list
  await page.keyboard.press(" ");
  await page.keyboard.press("Enter");
  await expect(page.locator(".stuff-detail-layout")).toBeVisible();
}

async function enterEditMode(page: any) {
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(page.locator(".cm-content")).toHaveAttribute("contenteditable", "true", { timeout: 500 });
  }).toPass({ timeout: 5000 });
}

test("space m b applies bullet point formatting in full detail screen", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await openFullDetail(page);

  // Enter insert mode and type some text
  await enterEditMode(page);
  await page.keyboard.press("i");
  await page.keyboard.type("Hello world");
  await page.keyboard.press("Escape");

  // Apply bullet point: space m b
  await page.keyboard.press(" ");
  await page.keyboard.press("m");
  await page.keyboard.press("b");

  await expect(page.locator(".cm-content")).toContainText("- Hello world");
});

test("space t b applies bold formatting in full detail screen", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await openFullDetail(page);

  await enterEditMode(page);
  await page.keyboard.press("i");
  await page.keyboard.type("Bold text");
  await page.keyboard.press("Escape");

  await page.keyboard.press("0");

  await page.keyboard.press("v");
  await page.keyboard.press("e");

  await page.keyboard.press(" ");
  await page.keyboard.press("t");
  await page.keyboard.press("b");

  await expect(page.locator(".cm-content")).toContainText("**Bold** text");
});

test("space m b applies bullet point formatting", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await focusDetail(page);

  // Enter insert mode and type some text
  await page.keyboard.press("i");
  await page.keyboard.type("Hello world");
  await page.keyboard.press("Escape");

  // Apply bullet point: space m b
  await page.keyboard.press(" ");
  await page.keyboard.press("m");
  await page.keyboard.press("b");

  await expect(page.locator(".cm-content")).toContainText("- Hello world");
});

test("space m 1 applies H1 formatting", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await focusDetail(page);

  await page.keyboard.press("i");
  await page.keyboard.type("Heading");
  await page.keyboard.press("Escape");

  // Apply H1: space m 1
  await page.keyboard.press(" ");
  await page.keyboard.press("m");
  await page.keyboard.press("1");

  await expect(page.locator(".cm-content")).toContainText("# Heading");
});

test("space t b applies bold formatting to selection", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await focusDetail(page);

  await page.keyboard.press("i");
  await page.keyboard.type("Bold text");
  await page.keyboard.press("Escape");

  // Go back to start of line
  await page.keyboard.press("0");

  // Select "Bold" using vim keys
  // 'v' for visual mode, 'e' to end of word
  await page.keyboard.press("v");
  await page.keyboard.press("e");

  // Apply bold: space t b
  await page.keyboard.press(" ");
  await page.keyboard.press("t");
  await page.keyboard.press("b");

  await expect(page.locator(".cm-content")).toContainText("**Bold** text");
});

test("space t t clears inline formatting", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await focusDetail(page);

  await page.keyboard.press("i");
  await page.keyboard.type("**Bold text**");
  await page.keyboard.press("Escape");

  // Go back to start of line
  await page.keyboard.press("0");
  
  // Select the whole line
  await page.keyboard.press("v");
  await page.keyboard.press("$");

  // Clear formatting: space t t
  await page.keyboard.press(" ");
  await page.keyboard.press("t");
  await page.keyboard.press("t");

  await expect(page.locator(".cm-content")).toContainText("Bold text");
  await expect(page.locator(".cm-content")).not.toContainText("**");
});

test("space m c c applies checked checklist", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await focusDetail(page);

  await page.keyboard.press("i");
  await page.keyboard.type("Task");
  await page.keyboard.press("Escape");

  // Apply checked checklist: space m c c
  await page.keyboard.press(" ");
  await page.keyboard.press("m");
  await page.keyboard.press("c");
  await page.keyboard.press("c");

  await expect(page.locator(".cm-content")).toContainText("- [x] Task");
});
