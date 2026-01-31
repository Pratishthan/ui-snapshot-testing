#!/usr/bin/env node

/**
 * Script to rerun only failed visual tests from the last test run
 * Reads the JSON results file and reruns only the stories that failed.
 *
 * Usage:
 *   node scripts/visual-tests/run-visual-tests-failures.js [path-to-json-file]
 *
 * Examples:
 *   node scripts/visual-tests/run-visual-tests-failures.js                          # Uses default: logs/visual-test-results.json
 *   node scripts/visual-tests/run-visual-tests-failures.js logs/custom-results.json # Uses custom JSON file
 *   npm run test:visual-tests:failures                                 # Via npm script (uses default)
 */

import { spawn } from "child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import { clearResultFiles } from "./clear-visual-test-results.js";
import { generateReports } from "./generate-visual-test-reports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reads and parses the JSON results file
 * @param {string} jsonFilePath - Path to the JSON results file
 * @returns {Object|null} Parsed JSON object or null if file doesn't exist or is invalid
 */
function readResultsJSON(jsonFilePath) {
  if (!existsSync(jsonFilePath)) {
    console.error(`❌ Results file not found: ${jsonFilePath}`);
    console.error(
      "💡 Run the visual tests first to generate results: npx ui-snapshot-testing run",
    );
    return null;
  }

  try {
    const content = readFileSync(jsonFilePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Failed to parse JSON file: ${jsonFilePath}`);
    console.error(`   Error: ${error.message}`);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  // Default to logs/visual-test-results.json if no argument provided
  const defaultJsonPath = path.join(
    __dirname,
    "../logs/visual-test-results.json",
  );
  const jsonFilePath =
    args.length > 0 ? path.resolve(args[0]) : defaultJsonPath;

  console.log(`📖 Reading results file: ${jsonFilePath}\n`);

  const results = readResultsJSON(jsonFilePath);
  if (!results) {
    process.exit(1);
  }

  // Extract failed story IDs
  const failedStoryIds = (results.failures || []).map((failure) => failure.id);

  if (failedStoryIds.length === 0) {
    console.log("✅ No failed tests found in the results file!");
    console.log(`   Total stories tested: ${results.totalStories || 0}`);
    console.log(`   Passed: ${(results.passed || []).length}`);
    console.log(`   Ignored: ${(results.ignored || []).length}`);
    process.exit(0);
  }

  console.log(`📋 Found ${failedStoryIds.length} failed test(s):\n`);
  failedStoryIds.forEach((storyId, index) => {
    const failure = results.failures[index];
    const pathInfo = failure?.importPath ? ` (${failure.importPath})` : "";
    console.log(`   ${index + 1}. ${storyId}${pathInfo}`);
    if (failure?.message) {
      console.log(`      Error: ${failure.message}`);
    }
  });

  // Clear result files before starting tests
  console.log("\nClearing previous test results...");
  try {
    await clearResultFiles();
  } catch (error) {
    console.error("❌ Failed to clear result files:", error.message);
    console.error("Aborting to prevent mixing results from different runs");
    process.exit(1);
  }

  // Set STORY_IDS environment variable with comma-separated list
  const storyIds = failedStoryIds.join(",");

  console.log(`\n🚀 Rerunning ${failedStoryIds.length} failed test(s)...\n`);

  // Build the playwright command (same as main test command, but without --update-snapshots)
  const playwrightArgs = [
    "test",
    "playwright/storybook-visual/visual-tests.spec.ts",
    "--config=playwright/config/playwright.storybook.config.ts",
    "--project=chromium",
  ];

  // Run playwright test with STORY_IDS environment variable
  const playwrightProcess = spawn("npx", ["playwright", ...playwrightArgs], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, STORY_IDS: storyIds, SKIP_CLEAR_AND_GENERATE: "1" },
  });

  // Wait for process to complete
  const exitCode = await new Promise((resolve) => {
    playwrightProcess.on("exit", (code) => {
      resolve(code || 0);
    });
  });

  // Generate reports after tests complete
  console.log("\nGenerating test reports...");
  try {
    await generateReports(failedStoryIds);
  } catch (error) {
    console.error("⚠️  Failed to generate reports:", error.message);
    // Don't exit on report generation failure, continue with exit code
  }

  if (exitCode === 0) {
    console.log(`\n✅ All ${failedStoryIds.length} test(s) passed on rerun`);
  } else {
    console.log(`\n❌ Some tests still failing (exit code: ${exitCode})`);
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error("❌ Error running failed visual tests:", error.message);
  process.exit(1);
});
