/**
 * Run Command - Execute visual tests
 */

import fs from "fs";
import path from "path";
import chalk from "chalk";
import { spawn } from "child_process";
import { loadConfig } from "../../config-loader.js";
import { fetchStoriesFromStorybook } from "../../lib/story-discovery.js";
import {
  generateTestFiles,
  cleanupTestFiles,
} from "../../lib/test-runner-utils.js";
import { generateFailuresLog } from "../../lib/failure-handler.js";

export const runCommand = (yargs) => {
  yargs.command(
    "run [options]",
    "Run visual tests",
    (yargs) => {
      return yargs

        .option("storybook-port", {
          alias: "p",
          type: "string",
          description: "Storybook server port",
        })
        .option("storybook-host", {
          type: "string",
          description: "Storybook server host",
        })

        .option("include-paths", {
          alias: "i",
          type: "string",
          description: "Comma-separated path segments to include",
        })
        .option("story-ids", {
          type: "string",
          description: "Comma-separated story IDs to test",
        })
        .option("config", {
          alias: "c",
          type: "string",
          description: "Path to config file",
        })
        .option("update-snapshots", {
          alias: "u",
          type: "boolean",
          description: "Update snapshots instead of comparing",
          default: false,
        })
        .example("$0 run", "Run visual tests with default settings")
        .example("$0 run --mode lite", "Run only _visual stories")

        .example(
          "$0 run --include-paths components/Button",
          "Run tests for Button component",
        );
    },
    async (argv) => {
      try {
        console.log(chalk.blue("🚀 Running visual tests...\n"));

        // Load configuration
        const configOptions = {
          configFile: argv.config,
        };

        if (argv.storybookPort) {
          configOptions.storybook = { port: argv.storybookPort };
        }
        if (argv.storybookHost) {
          configOptions.storybook = configOptions.storybook || {};
          configOptions.storybook.host = argv.storybookHost;
        }

        if (argv.includePaths) {
          configOptions.filters = configOptions.filters || {};
          configOptions.filters.includePaths = argv.includePaths.split(",");
        }
        if (argv.storyIds) {
          configOptions.filters = configOptions.filters || {};
          configOptions.filters.storyIds = argv.storyIds.split(",");
        }

        const config = await loadConfig(configOptions);

        console.log(chalk.gray("Configuration:"));
        console.log(
          chalk.gray(
            `  Storybook: ${config.storybook.host}:${config.storybook.port}`,
          ),
        );
        if (config.testMatcher?.tags) {
          console.log(
            chalk.gray(`  Tags: ${config.testMatcher.tags.join(", ")}`),
          );
        }

        // Pre-fetch stories
        console.log(chalk.blue("🔍 Discovering stories..."));
        const stories = await fetchStoriesFromStorybook(
          config,
          argv.updateSnapshots,
        );
        console.log(chalk.green(`✅ Found ${stories.length} stories`));

        if (stories.length === 0) {
          console.warn(
            chalk.yellow("⚠️  No stories found matching the criteria"),
          );
          return;
        }

        // Generate test files
        const { dataFile, specFile } = generateTestFiles(config, stories);

        // Build Playwright command
        const playwrightArgs = [
          "test",
          specFile,
          `--config=${config.paths.playwrightConfig}`,
          `--config=${config.paths.playwrightConfig}`,
          config.playwrightConfig?.project
            ? `--project=${config.playwrightConfig.project}`
            : "--project=chromium",
        ];

        if (argv.updateSnapshots) {
          playwrightArgs.push("--update-snapshots");
        }

        // Set environment variables
        const env = {
          ...process.env,
          VISUAL_TESTS_DATA_FILE: dataFile,
          // Ensure CI is set to 1 for Playwright
          CI: "1",
          // Keep legacy env vars just in case, though they shouldn't be needed for core logic anymore
          // VISUAL_TEST_MODE: config.mode,
          STORYBOOK_PORT: config.storybook.port,
        };

        // Run Playwright
        // Resolve playwright path locally to avoid dependency on global npx
        const playwrightPath = path.resolve(
          process.cwd(),
          "node_modules",
          ".bin",
          "playwright",
        );

        const executable = fs.existsSync(playwrightPath)
          ? playwrightPath
          : "npx"; // Fallback to npx if local binary not found

        const args =
          executable === playwrightPath
            ? ["test", ...playwrightArgs.slice(1)]
            : ["playwright", ...playwrightArgs];

        // Run Playwright
        const playwrightProcess = spawn(executable, args, {
          stdio: "inherit",
          shell: false, // Security: Disable shell to prevent command injection
          env,
        });

        const exitCode = await new Promise((resolve) => {
          playwrightProcess.on("exit", (code) => resolve(code || 0));
        });

        // Clean up temp files
        cleanupTestFiles({ dataFile, specFile });

        // Generate failures log
        try {
          // Find JSON reporter output path
          let jsonReportPath = path.join(process.cwd(), "test-results.json"); // default fallback

          if (config.playwrightConfig?.reporter) {
            const reporters = Array.isArray(config.playwrightConfig.reporter)
              ? config.playwrightConfig.reporter
              : [config.playwrightConfig.reporter];

            const jsonReporter = reporters.find(
              (r) => (Array.isArray(r) && r[0] === "json") || r === "json",
            );

            if (
              jsonReporter &&
              Array.isArray(jsonReporter) &&
              jsonReporter[1]?.outputFile
            ) {
              jsonReportPath = path.resolve(
                process.cwd(),
                jsonReporter[1].outputFile,
              );
            }
          }

          const failuresFile = path.resolve(
            process.cwd(),
            config.paths.failuresFile || "logs/visual-test-failures.jsonl",
          );

          await generateFailuresLog(jsonReportPath, failuresFile);
        } catch (err) {
          console.warn(
            chalk.yellow(`Failed to generate failures log: ${err.message}`),
          );
        }

        if (exitCode === 0) {
          console.log(chalk.green("\n✅ Visual tests completed successfully"));
        } else {
          console.log(chalk.red("\n❌ Visual tests failed"));
          process.exit(exitCode);
        }
      } catch (error) {
        console.error(chalk.red("Error running visual tests:"), error.message);
        process.exit(1);
      }
    },
  );
};
