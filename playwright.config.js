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
    visualTestConfig.snapshot?.paths?.snapshotsDir ||
      "./playwright/__visual_snapshots__",
    isMobile ? "mobile" : "",
    localeCode && !visualTestConfig.locale?.default ? localeCode : "",
  ),
  snapshotPathTemplate: "{snapshotDir}/{arg}{ext}",

  // Update snapshots configuration
  // Default to 'none' to prevent accidental creation of new snapshots
  // Only allow 'missing' if explicitly authorized via env var
  updateSnapshots:
    process.env.VISUAL_TEST_UPDATE_SNAPSHOTS === "true" ? "missing" : "none",

  // Test execution settings
  fullyParallel: visualTestConfig.playwright?.fullyParallel ?? false,
  workers: visualTestConfig.playwright?.workers ?? 1,
  retries: visualTestConfig.playwright?.retries ?? 0,
  forbidOnly: visualTestConfig.playwright?.forbidOnly ?? true,

  // Timeout configuration
  timeout: visualTestConfig.playwright?.timeout ?? 30000,
  expect: visualTestConfig.playwright?.expect ?? { timeout: 5000 },

  // Reporter configuration
  // Reporter configuration
  reporter: (
    visualTestConfig.playwright?.reporter ?? [
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
    ...(visualTestConfig.playwright?.use || {}),
  },

  // Projects configuration
  projects: visualTestConfig.playwright?.projects ?? [
    {
      name: "chromium",
    },
  ],
};

// Add webServer configuration if storybook.command is provided
if (visualTestConfig.storybook?.command) {
  config.webServer = {
    command: visualTestConfig.storybook.command,
    url: `http://${visualTestConfig.storybook?.host || "localhost"}:${visualTestConfig.storybook?.port || "6006"}`,
    reuseExistingServer: visualTestConfig.storybook.reuseExistingServer ?? true,
    timeout: visualTestConfig.storybook.timeout ?? 120000,
  };
}

export default config;
