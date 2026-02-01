/**
 * Playwright Configuration for Visual Tests
 *
 * This is the library's default Playwright configuration.
 * Consumer applications should reference this file directly in their package.json scripts.
 */

import { loadConfig } from "./config-loader.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the consumer's visual-tests.config.js
// Check for mobile mode environment variable
const isMobile = process.env.VISUAL_TEST_MOBILE === "true";
const localeCode = process.env.VISUAL_TEST_LOCALE || "";
const visualTestConfig = await loadConfig({
  mobile: isMobile,
  locale: localeCode || undefined,
});

// Build Playwright configuration from visual test config
const config = {
  // Test file - points to library's spec file or generated spec
  testDir: process.cwd(),
  testMatch: /visual-tests.*\.spec\.js/,

  // Snapshot configuration
  snapshotDir: path.resolve(
    process.cwd(),
    visualTestConfig.paths?.snapshotsDir || "./playwright/__visual_snapshots__",
    isMobile ? "mobile" : "",
    localeCode ? localeCode : "",
  ),
  snapshotPathTemplate: "{snapshotDir}/{arg}{ext}",

  // Update snapshots configuration
  // Default to 'none' to prevent accidental creation of new snapshots
  // Only allow 'missing' if explicitly authorized via env var
  updateSnapshots:
    process.env.VISUAL_TEST_UPDATE_SNAPSHOTS === "true" ? "missing" : "none",

  // Test execution settings
  fullyParallel: visualTestConfig.playwrightConfig?.fullyParallel ?? false,
  workers: visualTestConfig.playwrightConfig?.workers ?? 1,
  retries: visualTestConfig.playwrightConfig?.retries ?? 0,
  forbidOnly: visualTestConfig.playwrightConfig?.forbidOnly ?? true,

  // Timeout configuration
  timeout: visualTestConfig.playwrightConfig?.timeout ?? 30000,
  expect: visualTestConfig.playwrightConfig?.expect ?? { timeout: 5000 },

  // Reporter configuration
  // Reporter configuration
  reporter: (
    visualTestConfig.playwrightConfig?.reporter ?? [
      ["html", { outputFolder: "playwright-report" }],
      ["list"],
    ]
  ).map(([name, options]) => {
    if (name === "html" && options?.outputFolder) {
      return [
        name,
        {
          ...options,
          outputFolder: path.resolve(process.cwd(), options.outputFolder),
        },
      ];
    }
    if (name === "json" && options?.outputFile) {
      return [
        name,
        {
          ...options,
          outputFile: path.resolve(process.cwd(), options.outputFile),
        },
      ];
    }
    return [name, options];
  }),

  // Shared settings
  use: {
    baseURL: `http://${visualTestConfig.storybook?.host || "localhost"}:${visualTestConfig.storybook?.port || "6006"}`,
    ...(visualTestConfig.playwrightConfig?.use || {}),
  },

  // Projects configuration
  projects: visualTestConfig.playwrightConfig?.projects ?? [
    {
      name: "chromium",
    },
  ],
};

// Add webServer configuration if storybookConfig.command is provided
if (visualTestConfig.storybookConfig?.command) {
  config.webServer = {
    command: visualTestConfig.storybookConfig.command,
    url: `http://${visualTestConfig.storybook?.host || "localhost"}:${visualTestConfig.storybook?.port || "6006"}`,
    reuseExistingServer:
      visualTestConfig.storybookConfig.reuseExistingServer ?? true,
    timeout: visualTestConfig.storybookConfig.timeout ?? 120000,
  };
}

export default config;
