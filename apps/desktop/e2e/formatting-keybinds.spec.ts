import { expect, test, type Page } from "@playwright/test";

function uniqueTitle(): string {
  return `Formatting test ${Date.now()}`;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("main").click();
});

async function createStuff(page: Page, title: string) {
  await page.keyboard.press("h");
  await page.keyboard.press("a");
  const input = page.locator("input.tree-entry__input");
  await expect(input).toBeVisible();
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByRole("button", { name: title })).toBeVisible();
}

async function focusDetail(page: Page) {
  await page.keyboard.press("l");
  const detailPane = page.locator(".inbox-pane--detail");
  await expect(detailPane).toHaveClass(/list-pane--active/);
  await expect(page.locator(".cm-content")).toBeVisible();
}

async function openFullDetail(page: Page) {
  // We might be in editing mode after creating stuff, so we press Escape
  // to go to normal mode, and Escape again to go back to inbox list
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  
  // The binding is Space (leader) + Enter from the inbox list
  await page.keyboard.press(" ");
  await page.keyboard.press("Enter");
  await expect(page.locator(".stuff-detail-layout")).toBeVisible();
}

async function enterEditMode(page: Page) {
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(page.locator(".cm-content")).toHaveAttribute("contenteditable", "true", { timeout: 500 });
  }).toPass({ timeout: 5000 });
}

async function typeInEditor(page: Page, text: string) {
  const editor = page.locator(".cm-content");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  if (await editor.getAttribute("data-vim-mode") === "normal") {
    await page.keyboard.press("i");
  }
  await page.keyboard.type(text);
  await page.keyboard.press("Escape");
  await expect(editor).toHaveAttribute("data-vim-mode", "normal");
}

async function expectEditorText(page: Page, text: string) {
  await expect(page.locator(".cm-content")).toContainText(text);
}

test("space m b applies bullet point formatting in full detail screen", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await openFullDetail(page);

  await enterEditMode(page);
  await typeInEditor(page, "Hello world");

  // Apply bullet point: space m b
  await page.keyboard.press(" ");
  await page.keyboard.press("m");
  await page.keyboard.press("b");

  await expect(page.locator(".cm-bullet-mark")).toBeVisible();
  await expectEditorText(page, "Hello world");
});

test("space t b applies bold formatting in full detail screen", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await openFullDetail(page);

  await enterEditMode(page);
  await typeInEditor(page, "Bold text");

  await page.keyboard.press("0");

  await page.keyboard.press("v");
  await page.keyboard.press("e");

  await page.keyboard.press(" ");
  await page.keyboard.press("t");
  await page.keyboard.press("b");

  await expect(page.locator(".cm-bold-text")).toContainText("Bold");
  await expectEditorText(page, "Bold text");
});

test("space m b applies bullet point formatting", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await focusDetail(page);

  await typeInEditor(page, "Hello world");

  // Apply bullet point: space m b
  await page.keyboard.press(" ");
  await page.keyboard.press("m");
  await page.keyboard.press("b");

  await expect(page.locator(".cm-bullet-mark")).toBeVisible();
  await expectEditorText(page, "Hello world");
});

test("space m 1 applies H1 formatting", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await focusDetail(page);

  await typeInEditor(page, "Heading");

  // Apply H1: space m 1
  await page.keyboard.press(" ");
  await page.keyboard.press("m");
  await page.keyboard.press("1");

  await expect(page.locator(".cm-md-heading-1")).toContainText("Heading");
});

test("space t b applies bold formatting to selection", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await focusDetail(page);

  await typeInEditor(page, "Bold text");

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

  await expect(page.locator(".cm-bold-text")).toContainText("Bold");
  await expectEditorText(page, "Bold text");
});

test("space t t clears inline formatting", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await focusDetail(page);

  await typeInEditor(page, "Bold text");

  // Go back to start of line
  await page.keyboard.press("0");
  
  // Select the whole line
  await page.keyboard.press("v");
  await page.keyboard.press("$");

  await page.keyboard.press(" ");
  await page.keyboard.press("t");
  await page.keyboard.press("b");
  await expect(page.locator(".cm-bold-text")).toContainText("Bold text");

  await page.keyboard.press("0");
  await page.keyboard.press("v");
  await page.keyboard.press("$");

  // Clear formatting: space t t
  await page.keyboard.press(" ");
  await page.keyboard.press("t");
  await page.keyboard.press("t");

  await expectEditorText(page, "Bold text");
  await expect(page.locator(".cm-bold-text")).not.toBeVisible();
});

