import { defineConfig } from "@playwright/test";
const remoteURL = process.env.TEST_BASE_URL;
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.pw.ts",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: remoteURL || "http://127.0.0.1:4173/",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROME_PATH ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
  },
  webServer: remoteURL
    ? undefined
    : {
        command: "npm run dev -- --port 4173 --strictPort",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: true,
        timeout: 30000,
      },
});
