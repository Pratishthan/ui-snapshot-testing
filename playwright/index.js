/**
 * Playwright Integration Module
 *
 * Main entry point for Playwright integration.
 * Exports all helpers and test generation functions.
 */

export {
  generateVisualTests,
  generateVisualTestsFromData,
  readVisualTestsData,
  generateVisualTestsWithFilter,
  generateVisualTestsForStories,
  createTestSuite,
} from "./test-generator.js";

export {
  maskElements,
  maskTimestampElements,
  navigateToStory,
  waitForStoryReady,
  captureStoryScreenshot,
  prepareStoryForScreenshot,
  getSnapshotName,
  shouldIgnoreError,
  retryOperation,
  warmupStorybook,
  DEFAULT_MASK_SELECTORS,
} from "./helpers.js";

export {
  captureElementPositions,
  savePositions,
  loadPositions,
  comparePositions,
  captureAndSavePositions,
  loadAndComparePositions,
} from "./position-tracker.js";
