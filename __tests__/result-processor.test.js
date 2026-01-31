import { jest } from "@jest/globals";

const mockFs = {
  existsSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
};

jest.unstable_mockModule("fs", () => ({
  default: {
    existsSync: mockFs.existsSync,
    promises: mockFs.promises,
  },
  existsSync: mockFs.existsSync,
  promises: mockFs.promises,
}));

// Dynamic import after mocking
const { processTestResults, isSnapshotMismatch, shouldIgnoreError } =
  await import("../lib/result-processor.js");

describe("result-processor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isSnapshotMismatch", () => {
    test("identifies snapshot error messages", () => {
      expect(isSnapshotMismatch("Error: Snapshot comparison failed")).toBe(
        true,
      );
      expect(isSnapshotMismatch("Expected image to match")).toBe(true);
      expect(isSnapshotMismatch("Pixel difference detected")).toBe(true);
    });

    test("returns false for unrelated errors", () => {
      expect(isSnapshotMismatch("Timeout error")).toBe(false);
      expect(isSnapshotMismatch("Element not found")).toBe(false);
    });
  });

  describe("shouldIgnoreError", () => {
    test("ignores errors matching patterns", () => {
      expect(shouldIgnoreError("Timeout error", ["timeout"])).toBe(true);
    });

    test("does not ignore snapshot errors even if pattern matches", () => {
      expect(
        shouldIgnoreError("Snapshot comparison failed due to timeout", [
          "timeout",
        ]),
      ).toBe(false);
    });

    test("does not ignore if no pattern matches", () => {
      expect(shouldIgnoreError("Random error", ["timeout"])).toBe(false);
    });
  });

  describe("processTestResults", () => {
    test("processes failed, passed, and skipped tests correctly", async () => {
      const jsonReportPath = "/path/to/report.json";
      const logsDir = "/path/to/logs";

      mockFs.existsSync.mockReturnValue(true);

      const mockReport = {
        suites: [
          {
            specs: [
              {
                title: "components/Button.stories.tsx › Button › primary",
                file: "components/Button.stories.tsx",
                tests: [
                  {
                    results: [{ status: "passed" }],
                  },
                ],
              },
              {
                title: "components/Button.stories.tsx › Button › secondary",
                file: "components/Button.stories.tsx",
                tests: [
                  {
                    results: [
                      {
                        status: "failed",
                        error: { message: "Snapshot mismatch" },
                      },
                    ],
                  },
                ],
              },
              {
                title: "components/Input.stories.tsx › Input › default",
                file: "components/Input.stories.tsx",
                tests: [
                  {
                    results: [{ status: "skipped" }],
                  },
                ],
              },
            ],
          },
        ],
      };

      mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockReport));

      const summary = await processTestResults(jsonReportPath, logsDir);

      expect(summary).toEqual({
        failures: 1,
        passed: 1,
        skipped: 1,
      });

      // Verify failures write
      const failureCall = mockFs.promises.writeFile.mock.calls.find((call) =>
        call[0].includes("visual-test-failures.jsonl"),
      );
      expect(failureCall).toBeDefined();
      const failures = JSON.parse(failureCall[1]);
      expect(failures.id).toBe("secondary"); // Should extract ID correctly
      expect(failures.message).toBe("Snapshot mismatch");

      // Verify passed write
      const passedCall = mockFs.promises.writeFile.mock.calls.find((call) =>
        call[0].includes("visual-test-passed.jsonl"),
      );
      expect(passedCall).toBeDefined();
      const passed = JSON.parse(passedCall[1]);
      expect(passed.id).toBe("primary"); // Should extract ID correctly

      // Verify skipped write
      const skippedCall = mockFs.promises.writeFile.mock.calls.find((call) =>
        call[0].includes("visual-test-skipped.jsonl"),
      );
      expect(skippedCall).toBeDefined();
      const skipped = JSON.parse(skippedCall[1]);
      expect(skipped.id).toBe("default");
    });
  });
});
