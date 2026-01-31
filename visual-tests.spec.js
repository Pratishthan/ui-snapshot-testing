/**
 * Visual Tests Spec File
 *
 * This is the main test file that should be referenced by consumer applications.
 * It dynamically generates Playwright tests based on the visual-tests.config.js configuration.
 */

import {
  generateVisualTestsFromData,
  readVisualTestsData,
} from "./playwright/test-generator.js";

// Load configuration and generate tests synchronously
// The data file path is passed via environment variable from the CLI runner
const dataFile = process.env.VISUAL_TESTS_DATA_FILE;

if (!dataFile) {
  throw new Error(
    "VISUAL_TESTS_DATA_FILE environment variable not set. This test must be run via the CLI.",
  );
}

const { stories, config } = readVisualTestsData(dataFile);

generateVisualTestsFromData({ stories, config });
