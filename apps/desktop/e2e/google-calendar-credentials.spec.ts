import { expect, test, type Page, type Route } from "@playwright/test";
import { focusApp } from "./support/app";

type SavedCredentials = Readonly<{ clientId: string; clientSecret: string }>;

class GoogleCalendarApiFake {
  savedCredentials: SavedCredentials | null = null;

  async install(page: Page): Promise<void> {
    await page.route("**/integrations/google-calendar/status", route => this.fulfillStatus(route));
    await page.route("**/integrations/google-calendar/credentials", route => this.saveCredentials(route));
  }

  private async fulfillStatus(route: Route): Promise<void> {
    await route.fulfill({ json: this.status() });
  }

  private async saveCredentials(route: Route): Promise<void> {
    this.savedCredentials = route.request().postDataJSON() as SavedCredentials;
    await route.fulfill({ status: 204 });
  }

  private status() {
    return {
      credentialsConfigured: true,
      configurationStatus: "READY",
      configurationMessage: "Google Calendar is ready.",
      connected: this.savedCredentials === null,
      calendars: []
    };
  }
}

test("configured Google Calendar credentials can be replaced and are cleared after closing", async ({ page }) => {
  const googleCalendar = new GoogleCalendarApiFake();
  await googleCalendar.install(page);
  await openGoogleCalendarIntegration(page);
  await expect(page.getByRole("button", { name: "Update credentials" })).toBeVisible();
  await page.getByRole("button", { name: "Update credentials" }).click();
  await expectCredentialFieldsBlank(page);
  await page.getByPlaceholder("Client ID").fill("replacement-client-id");
  await page.getByPlaceholder("Client Secret").fill("replacement-client-secret");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Disconnected (Press 'c' to connect)")).toBeVisible();
  expect(googleCalendar.savedCredentials).toEqual({ clientId: "replacement-client-id", clientSecret: "replacement-client-secret" });
  await page.getByRole("button", { name: "Update credentials" }).click();
  await expectCredentialFieldsBlank(page);
});

async function openGoogleCalendarIntegration(page: Page): Promise<void> {
  await page.goto("/");
  await focusApp(page);
  await page.keyboard.press("Space");
  await page.keyboard.press("I");
  await page.keyboard.press("g");
  await expect(page.getByText("Integration Status")).toBeVisible();
}

async function expectCredentialFieldsBlank(page: Page): Promise<void> {
  await expect(page.getByPlaceholder("Client ID")).toHaveValue("");
  await expect(page.getByPlaceholder("Client Secret")).toHaveValue("");
}
