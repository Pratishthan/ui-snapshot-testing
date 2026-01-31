#!/usr/bin/env node

import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import readline from "readline";
import { fileURLToPath } from "url";
import { clearResultFiles } from "./clear-visual-test-results.js";
import { generateReports } from "./generate-visual-test-reports.js";
import {
  DEFAULT_VISUAL_KEYWORDS,
  getDefaultKeywordsForMode,
} from "./visual-test-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get target branch from env var, default to Sprint16
const targetBranch = process.env.VISUAL_TESTS_TARGET_BRANCH || "Sprint16";
const projectRoot = path.join(__dirname, "..");

/**
 * Check if a file is a story file
 */
function isStoryFile(filePath) {
  return filePath.includes(".stories.") || filePath.includes(".story.");
}

/**
 * Check if a file is a component file (excluding test files, utils, etc.)
 */
function isComponentFile(filePath) {
  // Must be in src/components/ directory
  if (!filePath.includes("src/components/")) {
    return false;
  }

  // Must be .tsx file
  if (!filePath.endsWith(".tsx")) {
    return false;
  }

  // Exclude test files
  if (
    filePath.endsWith(".spec.tsx") ||
    filePath.endsWith(".test.tsx") ||
    filePath.endsWith(".stories.tsx") ||
    filePath.endsWith(".story.tsx")
  ) {
    return false;
  }

  // Exclude utility and special files
  const basename = path.basename(filePath);
  if (
    basename.endsWith(".utils.tsx") ||
    basename.endsWith("Utils.tsx") ||
    basename.endsWith(".slice.tsx") ||
    basename.endsWith(".styles.tsx") ||
    basename.endsWith(".constants.tsx") ||
    basename.endsWith(".types.tsx") ||
    basename.endsWith("Props.tsx") ||
    basename.endsWith("Context.tsx") ||
    basename.endsWith("Provider.tsx") ||
    basename.endsWith("Type.tsx") ||
    basename.endsWith("Types.tsx") ||
    basename.includes("Context") ||
    (basename.startsWith("use") &&
      basename.charAt(3) === basename.charAt(3).toUpperCase()) ||
    basename === "index.tsx" ||
    basename === "types.tsx" ||
    basename === "App.tsx" ||
    basename === "main.tsx" ||
    basename === "router.tsx" ||
    basename === "routes.tsx" ||
    basename.startsWith("_")
  ) {
    return false;
  }

  return true;
}

/**
 * Find story file(s) for a given component file
 * Returns array of story file paths that exist
 */
function findStoryFilesForComponent(componentPath) {
  const dir = path.dirname(componentPath);
  const basename = path.basename(componentPath, ".tsx");
  const storyFiles = [];

  // Check for various story file patterns
  const possibleStoryFiles = [
    path.join(dir, `${basename}.stories.tsx`),
    path.join(dir, `${basename}.stories.ts`),
    path.join(dir, `${basename}.story.tsx`),
    path.join(dir, `${basename}.story.ts`),
  ];

  for (const storyPath of possibleStoryFiles) {
    // Convert to relative path from project root for consistency
    const relativePath = path.relative(projectRoot, storyPath);
    if (fs.existsSync(storyPath)) {
      storyFiles.push(relativePath);
    }
  }

  return storyFiles;
}

/**
 * Get the default remote name (usually 'origin')
 */
function getDefaultRemote() {
  try {
    const output = execSync("git remote", {
      encoding: "utf8",
      cwd: projectRoot,
    });
    const remotes = output.trim().split("\n").filter(Boolean);
    return remotes.includes("origin") ? "origin" : remotes[0] || "origin";
  } catch {
    return "origin";
  }
}

/**
 * Check if target branch exists locally
 */
