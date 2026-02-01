import { jest } from "@jest/globals";

// Mock dependencies
const mockFs = {
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
};

const mockImageSize = jest.fn();

const mockFetchStories = jest.fn();
const mockSanitize = (id) =>
  id
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

jest.unstable_mockModule("fs", () => ({ default: mockFs }));
jest.unstable_mockModule("image-size", () => ({ imageSize: mockImageSize }));
jest.unstable_mockModule("../lib/story-discovery.js", () => ({
  fetchStoriesFromStorybook: mockFetchStories,
  sanitizeSnapshotName: mockSanitize,
}));

// Import module under test
const { findRecommendations } = await import("../lib/recommendation-engine.js");

describe("Recommendation Engine", () => {
  const config = {
    paths: {
      snapshotsDir: "__visual_snapshots__",
    },
    snapshot: {
      mobile: {
        discovery: {
          thresholds: {
            minWidth: 400,
          },
        },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([]);
    mockFetchStories.mockResolvedValue([]);
  });

  test("returns empty list if snapshot directory missing", async () => {
    mockFs.existsSync.mockReturnValue(false);
    const results = await findRecommendations(config);
    expect(results).toEqual([]);
  });

  test("returns empty list if no desktop snapshots", async () => {
    mockFs.readdirSync.mockReturnValue([]);
    const results = await findRecommendations(config);
    expect(results).toEqual([]);
  });

  test("recommends story exceeding width threshold without mobile snapshot", async () => {
    // Setup desktop snapshot
    mockFs.readdirSync.mockImplementation((path) => {
      if (path.endsWith("mobile")) return [];
      return ["story-one.png"];
    });

    // Setup dimensions (width 500 > 400)
    mockImageSize.mockReturnValue({ width: 500, height: 100 });

    // Setup matching story
    mockFetchStories.mockResolvedValue([
      { id: "story--one", name: "Story One" },
    ]);

    const results = await findRecommendations(config);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      storyId: "story--one",
      width: 500,
      reason: expect.stringContaining("Width 500px > 400px"),
    });
  });

  test("ignores story within width threshold", async () => {
    // Setup desktop snapshot
    mockFs.readdirSync.mockImplementation((path) => {
      if (path.endsWith("mobile")) return [];
      return ["story-one.png"];
    });

    // Setup dimensions (width 300 < 400)
    mockImageSize.mockReturnValue({ width: 300, height: 100 });

    const results = await findRecommendations(config);

    expect(results).toHaveLength(0);
  });

  test("ignores story that already has mobile snapshot", async () => {
    // Setup desktop snapshot
    mockFs.readdirSync.mockImplementation((path) => {
      if (path.endsWith("mobile")) return ["story-one-375x667.png"];
      return ["story-one.png"];
    });

    // Setup dimensions (width 500 > 400)
    mockImageSize.mockReturnValue({ width: 500, height: 100 });

    const results = await findRecommendations(config);

    expect(results).toHaveLength(0);
  });

  test("excludes stories based on tags", async () => {
    const configWithExclusion = {
      ...config,
      snapshot: {
        mobile: {
          discovery: {
            excludeTags: ["ignore-mobile"],
          },
        },
      },
    };

    mockFs.readdirSync.mockImplementation((path) => {
      if (path.endsWith("mobile")) return [];
      return ["story-one.png"];
    });

    mockImageSize.mockReturnValue({ width: 500, height: 100 });

    // Story has excluded tag
    mockFetchStories.mockResolvedValue([
      { id: "story--one", tags: ["ignore-mobile"] },
    ]);

    const results = await findRecommendations(configWithExclusion);

    expect(results).toHaveLength(0);
  });

  test("handles case-insensitive matching between story ID and filename", async () => {
    // Setup desktop snapshot (lowercase on disk)
    mockFs.readdirSync.mockImplementation((path) => {
      if (path.endsWith("mobile")) return [];
      return ["story-one.png"];
    });

    mockImageSize.mockReturnValue({ width: 500, height: 100 });

    // Story ID has uppercase
    mockFetchStories.mockResolvedValue([
      { id: "Story--One", name: "Story One" },
    ]);

    const results = await findRecommendations(config);

    expect(results).toHaveLength(1);
    expect(results[0].storyId).toBe("Story--One");
  });
});
