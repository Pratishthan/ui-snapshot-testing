/**
 * Report Command Tests
 */

import { jest } from "@jest/globals";
import chalk from "chalk";
import path from "path";

const mockLoadConfig = jest.fn();
const mockGenerateJsonReport = jest.fn();
const mockReadFailuresFromJsonl = jest.fn();
const mockReadPassedFromJsonl = jest.fn();
const mockReadIgnoredFromJsonl = jest.fn();
const mockReadSkippedFromJsonl = jest.fn();

const mockSpawn = jest.fn();

const mockFs = {
  existsSync: jest.fn(),
};

const mockConsoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = jest
  .spyOn(console, "error")
  .mockImplementation(() => {});
const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});

jest.unstable_mockModule("fs", () => ({
  default: mockFs,
  existsSync: mockFs.existsSync,
}));

jest.unstable_mockModule("child_process", () => ({
  spawn: mockSpawn,
}));

jest.unstable_mockModule("../config-loader.js", () => ({
  loadConfig: mockLoadConfig,
}));

jest.unstable_mockModule("../lib/report-generator.js", () => ({
  generateJsonReport: mockGenerateJsonReport,
}));

jest.unstable_mockModule("../lib/result-processor.js", () => ({
  readFailuresFromJsonl: mockReadFailuresFromJsonl,
  readPassedFromJsonl: mockReadPassedFromJsonl,
  readIgnoredFromJsonl: mockReadIgnoredFromJsonl,
  readSkippedFromJsonl: mockReadSkippedFromJsonl,
  allFailuresIgnorable: jest.fn(),
}));

describe("Report Command", () => {
  let reportCommand;
  let mockYargs;
  let commandHandler;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await import("../cli/commands/report.js");
    reportCommand = module.reportCommand;

    mockYargs = {
      command: jest.fn((name, description, builder, handler) => {
        commandHandler = handler;
        return mockYargs;
      }),
      option: jest.fn(() => mockYargs),
      example: jest.fn(() => mockYargs),
    };

    mockSpawn.mockReturnValue({
      unref: jest.fn(),
    });
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockExit.mockRestore();
  });

  it("should open HTML report by default", async () => {
    const mockConfig = {
      snapshot: {
        paths: { logsDir: "logs" },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFs.existsSync.mockReturnValue(true);

    reportCommand(mockYargs);
    const argv = { config: "config.js", open: true, format: "html" };
    await commandHandler(argv);

    const reportPath = path.join(
      process.cwd(),
      "logs",
      "playwright/storybook/reports/index.html",
    );
    expect(mockFs.existsSync).toHaveBeenCalledWith(reportPath);
    expect(mockSpawn).toHaveBeenCalled();
  });

  it("should generate report when --generate is used", async () => {
    const mockConfig = {
      snapshot: {
        paths: { logsDir: "logs" },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockReadFailuresFromJsonl.mockResolvedValue([]);
    mockReadPassedFromJsonl.mockResolvedValue([]);
    mockReadIgnoredFromJsonl.mockResolvedValue([]);
    mockReadSkippedFromJsonl.mockResolvedValue([]);
    mockGenerateJsonReport.mockResolvedValue("/path/to/report.json");

    reportCommand(mockYargs);
    const argv = {
      config: "config.js",
      generate: true,
      format: "json",
      open: false,
    };
    await commandHandler(argv);

    expect(mockReadFailuresFromJsonl).toHaveBeenCalled();
    expect(mockReadPassedFromJsonl).toHaveBeenCalled();
    expect(mockGenerateJsonReport).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("JSON report generated"),
    );
  });

  it("should generate both HTML and JSON when format is both", async () => {
    const mockConfig = {
      snapshot: {
        paths: { logsDir: "logs" },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockReadFailuresFromJsonl.mockResolvedValue([]);
    mockReadPassedFromJsonl.mockResolvedValue([]);
    mockReadIgnoredFromJsonl.mockResolvedValue([]);
    mockReadSkippedFromJsonl.mockResolvedValue([]);
    mockGenerateJsonReport.mockResolvedValue("/path/to/report.json");

    reportCommand(mockYargs);
    const argv = {
      config: "config.js",
      generate: true,
      format: "both",
      open: false,
    };
    await commandHandler(argv);

    expect(mockGenerateJsonReport).toHaveBeenCalled();
  });

  it("should warn when report file doesn't exist", async () => {
    const mockConfig = {
      snapshot: {
        paths: { logsDir: "logs" },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFs.existsSync.mockReturnValue(false);

    reportCommand(mockYargs);
    const argv = { config: "config.js", open: true, format: "html" };
    await commandHandler(argv);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("Report not found"),
    );
  });

  it("should open JSON report when format is json", async () => {
    const mockConfig = {
      snapshot: {
        paths: { logsDir: "logs" },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFs.existsSync.mockReturnValue(true);

    reportCommand(mockYargs);
    const argv = { config: "config.js", open: true, format: "json" };
    await commandHandler(argv);

    const jsonPath = path.join(process.cwd(), "logs", "visual-test-results.json");
    expect(mockFs.existsSync).toHaveBeenCalledWith(jsonPath);
  });

  it("should handle errors gracefully", async () => {
    mockLoadConfig.mockRejectedValue(new Error("Config error"));

    reportCommand(mockYargs);
    const argv = { config: "config.js" };
    await commandHandler(argv);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Error generating/opening report"),
      expect.any(String),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
