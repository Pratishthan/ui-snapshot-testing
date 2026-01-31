/**
 * Test Generator Module
 *
 * Generates Playwright visual regression tests dynamically based on discovered stories.
 * This is the main integration point for consuming projects.
 */

import fs from "fs";
import {
  prepareStoryForScreenshot,
  captureStoryScreenshot,
  shouldIgnoreError,
  getSnapshotName,
} from "./helpers.js";
import {
  captureAndSavePositions,
  loadAndComparePositions,
} from "./position-tracker.js";

/**
 * Generates visual regression tests for Storybook stories
 *
 * @param {object} options - Configuration options
 * @param {object} options.config - Full configuration object (from loadConfig)
 * @param {string} options.targetSelector - CSS selector for screenshot target (default: '#storybook-root')
 * @param {Function} options.beforeEach - Optional hook to run before each test
 * @param {Function} options.afterEach - Optional hook to run after each test
 * @param {Function} options.beforeAll - Optional hook to run before all tests
 * @param {Function} options.afterAll - Optional hook to run after all tests
 *
 * @example
 * // In your visual-tests.spec.ts file:
 * import { generateVisualTests } from 'snapshot-testing/playwright';
 * import { loadConfig } from 'snapshot-testing/config';
 *
 * const config = await loadConfig();
 * await generateVisualTests({ config });
 */
/**
 * Generates visual regression tests synchronously from pre-loaded data
 * This is required because Playwright does not support async test definition
 *
 * @param {object} options - Options object
 * @param {Array} options.stories - Array of story objects
 * @param {object} options.config - Configuration object
 * @param {string} options.targetSelector - CSS selector for screenshot target
 * @param {Function} options.beforeEach - Optional hook
 * @param {Function} options.afterEach - Optional hook
 * @param {Function} options.beforeAll - Optional hook
 * @param {Function} options.afterAll - Optional hook
 */
export function generateVisualTestsFromData(options = {}) {
  const {
    stories,
    config,
    test,
    expect,
    targetSelector = "#storybook-root",
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
  } = options;

  if (!test || !expect) {
    throw new Error(
      "Missing 'test' or 'expect' objects. Please pass them from your test file.",
    );
  }

  if (!stories || stories.length === 0) {
    console.warn("⚠️  No stories provided to generate tests for");
    return;
  }

  // Set up test hooks if provided
  if (beforeAll) {
    test.beforeAll(beforeAll);
  }

  if (afterAll) {
    test.afterAll(afterAll);
  }

  if (beforeEach) {
    test.beforeEach(beforeEach);
  }

  if (afterEach) {
    test.afterEach(afterEach);
  }

  // Generate a test for each story
  for (const story of stories) {
    test(`${story.id}`, async ({ page }, testInfo) => {
      const storyId = story.id;
      const snapshotName = getSnapshotName(storyId);

      try {
        // Prepare story for screenshot
        const { ready, error } = await prepareStoryForScreenshot(
          page,
          storyId,
          {
            ...config,
            targetSelector,
          },
        );

        if (!ready) {
          throw new Error(error || "Story not ready for screenshot");
        }

        // Get snapshot path
        const snapshotPath = testInfo.snapshotPath(`${snapshotName}.png`);

        // Check if we're in update mode
        const isUpdateMode =
          testInfo.config.updateSnapshots === "all" ||
          testInfo.config.updateSnapshots === "missing";

        if (
          config.snapshot?.position?.enabled !== false &&
          story._testOptions?.position !== false
        ) {
          if (isUpdateMode) {
            // Update mode: capture and save positions
            await captureAndSavePositions(
              page,
              snapshotPath,
              targetSelector,
              config,
            );
          } else {
            // Verify mode: compare positions first
            const positionResult = await loadAndComparePositions(
              page,
              snapshotPath,
              targetSelector,
              config,
            );

            if (!positionResult.passed) {
              const errorMessage = [
                "Element position/order differences detected:",
                ...positionResult.differences,
              ].join("\n  - ");

              throw new Error(errorMessage);
            }
          }
        }

        // Take screenshot and compare
        if (
          config.snapshot?.image?.enabled !== false &&
          story._testOptions?.image !== false
        ) {
          const screenshot = await captureStoryScreenshot(page, targetSelector);
          expect(screenshot).toMatchSnapshot(`${snapshotName}.png`, {
            maxDiffPixelRatio: config.snapshot?.image?.maxDiffPixelRatio,
            maxDiffPixels: config.snapshot?.image?.maxDiffPixels,
            threshold: config.snapshot?.image?.threshold,
          });
        }
      } catch (error) {
        // Check if error should be ignored
        const ignorePatterns = config.errorHandling?.ignorePatterns || [];
        if (shouldIgnoreError(error, ignorePatterns)) {
          console.log(`⚠️  Ignoring error for ${storyId}: ${error.message}`);
          test.skip();
          return;
        }

        // Re-throw error to fail the test
        throw error;
      }
    });
  }
}

/**
 * @deprecated Use generateVisualTestsFromData instead. Async test generation is not supported by Playwright.
 */
export async function generateVisualTests(options = {}) {
  throw new Error(
    "generateVisualTests is deprecated and does not work with Playwright. Use generateVisualTestsFromData with pre-loaded story data instead.",
  );
}

/**
 * Helper to read visual tests data from file
 * @param {string} filePath - Path to data file
 * @returns {object} Object containing { stories, config }
 */
export function readVisualTestsData(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Visual tests data file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Generates visual tests with custom story filtering
 * @deprecated Use generateVisualTestsFromData
 */
export async function generateVisualTestsWithFilter(options = {}) {
  throw new Error(
    "generateVisualTestsWithFilter is deprecated. Filter stories before generating tests.",
  );
}

/**
 * Generates visual tests for specific story IDs
 * @deprecated Use generateVisualTestsFromData
 */
export async function generateVisualTestsForStories(options = {}) {
  throw new Error(
    "generateVisualTestsForStories is deprecated. Filter stories before generating tests.",
  );
}

/**
 * Helper to create a test suite with custom configuration
 *
 * @param {string} suiteName - Name of the test suite
 * @param {object} config - Configuration object
 * @param {Function} testGenerator - Function that generates tests
 */
export function createTestSuite(suiteName, config, testGenerator) {
  test.describe(suiteName, () => {
    testGenerator(config);
  });
}
