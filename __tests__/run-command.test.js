/**
 * Run Command Tests
 */

import { jest } from "@jest/globals";

// Mock dependencies
const mockSpawn = jest.fn();
const mockLoadConfig = jest.fn();
const mockFetchStories = jest.fn();
const mockGenerateTestFiles = jest.fn();
const mockCleanupTestFiles = jest.fn();
const mockProcessTestResults = jest.fn();

jest.unstable_mockModule("child_process", () => ({
  spawn: mockSpawn,
}));

jest.unstable_mockModule("../config-loader.js", () => ({
  loadConfig: mockLoadConfig,
}));

jest.unstable_mockModule("../lib/story-discovery.js", () => ({
  fetchStoriesFromStorybook: mockFetchStories,
}));

jest.unstable_mockModule("../lib/test-runner-utils.js", () => ({
  generateTestFiles: mockGenerateTestFiles,
  cleanupTestFiles: mockCleanupTestFiles,
}));

jest.unstable_mockModule("../lib/result-processor.js", () => ({
  processTestResults: mockProcessTestResults,
}));

describe("Run Command - Locale Mode", () => {
  let runCommand;
  let mockYargs;
  let commandHandler;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Import the module after mocks are set up
    const module = await import("../cli/commands/run.js");
    runCommand = module.runCommand;

    // Create mock yargs
    mockYargs = {
      command: jest.fn((name, description, builder, handler) => {
        commandHandler = handler;
        return mockYargs;
      }),
      option: jest.fn(() => mockYargs),
      example: jest.fn(() => mockYargs),
    };

    // Setup default mocks
    mockGenerateTestFiles.mockReturnValue({
      dataFile: "/tmp/data.json",
      specFile: "/tmp/spec.js",
    });

    mockFetchStories.mockResolvedValue([
      { id: "button--default", name: "Default" },
    ]);

    // Mock spawn to simulate successful execution
    const mockProcess = {
      on: jest.fn((event, callback) => {
        if (event === "exit") {
          setTimeout(() => callback(0), 10);
        }
      }),
    };
    mockSpawn.mockReturnValue(mockProcess);
  });

  describe("All Locales Mode", () => {
    it("should detect --locale without value as all locales mode", async () => {
      const mockConfig = {
        snapshot: {
          locale: {
            locales: [
              { code: "en-US", name: "English" },
              { code: "de-DE", name: "German" },
            ],
          },
          paths: {
            snapshotsDir: "__visual_snapshots__",
            playwrightConfig: "playwright.config.js",
            logsDir: "logs",
          },
        },
        playwright: {},
        storybook: { port: 6006 },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      // Register the command
      runCommand(mockYargs);

      // Execute with --locale as boolean
      const argv = {
        locale: true, // Boolean indicates no value provided
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should load config multiple times (1 initial + 1 per locale)
      expect(mockLoadConfig).toHaveBeenCalledTimes(3);

      // Verify each locale was loaded with correct overrides
      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "en-US" }),
      );
      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "de-DE" }),
      );

      // Should call fetchStories for each locale
      expect(mockFetchStories).toHaveBeenCalledTimes(2);
    });

    it("should validate that locales are configured", async () => {
      const mockConfig = {
        snapshot: {
          locale: {
            locales: [], // Empty locales array
          },
        },
        paths: {},
        storybook: { port: 6006 },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      // Mock process.exit
      const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});

      runCommand(mockYargs);

      const argv = {
        locale: true,
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should exit with error
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it("should skip default locale in all locales mode", async () => {
      const mockConfig = {
        snapshot: {
          locale: {
            locales: [
              { code: "en-US", name: "English", default: true },
              { code: "de-DE", name: "German" },
            ],
          },
          paths: {
            snapshotsDir: "__visual_snapshots__",
            playwrightConfig: "playwright.config.js",
            logsDir: "logs",
          },
        },
        playwright: {},
        storybook: { port: 6006 },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      runCommand(mockYargs);

      const argv = {
        locale: true,
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should load config 2 times (1 initial + 1 for non-default locale)
      expect(mockLoadConfig).toHaveBeenCalledTimes(2);

      // Verify ONLY non-default locale was loaded
      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "de-DE" }),
      );
      // Should NOT be called for default locale (en-US)
      expect(mockLoadConfig).not.toHaveBeenCalledWith(
        expect.objectContaining({ locale: "en-US" }),
      );

      // Should call fetchStories once (for non-default locale)
      expect(mockFetchStories).toHaveBeenCalledTimes(1);
    });

    it("should handle failures in locale runs", async () => {
      const mockConfig = {
        snapshot: {
          locale: {
            locales: [
              { code: "en-US", name: "English" },
              { code: "de-DE", name: "German" },
            ],
          },
          paths: {
            snapshotsDir: "__visual_snapshots__",
            playwrightConfig: "playwright.config.js",
            logsDir: "logs",
          },
        },
        playwright: {},
        storybook: { port: 6006 },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      // Mock spawn to fail on second locale
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        return {
          on: jest.fn((event, callback) => {
            if (event === "exit") {
              // First locale succeeds, second fails
              setTimeout(() => callback(callCount === 1 ? 0 : 1), 10);
            }
          }),
        };
      });

      const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});

      runCommand(mockYargs);

      const argv = {
        locale: true,
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should exit with error code 1
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe("Single Locale Mode", () => {
    it("should handle --locale with specific value", async () => {
      const mockConfig = {
        snapshot: {
          locale: {
            locales: [
              { code: "en-US", name: "English" },
              { code: "de-DE", name: "German" },
            ],
          },
          paths: {
            snapshotsDir: "__visual_snapshots__",
            playwrightConfig: "playwright.config.js",
            logsDir: "logs",
          },
        },
        playwright: {},
        storybook: { port: 6006 },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      runCommand(mockYargs);

      const argv = {
        locale: "de-DE", // String value
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should load config once with the specific locale
      expect(mockLoadConfig).toHaveBeenCalledTimes(1);
      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "de-DE" }),
      );

      // Should fetch stories once
      expect(mockFetchStories).toHaveBeenCalledTimes(1);
    });
  });

  describe("No Locale Mode", () => {
    it("should handle run without locale flag", async () => {
      const mockConfig = {
        snapshot: {
          paths: {
            snapshotsDir: "__visual_snapshots__",
            playwrightConfig: "playwright.config.js",
            logsDir: "logs",
          },
        },
        playwright: {},
        storybook: { port: 6006 },
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      runCommand(mockYargs);

      const argv = {
        // No locale property
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should load config once without locale
      expect(mockLoadConfig).toHaveBeenCalledTimes(1);
      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.objectContaining({ locale: undefined }),
      );
    });
  });
});
