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
const getDefaultConfig = () => {
  return {
    testMatcher: {
      tags: DEFAULT_TEST_MATCHER.tags,
      suffix: DEFAULT_TEST_MATCHER.suffix,
    },
    storybook: {
      port: DEFAULT_STORYBOOK_PORT,
      host: DEFAULT_STORYBOOK_HOST,
      indexPath: DEFAULT_STORYBOOK_INDEX_PATH,
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
    snapshot: {
      image: {
        enabled: DEFAULT_ENABLE_IMAGE_SNAPSHOTS,
      },
      position: {
        enabled: DEFAULT_ENABLE_POSITION_SNAPSHOTS,
        orderCheck: DEFAULT_ENABLE_ORDER_CHECK,
        positionThreshold: DEFAULT_POSITION_THRESHOLD,
        sizeThreshold: DEFAULT_SIZE_THRESHOLD,
      },
    },
    diff: {
      targetBranch: DEFAULT_TARGET_BRANCH,
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

  // Parse list values
  if (normalized.testMatcher) {
    if (typeof normalized.testMatcher.tags === "string") {
      normalized.testMatcher.tags = parseList(normalized.testMatcher.tags);
    }

    // Normalize suffix to array if it is a comma-separated string or a single string
    if (normalized.testMatcher.suffix) {
      if (typeof normalized.testMatcher.suffix === "string") {
        // Check if it's a comma-separated list
        if (normalized.testMatcher.suffix.includes(",")) {
          normalized.testMatcher.suffix = parseList(
            normalized.testMatcher.suffix,
          );
        } else {
          // Keep as string if single value, or wrap?
          // Matches logic in story-discovery handles string or array,
          // but let's consistency parse list if commas exist.
          // Actually, suffixes might contain other chars.
          // Use parseList for consistency if it looks like a list.
          normalized.testMatcher.suffix = parseList(
            normalized.testMatcher.suffix,
          );
        }
      }
    }
  }

  // Parse list values
  if (normalized.filters) {
    if (typeof normalized.filters.includePaths === "string") {
      normalized.filters.includePaths = parseList(
        normalized.filters.includePaths,
      );
    }
    if (typeof normalized.filters.storyIds === "string") {
      normalized.filters.storyIds = parseList(normalized.filters.storyIds);
    }
    if (typeof normalized.filters.exclusions === "string") {
      normalized.filters.exclusions = parseList(normalized.filters.exclusions);
    }
  }

  if (
    normalized.paths?.componentPaths &&
    typeof normalized.paths.componentPaths === "string"
  ) {
    normalized.paths.componentPaths = parseList(
      normalized.paths.componentPaths,
    );
  }

  if (
    normalized.errorHandling?.ignorePatterns &&
    typeof normalized.errorHandling.ignorePatterns === "string"
  ) {
    normalized.errorHandling.ignorePatterns = parseList(
      normalized.errorHandling.ignorePatterns,
    );
  }

  // Parse boolean values
  if (normalized.snapshot?.image) {
    if (normalized.snapshot.image.enabled !== undefined) {
      normalized.snapshot.image.enabled = parseBoolean(
        normalized.snapshot.image.enabled,
        DEFAULT_ENABLE_IMAGE_SNAPSHOTS,
      );
    }
  }

  if (normalized.snapshot?.position) {
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
  if (normalized.snapshot?.position) {
    if (normalized.snapshot.position.positionThreshold !== undefined) {
      normalized.snapshot.position.positionThreshold =
        Number(normalized.snapshot.position.positionThreshold) ||
        DEFAULT_POSITION_THRESHOLD;
    }
    if (normalized.snapshot.position.sizeThreshold !== undefined) {
      normalized.snapshot.position.sizeThreshold =
        Number(normalized.snapshot.position.sizeThreshold) ||
        DEFAULT_SIZE_THRESHOLD;
    }
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
  if (config.snapshot?.position?.positionThreshold !== undefined) {
    const threshold = Number(config.snapshot.position.positionThreshold);
    if (isNaN(threshold) || threshold < 0) {
      throw new Error(
        `Invalid position threshold: ${config.snapshot.position.positionThreshold}`,
      );
    }
  }

  if (config.snapshot?.position?.sizeThreshold !== undefined) {
    const threshold = Number(config.snapshot.position.sizeThreshold);
    if (isNaN(threshold) || threshold < 0) {
      throw new Error(
        `Invalid size threshold: ${config.snapshot.position.sizeThreshold}`,
      );
    }
  }
};

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
    const fileConfig = await loadConfigFile(configFilePath);
    config = deepMerge(config, fileConfig);

    // Apply mobile configuration if enabled
    // Mobile config is nested under snapshot.mobile
    if (options.mobile && fileConfig.snapshot?.mobile?.enabled) {
      // Merge mobile-specific testMatcher if provided
      if (fileConfig.snapshot.mobile.testMatcher) {
        config.testMatcher = deepMerge(
          config.testMatcher || {},
          fileConfig.snapshot.mobile.testMatcher,
        );
      }

      // Merge mobile-specific settings
      // For viewports, we'll set them in playwrightConfig.use
      if (
        fileConfig.snapshot.mobile.viewports &&
        fileConfig.snapshot.mobile.viewports.length > 0
      ) {
        // Use the first viewport for now (multi-viewport support can be added later)
        const viewport = fileConfig.snapshot.mobile.viewports[0];
        config.playwrightConfig = config.playwrightConfig || {};
        config.playwrightConfig.use = config.playwrightConfig.use || {};
        config.playwrightConfig.use.viewport = {
          width: viewport.width,
          height: viewport.height,
        };
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
        config.testMatcher = deepMerge(
          config.testMatcher || {},
          fileConfig.snapshot.locale.testMatcher,
        );
      }

      // Store locale code in config for use by other modules
      config.locale = {
        code: options.locale,
        name: localeConfig.name,
        direction: localeConfig.direction || "ltr",
        storybookGlobalParam:
          fileConfig.snapshot.locale.storybookGlobalParam || "locale",
      };
    }
  }

  // 3. Merge programmatic options (highest priority)
  // But preserve the locale object if it was set above
  const localeObject = config.locale;
  config = deepMerge(config, options);
  if (localeObject && typeof localeObject === "object") {
    config.locale = localeObject;
  }

  // 4. Normalize configuration
  config = normalizeConfig(config);

  // 5. Validate configuration
  validateConfig(config);

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
