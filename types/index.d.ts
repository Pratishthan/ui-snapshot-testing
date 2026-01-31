/**
 * Type definitions for ui-snapshot-testing
 */

// Re-export configuration types
export * from "../config-loader.js";
export * from "../visual-test-config.js";

// Story Discovery Types
export interface StoryEntry {
  id: string;
  type?: string;
  name?: string;
  importPath?: string;
}

export function fetchStoriesFromStorybook(
  config: import("../config-loader.js").VisualTestConfig,
  includeAllMatching?: boolean,
): Promise<StoryEntry[]>;

export function filterStoriesByKeywords(
  stories: StoryEntry[],
  keywords: string[],
  mode: "lite" | "full",
): StoryEntry[];

export function filterStoriesByPaths(
  stories: StoryEntry[],
  paths: string[],
): StoryEntry[];

export function filterStoriesByExclusions(
  stories: StoryEntry[],
  exclusions: string[],
): StoryEntry[];

export function matchesExclusionPatterns(
  entry: StoryEntry,
  exclusions: string[],
): boolean;

export function matchesVisualCriteria(
  entry: StoryEntry,
  keywords: string[],
  mode: "lite" | "full",
): boolean;

export function matchesPathFilters(
  entry: StoryEntry,
  includePaths: string[],
): boolean;

export function matchesStoryIdFilters(
  entry: StoryEntry,
  storyIds: string[],
): boolean;

export function snapshotExists(
  storyId: string,
  config: import("../config-loader.js").VisualTestConfig,
): boolean;

export function sanitizeSnapshotName(storyId: string): string;

// Failure Handling Types
export interface FailureEntry {
  id: string;
  storyId?: string;
  importPath?: string | null;
  message?: string;
  errorMessage?: string;
  screenshotPath?: string;
  positionDiffs?: PositionDiff[];
}

export interface PositionDiff {
  testId: string;
  expected: {
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  actual: {
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  deltaX: number;
  deltaY: number;
  deltaWidth: number;
  deltaHeight: number;
}

export interface IgnoredEntry {
  id: string;
  importPath?: string;
  message: string;
  pattern: string;
}

export interface SkippedEntry {
  id: string;
  importPath?: string;
  message: string;
  reason: string;
}

export interface FailureSummary {
  total: number;
  ignorable: number;
  nonIgnorable: number;
  allIgnorable: boolean;
}

export function isSnapshotMismatch(errorMessage: string): boolean;

export function shouldIgnoreError(
  errorMessage: string,
  ignorePatterns: string[],
): boolean;

export function parseFailures(
  logFile: string,
  config: import("../config-loader.js").VisualTestConfig,
): Promise<FailureEntry[]>;

export function readFailuresFromJsonl(
  failuresFile: string,
): Promise<FailureEntry[]>;
export function readPassedFromJsonl(passedFile: string): Promise<string[]>;
export function readIgnoredFromJsonl(
  ignoredFile: string,
): Promise<IgnoredEntry[]>;
export function readSkippedFromJsonl(
  skippedFile: string,
): Promise<SkippedEntry[]>;

export function categorizeFailures(
  failures: FailureEntry[],
  config: import("../config-loader.js").VisualTestConfig,
): {
  ignorable: FailureEntry[];
  nonIgnorable: FailureEntry[];
};

export function allFailuresIgnorable(
  failures: FailureEntry[],
  config: import("../config-loader.js").VisualTestConfig,
): boolean;

export function getFailureSummary(
  failures: FailureEntry[],
  config: import("../config-loader.js").VisualTestConfig,
): FailureSummary;

// Report Generation Types
export interface TestResults {
  totalStories: number;
  failures: FailureEntry[];
  passed: string[];
  ignored: IgnoredEntry[];
  skipped: SkippedEntry[];
}

export function generateJsonReport(
  results: TestResults,
  config: import("../config-loader.js").VisualTestConfig,
): Promise<string | null>;

export function generateHtmlReport(
  results: TestResults,
  config: import("../config-loader.js").VisualTestConfig,
): Promise<string | null>;

export function generateLogReport(
  results: TestResults,
  config: import("../config-loader.js").VisualTestConfig,
): Promise<string | null>;

// Diff Analysis Types
export interface AffectedStories {
  storyFiles: string[];
  componentFiles: string[];
  otherFiles: string[];
  componentToStoryMap: Map<string, string[]>;
  allStoryFiles: string[];
}

export function isStoryFile(filePath: string): boolean;

export function isComponentFile(
  filePath: string,
  componentPaths?: string[],
): boolean;

export function findStoryFilesForComponent(
  componentPath: string,
  projectRoot?: string,
): string[];

export function getChangedFiles(
  targetBranch: string,
  projectRoot?: string,
): string[];

export function branchExists(branchName: string, projectRoot?: string): boolean;

export function remoteBranchExists(
  branchName: string,
  remote?: string,
  projectRoot?: string,
): boolean;

export function getDefaultRemote(projectRoot?: string): string;

export function mapComponentsToStories(
  componentFiles: string[],
  projectRoot?: string,
): Map<string, string[]>;

export function findAffectedStories(
  changedFiles: string[],
  config: import("../config-loader.js").VisualTestConfig,
): AffectedStories;

export function estimateStoryExports(
  storyFilePath: string,
  projectRoot?: string,
): number;
