import { expect, test } from "@playwright/test";
import {
  apiBaseUrl,
  convertStuffToNextActionApi,
  convertStuffToProjectApi,
  createStuffApi,
  openApp,
  resetTestData,
  uniqueLabel
} from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("gd navigates from next action to project detail with item focused, and gd in project detail navigates back to next action", async ({ page, request }) => {
  const projectTitle = uniqueLabel("Project Alpha");
  const actionTitle = uniqueLabel("Important Action");

  const project = await createStuffApi(request, projectTitle);
  await convertStuffToProjectApi(request, project.id);

  const action = await createStuffApi(request, actionTitle);
  await convertStuffToNextActionApi(request, action.id);

  const assignResponse = await request.put(`${apiBaseUrl}/items/${action.id}/project`, {
    data: { projectId: project.id }
  });
  expect(assignResponse.ok()).toBeTruthy();

  await openApp(page);
  await page.keyboard.press("Space");
  await page.keyboard.press("n");

  const actionButton = page.getByRole("button", { name: actionTitle, exact: false });
  await expect(actionButton).toBeVisible();
  await expect(actionButton).toHaveClass(/tree-entry--active/);

  await page.keyboard.press("g");
  await page.keyboard.press("d");

  const projectActionButton = page.locator(".tree-list--inbox").getByRole("button", { name: actionTitle, exact: false });
  await expect(projectActionButton).toBeVisible();
  await expect(projectActionButton).toHaveClass(/tree-entry--active/);

  await page.keyboard.press("g");
  await page.keyboard.press("d");

  await expect(page.locator(".list-pane__title", { hasText: "Next Actions" })).toBeVisible();
  await expect(actionButton).toBeVisible();
  await expect(actionButton).toHaveClass(/tree-entry--active/);

  await page.keyboard.press("Control+o");
  await expect(projectActionButton).toBeVisible();
  await expect(projectActionButton).toHaveClass(/tree-entry--active/);

  await page.keyboard.press("Control+o");
  await expect(page.locator(".list-pane__title", { hasText: "Next Actions" })).toBeVisible();
  await expect(actionButton).toBeVisible();

  await page.keyboard.press("Control+i");
  await expect(projectActionButton).toBeVisible();
  await expect(projectActionButton).toHaveClass(/tree-entry--active/);

  await page.keyboard.press("Control+i");
  await expect(page.locator(".list-pane__title", { hasText: "Next Actions" })).toBeVisible();
  await expect(actionButton).toBeVisible();
});
