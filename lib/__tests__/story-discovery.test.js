import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { fetchStoriesFromStorybook } from "../story-discovery.js";

// Mock global fetch
global.fetch = jest.fn();

describe("fetchStoriesFromStorybook Cascading Matchers", () => {
  const mockStories = {
    entries: {
      "story-visual": {
        id: "component--visual",
        name: "Visual Story",
        type: "story",
        tags: ["visual"],
        importPath: "./src/Component.stories.js",
      },
      "story-layout": {
        id: "component--layout",
        name: "Layout Story",
        type: "story",
        tags: ["layout"],
        importPath: "./src/Component.stories.js",
      },
      "story-both": {
        id: "component--both",
        name: "Both Story",
        type: "story",
        tags: ["visual", "layout"],
        importPath: "./src/Component.stories.js",
      },
      "story-none": {
        id: "component--none",
        name: "None Story",
        type: "story",
        tags: [],
        importPath: "./src/Component.stories.js",
      },
    },
  };

  const baseConfig = {
    storybook: { host: "localhost", port: "6006", indexPath: "/index.json" },
    filters: { exclusions: [], includePaths: [], storyIds: [] },
    testMatcher: { tags: ["visual"] }, // Global default
  };

  beforeEach(() => {
    fetch.mockClear();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockStories,
    });
  });

  it("uses global matcher when no overrides provided", async () => {
    const stories = await fetchStoriesFromStorybook(baseConfig, true);

    // Should match 'visual' and 'both'
    expect(stories).toHaveLength(2);
    expect(
      stories.find((s) => s.id === "component--visual")._testOptions,
    ).toEqual({
      image: true,
      position: true,
    });
  });

  it("respects image-specific matcher override", async () => {
    const config = {
      ...baseConfig,
      snapshot: {
        image: {
          testMatcher: { tags: ["layout"] }, // Only layout matching stories for image
        },
      },
    };

    const stories = await fetchStoriesFromStorybook(config, true);

    // 'visual' matches Global (fallback for position) -> position=true, image=false
    // 'layout' matches Image (override) -> image=true, position=false (no match global)
    // 'both' matches Both -> image=true, position=true

    const visual = stories.find((s) => s.id === "component--visual");
    expect(visual).toBeDefined();
    expect(visual._testOptions).toEqual({ image: false, position: true });

    const layout = stories.find((s) => s.id === "component--layout");
    expect(layout).toBeDefined();
    expect(layout._testOptions).toEqual({ image: true, position: false });

    const both = stories.find((s) => s.id === "component--both");
    expect(both).toBeDefined();
    expect(both._testOptions).toEqual({ image: true, position: true });
  });

  it("respects position-specific matcher override", async () => {
    const config = {
      ...baseConfig,
      snapshot: {
        position: {
          testMatcher: { tags: ["layout"] },
        },
      },
    };

    const stories = await fetchStoriesFromStorybook(config, true);

    // 'visual': matches Global (image) -> image=true. Matches Position (layout)? No. -> position=false.
    // 'layout': matches Global (image)? No. Matches Position (layout)? Yess. -> image=false, position=true.

    const visual = stories.find((s) => s.id === "component--visual");
    expect(visual._testOptions).toEqual({ image: true, position: false });

    const layout = stories.find((s) => s.id === "component--layout");
    expect(layout._testOptions).toEqual({ image: false, position: true });
  });
});
