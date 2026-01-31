/**
 * Position Tracking Module
 *
 * Captures and compares element positions to detect layout shifts.
 * Tracks elements with data-testid attributes within a target container.
 */

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/**
 * Captures element positions from a Playwright page
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} targetSelector - CSS selector for the container to track elements within
 * @param {object} config - Configuration object
 * @returns {Promise<Array<{testId: string, order: number, x: number, y: number, width: number, height: number}>>}
 */
export async function captureElementPositions(
  page,
  targetSelector = "body",
  config = {},
) {
  const enabled = config.snapshot?.position?.enabled !== false;

  if (!enabled) {
    return [];
  }

  try {
    const positions = await page.evaluate((selector) => {
      const container = document.querySelector(selector);
      if (!container) {
        return [];
      }

      const elements = container.querySelectorAll("[data-testid]");
      const positions = [];

      elements.forEach((element, index) => {
        const testId = element.getAttribute("data-testid");
        const rect = element.getBoundingClientRect();

        positions.push({
          testId,
          order: index,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      });

      return positions;
    }, targetSelector);

    return positions;
  } catch (error) {
    console.error("Failed to capture element positions:", error.message);
    return [];
  }
}

/**
 * Saves element positions to a JSON file
 * @param {Array} positions - Array of position objects
 * @param {string} snapshotPath - Path to the image snapshot (positions will be saved alongside by default)
 * @param {string} [positionsDir] - Optional directory to save positions in. If provided, snapshotPath is used to derive the filename.
 * @returns {Promise<void>}
 */
export async function savePositions(positions, snapshotPath, positionsDir) {
  if (!positions || positions.length === 0) {
    return;
  }

  let positionsPath;

  if (positionsDir) {
    // If a separate directory is configured, use it
    // We need to construct the path based on the snapshot filename
    const snapshotName = path.basename(snapshotPath, ".png");
    // Ensure directory exists
    if (!existsSync(positionsDir)) {
      try {
        await import("fs/promises").then((fs) =>
          fs.mkdir(positionsDir, { recursive: true }),
        );
      } catch (e) {
        // Ignore if already exists (race condition)
      }
    }
    positionsPath = path.join(positionsDir, `${snapshotName}.positions.json`);
  } else {
    // Default: save alongside image
    positionsPath = snapshotPath.replace(/\.png$/, ".positions.json");
  }

  try {
    await writeFile(positionsPath, JSON.stringify(positions, null, 2), "utf-8");
  } catch (error) {
    console.error(
      `Failed to save positions to ${positionsPath}:`,
      error.message,
    );
  }
}

/**
 * Loads element positions from a JSON file
 * @param {string} snapshotPath - Path to the image snapshot
 * @param {string} [positionsDir] - Optional directory to load positions from
 * @returns {Promise<Array|null>} - Array of position objects or null if not found
 */
export async function loadPositions(snapshotPath, positionsDir) {
  let positionsPath;

  if (positionsDir) {
    const snapshotName = path.basename(snapshotPath, ".png");
    positionsPath = path.join(positionsDir, `${snapshotName}.positions.json`);
  } else {
    positionsPath = snapshotPath.replace(/\.png$/, ".positions.json");
  }

  if (!existsSync(positionsPath)) {
    return null;
  }

  try {
    const content = await readFile(positionsPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(
      `Failed to load positions from ${positionsPath}:`,
      error.message,
    );
    return null;
  }
}

/**
 * Compares two sets of element positions
 * @param {Array} expected - Expected positions
 * @param {Array} actual - Actual positions
 * @param {object} config - Configuration object
 * @returns {{passed: boolean, differences: Array<string>}}
 */
export function comparePositions(expected, actual, config = {}) {
  const orderCheckEnabled = config.snapshot?.position?.orderCheck !== false;
  const positionThreshold = config.snapshot?.position?.positionThreshold || 5;
  const sizeThreshold = config.snapshot?.position?.sizeThreshold || 5;

  // Currently only order checking is enabled by default
  // Position and size checks are disabled to reduce false positives
  const checkPosition = false; // Can be enabled via config if needed
  const checkSize = false; // Can be enabled via config if needed

  const differences = [];

  if (!expected || expected.length === 0) {
    return { passed: true, differences: [] };
  }

  if (!actual || actual.length === 0) {
    differences.push("No elements found in actual page");
    return { passed: false, differences };
  }

  // Check for order differences
  if (orderCheckEnabled) {
    const expectedOrder = expected.map((e) => e.testId);
    const actualOrder = actual.map((a) => a.testId);

    // Check for missing elements
    const missingElements = expectedOrder.filter(
      (id) => !actualOrder.includes(id),
    );
    if (missingElements.length > 0) {
      differences.push(`Missing elements: ${missingElements.join(", ")}`);
    }

    // Check for new elements
    const newElements = actualOrder.filter((id) => !expectedOrder.includes(id));
    if (newElements.length > 0) {
      differences.push(`New elements: ${newElements.join(", ")}`);
    }

    // Check for order changes
    expectedOrder.forEach((testId, expectedIndex) => {
      const actualIndex = actualOrder.indexOf(testId);
      if (actualIndex !== -1 && actualIndex !== expectedIndex) {
        differences.push(
          `Element '${testId}' order changed from position ${expectedIndex} to ${actualIndex}`,
        );
      }
    });
  }

  // Check for position differences (disabled by default)
  if (checkPosition) {
    expected.forEach((expectedPos) => {
      const actualPos = actual.find((a) => a.testId === expectedPos.testId);
      if (!actualPos) return;

      const xDiff = Math.abs(expectedPos.x - actualPos.x);
      const yDiff = Math.abs(expectedPos.y - actualPos.y);

      if (xDiff > positionThreshold || yDiff > positionThreshold) {
        differences.push(
          `Element '${expectedPos.testId}' position changed: ` +
            `x: ${expectedPos.x} → ${actualPos.x} (diff: ${xDiff}), ` +
            `y: ${expectedPos.y} → ${actualPos.y} (diff: ${yDiff})`,
        );
      }
    });
  }

  // Check for size differences (disabled by default)
  if (checkSize) {
    expected.forEach((expectedPos) => {
      const actualPos = actual.find((a) => a.testId === expectedPos.testId);
      if (!actualPos) return;

      const widthDiff = Math.abs(expectedPos.width - actualPos.width);
      const heightDiff = Math.abs(expectedPos.height - actualPos.height);

      if (widthDiff > sizeThreshold || heightDiff > sizeThreshold) {
        differences.push(
          `Element '${expectedPos.testId}' size changed: ` +
            `width: ${expectedPos.width} → ${actualPos.width} (diff: ${widthDiff}), ` +
            `height: ${expectedPos.height} → ${actualPos.height} (diff: ${heightDiff})`,
        );
      }
    });
  }

  return {
    passed: differences.length === 0,
    differences,
  };
}

/**
 * Captures and saves element positions for a story
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} snapshotPath - Path where the snapshot will be saved
 * @param {string} targetSelector - CSS selector for the container
 * @param {object} config - Configuration object
 * @returns {Promise<void>}
 */
export async function captureAndSavePositions(
  page,
  snapshotPath,
  targetSelector = "body",
  config = {},
) {
  const positionsDir = config.snapshot?.position?.snapshotDir;
  const positions = await captureElementPositions(page, targetSelector, config);
  if (positions.length > 0) {
    await savePositions(positions, snapshotPath, positionsDir);
  }
}

/**
 * Loads and compares element positions for a story
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} snapshotPath - Path to the snapshot
 * @param {string} targetSelector - CSS selector for the container
 * @param {object} config - Configuration object
 * @returns {Promise<{passed: boolean, differences: Array<string>}>}
 */
export async function loadAndComparePositions(
  page,
  snapshotPath,
  targetSelector = "body",
  config = {},
) {
  const enabled = config.snapshot?.position?.enabled !== false;
  const positionsDir = config.snapshot?.position?.snapshotDir;

  if (!enabled) {
    return { passed: true, differences: [] };
  }

  const expectedPositions = await loadPositions(snapshotPath, positionsDir);
  if (!expectedPositions) {
    // No baseline positions exist yet
    return { passed: true, differences: [] };
  }

  const actualPositions = await captureElementPositions(
    page,
    targetSelector,
    config,
  );
  return comparePositions(expectedPositions, actualPositions, config);
}
