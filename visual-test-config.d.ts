/**
 * TypeScript declarations for visual-test-config.js
 */

// ============================================================================
// Visual Test Mode and Keywords
// ============================================================================

/**
 * Default visual test keywords for full mode
 */
export const DEFAULT_VISUAL_KEYWORDS: string;

/**
 * Default visual test mode
 */
export const DEFAULT_VISUAL_TEST_MODE: 'lite' | 'full';

/**
 * Default exclusion patterns for visual tests
 */
export const DEFAULT_VISUAL_EXCLUSIONS: string;

// ============================================================================
// Paths Configuration
// ============================================================================

/**
 * Default Playwright configuration path
 */
export const DEFAULT_PLAYWRIGHT_CONFIG_PATH: string;

/**
 * Default test spec path
 */
export const DEFAULT_TEST_SPEC_PATH: string;

/**
 * Default logs directory
 */
export const DEFAULT_LOGS_DIR: string;

/**
 * Default snapshots directory
 */
export const DEFAULT_SNAPSHOTS_DIR: string;

/**
 * Default screenshots directory (relative to logs dir)
 */
export const DEFAULT_SCREENSHOTS_DIR: string;

/**
 * Default component paths to scan for components
 */
export const DEFAULT_COMPONENT_PATHS: string[];

// ============================================================================
// Storybook Configuration
// ============================================================================

/**
 * Default Storybook port
 */
export const DEFAULT_STORYBOOK_PORT: string;

/**
 * Default Storybook host
 */
export const DEFAULT_STORYBOOK_HOST: string;

/**
 * Default Storybook index path
 */
export const DEFAULT_STORYBOOK_INDEX_PATH: string;

// ============================================================================
// Test Behavior Configuration
// ============================================================================

/**
 * Default error patterns to ignore
 */
export const DEFAULT_IGNORE_ERROR_PATTERNS: string[];

/**
 * Default position threshold (pixels)
 */
export const DEFAULT_POSITION_THRESHOLD: number;

/**
 * Default size threshold (pixels)
 */
export const DEFAULT_SIZE_THRESHOLD: number;

/**
 * Default: enable position tracking
 */
export const DEFAULT_ENABLE_POSITION_TRACKING: boolean;

/**
 * Default: enable order checking
 */
export const DEFAULT_ENABLE_ORDER_CHECK: boolean;

/**
 * Default target branch for diff-based testing
 */
export const DEFAULT_TARGET_BRANCH: string;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the default visual keywords for a given mode
 * @param mode - 'lite' or 'full'
 * @returns Default keywords (empty string for lite mode)
 */
export function getDefaultKeywordsForMode(mode: 'lite' | 'full'): string;

/**
 * Get the default exclusion patterns
 * @returns Default exclusion patterns (comma-separated)
 */
export function getDefaultExclusions(): string;

/**
 * Get Storybook URL
 * @param host - Storybook host (defaults to DEFAULT_STORYBOOK_HOST)
 * @param port - Storybook port (defaults to DEFAULT_STORYBOOK_PORT)
 * @returns Full Storybook URL
 */
export function getStorybookUrl(host?: string, port?: string): string;

/**
 * Get Storybook index URL
 * @param host - Storybook host (defaults to DEFAULT_STORYBOOK_HOST)
 * @param port - Storybook port (defaults to DEFAULT_STORYBOOK_PORT)
 * @returns Full Storybook index URL
 */
export function getStorybookIndexUrl(host?: string, port?: string): string;
