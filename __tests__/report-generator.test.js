import {
  generateFailureRow,
  escapeHtml,
  generatePositionDiffsTable,
} from "../lib/report-generator.js";

describe("Report Generator", () => {
  describe("escapeHtml", () => {
    test("escapes special characters", () => {
      expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
      expect(escapeHtml('"quote"')).toBe("&quot;quote&quot;");
      expect(escapeHtml("'single'")).toBe("&#039;single&#039;");
      expect(escapeHtml("&")).toBe("&amp;");
    });
  });

  describe("generateFailureRow", () => {
    const row = {
      storyId: "test-story",
      importPath: "./src/Test.stories.js",
      message: "Mismatch found",
      referenceSnapshot: "snapshots/test.png",
      errorScreenshot: "screenshots/test-diff.png",
      hasReference: true,
      hasError: true,
      positionDiffs: [],
    };

    test("generates failure row HTML with images", () => {
      const html = generateFailureRow(row);
      expect(html).toContain("test-story");
      expect(html).toContain("./src/Test.stories.js");
      expect(html).toContain("Mismatch found");
      expect(html).toContain('<img src="snapshots/test.png"');
      expect(html).toContain('<img src="screenshots/test-diff.png"');
    });

    test("handles missing reference", () => {
      const missingRow = {
        ...row,
        hasReference: false,
        referenceSnapshot: null,
      };
      const html = generateFailureRow(missingRow);
      expect(html).toContain("Reference snapshot not found");
    });
  });

  describe("generatePositionDiffsTable", () => {
    const positionDiffs = [
      {
        testId: "element-1",
        expected: { x: 10, y: 10, visible: true },
        actual: { x: 20, y: 20, visible: true },
        deltaX: 10,
        deltaY: 10,
        deltaWidth: 0,
        deltaHeight: 0,
      },
    ];

    test("generates table with diffs", () => {
      const html = generatePositionDiffsTable(positionDiffs);
      expect(html).toContain("element-1");
      expect(html).toContain("+10px, +10px");
    });
  });
});
