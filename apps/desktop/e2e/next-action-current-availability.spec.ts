import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { apiBaseUrl, convertStuffToNextActionApi, createContextApi, createStuffApi, openApp, resetTestData, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("opens current availability from the next actions list", async ({ page }) => {
  await page.keyboard.press("Space");
  await page.keyboard.press("n");
  await expect(page.locator(".list-pane__title", { hasText: "Next Actions" }).first()).toBeVisible();

  await openCurrentAvailability(page);

  const dialog = currentAvailabilityDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Contexts");
});

test("filters next actions by any selected current availability context", async ({ page, request }) => {
  const homeName = uniqueLabel("Home");
  const notebookName = uniqueLabel("Notebook");
  const home = await createContextApi(request, homeName);
  const notebook = await createContextApi(request, notebookName);
  const ipad = await createContextApi(request, uniqueLabel("iPad"));
  const homeTitle = uniqueLabel("Home action");
  const notebookTitle = uniqueLabel("Notebook action");
  const anywhereTitle = uniqueLabel("Anywhere action");
  const ipadTitle = uniqueLabel("iPad action");
  await createNextAction(request, homeTitle, [home.id]);
  await createNextAction(request, notebookTitle, [notebook.id]);
  await createNextAction(request, anywhereTitle, []);
  await createNextAction(request, ipadTitle, [ipad.id]);

  await openNextActions(page);
  await openCurrentAvailability(page);
  await page.getByRole("button", { name: new RegExp(homeName) }).click();
  await page.getByRole("button", { name: new RegExp(notebookName) }).click();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("button", { name: homeTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: notebookTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: anywhereTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: ipadTitle })).not.toBeVisible();
});

test("next actions API filters by any current availability context", async ({ request }) => {
  const home = await createContextApi(request, uniqueLabel("Home"));
  const notebook = await createContextApi(request, uniqueLabel("Notebook"));
  const ipad = await createContextApi(request, uniqueLabel("iPad"));
  const homeTitle = uniqueLabel("Home api action");
  const notebookTitle = uniqueLabel("Notebook api action");
  const bothTitle = uniqueLabel("Both api action");
  const anywhereTitle = uniqueLabel("Anywhere api action");
  const ipadTitle = uniqueLabel("iPad api action");
  await createNextAction(request, homeTitle, [home.id]);
  await createNextAction(request, notebookTitle, [notebook.id]);
  await createNextAction(request, bothTitle, [home.id, notebook.id]);
  await createNextAction(request, anywhereTitle, []);
  await createNextAction(request, ipadTitle, [ipad.id]);

  const response = await request.get(`${apiBaseUrl}/next-actions?orderBy=energy&contextIds=${home.id}&contextIds=${notebook.id}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  const titles = (await response.json() as Array<{ title: string }>).map((item) => item.title);

  expect(titles).toContain(homeTitle);
  expect(titles).toContain(notebookTitle);
  expect(titles).toContain(bothTitle);
  expect(titles).toContain(anywhereTitle);
  expect(titles).not.toContain(ipadTitle);
});

test("clears current availability and selects the first visible next action", async ({ page, request }) => {
  const homeName = uniqueLabel("Home");
  const otherName = uniqueLabel("Other");
  const home = await createContextApi(request, homeName);
  const other = await createContextApi(request, otherName);
  const homeTitle = uniqueLabel("Home reset action");
  const firstTitle = uniqueLabel("First reset action");
  await createNextAction(request, homeTitle, [home.id], 1.0);
  await createNextAction(request, firstTitle, [other.id], 9.0);

  await openNextActions(page);
  await applyNamedContextAvailability(page, homeName);
  await expect(page.getByRole("button", { name: firstTitle })).not.toBeVisible();

  await page.keyboard.press("C");

  await expect(page.getByText("Context: all contexts")).toBeVisible();
  await expect(page.locator('ol[aria-label="Next actions"] .tree-entry').first()).toHaveClass(/tree-entry--active/);
});

async function createNextAction(request: APIRequestContext, title: string, contextIds: string[], energy = 1.0): Promise<void> {
  const stuff = await createStuffApi(request, title);
  await convertStuffToNextActionApi(request, stuff.id, contextIds, energy);
}

async function openNextActions(page: Page): Promise<void> {
  await page.keyboard.press("Space");
  await page.keyboard.press("n");
  await expect(page.locator(".list-pane__title", { hasText: "Next Actions" }).first()).toBeVisible();
  await page.locator("main").click();
}

async function openCurrentAvailability(page: Page): Promise<void> {
  await page.locator("main").click();
  await page.keyboard.press("c");
  await expect(currentAvailabilityDialog(page)).toBeVisible();
}

function currentAvailabilityDialog(page: Page) {
  return page.getByRole("dialog", { name: "Current Availability" });
}

async function applyNamedContextAvailability(page: Page, contextName: string): Promise<void> {
  await openCurrentAvailability(page);
  await expect(page.getByRole("button", { name: new RegExp(contextName) })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(contextName) }).click();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
}
