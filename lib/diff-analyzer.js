/**
 * Diff Analyzer Module
 * Handles git diff analysis and mapping of changed files to affected stories
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Check if a file is a story file
 * @param {string} filePath - File path
 * @returns {boolean} True if file is a story file
 */
export const isStoryFile = (filePath) => {
  return filePath.includes(".stories.") || filePath.includes(".story.");
};

/**
 * Check if a file is a component file
 * @param {string} filePath - File path
 * @param {string[]} componentPaths - Component directory paths
 * @returns {boolean} True if file is a component file
 */
export const isComponentFile = (
  filePath,
  componentPaths = ["src/components/"],
) => {
  // Must be in one of the component directories
  if (!componentPaths.some((dir) => filePath.includes(dir))) {
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
};

/**
 * Find story files for a component
 * @param {string} componentPath - Component file path
 * @param {string} projectRoot - Project root directory
 * @returns {string[]} Array of story file paths
 */
export const findStoryFilesForComponent = (
  componentPath,
  projectRoot = process.cwd(),
) => {
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
};

/**
 * Get changed files between target branch and HEAD
 * @param {string} targetBranch - Target branch name
 * @param {string} projectRoot - Project root directory
 * @returns {string[]} Array of changed file paths
 */
export const getChangedFiles = (targetBranch, projectRoot = process.cwd()) => {
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
    throw new Error(`Failed to get changed files: ${error.message}`);
  }
};

/**
 * Check if branch exists locally
 * @param {string} branchName - Branch name
 * @param {string} projectRoot - Project root directory
 * @returns {boolean} True if branch exists
 */
export const branchExists = (branchName, projectRoot = process.cwd()) => {
  try {
    execSync(`git rev-parse --verify ${branchName}`, {
      stdio: "ignore",
      cwd: projectRoot,
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if branch exists remotely
 * @param {string} branchName - Branch name
 * @param {string} remote - Remote name
 * @param {string} projectRoot - Project root directory
 * @returns {boolean} True if branch exists remotely
 */
export const remoteBranchExists = (
  branchName,
  remote = "origin",
  projectRoot = process.cwd(),
) => {
  try {
    execSync(`git ls-remote --heads ${remote} ${branchName}`, {
      stdio: "ignore",
      cwd: projectRoot,
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Get default remote name
 * @param {string} projectRoot - Project root directory
 * @returns {string} Remote name
 */
export const getDefaultRemote = (projectRoot = process.cwd()) => {
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
};

/**
 * Map component files to their story files
 * @param {string[]} componentFiles - Array of component file paths
 * @param {string} projectRoot - Project root directory
 * @returns {Map<string, string[]>} Map of component path to story paths
 */
export const mapComponentsToStories = (
  componentFiles,
  projectRoot = process.cwd(),
) => {
  const componentToStoryMap = new Map();

  for (const componentFile of componentFiles) {
    const componentPath = path.join(projectRoot, componentFile);
    const stories = findStoryFilesForComponent(componentPath, projectRoot);

    if (stories.length > 0) {
      componentToStoryMap.set(componentFile, stories);
    }
  }

  return componentToStoryMap;
};

/**
 * Find affected stories from changed files
 * @param {string[]} changedFiles - Array of changed file paths
 * @param {object} config - Configuration object
 * @returns {object} Object with story files, component files, and mapping
 */
export const findAffectedStories = (changedFiles, config) => {
  const storyFiles = [];
  const componentFiles = [];
  const otherFiles = [];

  for (const file of changedFiles) {
    // Only process files in src/ directory (or other configured paths)
    const inComponentPath = config.snapshot.paths.componentPaths.some((dir) =>
      file.startsWith(dir),
    );

    if (!inComponentPath) {
      otherFiles.push(file);
      continue;
    }

    if (isStoryFile(file)) {
      storyFiles.push(file);
    } else if (isComponentFile(file, config.snapshot.paths.componentPaths)) {
      componentFiles.push(file);
    } else {
      otherFiles.push(file);
    }
  }

  // Find story files for changed components
  const componentToStoryMap = mapComponentsToStories(componentFiles);
  const storyFilesFromComponents = [];

  for (const stories of componentToStoryMap.values()) {
    storyFilesFromComponents.push(...stories);
  }

  // Combine all story files and get unique paths
  const allStoryFiles = [
    ...new Set([...storyFiles, ...storyFilesFromComponents]),
  ];

  return {
    storyFiles,
    componentFiles,
    otherFiles,
    componentToStoryMap,
    allStoryFiles,
  };
};

/**
 * Estimate number of story exports in a file
 * @param {string} storyFilePath - Story file path
 * @param {string} projectRoot - Project root directory
 * @returns {number} Estimated number of story exports
 */
export const estimateStoryExports = (
  storyFilePath,
  projectRoot = process.cwd(),
) => {
  try {
    const fullPath = path.join(projectRoot, storyFilePath);
    const content = fs.readFileSync(fullPath, "utf8");

    const lines = content.split("\n");
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip meta and default exports
      if (
        trimmed.includes("export default") ||
        trimmed.includes("export const meta")
      ) {
        continue;
      }

      // Count export const/function declarations
      if (trimmed.match(/^export\s+(const|function)\s+\w+/)) {
        count++;
      }
    }

    return Math.max(1, count); // At least 1 story per file
  } catch {
    return 1; // Default to 1 if we can't read the file
  }
};
