/**
 * TypeScript declarations for config-loader.js
 */

/**
 * Visual test configuration object
 */
export interface VisualTestConfig {
  /** Storybook configuration */
  storybook: {
    /** Storybook port */
    port: string;
    /** Storybook host */
    host: string;
    /** Storybook index path */
    indexPath: string;
    /** Command to start Storybook */
    command?: string;
    /** Timeout for Storybook to start (ms) */
    timeout?: number;
    /** Reuse existing Storybook server */
    reuseExistingServer?: boolean;
  };

  playwright?: {
    fullyParallel?: boolean;
    workers?: number;
    timeout?: number;
    retries?: number;
    forbidOnly?: boolean;
    expect?: {
      timeout?: number;
    };
    reporter?: Array<string | [string, any]>;
    use?: {
      trace?: string;
      screenshot?: string;
      video?: string;
      viewport?: { width: number; height: number };
      ignoreHTTPSErrors?: boolean;
      [key: string]: any;
    };
    projects?: Array<{
      name: string;
      use?: any;
      [key: string]: any;
    }>;
    [key: string]: any;
  };

  /** Snapshot configuration */
  snapshot: {
    /** Test matcher configuration */
    testMatcher: {
      tags: string[];
      suffix?: string[];
      keywords?: string[];
    };
    /** Story filtering configuration */
    filters: {
      includePaths: string[];
      storyIds: string[];
      keywords: string[];
      exclusions: string[];
    };
    /** Path configuration */
    paths: {
      playwrightConfig: string;
      testSpec: string;
      logsDir: string;
      snapshotsDir: string;
      screenshotsDir: string;
      componentPaths: string[];
    };
    /** Error handling configuration */
    errorHandling: {
      ignorePatterns: string[];
    };
    /** Diff-based testing configuration */
    diff: {
      targetBranch: string;
    };
    /** Masking configuration */
    masking: {
      selectors: string[];
    };

    /** Image snapshot configuration */
    image?: {
      enabled: boolean;
      testMatcher?: {
        tags?: string[];
      };
    };
    /** Position snapshot configuration */
    position?: {
      enabled: boolean;
      orderCheck: boolean;
      thresholds: {
        position: number;
        size: number;
      };
      testMatcher?: {
        tags?: string[];
      };
    };
    /** Mobile snapshot configuration */
    mobile?: {
      enabled: boolean;
      viewports?: Array<{ width: number; height: number; name?: string }>;
      testMatcher?: {
        tags?: string[];
      };
      /** Discovery configuration for mobile recommendations */
      discovery?: {
        thresholds?: {
          minWidth?: number;
        };
        excludeTags?: string[];
      };
    };
    /** Locale snapshot configuration */
    locale?: {
      enabled: boolean;
      locales?: Array<{
        code: string;
        name: string;
        direction?: "ltr" | "rtl";
        default?: boolean;
      }>;
      testMatcher?: {
        tags?: string[];
      };
      storybookGlobalParam?: string;
    };
  };

  /** Active configuration state (runtime only) */
  activeViewport?: { width: number; height: number; name?: string };
  locale?: {
    code: string;
    name: string;
    direction: string;
    default: boolean;
    storybookGlobalParam: string;
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
