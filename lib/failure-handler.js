/**
 * Failure Handler Module
 * Handles parsing, categorizing, and filtering test failures
 */

import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

/**
 * Check if error is a snapshot mismatch (should never be ignored)
 * @param {string} errorMessage - Error message
 * @returns {boolean} True if error is a snapshot mismatch
 */
export const isSnapshotMismatch = (errorMessage) => {
  const errorLower = errorMessage.toLowerCase();
  const snapshotIndicators = [
    'snapshot',
    'comparison',
    'toMatchSnapshot',
    'screenshot comparison',
    'image comparison',
    'visual regression',
    'snapshot mismatch',
    'expected image',
    'actual image',
    'pixel',
    'threshold',
  ];

  return snapshotIndicators.some((indicator) => errorLower.includes(indicator));
};

/**
 * Check if error should be ignored based on patterns
 * @param {string} errorMessage - Error message
 * @param {string[]} ignorePatterns - Patterns to ignore
 * @returns {boolean} True if error should be ignored
 */
export const shouldIgnoreError = (errorMessage, ignorePatterns) => {
  if (!ignorePatterns || ignorePatterns.length === 0) {
    return false;
  }

  // Snapshot mismatches should never be ignored
  if (isSnapshotMismatch(errorMessage)) {
    return false;
  }

  const errorLower = errorMessage.toLowerCase();
  const patterns = Array.isArray(ignorePatterns)
    ? ignorePatterns
    : [ignorePatterns];

  return patterns.some((pattern) => errorLower.includes(pattern.toLowerCase()));
};

/**
 * Parse failures from log file
 * @param {string} logFile - Path to log file
 * @param {object} config - Configuration object
 * @returns {Promise<Array>} Array of failure objects
 */
