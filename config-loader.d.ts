/**
 * TypeScript declarations for config-loader.js
 */

/**
 * Visual test configuration object
 */
export interface VisualTestConfig {
  /** Test mode: 'lite' (only _visual stories) or 'full' (keyword matching) */
  mode: 'lite' | 'full';

  /** Storybook configuration */
  storybook: {
    /** Storybook port */
    port: string;
    /** Storybook host */
    host: string;
    /** Storybook index path */
    indexPath: string;
  };

  /** Story filtering configuration */
  filters: {
    /** Path segments to include (stories must match at least one) */
    includePaths: string[];
    /** Specific story IDs to include */
    storyIds: string[];
    /** Keywords to match in story names */
    keywords: string[];
    /** Exclusion patterns (stories matching these are excluded) */
    exclusions: string[];
  };

  /** Path configuration */
  paths: {
    /** Playwright configuration file path */
    playwrightConfig: string;
    /** Test spec file path */
    testSpec: string;
    /** Logs directory */
    logsDir: string;
    /** Snapshots directory */
    snapshotsDir: string;
    /** Screenshots directory (relative to logs dir) */
    screenshotsDir: string;
    /** Component paths to scan */
    componentPaths: string[];
  };

  /** Error handling configuration */
  errorHandling: {
    /** Error message patterns to ignore */
    ignorePatterns: string[];
  };

  /** Position tracking configuration */
  positionTracking: {
    /** Enable position tracking */
    enabled: boolean;
    /** Enable order checking */
    orderCheck: boolean;
    /** Position threshold in pixels */
    positionThreshold: number;
    /** Size threshold in pixels */
    sizeThreshold: number;
  };

  /** Diff-based testing configuration */
  diff: {
    /** Target branch for diff comparison */
    targetBranch: string;
  };
}

/**
 * Configuration loading options
 */
export interface ConfigOptions extends Partial<VisualTestConfig> {
  /** Path to config file (overrides auto-detection) */
  configFile?: string;
}

/**
 * Load configuration from all sources
 * Priority: programmatic > env vars > config file > defaults
 *
 * @param options - Programmatic configuration options
 * @returns Merged configuration object
 */
export function loadConfig(options?: ConfigOptions): Promise<VisualTestConfig>;

/**
 * Get configuration value by path (e.g., 'storybook.port')
 * @param config - Configuration object
 * @param path - Dot-separated path to value
 * @param defaultValue - Default value if path not found
 * @returns Configuration value
 */
export function getConfigValue<T = any>(
  config: VisualTestConfig,
  path: string,
  defaultValue?: T,
): T;
