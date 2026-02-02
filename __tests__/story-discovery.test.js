import {
  matchesVisualCriteria,
  matchesExclusionPatterns,
  matchesPathFilters,
  matchesStoryIdFilters,
  sanitizeSnapshotName,
} from "../lib/story-discovery.js";

describe("Story Discovery", () => {
  describe("sanitizeSnapshotName", () => {
    test("replaces non-alphanumeric characters with dashes", () => {
      expect(sanitizeSnapshotName("foo bar")).toBe("foo-bar");
      expect(sanitizeSnapshotName("foo/bar/baz")).toBe("foo-bar-baz");
      expect(sanitizeSnapshotName("FooBar123")).toBe("foobar123");
      expect(sanitizeSnapshotName("foo.bar")).toBe("foo-bar");
    });
  });

  describe("matchesVisualCriteria", () => {
    const config = {
      tags: ["visual"],
      suffix: "_visual",
      keywords: ["Visual"],
    };

    test("matches by tag", () => {
      expect(
        matchesVisualCriteria(
          { tags: ["visual"], id: "test", name: "test" },
          config,
        ),
      ).toBe(true);
      expect(
        matchesVisualCriteria(
          { tags: ["visual", "other"], id: "test", name: "test" },
          config,
        ),
      ).toBe(true);
      expect(
        matchesVisualCriteria(
          { tags: ["other"], id: "test", name: "test" },
          config,
        ),
      ).toBe(false);
      expect(
        matchesVisualCriteria({ tags: [], id: "test", name: "test" }, config),
      ).toBe(false);
    });

    test("matches by suffix (legacy)", () => {
      expect(
        matchesVisualCriteria(
          { id: "comp--my-story_visual", name: "My Story" },
          config,
        ),
      ).toBe(true);
      expect(
        matchesVisualCriteria(
          { id: "comp--my-story", name: "My Story_Visual" },
          config,
        ),
      ).toBe(true);
      expect(
        matchesVisualCriteria(
          { id: "comp--my-story", name: "My Story" },
          config,
        ),
      ).toBe(false);
    });

    test("matches by keyword (legacy)", () => {
      expect(
        matchesVisualCriteria(
          { id: "comp--story", name: "Visual Test" },
          config,
        ),
      ).toBe(true);
      expect(
        matchesVisualCriteria(
          { id: "comp--story", name: "Normal Test" },
          config,
        ),
      ).toBe(false);
    });

    test("matches by parameter override", () => {
      expect(
        matchesVisualCriteria(
          {
            id: "test",
            name: "test",
            parameters: { snapshot: true },
          },
          config,
        ),
      ).toBe(true);
    });
  });

  describe("matchesExclusionPatterns", () => {
    test("matches pattern in id", () => {
      expect(
        matchesExclusionPatterns({ id: "foo-bar-skipped", name: "foo" }, [
          "skipped",
        ]),
      ).toBe(true);
    });
    test("matches pattern in name", () => {
      expect(
        matchesExclusionPatterns({ id: "foo", name: "Skipped Story" }, [
          "Skipped",
        ]),
      ).toBe(true);
    });
    test("matches pattern in importPath", () => {
      expect(
        matchesExclusionPatterns(
          { id: "foo", name: "foo", importPath: "./src/skipped/file.js" },
          ["skipped"],
        ),
      ).toBe(true);
    });
    test("does not match unrelated", () => {
      expect(
        matchesExclusionPatterns({ id: "foo-bar", name: "foo" }, ["skipped"]),
      ).toBe(false);
    });
    test("handles empty exclusions", () => {
      expect(matchesExclusionPatterns({ id: "foo" }, [])).toBe(false);
      expect(matchesExclusionPatterns({ id: "foo" }, null)).toBe(false);
    });
  });

  describe("matchesPathFilters", () => {
    test("matches included path", () => {
      expect(
        matchesPathFilters(
          { importPath: "./src/components/MyComp.stories.js" },
          ["src/components"],
        ),
      ).toBe(true);
    });
    test("does not match excluded path", () => {
      expect(
        matchesPathFilters({ importPath: "./src/hooks/useHook.stories.js" }, [
          "src/components",
        ]),
      ).toBe(false);
    });
    test("returns true if no filters", () => {
      expect(matchesPathFilters({ importPath: "./src/any" }, [])).toBe(true);
    });
  });

  describe("matchesStoryIdFilters", () => {
    test("matches specific ID", () => {
      expect(
        matchesStoryIdFilters({ id: "comp--story" }, ["comp--story"]),
      ).toBe(true);
    });
    test("does not match other ID", () => {
      expect(
        matchesStoryIdFilters({ id: "comp--other" }, ["comp--story"]),
      ).toBe(false);
    });
  });
});
