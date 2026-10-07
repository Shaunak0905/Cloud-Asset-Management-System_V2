import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end tests (docs/14 §47–49, §58). `npm run e2e` builds
 * nothing: it starts the production build (`npm run build` first) on port
 * 3000, or tests an already deployed site when E2E_BASE_URL is set (e.g. a
 * Vercel preview). The installed Chrome is used, so no browser download is
 * needed (E2E_BROWSER_CHANNEL=msedge for Edge).
 *
 * e2e/public.spec.ts needs no accounts. e2e/critical-path.spec.ts signs in
 * with test accounts and runs only when they are configured; see README →
 * Testing.
 */
// Test accounts and options live in a git-ignored file (README → Testing).
if (existsSync(".env.e2e.local")) process.loadEnvFile(".env.e2e.local");

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const channel = process.env.E2E_BROWSER_CHANNEL || "chrome";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    channel,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    {
      name: "mobile",
      // A phone-sized viewport with touch, in the same installed browser.
      use: {
        ...devices["Pixel 7"],
        channel,
        defaultBrowserType: "chromium",
      },
      testIgnore: /critical-path/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
