import { defineConfig } from "@playwright/test";
import { createPlaywrightConfig } from "ui-snapshot-testing/playwright-config";
import visualTestConfig from "./visual-tests.config.js";

/**
 * Playwright configuration for visual regression testing with Storybook
 *
 * This configuration uses the snapshot-testing library's helper to generate
 * the base configuration from visual-tests.config.js, with optional overrides.
 */
export default defineConfig(
  createPlaywrightConfig(visualTestConfig, {
    // Optional overrides - uncomment and customize as needed
    // workers: 2,
    // retries: 1,
    // timeout: 60000,
  }),
);
