/**
 * Report Generator Module
 * Handles generation of HTML, JSON, and log reports for visual test results
 */

import fs from "fs";
import path from "path";
import { promises as fsPromises } from "fs";
import { sanitizeSnapshotName } from "./story-discovery.js";

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export const escapeHtml = (text) => {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * Generate JSON report
 * @param {object} results - Test results object
 * @param {object} config - Configuration object
 * @returns {Promise<string|null>} Path to generated JSON file or null
 */
export const generateJsonReport = async (results, config) => {
  try {
    const logDir = path.join(process.cwd(), config.paths.logsDir);
    await fsPromises.mkdir(logDir, { recursive: true });

    const jsonData = {
      timestamp: new Date().toISOString(),
      totalStories: results.totalStories,
      failures: results.failures.map((f) => ({
        id: f.id,
        importPath: f.importPath,
        message: f.message,
        screenshotPath: f.screenshotPath,
        positionDiffs: f.positionDiffs,
      })),
      passed: results.passed,
      ignored: results.ignored.map((i) => ({
        id: i.id,
        importPath: i.importPath,
        message: i.message,
        pattern: i.pattern,
      })),
      skipped: results.skipped.map((s) => ({
        id: s.id,
        importPath: s.importPath,
        message: s.message,
        reason: s.reason,
      })),
    };

    const jsonPath = path.join(logDir, "visual-test-results.json");
    await fsPromises.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), {
      encoding: "utf8",
    });

    return jsonPath;
  } catch (error) {
    console.warn(`Failed to generate JSON report: ${error.message}`);
    return null;
  }
};

/**
 * Generate HTML report
 * @param {object} results - Test results object
 * @param {object} config - Configuration object
 * @returns {Promise<string|null>} Path to generated HTML file or null
 */
export const generateHtmlReport = async (results, config) => {
  if (!results.failures || results.failures.length === 0) {
    return null;
  }

  try {
    const logDir = path.join(process.cwd(), config.paths.logsDir);
    const snapshotDir = path.join(process.cwd(), config.paths.snapshotsDir);

    const reportPath = path.join(logDir, "visual-test-report.html");

    // Deduplicate failures by story ID
    const uniqueFailures = Array.from(
      new Map(results.failures.map((f) => [f.id, f])).values(),
    );

    // Filter out failures where reference snapshot doesn't exist
    const failuresWithSnapshots = uniqueFailures.filter((failure) => {
      const sanitizedId = sanitizeSnapshotName(failure.id);
      const referenceSnapshotPath = path.join(
        snapshotDir,
        `${sanitizedId}.png`,
      );
      return fs.existsSync(referenceSnapshotPath);
    });

    if (failuresWithSnapshots.length === 0) {
      return null;
    }

    const rows = failuresWithSnapshots.map((failure) => {
      const sanitizedId = sanitizeSnapshotName(failure.id);
      const referenceSnapshotPath = path.join(
        snapshotDir,
        `${sanitizedId}.png`,
      );
      const referenceSnapshotExists = fs.existsSync(referenceSnapshotPath);

      // Get relative paths for HTML
      const referenceSnapshotRelative = referenceSnapshotExists
        ? path.relative(logDir, referenceSnapshotPath).replace(/\\/g, "/")
        : null;
      const errorScreenshotRelative = failure.screenshotPath
        ? path.relative(logDir, failure.screenshotPath).replace(/\\/g, "/")
        : null;

      return {
        storyId: failure.id,
        importPath: failure.importPath || "unknown",
        message: failure.message,
        referenceSnapshot: referenceSnapshotRelative,
        errorScreenshot: errorScreenshotRelative,
        hasReference: referenceSnapshotExists,
        hasError: !!errorScreenshotRelative,
        positionDiffs: failure.positionDiffs || [],
      };
    });

    const html = generateHtmlContent(
      rows,
      failuresWithSnapshots.length,
      uniqueFailures.length,
      results.failures.length,
    );

    await fsPromises.writeFile(reportPath, html, { encoding: "utf8" });
    return reportPath;
  } catch (error) {
    console.warn(`Failed to generate HTML report: ${error.message}`);
    return null;
  }
};

