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
    const logDir = path.join(process.cwd(), config.snapshot.paths.logsDir);
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
  const failures = results.failures || [];
  const passed = results.passed || [];

  if (failures.length === 0 && passed.length === 0) {
    return null;
  }

  try {
    const logDir = path.join(process.cwd(), config.snapshot.paths.logsDir);
    const snapshotDir = path.join(
      process.cwd(),
      config.snapshot.paths.snapshotsDir,
    );

    const reportPath = path.join(logDir, "visual-test-report.html");

    // Deduplicate and combine
    const uniqueFailures = Array.from(
      new Map(failures.map((f) => [f.id, { ...f, status: "failed" }])).values(),
    );
    const uniquePassed = Array.from(
      new Map(passed.map((p) => [p.id, { ...p, status: "passed" }])).values(),
    );

    const allentries = [...uniqueFailures, ...uniquePassed];

    // Filter out entries where reference snapshot doesn't exist (unless it's a failure with no reference)
    // Actually for passed tests, reference MUST exist. For failures, it might not.
    // The original code filtered specific failures. Let's keep it simple: show what we have.
    // But we need to check snapshot existence for the image path.

    const rows = allentries.map((entry) => {
      const sanitizedId = sanitizeSnapshotName(entry.id);
      const referenceSnapshotPath = path.join(
        snapshotDir,
        `${sanitizedId}.png`,
      );
      const referenceSnapshotExists = fs.existsSync(referenceSnapshotPath);

      // Get relative paths for HTML
      const referenceSnapshotRelative = referenceSnapshotExists
        ? path.relative(logDir, referenceSnapshotPath).replace(/\\/g, "/")
        : null;

      const errorScreenshotRelative = entry.screenshotPath
        ? path.relative(logDir, entry.screenshotPath).replace(/\\/g, "/")
        : null;

      return {
        storyId: entry.id,
        importPath: entry.importPath || "unknown",
        message:
          entry.message || (entry.status === "passed" ? "Passed" : "Failed"),
        referenceSnapshot: referenceSnapshotRelative,
        errorScreenshot: errorScreenshotRelative,
        hasReference: referenceSnapshotExists,
        hasError: !!errorScreenshotRelative,
        positionDiffs: entry.positionDiffs || [],
        status: entry.status,
      };
    });

    if (rows.length === 0) {
      return null; // Should not happen given check above
    }

    const html = generateHtmlContent(
      rows,
      uniqueFailures.length,
      0, // Removed duplicate logic for simplicity in count, or calculate real duplicates if needed
      failures.length + passed.length,
      uniquePassed.length,
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
 * @param {number} failuresCount - Number of unique failures
 * @param {number} unused - Unused param (kept for signature compatibility)
 * @param {number} totalCount - Total number of entries
 * @param {number} passedCount - Number of unique passed tests
 * @returns {string} HTML content
 */
export const generateHtmlContent = (
  rows,
  failuresCount,
  unused,
  totalCount,
  passedCount = 0,
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
      padding: 15px 20px;
      border-bottom: 1px solid #ddd;
    }
    .failure-header.failed {
        background: #fff3cd;
        border-bottom-color: #ffc107;
    }
    .failure-header.passed {
        background: #e8f5e9;
        border-bottom-color: #a5d6a7;
    }
    .failure-title {
      font-weight: 600;
      margin-bottom: 5px;
    }
    .failed .failure-title { color: #856404; }
    .passed .failure-title { color: #2e7d32; }

    .failure-path {
      font-size: 12px;
      font-family: monospace;
      margin-bottom: 5px;
    }
    .failed .failure-path { color: #856404; }
    .passed .failure-path { color: #2e7d32; }

    .failure-message {
      font-size: 13px;
      margin-top: 5px;
    }
    .failed .failure-message { color: #856404; }
    .passed .failure-message { color: #2e7d32; }
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
    <h1>Visual Test Report</h1>
    <div class="summary">Generated: ${new Date().toLocaleString()}</div>
    <div class="summary">
        Total: ${totalCount} | 
        <span style="color: #d32f2f">Failed: ${failuresCount}</span> | 
        <span style="color: #2e7d32">Passed: ${passedCount}</span>
    </div>
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
      <div class="failure-header ${row.status}">
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
    const logDir = path.join(process.cwd(), config.snapshot.paths.logsDir);
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
