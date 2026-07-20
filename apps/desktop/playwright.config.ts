/// <reference types="node" />

import { defineConfig, devices } from "@playwright/test";

const desktopWebUrl = "http://127.0.0.1:1420";
const apiUrl = "http://127.0.0.1:18080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 2,
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: desktopWebUrl,
    trace: "on-first-retry"
  },
  webServer: [
    {
      command:
        "./gradlew --no-daemon bootRun --args='--spring.profiles.active=test --server.port=18080'",
      cwd: `${__dirname}/../api`,
      url: `${apiUrl}/inbox`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        GTD_TEST_DB_URL: process.env.GTD_E2E_DB_URL,
        GTD_TEST_DB_USERNAME: process.env.GTD_TEST_DB_USERNAME,
        GTD_TEST_DB_PASSWORD: process.env.GTD_TEST_DB_PASSWORD,
        GTD_SYNC_RCLONE_ENABLED: "false",
        APP_CORS_ALLOWED_ORIGINS: desktopWebUrl
      }
    },
    {
      command: "pnpm dev:web",
      cwd: __dirname,
      url: desktopWebUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_API_BASE_URL: apiUrl
      }
    }
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ]
});
