/**
 * TypeScript definitions for Playwright integration module
 */

import type { Page, TestInfo } from "@playwright/test";
import type { VisualTestConfig } from "../types/index.js";

// ============================================================================
// Test Generator Types
// ============================================================================

export interface GenerateVisualTestsOptions {
  /** Full configuration object (from loadConfig) */
  config?: VisualTestConfig;

  /** CSS selector for screenshot target (default: '#storybook-root') */
  targetSelector?: string;

  /** Hook to run before each test */
  beforeEach?: (
    context: { page: Page },
    testInfo: TestInfo,
  ) => Promise<void> | void;

  /** Hook to run after each test */
  afterEach?: (
    context: { page: Page },
    testInfo: TestInfo,
  ) => Promise<void> | void;

  /** Hook to run before all tests */
  beforeAll?: () => Promise<void> | void;

  /** Hook to run after all tests */
  afterAll?: () => Promise<void> | void;
}

export interface GenerateVisualTestsWithFilterOptions extends GenerateVisualTestsOptions {
  /** Custom function to filter stories */
  storyFilter?: (story: Story) => boolean;
}

export interface GenerateVisualTestsForStoriesOptions extends GenerateVisualTestsOptions {
  /** Array of story IDs to test */
  storyIds?: string[];
}

export interface Story {
  id: string;
  name: string;
  title: string;
  importPath: string;
}

/**
 * Generates visual regression tests for Storybook stories
 */
export function generateVisualTests(
  options?: GenerateVisualTestsOptions,
): Promise<void>;

/**
 * Generates visual tests with custom story filtering
 */
export function generateVisualTestsWithFilter(
  options?: GenerateVisualTestsWithFilterOptions,
): Promise<void>;

/**
 * Generates visual tests for specific story IDs
 */
export function generateVisualTestsForStories(
  options?: GenerateVisualTestsForStoriesOptions,
): Promise<void>;

/**
 * Helper to create a test suite with custom configuration
 */
export function createTestSuite(
  suiteName: string,
  config: VisualTestConfig,
  testGenerator: (config: VisualTestConfig) => void | Promise<void>,
): void;

// ============================================================================
// Helper Types
// ============================================================================

export interface PrepareStoryResult {
  ready: boolean;
  error?: string;
}

/**
 * Masks dynamic elements that change between test runs
 */
export function maskElements(page: Page, selectors?: string[]): Promise<void>;

/**
 * Default mask selectors for common dynamic elements
 */
export const DEFAULT_MASK_SELECTORS: string[];

/**
 * Masks timestamp elements (timeElapsed and bsqDate)
 */
export function maskTimestampElements(page: Page): Promise<void>;

/**
 * Navigates to a Storybook story
 */
export function navigateToStory(
  page: Page,
  storyId: string,
  config?: VisualTestConfig,
): Promise<void>;

/**
 * Waits for a story to be ready for screenshot
 */
export function waitForStoryReady(
  page: Page,
  targetSelector?: string,
  timeout?: number,
): Promise<boolean>;

/**
 * Captures a screenshot of a story
 */
export function captureStoryScreenshot(
  page: Page,
  targetSelector?: string,
  options?: any,
): Promise<Buffer>;

/**
 * Prepares a story for screenshot (navigate, wait, mask)
 */
export function prepareStoryForScreenshot(
  page: Page,
  storyId: string,
  config?: VisualTestConfig,
): Promise<PrepareStoryResult>;

/**
 * Gets the sanitized snapshot name for a story
 */
export function getSnapshotName(storyId: string): string;

/**
 * Checks if an error should be ignored based on patterns
 */
export function shouldIgnoreError(
  error: Error,
  ignorePatterns?: string[],
): boolean;

/**
 * Retries an async operation with exponential backoff
 */
export function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries?: number,
  initialDelay?: number,
): Promise<T>;

/**
 * Warms up Storybook server by making a request to index.json
 */
export function warmupStorybook(config?: VisualTestConfig): Promise<boolean>;

// ============================================================================
// Position Tracker Types
// ============================================================================

export interface ElementPosition {
  testId: string;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionComparisonResult {
  passed: boolean;
  differences: string[];
}

/**
 * Captures element positions from a Playwright page
 */
export function captureElementPositions(
  page: Page,
  targetSelector?: string,
  config?: VisualTestConfig,
): Promise<ElementPosition[]>;

/**
 * Saves element positions to a JSON file
 */
export function savePositions(
  positions: ElementPosition[],
  snapshotPath: string,
): Promise<void>;

/**
 * Loads element positions from a JSON file
 */
export function loadPositions(
  snapshotPath: string,
): Promise<ElementPosition[] | null>;

/**
 * Compares two sets of element positions
 */
export function comparePositions(
  expected: ElementPosition[],
  actual: ElementPosition[],
  config?: VisualTestConfig,
): PositionComparisonResult;

/**
 * Captures and saves element positions for a story
 */
export function captureAndSavePositions(
  page: Page,
  snapshotPath: string,
  targetSelector?: string,
  config?: VisualTestConfig,
): Promise<void>;

/**
 * Loads and compares element positions for a story
 */
export function loadAndComparePositions(
  page: Page,
  snapshotPath: string,
  targetSelector?: string,
  config?: VisualTestConfig,
): Promise<PositionComparisonResult>;
