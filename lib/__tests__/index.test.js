/**
 * Library Index Tests
 * Verifies that all exports are available
 */

import { jest } from "@jest/globals";

describe("Library Index", () => {
  it("should export all expected functions", async () => {
    const lib = await import("../index.js");

    expect(lib.loadConfig).toBeDefined();
    expect(lib.getConfigValue).toBeDefined();
    expect(lib.fetchStoriesFromStorybook).toBeDefined();
    expect(lib.filterStoriesByPaths).toBeDefined();
    expect(lib.filterStoriesByExclusions).toBeDefined();
    expect(lib.matchesExclusionPatterns).toBeDefined();
    expect(lib.matchesVisualCriteria).toBeDefined();
    expect(lib.matchesPathFilters).toBeDefined();
    expect(lib.matchesStoryIdFilters).toBeDefined();
    expect(lib.snapshotExists).toBeDefined();
    expect(lib.sanitizeSnapshotName).toBeDefined();
    expect(lib.generateJsonReport).toBeDefined();
    expect(lib.generateHtmlReport).toBeDefined();
    expect(lib.generateLogReport).toBeDefined();
    expect(lib.isStoryFile).toBeDefined();
    expect(lib.isComponentFile).toBeDefined();
    expect(lib.findStoryFilesForComponent).toBeDefined();
    expect(lib.getChangedFiles).toBeDefined();
    expect(lib.branchExists).toBeDefined();
    expect(lib.remoteBranchExists).toBeDefined();
    expect(lib.getDefaultRemote).toBeDefined();
    expect(lib.mapComponentsToStories).toBeDefined();
    expect(lib.findAffectedStories).toBeDefined();
    expect(lib.estimateStoryExports).toBeDefined();
  });
});
