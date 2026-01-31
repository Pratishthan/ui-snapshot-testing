/**
 * Visual Tests Library - Main Entry Point
 * Exports all core functionality for visual regression testing
 */

// Configuration
export { loadConfig, getConfigValue } from '../config-loader.js';
export * from '../visual-test-config.js';

// Story Discovery
export {
  fetchStoriesFromStorybook,
  filterStoriesByKeywords,
  filterStoriesByPaths,
  filterStoriesByExclusions,
  matchesExclusionPatterns,
  matchesVisualCriteria,
  matchesPathFilters,
  matchesStoryIdFilters,
  snapshotExists,
  sanitizeSnapshotName,
} from './story-discovery.js';

// Failure Handling
export {
  isSnapshotMismatch,
  shouldIgnoreError,
  parseFailures,
  readFailuresFromJsonl,
  readPassedFromJsonl,
  readIgnoredFromJsonl,
  readSkippedFromJsonl,
  categorizeFailures,
  allFailuresIgnorable,
  getFailureSummary,
} from './failure-handler.js';

// Report Generation
export {
  generateJsonReport,
  generateHtmlReport,
  generateLogReport,
} from './report-generator.js';

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
} from './diff-analyzer.js';
