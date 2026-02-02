/**
 * Playwright Config Helper
 *
 * Provides utilities to generate Playwright configuration from visual-tests.config.js
 */

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a Playwright configuration object from visual tests configuration
 *
 * @param {object} visualTestConfig - The visual tests configuration object
 * @param {object} overrides - Optional overrides to merge with generated config
 * @returns {object} Playwright configuration object
 *
 * @example
 * import { defineConfig } from '@playwright/test';
 * import { createPlaywrightConfig } from 'ui-snapshot-testing';
 * import visualTestConfig from './visual-tests.config.js';
 *
 * export default defineConfig(
 *   createPlaywrightConfig(visualTestConfig, {
 *     // Optional overrides
 *     workers: 8,
 *   })
 * );
 */
export function createPlaywrightConfig(visualTestConfig = {}, overrides = {}) {
  const paths = visualTestConfig.snapshot?.paths || {};

  // Handle merged configuration (new structure)
  // storybook contains everything, playwright contains everything

  const storybook = visualTestConfig.storybook || {};
  const playwright = visualTestConfig.playwright || {};

  // Get the library's spec file path
  const specFilePath = path.join(__dirname, "visual-tests.spec.js");

  // Build base configuration from visual test config
  const baseConfig = {
    // Test directory and file
    testMatch: specFilePath,

    // Snapshot configuration
    snapshotDir:
      visualTestConfig.snapshot?.image?.snapshotDir || // Legacy check or if image has specific dir
      paths.snapshotsDir ||
      "./playwright/__visual_snapshots__",
    snapshotPathTemplate: "{snapshotDir}/{testFileDir}/{arg}{ext}",

    // Test execution settings
    fullyParallel: playwright.fullyParallel ?? false,
    workers: playwright.workers ?? 1,
    retries: playwright.retries ?? 0,
    forbidOnly: playwright.forbidOnly ?? true,

    // Timeout configuration
    timeout: playwright.timeout ?? 30000,
    expect: playwright.expect ?? { timeout: 5000 },

    // Reporter configuration
    reporter: playwright.reporter ?? [
      ["html", { outputFolder: "playwright-report" }],
      ["list"],
    ],

    // Shared settings
    use: {
      baseURL: `http://${storybook.host || "localhost"}:${storybook.port || "6006"}`,
      ...(playwright.use || {}),
    },

    // Projects configuration
    projects: playwright.projects ?? [
      {
        name: "chromium",
      },
    ],
  };

  // Add webServer configuration if command is provided
  if (storybook.command) {
    baseConfig.webServer = {
      command: storybook.command,
      url: `http://${storybook.host || "localhost"}:${storybook.port || "6006"}`,
      reuseExistingServer: storybook.reuseExistingServer ?? true,
      timeout: storybook.timeout ?? 120000,
    };
  }

  // Merge with overrides
  return deepMerge(baseConfig, overrides);
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}
