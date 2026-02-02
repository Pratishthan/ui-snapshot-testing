#!/usr/bin/env node

/**
 * Configuration loader for visual tests
 * Merges configuration from multiple sources with clear precedence:
 * 1. Programmatic options (highest priority)
 * 2. Config file
 * 3. Default values (lowest priority)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  DEFAULT_TEST_MATCHER,
  DEFAULT_VISUAL_EXCLUSIONS,
  DEFAULT_PLAYWRIGHT_CONFIG_PATH,
  DEFAULT_TEST_SPEC_PATH,
  DEFAULT_LOGS_DIR,
  DEFAULT_SNAPSHOTS_DIR,
  DEFAULT_SCREENSHOTS_DIR,
  DEFAULT_COMPONENT_PATHS,
  DEFAULT_STORYBOOK_PORT,
  DEFAULT_STORYBOOK_HOST,
  DEFAULT_STORYBOOK_INDEX_PATH,
  DEFAULT_IGNORE_ERROR_PATTERNS,
  DEFAULT_POSITION_THRESHOLD,
  DEFAULT_SIZE_THRESHOLD,
  DEFAULT_ENABLE_POSITION_TRACKING,
  DEFAULT_ENABLE_ORDER_CHECK,
  DEFAULT_TARGET_BRANCH,
  DEFAULT_ENABLE_IMAGE_SNAPSHOTS,
  DEFAULT_ENABLE_POSITION_SNAPSHOTS,
} from "./visual-test-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse comma-separated list from string
 * @param {string} value - Comma-separated string
 * @returns {string[]} Array of trimmed values
 */
const parseList = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

/**
 * Parse boolean value from string or boolean
 * @param {string|boolean} value - Value to parse
 * @param {boolean} defaultValue - Default value if undefined
 * @returns {boolean} Parsed boolean value
 */
const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
  }
  return defaultValue;
};

/**
 * Load configuration from file
 * @param {string} configPath - Path to config file
 * @returns {Promise<object>} Configuration object
 */
const loadConfigFile = async (configPath) => {
  if (!configPath || !fs.existsSync(configPath)) {
    return {};
  }

  const ext = path.extname(configPath);

  try {
    if (ext === ".json") {
      const content = fs.readFileSync(configPath, "utf8");
      return JSON.parse(content);
    } else if (ext === ".js" || ext === ".mjs") {
      const fileUrl = new URL(`file://${path.resolve(configPath)}`);
      const module = await import(fileUrl.href);
      return module.default || module;
    }
  } catch (error) {
    console.warn(`Failed to load config file ${configPath}: ${error.message}`);
    return {};
  }

  return {};
};

/**
 * Find config file in project root
 * @returns {string|null} Path to config file or null
 */