export const parseFailures = async (logFile, config) => {
  const failures = [];

  if (!fs.existsSync(logFile)) {
    return failures;
  }

  try {
    const logContent = await fsPromises.readFile(logFile, 'utf-8');
    const lines = logContent.split('\n');

    for (const line of lines) {
      if (line.startsWith('FAIL ')) {
        // Extract storyId and error message from "FAIL [storyId] error message"
        const match = line.match(/^FAIL \[([^\]]+)\]\s+(.+)$/);
        if (match) {
          const [, storyId, errorMessage] = match;
          failures.push({
            storyId,
            errorMessage,
            importPath: null, // Will be populated later if available
          });
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to parse failures from ${logFile}: ${error.message}`);
  }

  return failures;
};

/**
 * Read failures from JSONL file
 * @param {string} failuresFile - Path to failures JSONL file
 * @returns {Promise<Array>} Array of failure objects
 */
export const readFailuresFromJsonl = async (failuresFile) => {
  if (!fs.existsSync(failuresFile)) {
    return [];
  }

  try {
    const content = await fsPromises.readFile(failuresFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const failures = lines.map((line) => JSON.parse(line));

    // Deduplicate by story ID
    return Array.from(new Map(failures.map((f) => [f.id, f])).values());
  } catch (error) {
    console.warn(
      `Failed to read failures from ${failuresFile}: ${error.message}`,
    );
    return [];
  }
};

/**
 * Read passed stories from JSONL file
 * @param {string} passedFile - Path to passed JSONL file
 * @returns {Promise<Array>} Array of passed story IDs
 */
export const readPassedFromJsonl = async (passedFile) => {
  if (!fs.existsSync(passedFile)) {
    return [];
  }

  try {
    const content = await fsPromises.readFile(passedFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const passed = lines.map((line) => JSON.parse(line));

    // Deduplicate
    return Array.from(new Set(passed.map((p) => p.id)));
  } catch (error) {
    return [];
  }
};

/**
 * Read ignored stories from JSONL file
 * @param {string} ignoredFile - Path to ignored JSONL file
 * @returns {Promise<Array>} Array of ignored story objects
 */
export const readIgnoredFromJsonl = async (ignoredFile) => {
  if (!fs.existsSync(ignoredFile)) {
    return [];
  }

  try {
    const content = await fsPromises.readFile(ignoredFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const ignored = lines.map((line) => JSON.parse(line));

    // Deduplicate by story ID
    return Array.from(new Map(ignored.map((i) => [i.id, i])).values());
  } catch (error) {
    return [];
  }
};

/**
 * Read skipped stories from JSONL file
 * @param {string} skippedFile - Path to skipped JSONL file
 * @returns {Promise<Array>} Array of skipped story objects
 */
export const readSkippedFromJsonl = async (skippedFile) => {
  if (!fs.existsSync(skippedFile)) {
    return [];
  }

  try {
    const content = await fsPromises.readFile(skippedFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const skipped = lines.map((line) => JSON.parse(line));

    // Deduplicate by story ID
    return Array.from(new Map(skipped.map((s) => [s.id, s])).values());
  } catch (error) {
    return [];
  }
};

/**
 * Categorize failures into ignorable and non-ignorable
 * @param {Array} failures - Array of failure objects
 * @param {object} config - Configuration object
 * @returns {object} Object with ignorable and nonIgnorable arrays
 */
export const categorizeFailures = (failures, config) => {
  const ignorable = [];
  const nonIgnorable = [];

  for (const failure of failures) {
    if (
      shouldIgnoreError(
        failure.message || failure.errorMessage,
        config.errorHandling.ignorePatterns,
      )
    ) {
      ignorable.push(failure);
    } else {
      nonIgnorable.push(failure);
    }
  }

  return { ignorable, nonIgnorable };
};

/**
 * Check if all failures are ignorable
 * @param {Array} failures - Array of failure objects
 * @param {object} config - Configuration object
 * @returns {boolean} True if all failures are ignorable
 */
export const allFailuresIgnorable = (failures, config) => {
  if (failures.length === 0) {
    return false;
  }

  return failures.every((failure) =>
    shouldIgnoreError(
      failure.message || failure.errorMessage,
      config.errorHandling.ignorePatterns,
    ),
  );
};

/**
 * Get failure summary
 * @param {Array} failures - Array of failure objects
 * @param {object} config - Configuration object
 * @returns {object} Summary object with counts
 */
export const getFailureSummary = (failures, config) => {
  const { ignorable, nonIgnorable } = categorizeFailures(failures, config);

  return {
    total: failures.length,
    ignorable: ignorable.length,
    nonIgnorable: nonIgnorable.length,
    allIgnorable: ignorable.length > 0 && nonIgnorable.length === 0,
  };
};

/**
 * Generate failures log from Playwright JSON report
 * @param {string} jsonReportPath - Path to Playwright JSON report
 * @param {string} outputJsonlPath - Path to output JSONL file
 * @returns {Promise<number>} Number of failures found
 */
export const generateFailuresLog = async (jsonReportPath, outputJsonlPath) => {
  if (!fs.existsSync(jsonReportPath)) {
    console.warn(`JSON report not found: ${jsonReportPath}`);
    return 0;
  }

  try {
    const reportContent = await fsPromises.readFile(jsonReportPath, "utf8");
    const report = JSON.parse(reportContent);
    const failures = [];

    // Recursive function to traverse suites
    const extractFailures = (suite) => {
      if (suite.specs) {
        for (const spec of suite.specs) {
          for (const test of spec.tests) {
            // Check if test failed
            // A test is failed if the last result is not passed/skipped
            const lastResult = test.results[test.results.length - 1];
            if (
              lastResult &&
              lastResult.status !== "passed" &&
              lastResult.status !== "skipped"
            ) {
              const errorMessage = lastResult.error
                ? lastResult.error.message
                : "Unknown error";
              
              // Use spec title as story ID
              failures.push({
                id: spec.title,
                message: errorMessage,
                importPath: spec.file, // Playwright provides file path
              });
            }
          }
        }
      }

      if (suite.suites) {
        for (const childSuite of suite.suites) {
          extractFailures(childSuite);
        }
      }
    };

    if (report.suites) {
      for (const suite of report.suites) {
        extractFailures(suite);
      }
    }

    // Write to JSONL
    const jsonlContent = failures
      .map((f) => JSON.stringify(f))
      .join("\n");
    
    // Ensure directory exists
    const dir = path.dirname(outputJsonlPath);
    if (!fs.existsSync(dir)) {
      await fsPromises.mkdir(dir, { recursive: true });
    }

    await fsPromises.writeFile(outputJsonlPath, jsonlContent);
    return failures.length;
  } catch (error) {
    console.error(`Error processing results: ${error.message}`);
    return 0;
  }
};
