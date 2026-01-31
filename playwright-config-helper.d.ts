/**
 * Playwright Config Helper Type Definitions
 */

import { PlaywrightTestConfig } from "@playwright/test";

/**
 * Visual test configuration object
 */
export interface VisualTestConfig {
  mode?: string;
  snapshot?: {
    type?: "image" | "json" | "both";
    image?: {
      maxDiffPixelRatio?: number;
      maxDiffPixels?: number;
      threshold?: number;
    };
    position?: {
      enabled?: boolean;
      orderCheck?: boolean;
      positionThreshold?: number;
      sizeThreshold?: number;
    };
  };
  storybook?: {
    port?: string;
    host?: string;
  };
  filters?: {
    keywords?: string[];
    exclusions?: string[];
    includePaths?: string[];
    storyIds?: string[];
  };
  paths?: {
    snapshotsDir?: string;
    logsDir?: string;
    resultsFile?: string;
    failuresFile?: string;
    htmlReport?: string;
    logFile?: string;
    screenshotsDir?: string;
  };
  playwrightConfig?: {
    fullyParallel?: boolean;
    workers?: number;
    retries?: number;
    forbidOnly?: boolean;
    timeout?: number;
    expect?: {
      timeout?: number;
    };
    reporter?: any[];
    use?: Record<string, any>;
    projects?: any[];
  };
  storybookConfig?: {
    command?: string | null;
    timeout?: number;
    reuseExistingServer?: boolean;
  };
  playwright?: {
    masking?: {
      selectors?: string[];
    };
  };
}

/**
 * Creates a Playwright configuration object from visual tests configuration
 *
 * @param visualTestConfig - The visual tests configuration object
 * @param overrides - Optional overrides to merge with generated config
 * @returns Playwright configuration object
 */
export function createPlaywrightConfig(
  visualTestConfig?: VisualTestConfig,
  overrides?: Partial<PlaywrightTestConfig>,
): PlaywrightTestConfig;