const findConfigFile = () => {
  const possibleNames = [
    "visual-tests.config.js",
    "visual-tests.config.mjs",
    "visual-tests.config.json",
    ".visual-tests.config.js",
    ".visual-tests.config.mjs",
    ".visual-tests.config.json",
  ];

  const projectRoot = process.cwd();

  for (const name of possibleNames) {
    const filePath = path.join(projectRoot, name);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
};

/**
 * Get default configuration
 * @returns {object} Default configuration object
 */
export const getDefaultConfig = () => {
  return {
    storybook: {
      port: DEFAULT_STORYBOOK_PORT,
      host: DEFAULT_STORYBOOK_HOST,
      indexPath: DEFAULT_STORYBOOK_INDEX_PATH,
      command: "npm run storybook",
      timeout: 120000,
      reuseExistingServer: true,
    },
    snapshot: {
      testMatcher: {
        tags: DEFAULT_TEST_MATCHER.tags,
      },
      filters: {
        includePaths: [],
        storyIds: [],
        exclusions: DEFAULT_VISUAL_EXCLUSIONS,
      },
      paths: {
        playwrightConfig: DEFAULT_PLAYWRIGHT_CONFIG_PATH,
        testSpec: DEFAULT_TEST_SPEC_PATH,
        logsDir: DEFAULT_LOGS_DIR,
        snapshotsDir: DEFAULT_SNAPSHOTS_DIR,
        screenshotsDir: DEFAULT_SCREENSHOTS_DIR,
        componentPaths: DEFAULT_COMPONENT_PATHS,
      },
      errorHandling: {
        ignorePatterns: DEFAULT_IGNORE_ERROR_PATTERNS,
      },
      image: {
        enabled: DEFAULT_ENABLE_IMAGE_SNAPSHOTS,
      },
      position: {
        enabled: DEFAULT_ENABLE_POSITION_SNAPSHOTS,
        orderCheck: DEFAULT_ENABLE_ORDER_CHECK,
        thresholds: {
          position: DEFAULT_POSITION_THRESHOLD,
          size: DEFAULT_SIZE_THRESHOLD,
        },
      },
      diff: {
        targetBranch: DEFAULT_TARGET_BRANCH,
      },
      masking: {
        selectors: [],
      },
    },
    playwright: {
      fullyParallel: true,
      workers: 6,
      timeout: 30000,
      retries: 0,
      forbidOnly: false,
      expect: {
        timeout: 5000,
      },
      reporter: [
        [
          "html",
          { outputFolder: "logs/playwright/storybook/reports", open: "never" },
        ],
        ["list"],
        [
          "json",
          { outputFile: "logs/playwright/storybook/reports/results.json" },
        ],
      ],
      use: {
        trace: "off",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        viewport: { width: 800, height: 600 },
        ignoreHTTPSErrors: true,
      },
      projects: [
        {
          name: "chromium",
        },
      ],
    },
  };
};

/**
 * Deep merge objects (later values override earlier ones)
 * @param {object} target - Target object
 * @param {object} source - Source object
 * @returns {object} Merged object
 */
const deepMerge = (target, source) => {
  const result = { ...target };

  for (const key in source) {
    if (source[key] === undefined || source[key] === null) {
      continue; // Skip undefined/null values
    }

    if (
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      source[key] !== null
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
};

/**
 * Normalize configuration (parse strings, apply defaults)
 * @param {object} config - Raw configuration object
 * @returns {object} Normalized configuration
 */
const normalizeConfig = (config) => {
  const normalized = { ...config };

  // Ensure snapshot object exists
  if (!normalized.snapshot) {
    normalized.snapshot = {};
  }

  // Parse list values
  if (normalized.snapshot.testMatcher) {
    if (typeof normalized.snapshot.testMatcher.tags === "string") {
      normalized.snapshot.testMatcher.tags = parseList(
        normalized.snapshot.testMatcher.tags,
      );
    }

    // Normalize suffix to array if it is a comma-separated string or a single string
    if (normalized.snapshot.testMatcher.suffix) {
      if (typeof normalized.snapshot.testMatcher.suffix === "string") {
        // Check if it's a comma-separated list
        if (normalized.snapshot.testMatcher.suffix.includes(",")) {
          normalized.snapshot.testMatcher.suffix = parseList(
            normalized.snapshot.testMatcher.suffix,
          );
        } else {
          normalized.snapshot.testMatcher.suffix = parseList(
            normalized.snapshot.testMatcher.suffix,
          );
        }
      }
    }
  }

  // Parse list values
  if (normalized.snapshot.filters) {
    if (typeof normalized.snapshot.filters.includePaths === "string") {
      normalized.snapshot.filters.includePaths = parseList(
        normalized.snapshot.filters.includePaths,
      );
    }
    if (typeof normalized.snapshot.filters.storyIds === "string") {
      normalized.snapshot.filters.storyIds = parseList(
        normalized.snapshot.filters.storyIds,
      );
    }
    if (typeof normalized.snapshot.filters.exclusions === "string") {
      normalized.snapshot.filters.exclusions = parseList(
        normalized.snapshot.filters.exclusions,
      );
    }
  }

  if (
    normalized.snapshot.paths?.componentPaths &&
    typeof normalized.snapshot.paths.componentPaths === "string"
  ) {
    normalized.snapshot.paths.componentPaths = parseList(
      normalized.snapshot.paths.componentPaths,
    );
  }

  if (
    normalized.snapshot.errorHandling?.ignorePatterns &&
    typeof normalized.snapshot.errorHandling.ignorePatterns === "string"
  ) {
    normalized.snapshot.errorHandling.ignorePatterns = parseList(
      normalized.snapshot.errorHandling.ignorePatterns,
    );
  }

  // Parse boolean values
  if (normalized.snapshot.image) {
    if (normalized.snapshot.image.enabled !== undefined) {
      normalized.snapshot.image.enabled = parseBoolean(
        normalized.snapshot.image.enabled,
        DEFAULT_ENABLE_IMAGE_SNAPSHOTS,
      );
    }
  }

  if (normalized.snapshot.position) {
    if (normalized.snapshot.position.enabled !== undefined) {
      normalized.snapshot.position.enabled = parseBoolean(
        normalized.snapshot.position.enabled,
        DEFAULT_ENABLE_POSITION_SNAPSHOTS,
      );
    }
    if (normalized.snapshot.position.orderCheck !== undefined) {
      normalized.snapshot.position.orderCheck = parseBoolean(
        normalized.snapshot.position.orderCheck,
        DEFAULT_ENABLE_ORDER_CHECK,
      );
    }
  }

  // Parse numeric values
  if (normalized.snapshot.position) {
    if (!normalized.snapshot.position.thresholds) {
      normalized.snapshot.position.thresholds = {};
    }

    // Handle old flattened structure if present (sanity check)
    if (normalized.snapshot.position.positionThreshold !== undefined) {
      normalized.snapshot.position.thresholds.position =
        normalized.snapshot.position.positionThreshold;
      delete normalized.snapshot.position.positionThreshold;
    }
    if (normalized.snapshot.position.sizeThreshold !== undefined) {
      normalized.snapshot.position.thresholds.size =
        normalized.snapshot.position.sizeThreshold;
      delete normalized.snapshot.position.sizeThreshold;
    }

    if (normalized.snapshot.position.thresholds.position !== undefined) {
      normalized.snapshot.position.thresholds.position =
        Number(normalized.snapshot.position.thresholds.position) ||
        DEFAULT_POSITION_THRESHOLD;
    }
    if (normalized.snapshot.position.thresholds.size !== undefined) {
      normalized.snapshot.position.thresholds.size =
        Number(normalized.snapshot.position.thresholds.size) ||
        DEFAULT_SIZE_THRESHOLD;
    }
  }

  // Ensure masking.selectors is an array
  if (
    normalized.snapshot.masking &&
    normalized.snapshot.masking.selectors &&
    typeof normalized.snapshot.masking.selectors === "string"
  ) {
    normalized.snapshot.masking.selectors = parseList(
      normalized.snapshot.masking.selectors,
    );
  }

  return normalized;
};

/**
 * Validate configuration
 * @param {object} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
const validateConfig = (config) => {
  // Validate storybook port
  if (config.storybook?.port) {
    const port = Number(config.storybook.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid Storybook port: ${config.storybook.port}`);
    }
  }

  // Validate position tracking thresholds
  if (config.snapshot?.position?.thresholds?.position !== undefined) {
    const threshold = Number(config.snapshot.position.thresholds.position);
    if (isNaN(threshold) || threshold < 0) {
      throw new Error(
        `Invalid position threshold: ${config.snapshot.position.thresholds.position}`,
      );
    }
  }

  if (config.snapshot?.position?.thresholds?.size !== undefined) {
    const threshold = Number(config.snapshot.position.thresholds.size);
    if (isNaN(threshold) || threshold < 0) {
      throw new Error(
        `Invalid size threshold: ${config.snapshot.position.thresholds.size}`,
      );
    }
  }
};

/**
 * Migrate old configuration to new structure (Backward Compatibility)
 * @param {object} config - Raw configuration object
 * @returns {object} Migrated configuration object
 */

/**
 * Load configuration from all sources
 * Priority: programmatic > config file > defaults
 *
 * @param {object} [options={}] - Programmatic configuration options
 * @param {string} [options.configFile] - Path to config file (overrides auto-detection)
 * @returns {Promise<object>} Merged configuration object
 */
export const loadConfig = async (options = {}) => {
  // 1. Start with defaults
  let config = getDefaultConfig();

  // 2. Load from config file (if exists)
  const configFilePath = options.configFile || findConfigFile();

  if (configFilePath) {
    let fileConfig = await loadConfigFile(configFilePath);

    config = deepMerge(config, fileConfig);

    // Apply mobile configuration if enabled
    // Mobile config is nested under snapshot.mobile
    if (options.mobile && fileConfig.snapshot?.mobile?.enabled) {
      // Merge mobile-specific testMatcher if provided
      if (fileConfig.snapshot.mobile.testMatcher) {
        config.snapshot.testMatcher = deepMerge(
          config.snapshot.testMatcher || {},
          fileConfig.snapshot.mobile.testMatcher,
        );
      }

      // Merge mobile-specific settings
      // For viewports, we'll set them in playwright.use (was playwrightConfig.use)
      if (
        fileConfig.snapshot.mobile.viewports &&
        fileConfig.snapshot.mobile.viewports.length > 0
      ) {
        // Use the first viewport for now (multi-viewport support can be added later)
        const viewport = fileConfig.snapshot.mobile.viewports[0];
        config.playwright = config.playwright || {};
        config.playwright.use = config.playwright.use || {};
        config.playwright.use.viewport = {
          width: viewport.width,
          height: viewport.height,
        };
        config.activeViewport = viewport; // Store for use by other modules
      }
    }

    // Apply locale configuration if enabled
    // Locale config is nested under snapshot.locale
    if (options.locale && fileConfig.snapshot?.locale?.enabled) {
      // Validate locale exists in configured locales
      const locales = fileConfig.snapshot.locale.locales || [];
      const localeConfig = locales.find((l) => l.code === options.locale);

      if (!localeConfig) {
        const availableLocales = locales.map((l) => l.code).join(", ");
        throw new Error(
          `Invalid locale: ${options.locale}. Available locales: ${availableLocales || "none configured"}`,
        );
      }

      // Merge locale-specific testMatcher if provided
      if (fileConfig.snapshot.locale.testMatcher) {
        config.snapshot.testMatcher = deepMerge(
          config.snapshot.testMatcher || {},
          fileConfig.snapshot.locale.testMatcher,
        );
      }

      // Store locale code in config for use by other modules
      config.locale = {
        code: options.locale,
        name: localeConfig.name,
        direction: localeConfig.direction || "ltr",
        default: localeConfig.default || false,
        storybookGlobalParam:
          fileConfig.snapshot.locale.storybookGlobalParam || "locale",
      };
    }
  }

  // 3. Merge programmatic options (highest priority)
  // But preserve the locale object and testMatcher if they were set above
  // This is necessary because options.locale might be a string (locale code)
  // which would overwrite the locale object we created
  const localeObject = config.locale;
  const testMatcherObject = config.snapshot?.testMatcher;

  config = deepMerge(config, options);

  // Restore locale object if it was set (don't let string locale code overwrite it)
  if (localeObject && typeof localeObject === "object") {
    config.locale = localeObject;
  }

  // Restore testMatcher if it was overridden for locale/mobile mode
  // Only restore if the options didn't explicitly provide a testMatcher
  if (testMatcherObject && !options.snapshot?.testMatcher) {
    config.snapshot.testMatcher = testMatcherObject;
  }

  // 4. Normalize configuration
  config = normalizeConfig(config);

  // 5. Validate configuration
  validateConfig(config);

  // Ensure maskSelectors is populated for backward compatibility with helpers.js
  // helpers.js uses config.maskSelectors
  if (config.masking && config.masking.selectors) {
    config.maskSelectors = config.masking.selectors;
  }

  return config;
};

/**
 * Get configuration value by path (e.g., 'storybook.port')
 * @param {object} config - Configuration object
 * @param {string} path - Dot-separated path to value
 * @param {*} [defaultValue] - Default value if path not found
 * @returns {*} Configuration value
 */
export const getConfigValue = (config, path, defaultValue = undefined) => {
  const keys = path.split(".");
  let value = config;

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }

  return value;
};
