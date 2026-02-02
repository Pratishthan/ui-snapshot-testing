/**
 * Test Runner Utilities
 * Shared helpers for CLI commands to generate test files and manage execution
 */

import fs from "fs";
import path from "path";

/**
 * Generate temporary test files (data and spec)
 * @param {object} config - Configuration object
 * @param {Array} stories - Array of stories to test
 * @returns {object} Object containing paths to generated files { dataFile, specFile }
 */
export const generateTestFiles = (config, stories) => {
  const logsDir = path.resolve(process.cwd(), config.snapshot.paths.logsDir);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // 1. Generate Data File
  const dataFile = path.join(logsDir, "visual-tests-data.json");
  fs.writeFileSync(dataFile, JSON.stringify({ config, stories }, null, 2));

  // 2. Generate Spec File
  // This ensures @playwright/test is resolved from the consumer's dependencies
  // to avoid Dual Package Hazard
  const specFile = path.join(logsDir, "visual-tests.generated.spec.js");
  const specContent = `
    import { test, expect } from '@playwright/test';
    import { generateVisualTestsFromData, readVisualTestsData } from 'ui-snapshot-testing/playwright';

    // Read data
    const dataFile = process.env.VISUAL_TESTS_DATA_FILE;
    const { stories, config } = readVisualTestsData(dataFile);

    // Generate tests
    generateVisualTestsFromData({ stories, config, test, expect });
  `;
  fs.writeFileSync(specFile, specContent);

  return { dataFile, specFile };
};

/**
 * Clean up temporary test files
 * @param {object} files - Object containing paths { dataFile, specFile }
 */
export const cleanupTestFiles = (files) => {
  const { dataFile, specFile } = files;

  try {
    if (dataFile && fs.existsSync(dataFile)) {
      fs.unlinkSync(dataFile);
    }
    if (specFile && fs.existsSync(specFile)) {
      fs.unlinkSync(specFile);
    }
  } catch (e) {
    // Ignore cleanup errors
  }
};
