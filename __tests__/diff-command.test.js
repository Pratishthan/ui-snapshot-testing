/**
 * Diff Command Tests
 */

import { jest } from "@jest/globals";
import chalk from "chalk";

const mockLoadConfig = jest.fn();
const mockGetChangedFiles = jest.fn();
const mockFindAffectedStories = jest.fn();
const mockFetchStories = jest.fn();
const mockGenerateTestFiles = jest.fn();
const mockCleanupTestFiles = jest.fn();

const mockSpawn = jest.fn();

const mockConsoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = jest
  .spyOn(console, "error")
  .mockImplementation(() => {});
const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});

jest.unstable_mockModule("child_process", () => ({
  spawn: mockSpawn,
}));

jest.unstable_mockModule("../config-loader.js", () => ({
  loadConfig: mockLoadConfig,
}));

jest.unstable_mockModule("../lib/diff-analyzer.js", () => ({
  getChangedFiles: mockGetChangedFiles,
  findAffectedStories: mockFindAffectedStories,
}));

jest.unstable_mockModule("../lib/story-discovery.js", () => ({
  fetchStoriesFromStorybook: mockFetchStories,
}));

jest.unstable_mockModule("../lib/test-runner-utils.js", () => ({
  generateTestFiles: mockGenerateTestFiles,
  cleanupTestFiles: mockCleanupTestFiles,
}));

describe("Diff Command", () => {
  let diffCommand;
  let mockYargs;
  let commandHandler;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await import("../cli/commands/diff.js");
    diffCommand = module.diffCommand;

    mockYargs = {
      command: jest.fn((name, description, builder, handler) => {
        commandHandler = handler;
        return mockYargs;
      }),
      option: jest.fn(() => mockYargs),
      example: jest.fn(() => mockYargs),
    };

    mockGenerateTestFiles.mockReturnValue({
      dataFile: "/tmp/data.json",
      specFile: "/tmp/spec.js",
    });

    const mockProcess = {
      on: jest.fn((event, callback) => {
        if (event === "exit") {
          setTimeout(() => callback(0), 0);
        }
      }),
    };
    mockSpawn.mockReturnValue(mockProcess);
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockExit.mockRestore();
  });

  it("should handle no changes", async () => {
    const mockConfig = {
      snapshot: {
        diff: { targetBranch: "main" },
        paths: { logsDir: "logs" },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockGetChangedFiles.mockReturnValue([]);

    diffCommand(mockYargs);
    const argv = { config: "config.js" };
    await commandHandler(argv);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("No changes detected"),
    );
  });

  it("should handle no story files affected", async () => {
    const mockConfig = {
      snapshot: {
        diff: { targetBranch: "main" },
        paths: { logsDir: "logs", componentPaths: ["src/components/"] },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockGetChangedFiles.mockReturnValue(["src/utils/helper.ts"]);
    mockFindAffectedStories.mockReturnValue({
      allStoryFiles: [],
      storyFiles: [],
      componentFiles: [],
      otherFiles: ["src/utils/helper.ts"],
    });

    diffCommand(mockYargs);
    const argv = { config: "config.js" };
    await commandHandler(argv);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("No story files affected"),
    );
  });

  it("should use target-branch option", async () => {
    const mockConfig = {
      snapshot: {
        diff: { targetBranch: "develop" },
        paths: { logsDir: "logs", componentPaths: ["src/components/"] },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockGetChangedFiles.mockReturnValue([]);

    diffCommand(mockYargs);
    const argv = { config: "config.js", targetBranch: "develop" };
    await commandHandler(argv);

    expect(mockLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          diff: { targetBranch: "develop" },
        }),
      }),
    );
  });

  it("should handle errors gracefully", async () => {
    mockLoadConfig.mockRejectedValue(new Error("Config error"));

    diffCommand(mockYargs);
    const argv = { config: "config.js" };
    await commandHandler(argv);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Error running diff tests"),
      expect.any(String),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
