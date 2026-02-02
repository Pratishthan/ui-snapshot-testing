/**
 * Test Runner Utils Tests
 */

import { jest } from "@jest/globals";
import path from "path";

const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
};

jest.unstable_mockModule("fs", () => ({
  default: mockFs,
  existsSync: mockFs.existsSync,
  mkdirSync: mockFs.mkdirSync,
  writeFileSync: mockFs.writeFileSync,
  unlinkSync: mockFs.unlinkSync,
}));

describe("Test Runner Utils", () => {
  let generateTestFiles, cleanupTestFiles;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import("../lib/test-runner-utils.js");
    generateTestFiles = module.generateTestFiles;
    cleanupTestFiles = module.cleanupTestFiles;

    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => {});
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.unlinkSync.mockImplementation(() => {});
  });

  describe("generateTestFiles", () => {
    it("should create logs directory if it doesn't exist", async () => {
      const config = {
        snapshot: {
          paths: { logsDir: "test-logs" },
        },
      };
      const stories = [{ id: "story1" }];

      mockFs.existsSync.mockReturnValue(false);

      await generateTestFiles(config, stories);

      const logsDir = path.resolve(process.cwd(), "test-logs");
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(logsDir, {
        recursive: true,
      });
    });

    it("should not create logs directory if it exists", async () => {
      const config = {
        snapshot: {
          paths: { logsDir: "test-logs" },
        },
      };
      const stories = [{ id: "story1" }];

      mockFs.existsSync.mockReturnValue(true);

      await generateTestFiles(config, stories);

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it("should generate data file with config and stories", async () => {
      const config = {
        snapshot: {
          paths: { logsDir: "test-logs" },
        },
      };
      const stories = [{ id: "story1", name: "Story 1" }];

      mockFs.existsSync.mockReturnValue(true);

      await generateTestFiles(config, stories);

      const dataFile = path.join(
        path.resolve(process.cwd(), "test-logs"),
        "visual-tests-data.json",
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        dataFile,
        JSON.stringify({ config, stories }, null, 2),
      );
    });

    it("should generate spec file with correct content", async () => {
      const config = {
        snapshot: {
          paths: { logsDir: "test-logs" },
        },
      };
      const stories = [{ id: "story1" }];

      mockFs.existsSync.mockReturnValue(true);

      await generateTestFiles(config, stories);

      const specFile = path.join(
        path.resolve(process.cwd(), "test-logs"),
        "visual-tests.generated.spec.js",
      );
      const specContent = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === specFile,
      )?.[1];

      expect(specContent).toContain("@playwright/test");
      expect(specContent).toContain("ui-snapshot-testing/playwright");
      expect(specContent).toContain("readVisualTestsData");
      expect(specContent).toContain("generateVisualTestsFromData");
    });

    it("should return paths to generated files", async () => {
      const config = {
        snapshot: {
          paths: { logsDir: "test-logs" },
        },
      };
      const stories = [{ id: "story1" }];

      mockFs.existsSync.mockReturnValue(true);

      const result = await generateTestFiles(config, stories);

      expect(result).toHaveProperty("dataFile");
      expect(result).toHaveProperty("specFile");
      expect(result.dataFile).toContain("visual-tests-data.json");
      expect(result.specFile).toContain("visual-tests.generated.spec.js");
    });
  });

  describe("cleanupTestFiles", () => {
    it("should delete data file if it exists", async () => {
      const files = {
        dataFile: "/path/to/data.json",
        specFile: "/path/to/spec.js",
      };

      mockFs.existsSync.mockReturnValue(true);

      await cleanupTestFiles(files);

      expect(mockFs.unlinkSync).toHaveBeenCalledWith("/path/to/data.json");
    });

    it("should delete spec file if it exists", async () => {
      const files = {
        dataFile: "/path/to/data.json",
        specFile: "/path/to/spec.js",
      };

      mockFs.existsSync.mockReturnValue(true);

      await cleanupTestFiles(files);

      expect(mockFs.unlinkSync).toHaveBeenCalledWith("/path/to/spec.js");
    });

    it("should not delete files that don't exist", async () => {
      const files = {
        dataFile: "/path/to/data.json",
        specFile: "/path/to/spec.js",
      };

      mockFs.existsSync.mockReturnValue(false);

      await cleanupTestFiles(files);

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it("should handle cleanup errors gracefully", () => {
      const files = {
        dataFile: "/path/to/data.json",
        specFile: "/path/to/spec.js",
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("Delete failed");
      });

      expect(() => cleanupTestFiles(files)).not.toThrow();
    });

    it("should handle missing file paths", () => {
      const files = {
        dataFile: null,
        specFile: undefined,
      };

      expect(() => cleanupTestFiles(files)).not.toThrow();
    });
  });
});
