import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  convertStuffToNextActionApi,
  createStuffApi,
  focusApp,
  openApp,
  openCalendars,
  resetTestData,
  setNextActionDeadlineApi,
  todayIsoValue,
  uniqueLabel,
  type CreatedResource
} from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("calendar projects a due next action without changing its identity", async ({ page, request }) => {
  const title = uniqueLabel("Due next action");
  const action = await seedDueNextAction(page, request, title);
  await verifyDueProjectionNavigation(page, title);
  await completeProjectedNextAction(page, action, title);
  await verifyCompletedProjectionNavigation(page, title);
  await restoreProjectionAndOpenDeadlineEditor(page, action, title);
});

test("calendar sends a projected next action to On Going as the original next action", async ({ page, request }) => {
  const title = uniqueLabel("Due next action ongoing");
  const action = await seedDueNextAction(page, request, title);
  const dueAction = page.locator(".inbox-pane").nth(0).getByRole("button", { name: title, exact: false }).first();
  await dueAction.click();
  const response = page.waitForResponse((candidate) =>
    candidate.url().endsWith(`/next-actions/${action.id}/ongoing`) && candidate.request().method() === "POST" && candidate.ok()
  );
  await page.keyboard.press("o");
  await response;
  await expect(page.locator(".list-pane__title", { hasText: "On Going Detail" })).toBeVisible();
  await openCalendars(page);
  await expect(page.locator(".inbox-pane").nth(0).getByRole("button", { name: title, exact: false })).toHaveCount(0);
  await openOnGoing(page);
  const ongoingAction = page.getByRole("button", { name: title, exact: false }).first();
  await expect(ongoingAction).toBeVisible();
  await expect(ongoingAction.locator(".tree-entry__glyph")).toHaveText("N");
});

async function seedDueNextAction(page: Page, request: APIRequestContext, title: string): Promise<CreatedResource> {
  const action = await createStuffApi(request, title);
  await convertStuffToNextActionApi(request, action.id);
  await setNextActionDeadlineApi(request, action.id, todayIsoValue());
  await page.reload();
  await focusApp(page);
  await openCalendars(page);
  return action;
}

async function verifyDueProjectionNavigation(page: Page, title: string): Promise<void> {
  const dueAction = page.locator(".inbox-pane").nth(0).getByRole("button", { name: title, exact: false }).first();
  await expect(dueAction).toBeVisible();
  await expect(dueAction.locator(".tree-entry__glyph")).toHaveText("N");
  await expect(dueAction.locator(".calendar-entry__deadline")).toHaveText("due today");
  await dueAction.click();
  await expect(page.locator(".inbox-pane .list-pane__title").nth(2)).toHaveText("Next Action Detail");
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(page.locator(".list-pane__title", { hasText: "Next Action Detail" })).toBeVisible();
  await page.keyboard.press("Escape");
  await openCalendars(page);
}

async function completeProjectedNextAction(page: Page, action: CreatedResource, title: string): Promise<void> {
  const response = page.waitForResponse((candidate) =>
    candidate.url().endsWith(`/next-actions/${action.id}/done`) && candidate.request().method() === "POST" && candidate.ok()
  );
  await page.locator(".inbox-pane").nth(0).getByRole("button", { name: title, exact: false }).first().click();
  await page.keyboard.press("x");
  await response;
  const doneAction = page.locator(".inbox-pane").nth(1).getByRole("button", { name: title, exact: false }).first();
  await expect(doneAction).toBeVisible();
  await expect(doneAction.locator(".tree-entry__glyph")).toHaveText("N");
  await expect(doneAction.locator(".calendar-entry__deadline")).toHaveText("done today");
}

async function verifyCompletedProjectionNavigation(page: Page, title: string): Promise<void> {
  await page.keyboard.press("2");
  await page.locator(".inbox-pane").nth(1).getByRole("button", { name: title, exact: false }).first().click();
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(page.locator(".list-pane__title").first()).toHaveText("Completed Next Actions");
  await expect(page.locator(".list-pane__title").nth(1)).toHaveText("Next Action Detail");
  await openCalendars(page);
}

async function openOnGoing(page: Page): Promise<void> {
  await page.keyboard.press("Space");
  await page.keyboard.press("o");
}

async function restoreProjectionAndOpenDeadlineEditor(page: Page, action: CreatedResource, title: string): Promise<void> {
  await page.keyboard.press("2");
  await page.locator(".inbox-pane").nth(1).getByRole("button", { name: title, exact: false }).first().click();
  const response = page.waitForResponse((candidate) =>
    candidate.url().endsWith(`/next-actions/${action.id}/reset-status`) && candidate.request().method() === "POST" && candidate.ok()
  );
  await page.keyboard.press("r");
  await response;
  await page.keyboard.press("1");
  const restored = page.locator(".inbox-pane").nth(0).getByRole("button", { name: title, exact: false }).first();
  await expect(restored).toBeVisible();
  await restored.click();
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog", { name: "Edit next action deadline" })).toBeVisible();
}
