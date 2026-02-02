/**
 * Recommend Mobile Command Tests
 */

import { jest } from "@jest/globals";
import chalk from "chalk";

const mockLoadConfig = jest.fn();
const mockFindRecommendations = jest.fn();

const mockConsoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = jest
  .spyOn(console, "error")
  .mockImplementation(() => {});
const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});

jest.unstable_mockModule("../config-loader.js", () => ({
  loadConfig: mockLoadConfig,
}));

jest.unstable_mockModule("../lib/recommendation-engine.js", () => ({
  findRecommendations: mockFindRecommendations,
}));

describe("Recommend Mobile Command", () => {
  let recommendMobileCommand;
  let mockYargs;
  let commandHandler;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await import("../cli/commands/recommend-mobile.js");
    recommendMobileCommand = module.recommendMobileCommand;

    mockYargs = {
      command: jest.fn((name, description, builder, handler) => {
        commandHandler = handler;
        return mockYargs;
      }),
      option: jest.fn(() => mockYargs),
    };
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockExit.mockRestore();
  });

  it("should display recommendations when found", async () => {
    const mockConfig = {
      snapshot: {
        mobile: {
          discovery: {
            thresholds: { minWidth: 400 },
          },
        },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFindRecommendations.mockResolvedValue([
      { storyId: "button--primary", width: 500, height: 300 },
      { storyId: "input--default", width: 600, height: 200 },
    ]);

    recommendMobileCommand(mockYargs);
    const argv = { config: "config.js" };
    await commandHandler(argv);

    expect(mockFindRecommendations).toHaveBeenCalledWith(mockConfig);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("Found 2 stories"),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("button--primary"),
    );
  });

  it("should display no recommendations message when none found", async () => {
    const mockConfig = {
      snapshot: {
        mobile: {
          discovery: {
            thresholds: { minWidth: 400 },
          },
        },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFindRecommendations.mockResolvedValue([]);

    recommendMobileCommand(mockYargs);
    const argv = { config: "config.js" };
    await commandHandler(argv);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("No missing mobile coverage"),
    );
  });

  it("should use threshold option from CLI", async () => {
    const mockConfig = {
      snapshot: {
        mobile: {
          discovery: {
            thresholds: { minWidth: 500 },
          },
        },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFindRecommendations.mockResolvedValue([]);

    recommendMobileCommand(mockYargs);
    const argv = { config: "config.js", threshold: 500 };
    await commandHandler(argv);

    expect(mockLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          mobile: expect.objectContaining({
            discovery: expect.objectContaining({
              thresholds: { minWidth: 500 },
            }),
          }),
        }),
      }),
    );
  });

  it("should display threshold in output", async () => {
    const mockConfig = {
      snapshot: {
        mobile: {
          discovery: {
            thresholds: { minWidth: 400 },
          },
        },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFindRecommendations.mockResolvedValue([]);

    recommendMobileCommand(mockYargs);
    const argv = { config: "config.js" };
    await commandHandler(argv);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("400px"),
    );
  });

  it("should handle errors gracefully", async () => {
    mockLoadConfig.mockRejectedValue(new Error("Config error"));

    recommendMobileCommand(mockYargs);
    const argv = { config: "config.js" };
    await commandHandler(argv);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Analysis failed"),
      expect.any(String),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