function branchExists(branchName) {
  try {
    execSync(`git rev-parse --verify ${branchName}`, {
      stdio: "ignore",
      cwd: projectRoot,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if target branch exists remotely
 */
function remoteBranchExists(branchName, remote = null) {
  const remoteName = remote || getDefaultRemote();
  try {
    execSync(`git ls-remote --heads ${remoteName} ${branchName}`, {
      stdio: "ignore",
      cwd: projectRoot,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompt user for input
 */
function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Get changed files between target branch and HEAD
 */
function getChangedFiles(targetBranch) {
  try {
    const output = execSync(`git diff --name-only ${targetBranch}...HEAD`, {
      encoding: "utf8",
      cwd: projectRoot,
    });
    return output
      .split("\n")
      .filter(Boolean)
      .map((file) => file.trim());
  } catch (error) {
    console.error(`Error running git diff: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch story IDs from Storybook that match the include paths
 */
async function fetchStoryIdsForPaths(includePaths) {
  const STORYBOOK_PORT = process.env.STORYBOOK_PORT || "6006";
  const STORYBOOK_HOST = process.env.STORYBOOK_HOST || "localhost";
  const indexUrl = `http://${STORYBOOK_HOST}:${STORYBOOK_PORT}/index.json`;

  try {
    const response = await fetch(indexUrl);
    if (!response.ok) {
      return [];
    }

    const indexJson = await response.json();
    const entries = Object.values(indexJson.entries ?? {});
    const includePathsList = includePaths
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const storyIds = entries
      .filter((entry) => entry.type === "story" && entry.id)
      .filter((entry) => {
        if (includePathsList.length === 0) {
          return true;
        }
        const importPath = entry.importPath ?? "";
        return includePathsList.some((segment) => importPath.includes(segment));
      })
      .map((entry) => entry.id);

    return storyIds;
  } catch (error) {
    // If we can't fetch from Storybook, return empty array
    return [];
  }
}

/**
 * Count story exports in a story file (rough estimate)
 * Note: Actual test count will be filtered by Storybook's visual criteria
 * (stories matching keywords: Default, Loading, Error, Long or _visual suffix)
 */
function estimateStoryExports(storyFilePath) {
  try {
    const fullPath = path.join(projectRoot, storyFilePath);
    const content = fs.readFileSync(fullPath, "utf8");

    // Count exported story constants/functions (excluding meta and default exports)
    const lines = content.split("\n");
    let count = 0;
    let inMultiLineExport = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip meta and default exports
      if (
        line.includes("export default") ||
        line.includes("export const meta")
      ) {
        continue;
      }

      // Count export const/function declarations
      if (line.match(/^export\s+(const|function)\s+\w+/)) {
        // Check if it's likely a story (contains visual keywords or _visual)
        const storyName =
          line.match(/export\s+(const|function)\s+(\w+)/)?.[2] || "";
        if (
          storyName.toLowerCase().includes("default") ||
          storyName.toLowerCase().includes("loading") ||
          storyName.toLowerCase().includes("error") ||
          storyName.toLowerCase().includes("long") ||
          storyName.toLowerCase().includes("visual")
        ) {
          count++;
        } else {
          // Count all exports as potential stories (will be filtered by Storybook)
          count++;
        }
      }
    }

    return Math.max(1, count); // At least 1 story per file
  } catch {
    return 1; // Default to 1 if we can't read the file
  }
}

/**
 * Main function
 */
async function main() {
  console.log("=".repeat(80));
  console.log("Visual Tests Diff Wrapper");
  console.log("=".repeat(80));

  let actualTargetBranch = targetBranch;
  let isRemoteBranch = false;

  // Check if target branch exists locally
  if (!branchExists(targetBranch)) {
    const remote = getDefaultRemote();
    const remoteBranch = `${remote}/${targetBranch}`;

    // Check if it exists remotely
    if (remoteBranchExists(targetBranch, remote)) {
      console.log(`\n⚠️  Target branch "${targetBranch}" not found locally.`);
      console.log(`   Found remotely as "${remoteBranch}"`);
      console.log(`\n   Options:`);
      console.log(`   1. Use remote branch directly (${remoteBranch})`);
      console.log(`   2. Fetch and checkout locally first`);
      console.log(`   3. Cancel`);

      const choice = await promptUser(`\n   Choose an option (1/2/3): `);

      if (choice === "1") {
        actualTargetBranch = remoteBranch;
        isRemoteBranch = true;
        console.log(`\n   ✓ Using remote branch: ${actualTargetBranch}`);
      } else if (choice === "2") {
        console.log(`\n   Fetching branch from remote...`);
        try {
          execSync(`git fetch ${remote} ${targetBranch}:${targetBranch}`, {
            stdio: "inherit",
            cwd: projectRoot,
          });
          actualTargetBranch = targetBranch;
          console.log(`   ✓ Branch fetched successfully`);
        } catch (error) {
          console.error(`\n❌ Error fetching branch: ${error.message}`);
          process.exit(1);
        }
      } else {
        console.log(`\n   Cancelled.`);
        process.exit(0);
      }
    } else {
      console.error(
        `\n❌ Error: Target branch "${targetBranch}" does not exist locally or remotely.\n` +
          `   Please specify a valid branch using VISUAL_TESTS_TARGET_BRANCH environment variable.\n`,
      );
      process.exit(1);
    }
  }

  // Get current branch name
  const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
    encoding: "utf8",
    cwd: projectRoot,
  }).trim();

  // Check if we're on the target branch itself
  if (currentBranch === targetBranch && !isRemoteBranch) {
    console.log(`\n✅ Running on target branch "${targetBranch}" itself.`);
    console.log("   No diff to compare. Exiting successfully.\n");
    process.exit(0);
  }

  console.log(`\n📊 Configuration:`);
  console.log(
    `   Target branch: ${actualTargetBranch}${isRemoteBranch ? " (remote)" : ""}`,
  );
  console.log(`   Current branch: ${currentBranch}`);

  console.log(`\n🔍 Analyzing changes...`);

  // Get changed files
  const changedFiles = getChangedFiles(actualTargetBranch);

  if (changedFiles.length === 0) {
    console.log("\n✅ No changes detected between branches.");
    console.log("   Skipping visual tests.\n");
    process.exit(0);
  }

  console.log(`   Total files changed: ${changedFiles.length}`);

  // Filter for relevant files
  const storyFiles = [];
  const componentFiles = [];
  const otherFiles = [];

  for (const file of changedFiles) {
    // Only process files in src/ directory
    if (!file.startsWith("src/")) {
      otherFiles.push(file);
      continue;
    }

    if (isStoryFile(file)) {
      storyFiles.push(file);
    } else if (isComponentFile(file)) {
      componentFiles.push(file);
    } else {
      otherFiles.push(file);
    }
  }

  console.log(`   Story files changed: ${storyFiles.length}`);
  console.log(`   Component files changed: ${componentFiles.length}`);
  console.log(`   Other files changed: ${otherFiles.length}`);

  // Find story files for changed components
  const storyFilesFromComponents = [];
  const componentToStoryMap = new Map();

  for (const componentFile of componentFiles) {
    const componentPath = path.join(projectRoot, componentFile);
    const stories = findStoryFilesForComponent(componentPath);
    if (stories.length > 0) {
      componentToStoryMap.set(componentFile, stories);
      storyFilesFromComponents.push(...stories);
    }
  }

  // Combine all story files and get unique paths
  const allStoryFiles = [
    ...new Set([...storyFiles, ...storyFilesFromComponents]),
  ];

  if (allStoryFiles.length === 0) {
    console.log(
      "\n✅ No story files or component files with stories were changed.",
    );
    console.log("   Skipping visual tests.\n");
    process.exit(0);
  }

  // Estimate total number of story exports (upper bound)
  let totalStoryExports = 0;
  const storyFileDetails = [];
  for (const storyFile of allStoryFiles) {
    const exportCount = estimateStoryExports(storyFile);
    totalStoryExports += exportCount;
    storyFileDetails.push({ file: storyFile, exports: exportCount });
  }

  console.log(`\n📝 Story files to test: ${allStoryFiles.length}`);
  if (storyFiles.length > 0) {
    console.log(`   Direct story file changes (${storyFiles.length}):`);
    storyFiles.forEach((file) => {
      const detail = storyFileDetails.find((d) => d.file === file);
      const exportInfo = detail ? ` (~${detail.exports} exports)` : "";
      console.log(`     • ${file}${exportInfo}`);
    });
  }
  if (componentFiles.length > 0 && storyFilesFromComponents.length > 0) {
    console.log(`   Story files from component changes:`);
    componentToStoryMap.forEach((stories, component) => {
      stories.forEach((story) => {
        const detail = storyFileDetails.find((d) => d.file === story);
        const exportInfo = detail ? ` (~${detail.exports} exports)` : "";
        console.log(`     • ${story}${exportInfo} (from ${component})`);
      });
    });
  }

  const visualTestMode = process.env.VISUAL_TEST_MODE || "lite";
  const defaultKeywordsForMode = getDefaultKeywordsForMode(visualTestMode);
  const modeDescription =
    visualTestMode === "lite"
      ? "only stories with _visual suffix"
      : `stories matching: ${defaultKeywordsForMode} keywords or _visual suffix`;

  console.log(`\n🧪 Test estimation:`);
  console.log(`   Story files: ${allStoryFiles.length}`);
  console.log(`   Total story exports: ~${totalStoryExports}`);
  console.log(`   Visual test mode: ${visualTestMode}`);
  console.log(`   Note: Actual tests will be filtered to ${modeDescription}`);

  // Convert story file paths to include paths for STORY_INCLUDE_PATHS
  // STORY_INCLUDE_PATHS uses substring matching, so we can use the file paths directly
  const includePaths = allStoryFiles.join(",");

  // Clear result files before starting tests
  console.log("\nClearing previous test results...");
  try {
    await clearResultFiles();
  } catch (error) {
    console.error("❌ Failed to clear result files:", error.message);
    console.error("Aborting to prevent mixing results from different runs");
    process.exit(1);
  }

  // Determine visual test keywords for the selected mode (from shared config)
  const storyVisualKeywords = getDefaultKeywordsForMode(visualTestMode);

  // Execute the visual tests wrapper with STORY_INCLUDE_PATHS set
  // This ensures timeout errors are handled correctly
  // Note: We set SKIP_CLEAR_AND_GENERATE to prevent wrapper from calling clear/generate
  // since we're handling it here
  const command =
    `cross-env CI=1 VISUAL_TEST_MODE=${visualTestMode} STORY_VISUAL_KEYWORDS="${storyVisualKeywords}" STORY_INCLUDE_PATHS=` +
    includePaths +
    " SKIP_CLEAR_AND_GENERATE=1 node scripts/visual-tests/run-visual-tests-wrapper.js";

  console.log(`\n🚀 Running visual tests for changed stories...`);
  console.log("=".repeat(80));
  console.log("");

  let testExitCode = 0;
  try {
    execSync(command, { stdio: "inherit", cwd: projectRoot });
  } catch (error) {
    testExitCode = error.status || 1;
  }

  // Generate reports after tests complete
  console.log("\nGenerating test reports...");
  try {
    // Fetch story IDs that match the include paths for filtering
    const testedStoryIds = await fetchStoryIdsForPaths(includePaths);
    await generateReports(testedStoryIds.length > 0 ? testedStoryIds : null);
  } catch (error) {
    console.error("⚠️  Failed to generate reports:", error.message);
    // Don't exit on report generation failure, continue with exit code
  }

  console.log("");
  console.log("=".repeat(80));
  if (testExitCode === 0) {
    console.log("✅ Visual tests completed successfully");
  } else {
    console.log("❌ Visual tests failed");
  }
  console.log("=".repeat(80));

  process.exit(testExitCode);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
