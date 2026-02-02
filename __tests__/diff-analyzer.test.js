/**
 * Diff Analyzer Tests
 */

import { jest } from "@jest/globals";
import path from "path";

const mockExecSync = jest.fn();
const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
};

jest.unstable_mockModule("child_process", () => ({
  execSync: mockExecSync,
}));

jest.unstable_mockModule("fs", () => ({
  default: mockFs,
  existsSync: mockFs.existsSync,
  readFileSync: mockFs.readFileSync,
}));

describe("Diff Analyzer", () => {
  let isStoryFile,
    isComponentFile,
    findStoryFilesForComponent,
    getChangedFiles,
    branchExists,
    remoteBranchExists,
    getDefaultRemote,
    mapComponentsToStories,
    findAffectedStories,
    estimateStoryExports;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import("../lib/diff-analyzer.js");
    isStoryFile = module.isStoryFile;
    isComponentFile = module.isComponentFile;
    findStoryFilesForComponent = module.findStoryFilesForComponent;
    getChangedFiles = module.getChangedFiles;
    branchExists = module.branchExists;
    remoteBranchExists = module.remoteBranchExists;
    getDefaultRemote = module.getDefaultRemote;
    mapComponentsToStories = module.mapComponentsToStories;
    findAffectedStories = module.findAffectedStories;
    estimateStoryExports = module.estimateStoryExports;
  });

  describe("isStoryFile", () => {
    it("should identify .stories. files", () => {
      expect(isStoryFile("Button.stories.tsx")).toBe(true);
      expect(isStoryFile("src/Button.stories.tsx")).toBe(true);
    });

    it("should identify .story. files", () => {
      expect(isStoryFile("Button.story.tsx")).toBe(true);
      expect(isStoryFile("src/Button.story.tsx")).toBe(true);
    });

    it("should reject non-story files", () => {
      expect(isStoryFile("Button.tsx")).toBe(false);
      expect(isStoryFile("Button.test.tsx")).toBe(false);
    });
  });

  describe("isComponentFile", () => {
    it("should identify component files in component paths", () => {
      expect(
        isComponentFile("src/components/Button.tsx", ["src/components/"]),
      ).toBe(true);
    });

    it("should reject non-tsx files", () => {
      expect(
        isComponentFile("src/components/Button.ts", ["src/components/"]),
      ).toBe(false);
    });

    it("should reject test files", () => {
      expect(
        isComponentFile("src/components/Button.test.tsx", ["src/components/"]),
      ).toBe(false);
      expect(
        isComponentFile("src/components/Button.spec.tsx", ["src/components/"]),
      ).toBe(false);
      expect(
        isComponentFile("src/components/Button.stories.tsx", ["src/components/"]),
      ).toBe(false);
    });

    it("should reject utility files", () => {
      expect(
        isComponentFile("src/components/Button.utils.tsx", ["src/components/"]),
      ).toBe(false);
      expect(
        isComponentFile("src/components/ButtonUtils.tsx", ["src/components/"]),
      ).toBe(false);
      expect(
        isComponentFile("src/components/Button.types.tsx", ["src/components/"]),
      ).toBe(false);
    });

    it("should reject files outside component paths", () => {
      expect(isComponentFile("src/utils/Button.tsx", ["src/components/"])).toBe(
        false,
      );
    });
  });

  describe("findStoryFilesForComponent", () => {
    it("should find .stories.tsx file", () => {
      const componentPath = path.join(process.cwd(), "src/components/Button.tsx");
      mockFs.existsSync.mockImplementation((filePath) => {
        return filePath.endsWith("Button.stories.tsx");
      });

      const stories = findStoryFilesForComponent(componentPath);
      expect(stories.length).toBeGreaterThan(0);
      expect(stories[0]).toContain("Button.stories.tsx");
    });

    it("should find .stories.ts file", () => {
      const componentPath = path.join(process.cwd(), "src/components/Button.tsx");
      mockFs.existsSync.mockImplementation((filePath) => {
        return filePath.endsWith("Button.stories.ts");
      });

      const stories = findStoryFilesForComponent(componentPath);
      expect(stories.length).toBeGreaterThan(0);
    });

    it("should return empty array if no story files found", () => {
      const componentPath = path.join(process.cwd(), "src/components/Button.tsx");
      mockFs.existsSync.mockReturnValue(false);

      const stories = findStoryFilesForComponent(componentPath);
      expect(stories).toEqual([]);
    });
  });

  describe("getChangedFiles", () => {
    it("should return changed files from git diff", () => {
      mockExecSync.mockReturnValue("file1.tsx\nfile2.tsx\nfile3.tsx\n");

      const files = getChangedFiles("main");

      expect(files).toEqual(["file1.tsx", "file2.tsx", "file3.tsx"]);
      expect(mockExecSync).toHaveBeenCalledWith(
        "git diff --name-only main...HEAD",
        expect.objectContaining({
          encoding: "utf8",
        }),
      );
    });

    it("should filter out empty lines", () => {
      mockExecSync.mockReturnValue("file1.tsx\n\nfile2.tsx\n");

      const files = getChangedFiles("main");

      expect(files).toEqual(["file1.tsx", "file2.tsx"]);
    });

    it("should throw error on git failure", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Git error");
      });

      expect(() => getChangedFiles("main")).toThrow("Failed to get changed files");
    });
  });

  describe("branchExists", () => {
    it("should return true if branch exists", () => {
      mockExecSync.mockImplementation(() => {});

      expect(branchExists("main")).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        "git rev-parse --verify main",
        expect.objectContaining({ stdio: "ignore" }),
      );
    });

    it("should return false if branch doesn't exist", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Branch not found");
      });

      expect(branchExists("nonexistent")).toBe(false);
    });
  });

  describe("remoteBranchExists", () => {
    it("should return true if remote branch exists", () => {
      mockExecSync.mockImplementation(() => {});

      expect(remoteBranchExists("main", "origin")).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        "git ls-remote --heads origin main",
        expect.objectContaining({ stdio: "ignore" }),
      );
    });

    it("should return false if remote branch doesn't exist", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Not found");
      });

      expect(remoteBranchExists("nonexistent", "origin")).toBe(false);
    });
  });

  describe("getDefaultRemote", () => {
    it("should return origin if it exists", () => {
      mockExecSync.mockReturnValue("origin\nupstream\n");

      expect(getDefaultRemote()).toBe("origin");
    });

    it("should return first remote if origin doesn't exist", () => {
      mockExecSync.mockReturnValue("upstream\nfork\n");

      expect(getDefaultRemote()).toBe("upstream");
    });

    it("should return origin as default on error", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Git error");
      });

      expect(getDefaultRemote()).toBe("origin");
    });
  });

  describe("mapComponentsToStories", () => {
    it("should map components to their story files", () => {
      const componentFiles = ["src/components/Button.tsx"];
      mockFs.existsSync.mockImplementation((filePath) => {
        return filePath.includes("Button.stories.tsx");
      });

      const map = mapComponentsToStories(componentFiles);

      expect(map.size).toBe(1);
      expect(map.has("src/components/Button.tsx")).toBe(true);
    });

    it("should return empty map if no stories found", () => {
      const componentFiles = ["src/components/Button.tsx"];
      mockFs.existsSync.mockReturnValue(false);

      const map = mapComponentsToStories(componentFiles);

      expect(map.size).toBe(0);
    });
  });

  describe("findAffectedStories", () => {
    it("should identify story files", () => {
      const changedFiles = ["src/components/Button.stories.tsx"];
      const config = {
        snapshot: {
          paths: { componentPaths: ["src/components/"] },
        },
      };

      const result = findAffectedStories(changedFiles, config);

      expect(result.storyFiles).toContain("src/components/Button.stories.tsx");
      expect(result.componentFiles).toEqual([]);
    });

    it("should identify component files", () => {
      const changedFiles = ["src/components/Button.tsx"];
      const config = {
        snapshot: {
          paths: { componentPaths: ["src/components/"] },
        },
      };

      const result = findAffectedStories(changedFiles, config);

      expect(result.componentFiles).toContain("src/components/Button.tsx");
    });

    it("should find story files for changed components", () => {
      const changedFiles = ["src/components/Button.tsx"];
      const config = {
        snapshot: {
          paths: { componentPaths: ["src/components/"] },
        },
      };

      mockFs.existsSync.mockImplementation((filePath) => {
        return filePath.includes("Button.stories.tsx");
      });

      const result = findAffectedStories(changedFiles, config);

      expect(result.allStoryFiles.length).toBeGreaterThan(0);
    });

    it("should filter out files not in component paths", () => {
      const changedFiles = [
        "src/components/Button.tsx",
        "src/utils/helper.ts",
      ];
      const config = {
        snapshot: {
          paths: { componentPaths: ["src/components/"] },
        },
      };

      const result = findAffectedStories(changedFiles, config);

      expect(result.otherFiles).toContain("src/utils/helper.ts");
    });
  });

  describe("estimateStoryExports", () => {
    it("should count export const declarations", () => {
      const storyFilePath = "src/components/Button.stories.tsx";
      mockFs.readFileSync.mockReturnValue(`
        export default { title: 'Button' };
        export const Primary = {};
        export const Secondary = {};
        export const Large = {};
      `);

      const count = estimateStoryExports(storyFilePath);

      expect(count).toBe(3);
    });

    it("should count export function declarations", () => {
      const storyFilePath = "src/components/Button.stories.tsx";
      mockFs.readFileSync.mockReturnValue(`
        export default { title: 'Button' };
        export function Primary() {}
        export function Secondary() {}
      `);

      const count = estimateStoryExports(storyFilePath);

      expect(count).toBe(2);
    });

    it("should skip default and meta exports", () => {
      const storyFilePath = "src/components/Button.stories.tsx";
      mockFs.readFileSync.mockReturnValue(`
        export default { title: 'Button' };
        export const meta = {};
        export const Primary = {};
      `);

      const count = estimateStoryExports(storyFilePath);

      expect(count).toBe(1);
    });

    it("should return at least 1", () => {
      const storyFilePath = "src/components/Button.stories.tsx";
      mockFs.readFileSync.mockReturnValue(`
        export default { title: 'Button' };
      `);

      const count = estimateStoryExports(storyFilePath);

      expect(count).toBe(1);
    });

    it("should return 1 on read error", () => {
      const storyFilePath = "src/components/Button.stories.tsx";
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("Read failed");
      });

      const count = estimateStoryExports(storyFilePath);

      expect(count).toBe(1);
    });
  });
});