/**
 * Generate HTML content for report
 * @param {Array} rows - Array of row data objects
 * @param {number} failuresCount - Number of failures with snapshots
 * @param {number} uniqueCount - Number of unique failures
 * @param {number} totalCount - Total number of failure entries
 * @returns {string} HTML content
 */
export const generateHtmlContent = (
  rows,
  failuresCount,
  uniqueCount,
  totalCount,
) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Test Failures Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      color: #333;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #d32f2f;
      margin-bottom: 10px;
    }
    .summary {
      color: #666;
      font-size: 14px;
    }
    .failure {
      background: white;
      margin-bottom: 20px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .failure-header {
      background: #fff3cd;
      padding: 15px 20px;
      border-bottom: 1px solid #ffc107;
    }
    .failure-title {
      font-weight: 600;
      color: #856404;
      margin-bottom: 5px;
    }
    .failure-path {
      font-size: 12px;
      color: #856404;
      font-family: monospace;
      margin-bottom: 5px;
    }
    .failure-message {
      font-size: 13px;
      color: #856404;
      margin-top: 5px;
    }
    .comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
    }
    .image-container {
      padding: 20px;
      text-align: center;
      background: #fafafa;
    }
    .image-container:first-child {
      border-right: 1px solid #e0e0e0;
    }
    .image-label {
      font-weight: 600;
      margin-bottom: 10px;
      color: #333;
      font-size: 14px;
    }
    .image-container img {
      max-width: 100%;
      height: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .missing {
      color: #999;
      font-style: italic;
      padding: 40px;
    }
    .single-image {
      grid-column: 1 / -1;
    }
    .position-diffs {
      margin-top: 20px;
      padding: 20px;
      background: #fff3cd;
      border-top: 1px solid #ffc107;
    }
    .position-diffs-title {
      font-weight: 600;
      color: #856404;
      margin-bottom: 15px;
      font-size: 14px;
    }
    .position-diffs-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .position-diffs-table th {
      background: #ffc107;
      color: #856404;
      padding: 8px;
      text-align: left;
      font-weight: 600;
      border: 1px solid #ffc107;
    }
    .position-diffs-table td {
      padding: 8px;
      border: 1px solid #ffc107;
      background: white;
    }
    .position-diffs-table tr:nth-child(even) td {
      background: #fffbf0;
    }
    .delta-positive {
      color: #d32f2f;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Visual Test Failures Report</h1>
    <div class="summary">Generated: ${new Date().toLocaleString()}</div>
    <div class="summary">Total Failures: ${failuresCount}${totalCount !== uniqueCount ? ` (${totalCount} entries, ${totalCount - uniqueCount} duplicates removed)` : ""}${uniqueCount !== failuresCount ? ` (${uniqueCount - failuresCount} failures without reference snapshots excluded)` : ""}</div>
  </div>

  ${rows.map((row) => generateFailureRow(row)).join("")}
</body>
</html>`;
};

/**
 * Generate HTML for a single failure row
 * @param {object} row - Row data object
 * @returns {string} HTML content for row
 */
export const generateFailureRow = (row) => {
  return `
    <div class="failure">
      <div class="failure-header">
        <div class="failure-title">${escapeHtml(row.storyId)}</div>
        <div class="failure-path">${escapeHtml(row.importPath)}</div>
        <div class="failure-message">${escapeHtml(row.message)}</div>
      </div>
      <div class="comparison ${!row.hasReference || !row.hasError ? "single-image" : ""}">
        <div class="image-container">
          <div class="image-label">Reference Snapshot</div>
          ${
            row.hasReference && row.referenceSnapshot
              ? `<img src="${escapeHtml(row.referenceSnapshot)}" alt="Reference snapshot" />`
              : `<div class="missing">Reference snapshot not found</div>`
          }
        </div>
        ${
          row.hasReference && row.hasError
            ? `
        <div class="image-container">
          <div class="image-label">Error Screenshot</div>
          ${
            row.errorScreenshot
              ? `<img src="${escapeHtml(row.errorScreenshot)}" alt="Error screenshot" />`
              : `<div class="missing">Error screenshot not available</div>`
          }
        </div>
        `
            : row.hasError && row.errorScreenshot
              ? `
        <div class="image-container">
          <div class="image-label">Error Screenshot</div>
          <img src="${escapeHtml(row.errorScreenshot)}" alt="Error screenshot" />
        </div>
        `
              : ""
        }
      </div>
      ${row.positionDiffs && row.positionDiffs.length > 0 ? generatePositionDiffsTable(row.positionDiffs) : ""}
    </div>
  `;
};

/**
 * Generate HTML for position diffs table
 * @param {Array} positionDiffs - Array of position diff objects
 * @returns {string} HTML content for position diffs
 */
export const generatePositionDiffsTable = (positionDiffs) => {
  return `
      <div class="position-diffs">
        <div class="position-diffs-title">Element Position Differences (${positionDiffs.length} element(s) moved)</div>
        <table class="position-diffs-table">
          <thead>
            <tr>
              <th>Element (testId)</th>
              <th>Expected Position</th>
              <th>Actual Position</th>
              <th>Delta (X, Y)</th>
              <th>Size Change</th>
            </tr>
          </thead>
          <tbody>
            ${positionDiffs
              .map(
                (diff) => `
            <tr>
              <td><code>${escapeHtml(diff.testId)}</code></td>
              <td>
                ${
                  diff.expected.visible
                    ? `(${diff.expected.x}, ${diff.expected.y})`
                    : "<em>Element was removed</em>"
                }
              </td>
              <td>
                ${
                  diff.actual.visible
                    ? `(${diff.actual.x}, ${diff.actual.y})`
                    : "<em>Element was added</em>"
                }
              </td>
              <td>
                ${
                  diff.expected.visible && diff.actual.visible
                    ? `<span class="delta-positive">+${diff.deltaX}px, +${diff.deltaY}px</span>`
                    : "<em>N/A</em>"
                }
              </td>
              <td>
                ${
                  diff.expected.visible && diff.actual.visible
                    ? `W: ${diff.deltaWidth > 0 ? "+" : ""}${diff.deltaWidth}px, H: ${diff.deltaHeight > 0 ? "+" : ""}${diff.deltaHeight}px`
                    : "<em>N/A</em>"
                }
              </td>
            </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      `;
};

/**
 * Generate log report
 * @param {object} results - Test results object
 * @param {object} config - Configuration object
 * @returns {Promise<string|null>} Path to generated log file or null
 */
export const generateLogReport = async (results, config) => {
  try {
    const logDir = path.join(process.cwd(), config.paths.logsDir);
    await fsPromises.mkdir(logDir, { recursive: true });

    const logPath = path.join(logDir, "visual-test-results.log");
    const lines = [];

    lines.push(
      `Run: ${new Date().toISOString()} (stories: ${results.totalStories})`,
    );
    lines.push("");

    // Log passed stories
    if (results.passed && results.passed.length > 0) {
      lines.push("PASSED:");
      results.passed.forEach((id) => {
        lines.push(`  ✓ ${id}`);
      });
      lines.push("");
    }

    // Log failures
    if (results.failures && results.failures.length > 0) {
      lines.push("FAILED:");
      results.failures.forEach((failure) => {
        lines.push(`  ✗ ${failure.id}: ${failure.message}`);
      });
      lines.push("");
    }

    // Log ignored
    if (results.ignored && results.ignored.length > 0) {
      lines.push("IGNORED:");
      results.ignored.forEach((ignored) => {
        lines.push(
          `  ⚠ ${ignored.id}: ${ignored.message} (pattern: ${ignored.pattern})`,
        );
      });
      lines.push("");
    }

    // Log skipped
    if (results.skipped && results.skipped.length > 0) {
      lines.push("SKIPPED:");
      results.skipped.forEach((skipped) => {
        lines.push(`  ⊘ ${skipped.id}: ${skipped.message}`);
      });
      lines.push("");
    }

    // Summary
    lines.push("SUMMARY:");
    lines.push(`  Total: ${results.totalStories}`);
    lines.push(`  Passed: ${results.passed?.length || 0}`);
    lines.push(`  Failed: ${results.failures?.length || 0}`);
    lines.push(`  Ignored: ${results.ignored?.length || 0}`);
    lines.push(`  Skipped: ${results.skipped?.length || 0}`);

    await fsPromises.writeFile(logPath, lines.join("\n"), { encoding: "utf8" });
    return logPath;
  } catch (error) {
    console.warn(`Failed to generate log report: ${error.message}`);
    return null;
  }
};