test("space t l inserts markdown link from clipboard with p", async ({ page, context }) => {
  const title = uniqueTitle();
  const url = "https://www.google.com";
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await createStuff(page, title);
  await focusDetail(page);
  await page.evaluate((text) => navigator.clipboard.writeText(text), url);

  await typeInEditor(page, "linkzinho ");

  await page.keyboard.press(" ");
  await page.keyboard.press("t");
  await page.keyboard.press("l");

  const input = page.getByLabel("URL");
  await expect(input).toBeVisible();
  await page.keyboard.press("p");

  await expect(page.locator(".cm-markdown-link", { hasText: url })).toBeVisible();
});

test("inserts markdown asset preview from editor event", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await focusDetail(page);

  await typeInEditor(page, "assetzinho ");
  await dispatchInsertedAsset(page);

  await expect(page.locator(".cm-markdown-image")).toBeVisible();
});

test("undoing dd restores markdown asset preview", async ({ page }) => {
  const title = uniqueTitle();
  const token = "⟦asset:3625c437-ee86-45de-8135-01f0b46fd3da⟧";
  await createStuff(page, title);
  await focusDetail(page);

  await typeInEditor(page, "asset line ");
  await expect(page.locator(".cm-content")).toHaveAttribute("data-vim-mode", "normal");
  await dispatchInsertedAsset(page);
  await expect(page.locator(".cm-markdown-image")).toBeVisible();

  await page.keyboard.press("d");
  await page.keyboard.press("d");
  await expect(page.locator(".cm-markdown-image")).not.toBeVisible();

  await page.keyboard.press("u");
  await expect(page.locator(".cm-markdown-image")).toBeVisible();
  await expect(page.locator(".cm-content")).not.toContainText(token);
});

test("space g d opens link under cursor", async ({ page }) => {
  const title = uniqueTitle();
  const url = "https://example.com/docs";
  await mockWindowOpen(page);
  await createStuff(page, title);
  await focusDetail(page);

  await dispatchInsertedLink(page, url);
  await page.keyboard.press("0");
  await openCursorTarget(page);

  await expectOpenedUrl(page, url);
});

test("space g d opens asset under cursor", async ({ page }) => {
  const title = uniqueTitle();
  const url = "http://127.0.0.1:18080/assets/items/test/asset/clipboard-asset.png";
  await mockWindowOpen(page);
  await createStuff(page, title);
  await focusDetail(page);

  await dispatchInsertedAsset(page);
  await openCursorTarget(page);

  await expectOpenedUrl(page, url);
});

test("space m c c applies checked checklist", async ({ page }) => {
  const title = uniqueTitle();
  await createStuff(page, title);
  await focusDetail(page);

  await typeInEditor(page, "Task");

  // Apply checked checklist: space m c c
  await page.keyboard.press(" ");
  await page.keyboard.press("m");
  await page.keyboard.press("c");
  await page.keyboard.press("c");

  await expect(page.locator(".cm-checklist-box--checked")).toBeVisible();
  await expectEditorText(page, "Task");
});

async function dispatchInsertedAsset(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("gtd:insert-block-entity", {
    detail: {
      assetId: "3625c437-ee86-45de-8135-01f0b46fd3da",
      contentType: "image/png",
      displayName: "clipboard-asset.png",
      image: true,
      relativePath: "items/test/asset/clipboard-asset.png",
      url: "/assets/items/test/asset/clipboard-asset.png"
    }
  })));
}

async function dispatchInsertedLink(page: Page, url: string) {
  await page.evaluate((href) => window.dispatchEvent(new CustomEvent("gtd:insert-markdown-link", {
    detail: { text: "Example", url: href }
  })), url);
}

async function expectOpenedUrl(page: Page, url: string) {
  await expect.poll(() => openedUrls(page)).toContain(url);
}

async function mockWindowOpen(page: Page) {
  await page.evaluate(() => {
    (window as any).__openedUrls = [];
    window.open = (url?: string | URL) => {
      (window as any).__openedUrls.push(String(url));
      return null;
    };
  });
}

async function openedUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__openedUrls ?? []);
}

async function openCursorTarget(page: Page) {
  await page.keyboard.press(" ");
  await page.keyboard.press("g");
  await page.keyboard.press("d");
}
