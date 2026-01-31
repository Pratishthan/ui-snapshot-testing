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
 * import { createPlaywrightConfig } from 'snapshot-testing';
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
  const {
    storybook = {},
    paths = {},
    playwrightConfig = {},
    storybookConfig = {},
  } = visualTestConfig;

  // Get the library's spec file path
  const specFilePath = path.join(__dirname, "visual-tests.spec.js");

  // Build base configuration from visual test config
  const baseConfig = {
    // Test directory and file
    testMatch: specFilePath,

    // Snapshot configuration
    snapshotDir:
      visualTestConfig.snapshot?.image?.snapshotDir ||
      paths.snapshotsDir ||
      "./playwright/__visual_snapshots__",
    snapshotPathTemplate: "{snapshotDir}/{testFileDir}/{arg}{ext}",

    // Test execution settings from playwrightConfig
    fullyParallel: playwrightConfig.fullyParallel ?? false,
    workers: playwrightConfig.workers ?? 1,
    retries: playwrightConfig.retries ?? 0,
    forbidOnly: playwrightConfig.forbidOnly ?? true,

    // Timeout configuration
    timeout: playwrightConfig.timeout ?? 30000,
    expect: playwrightConfig.expect ?? { timeout: 5000 },

    // Reporter configuration
    reporter: playwrightConfig.reporter ?? [
      ["html", { outputFolder: "playwright-report" }],
      ["list"],
    ],

    // Shared settings
    use: {
      baseURL: `http://${storybook.host || "localhost"}:${storybook.port || "6006"}`,
      ...(playwrightConfig.use || {}),
    },

    // Projects configuration
    projects: playwrightConfig.projects ?? [
      {
        name: "chromium",
      },
    ],
  };

  // Add webServer configuration if storybookConfig.command is provided
  if (storybookConfig.command) {
    baseConfig.webServer = {
      command: storybookConfig.command,
      url: `http://${storybook.host || "localhost"}:${storybook.port || "6006"}`,
      reuseExistingServer: storybookConfig.reuseExistingServer ?? true,
      timeout: storybookConfig.timeout ?? 120000,
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
