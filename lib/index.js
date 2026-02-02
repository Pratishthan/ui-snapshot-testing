/**
 * Visual Tests Library - Main Entry Point
 * Exports all core functionality for visual regression testing
 */

// Configuration
export { loadConfig, getConfigValue } from "../config-loader.js";
export * from "../visual-test-config.js";

// Story Discovery
export {
  fetchStoriesFromStorybook,
  filterStoriesByPaths,
  filterStoriesByExclusions,
  matchesExclusionPatterns,
  matchesVisualCriteria,
  matchesPathFilters,
  matchesStoryIdFilters,
  snapshotExists,
  sanitizeSnapshotName,
} from "./story-discovery.js";

// Result Processing
export * from "./result-processor.js";

// Report Generation
export {
  generateJsonReport,
  generateHtmlReport,
  generateLogReport,
} from "./report-generator.js";

// Diff Analysis
export {
  isStoryFile,
  isComponentFile,
  findStoryFilesForComponent,
  getChangedFiles,
  branchExists,
  remoteBranchExists,
  getDefaultRemote,
  mapComponentsToStories,
  findAffectedStories,
  estimateStoryExports,
} from "./diff-analyzer.js";
