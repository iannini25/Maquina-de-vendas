import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra o app rodando (compose.dev + pnpm dev, ou CI).
 * BASE_URL padrão: http://localhost:3000.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      // Pixel 5 = chromium (evita depender do WebKit instalado no Windows)
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testMatch: /landing-public\.spec\.ts/,
    },
  ],
});
