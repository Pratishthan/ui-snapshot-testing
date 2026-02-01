/**
 * Shared configuration for visual tests
 * This is the single source of truth for default values
 */

/**
 * Default test matcher configuration
 * Defines how visual test stories are identified
 */
export const DEFAULT_TEST_MATCHER = {
  // Stories with these tags are considered visual tests
  tags: ["visual"],
  // Legacy support: match stories with _visual suffix (can be configured by user)
  // suffix: "_visual",
};

/**
 * Default: enable image comparison
 */
export const DEFAULT_ENABLE_IMAGE_SNAPSHOTS = true;

/**
 * Default: enable position tracking
 */
export const DEFAULT_ENABLE_POSITION_SNAPSHOTS = true;

/**
 * Default exclusion patterns for visual tests
 * Stories containing any of these patterns (case-insensitive) are excluded from visual tests
 */
export const DEFAULT_VISUAL_EXCLUSIONS = "no-visual";

// ============================================================================
// Paths Configuration
// ============================================================================

/**
 * Default Playwright configuration path
 */
export const DEFAULT_PLAYWRIGHT_CONFIG_PATH =
  "playwright/config/playwright.storybook.config.ts";

/**
 * Default test spec path
 */
export const DEFAULT_TEST_SPEC_PATH =
  "playwright/storybook-visual/visual-tests.spec.ts";

/**
 * Default logs directory
 */
export const DEFAULT_LOGS_DIR = "logs";

/**
 * Default snapshots directory
 */
export const DEFAULT_SNAPSHOTS_DIR =
  "playwright/storybook-visual/__visual_snapshots__";

/**
 * Default screenshots directory (relative to logs dir)
 */
export const DEFAULT_SCREENSHOTS_DIR = "screenshots";

/**
 * Default component paths to scan for components
 */
export const DEFAULT_COMPONENT_PATHS = ["src/components/"];

// ============================================================================
// Storybook Configuration
// ============================================================================

/**
 * Default Storybook port
 */
export const DEFAULT_STORYBOOK_PORT = "6006";

/**
 * Default Storybook host
 */
export const DEFAULT_STORYBOOK_HOST = "localhost";

/**
 * Default Storybook index path
 */
export const DEFAULT_STORYBOOK_INDEX_PATH = "/index.json";

// ============================================================================
// Test Behavior Configuration
// ============================================================================

/**
 * Default error patterns to ignore
 */
export const DEFAULT_IGNORE_ERROR_PATTERNS = ["closed", "timeout"];

/**
 * Default position threshold (pixels)
 */
export const DEFAULT_POSITION_THRESHOLD = 5;

/**
 * Default size threshold (pixels)
 */
export const DEFAULT_SIZE_THRESHOLD = 5;

/**
 * Default: enable position tracking
 */
export const DEFAULT_ENABLE_POSITION_TRACKING = true;

/**
 * Default: enable order checking
 */
export const DEFAULT_ENABLE_ORDER_CHECK = true;

/**
 * Default minimum width for mobile recommendation discovery (pixels)
 */
export const DEFAULT_MOBILE_DISCOVERY_MIN_WIDTH = 400;

/**
 * Default tags to exclude from mobile recommendations
 */
export const DEFAULT_MOBILE_DISCOVERY_EXCLUDE_TAGS = [];

/**
 * Default target branch for diff-based testing
 */
export const DEFAULT_TARGET_BRANCH = "Sprint16";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the default exclusion patterns
 * @returns {string} Default exclusion patterns (comma-separated)
 */
export const getDefaultExclusions = () => {
  return DEFAULT_VISUAL_EXCLUSIONS;
};

/**
 * Get Storybook URL
 * @param {string} [host] - Storybook host (defaults to DEFAULT_STORYBOOK_HOST)
 * @param {string} [port] - Storybook port (defaults to DEFAULT_STORYBOOK_PORT)
 * @returns {string} Full Storybook URL
 */
export const getStorybookUrl = (
  host = DEFAULT_STORYBOOK_HOST,
  port = DEFAULT_STORYBOOK_PORT,
) => {
  return `http://${host}:${port}`;
};

/**
 * Get Storybook index URL
 * @param {string} [host] - Storybook host (defaults to DEFAULT_STORYBOOK_HOST)
 * @param {string} [port] - Storybook port (defaults to DEFAULT_STORYBOOK_PORT)
 * @returns {string} Full Storybook index URL
 */
export const getStorybookIndexUrl = (
  host = DEFAULT_STORYBOOK_HOST,
  port = DEFAULT_STORYBOOK_PORT,
) => {
  return `${getStorybookUrl(host, port)}${DEFAULT_STORYBOOK_INDEX_PATH}`;
};
