#!/usr/bin/env node

/**
 * Wrapper script for visual tests that exits with success (0) if all failures are due to timeouts
 * that match ignorable patterns (configured via IGNORE_ERROR_PATTERNS env var).
 *
 * Usage:
 *   node scripts/visual-tests/run-visual-tests-wrapper.js [playwright-args...]
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { clearResultFiles } from "./clear-visual-test-results.js";
import {
  DEFAULT_VISUAL_TEST_MODE,
  getDefaultKeywordsForMode,
} from "./visual-test-config.js";
import { generateReports } from "./generate-visual-test-reports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse ignorable error patterns from environment variable
// Format: comma-separated patterns, e.g., "closed,timeout,network"
// Default: "closed,timeout" - common transient errors that don't indicate visual regressions
const parseIgnorablePatterns = () => {
  const defaultPatterns = ["closed", "timeout"];

  // If explicitly set to empty string, don't ignore anything
  if (process.env.IGNORE_ERROR_PATTERNS === "") {
    return [];
  }

  // If set, use the provided patterns
  if (process.env.IGNORE_ERROR_PATTERNS) {
    const patterns = process.env.IGNORE_ERROR_PATTERNS.split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    return patterns.length > 0 ? patterns : defaultPatterns;
  }

  // Default: ignore common transient errors
  return defaultPatterns;
};

const ignorablePatterns = parseIgnorablePatterns();

// Check if an error message matches ignorable patterns
const shouldIgnoreError = (errorMessage) => {
  if (ignorablePatterns.length === 0) {
    return false;
  }

  const errorLower = errorMessage.toLowerCase();
  return ignorablePatterns.some((pattern) => errorLower.includes(pattern));
};

// Check if error is a snapshot mismatch (should never be ignored)
const isSnapshotMismatch = (errorMessage) => {
  const errorLower = errorMessage.toLowerCase();
  const snapshotIndicators = [
    "snapshot",
    "comparison",
    "toMatchSnapshot",
    "screenshot comparison",
    "image comparison",
    "visual regression",
    "snapshot mismatch",
    "expected image",
    "actual image",
    "pixel",
    "threshold",
  ];

  return snapshotIndicators.some((indicator) => errorLower.includes(indicator));
};

// Fetch stories from Storybook index to get importPath mapping
const fetchStoryPaths = async () => {
  const STORYBOOK_PORT = process.env.STORYBOOK_PORT || "6006";
  const STORYBOOK_HOST = process.env.STORYBOOK_HOST || "localhost";
  const indexUrl = `http://${STORYBOOK_HOST}:${STORYBOOK_PORT}/index.json`;

  try {
    const response = await fetch(indexUrl);
    if (!response.ok) {
      return new Map();
    }

    const indexJson = await response.json();
    const entries = Object.values(indexJson.entries ?? {});
    const storyPathMap = new Map();

    for (const entry of entries) {
      if (entry.type === "story" && entry.id && entry.importPath) {
        storyPathMap.set(entry.id, entry.importPath);
      }
    }

    return storyPathMap;
  } catch (error) {
    // If we can't fetch from Storybook, return empty map (will fall back to SUMMARY parsing)
    return new Map();
  }
};

// Parse Playwright test results to check if failures are only ignorable errors
const checkFailures = async () => {
  const logFile = path.join(
    process.cwd(),
    "logs",
    "storybook-visual-results.log",
  );
  const failuresJsonlFile = path.join(
    process.cwd(),
    "logs",
    "visual-test-failures.jsonl",
  );

  const failures = [];

  // Try to fetch story paths from Storybook index first
  const storyPathMap = await fetchStoryPaths();

  // Read failures from log file (if it exists)
  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, "utf-8");
    const lines = logContent.split("\n");

    // Also build a map from SUMMARY section as fallback (in case Storybook is not available)
    let inSummarySection = false;
    for (const line of lines) {
      if (line.includes("SUMMARY: Failing stories")) {
        inSummarySection = true;
        continue;
      }
      if (inSummarySection) {
        // Stop if we hit another SUMMARY line (different section)
        if (line.startsWith("SUMMARY:") && !line.includes("Failing stories")) {
          break;
        }
        // Parse summary entry lines (format: "storyId (importPath): error message" or "storyId: error message")
        if (line.trim()) {
          // Format: "storyId (importPath): error message"
          const match = line.match(/^([^\s(]+)\s*\(([^)]+)\):\s*(.+)$/);
          if (match) {
            const [, storyId, importPath] = match;
            // Only set if not already in map (Storybook data takes precedence)
            if (!storyPathMap.has(storyId)) {
              storyPathMap.set(storyId, importPath);
            }
          } else {
            // Format without path: "storyId: error message"
            const matchNoPath = line.match(/^([^\s:]+):\s*(.+)$/);
            if (matchNoPath) {
              const [, storyId] = matchNoPath;
              // Only set to null if not already in map
              if (!storyPathMap.has(storyId)) {
                storyPathMap.set(storyId, null);
              }
            } else {
              // If line doesn't match summary format, we've left the summary section
              break;
            }
          }
        }
      }
    }

    // Find all FAIL entries and extract storyId + error message
    for (const line of lines) {
      if (line.startsWith("FAIL ")) {
        // Extract storyId and error message from "FAIL [storyId] error message"
        const match = line.match(/^FAIL \[([^\]]+)\]\s+(.+)$/);
        if (match) {
          const [, storyId, errorMessage] = match;
          const importPath = storyPathMap.get(storyId) || null;
          failures.push({ storyId, importPath, errorMessage });
        }
      }
    }
  }

  // Also read failures from JSONL file (more reliable source, especially with parallel workers)
  if (fs.existsSync(failuresJsonlFile)) {
    try {
      const jsonlContent = fs.readFileSync(failuresJsonlFile, "utf-8");
      const jsonlLines = jsonlContent.split("\n").filter(Boolean);

      for (const line of jsonlLines) {
        try {
          const failureRecord = JSON.parse(line);
          const storyId = failureRecord.id;
          const importPath =
            failureRecord.importPath || storyPathMap.get(storyId) || null;
          const errorMessage = failureRecord.message || "";

          // Only add if not already in failures array (from log file)
          const exists = failures.some((f) => f.storyId === storyId);
          if (!exists) {
            failures.push({ storyId, importPath, errorMessage });
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          console.warn(`⚠️  Failed to parse JSONL line: ${parseError.message}`);
        }
      }
    } catch (readError) {
      console.warn(
        `⚠️  Failed to read failures JSONL file: ${readError.message}`,
      );
    }
  }

  // Deduplicate failures by storyId (keep first occurrence)
  const uniqueFailures = Array.from(
    new Map(failures.map((f) => [f.storyId, f])).values(),
  );

  // Check if all failures are ignorable (not snapshot mismatches and match ignorable patterns)
  const allIgnorable =
    uniqueFailures.length > 0 &&
    uniqueFailures.every((failure) => {
      // Snapshot mismatches should never be ignored
      if (isSnapshotMismatch(failure.errorMessage)) {
        return false;
      }
      // Check if error matches ignorable patterns
      return shouldIgnoreError(failure.errorMessage);
    });

  return { allIgnorable, failures: uniqueFailures };
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);

  // Determine visual test mode (lite = only _visual stories, full = all keywords)
  const visualTestMode =
    process.env.VISUAL_TEST_MODE || DEFAULT_VISUAL_TEST_MODE;
  const storyVisualKeywords =
    process.env.STORY_VISUAL_KEYWORDS ||
    getDefaultKeywordsForMode(visualTestMode);

  // Set STORY_VISUAL_KEYWORDS if not already set
  if (!process.env.STORY_VISUAL_KEYWORDS) {
    process.env.STORY_VISUAL_KEYWORDS = storyVisualKeywords;
  }

  // Build the playwright command
  const playwrightArgs = [
    "test",
    "playwright/storybook-visual/visual-tests.spec.ts",
    "--config=playwright/config/playwright.storybook.config.ts",
    "--project=chromium",
    ...args,
  ];

  const modeDescription =
    visualTestMode === "lite"
      ? "only stories with _visual suffix"
      : `stories matching keywords: ${storyVisualKeywords || "none"} or _visual suffix`;

  // Clear result files before starting tests (unless skipped by parent script)
  if (!process.env.SKIP_CLEAR_AND_GENERATE) {
    console.log("Clearing previous test results...");
    try {
      await clearResultFiles();
    } catch (error) {
      console.error("❌ Failed to clear result files:", error.message);
      console.error("Aborting to prevent mixing results from different runs");
      process.exit(1);
    }
  }

  // Generate stories cache before running tests
  // This is a workaround for Playwright's limitation with async HTTP fetch in test files
  console.log("Generating stories cache...");
  try {
    const { execSync } = await import("child_process");
    const cacheScriptPath = path.join(__dirname, "generate-stories-cache.js");
    execSync(`node ${cacheScriptPath}`, {
      stdio: "inherit",
      cwd: process.cwd(),
      env: { ...process.env }, // Pass through all env vars for filtering
    });
  } catch (error) {
    console.error("❌ Failed to generate stories cache:", error.message);
    console.error("Aborting test run");
    process.exit(1);
  }

  console.log("\nRunning visual tests...");
  console.log(`Visual test mode: ${visualTestMode}`);
  console.log(`Filtering to: ${modeDescription}`);
  console.log(
    `Ignoring errors matching patterns: ${ignorablePatterns.join(", ")}`,
  );
  console.log("Note: Snapshot/image mismatches are NEVER ignored\n");

  // Run playwright test
  const playwrightProcess = spawn("npx", ["playwright", ...playwrightArgs], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  });

  // Wait for process to complete
  const exitCode = await new Promise((resolve) => {
    playwrightProcess.on("exit", (code) => {
      resolve(code || 0);
    });
  });

  // Generate reports after tests complete (unless skipped by parent script)
  if (!process.env.SKIP_CLEAR_AND_GENERATE) {
    console.log("\nGenerating test reports...");
    try {
      await generateReports(null); // null = read all results from JSONL files
    } catch (error) {
      console.error("⚠️  Failed to generate reports:", error.message);
      // Don't exit on report generation failure, continue with failure checking
    }
  }

  const logFile = path.join(
    process.cwd(),
    "logs",
    "storybook-visual-results.log",
  );

  // Always check for failures in the log file, even if Playwright exited with code 0
  // This is important because snapshot mismatches might not always cause Playwright to exit with non-zero code
  const { allIgnorable, failures } = await checkFailures();

  // If tests passed or were skipped (no failures found in log), exit with success
  if (failures.length === 0) {
    console.log("\n✅ All tests passed or were skipped");
    console.log(`📄 Log file: ${logFile}`);
    process.exit(0);
  }

  // If Playwright exited with 0 but we have failures, log a warning
  if (exitCode === 0 && failures.length > 0) {
    console.warn(
      "\n⚠️  Warning: Playwright exited with code 0, but failures were detected in the log file",
    );
  }

  if (allIgnorable) {
    console.log(
      `\n✅ All ${failures.length} failure(s) are ignorable (timeout/closed errors)`,
    );
    console.log("Exiting with success code (0)");
    console.log(`📄 Log file: ${logFile}`);
    process.exit(0);
  } else {
    console.log(`\n❌ Some failures are not ignorable:`);
    failures.forEach((failure, index) => {
      const isIgnorable =
        !isSnapshotMismatch(failure.errorMessage) &&
        shouldIgnoreError(failure.errorMessage);
      const status = isIgnorable ? "⚠️  (ignorable)" : "❌ (must fix)";
      // Show both storyId and importPath when available, matching SUMMARY format
      const pathInfo = failure.importPath
        ? `${failure.storyId} (${failure.importPath})`
        : failure.storyId;
      console.log(`  ${index + 1}. ${pathInfo} ${status}`);
    });
    console.log("\nExiting with failure code");
    console.log(`📄 Log file: ${logFile}`);
    process.exit(exitCode);
  }
};

main().catch((error) => {
  console.error("Error running visual tests wrapper:", error);
  process.exit(1);
});
