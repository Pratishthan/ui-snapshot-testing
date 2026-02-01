/**
 * Dry Run Command Tests
 */

import { jest } from "@jest/globals";
import chalk from "chalk";

// Mock dependencies
const mockLoadConfig = jest.fn();
const mockFetchStories = jest.fn();

// Mock console
const mockConsoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = jest
  .spyOn(console, "error")
  .mockImplementation(() => {});
const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});

jest.unstable_mockModule("../config-loader.js", () => ({
  loadConfig: mockLoadConfig,
}));

jest.unstable_mockModule("../lib/story-discovery.js", () => ({
  fetchStoriesFromStorybook: mockFetchStories,
}));

describe("Dry Run Command", () => {
  let dryRunCommand;
  let mockYargs;
  let commandHandler;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await import("../cli/commands/dry-run.js");
    dryRunCommand = module.dryRunCommand;

    mockYargs = {
      command: jest.fn((name, description, builder, handler) => {
        commandHandler = handler;
        return mockYargs;
      }),
      option: jest.fn(() => mockYargs),
      example: jest.fn(() => mockYargs),
    };
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockExit.mockRestore();
  });

  it("should process default dry-run correctly", async () => {
    const mockConfig = {
      paths: { snapshotsDir: "__visual_snapshots__" },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFetchStories.mockResolvedValue([
      { id: "story1", name: "Story 1" },
      { id: "story2", name: "Story 2" },
    ]);

    dryRunCommand(mockYargs);
    const argv = { config: "config.js" };
    await commandHandler(argv);

    expect(mockLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        configFile: "config.js",
        mobile: undefined,
        locale: undefined,
      }),
    );

    // Should fetch all matching stories (includeAllMatching = true)
    expect(mockFetchStories).toHaveBeenCalledWith(mockConfig, true);

    // Verify usage of console.log
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("Found 2 stories"),
    );
  });

  it("should handle verbose output", async () => {
    const mockConfig = { paths: { snapshotsDir: "__visual_snapshots__" } };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFetchStories.mockResolvedValue([
      { id: "story1", name: "Story 1", importPath: "src/Story1.stories.js" },
    ]);

    dryRunCommand(mockYargs);
    const argv = { config: "config.js", verbose: true };
    await commandHandler(argv);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("src/Story1.stories.js"),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("story1 (Story 1)"),
    );
  });

  it("should handle filter options (mobile, locale, includes)", async () => {
    const mockConfig = {
      paths: { snapshotsDir: "__visual_snapshots__" },
      mobile: true,
      locale: { code: "de-DE", name: "German" },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFetchStories.mockResolvedValue([]);

    dryRunCommand(mockYargs);
    const argv = {
      config: "config.js",
      mobile: true,
      locale: "de-DE",
      includePaths: "components/Button",
      storyIds: "button--primary",
    };
    await commandHandler(argv);

    expect(mockLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        mobile: true,
        locale: "de-DE",
        filters: {
          includePaths: ["components/Button"],
          storyIds: ["button--primary"],
        },
      }),
    );

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("Mobile mode: enabled"),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("Locale: de-DE"),
    );
  });
});
