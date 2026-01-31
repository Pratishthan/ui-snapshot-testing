/**
 * Diff Command - Run visual tests for changed stories
 */

import chalk from "chalk";
import { loadConfig } from "../../config-loader.js";
import {
  getChangedFiles,
  findAffectedStories,
} from "../../lib/diff-analyzer.js";
import { spawn } from "child_process";
import { fetchStoriesFromStorybook } from "../../lib/story-discovery.js";
import {
  generateTestFiles,
  cleanupTestFiles,
} from "../../lib/test-runner-utils.js";

export const diffCommand = (yargs) => {
  yargs.command(
    "diff [options]",
    "Run visual tests for changed stories (git diff)",
    (yargs) => {
      return yargs
        .option("target-branch", {
          alias: "t",
          type: "string",
          description: "Target branch for comparison",
        })
        .option("mode", {
          alias: "m",
          type: "string",
          choices: ["lite", "full"],
          description: "Test mode",
        })
        .option("config", {
          alias: "c",
          type: "string",
          description: "Path to config file",
        })
        .example("$0 diff", "Run tests for stories changed since Sprint16")
        .example("$0 diff --target-branch main", "Compare against main branch")
        .example("$0 diff --mode full", "Use full mode for changed stories");
    },
    async (argv) => {
      try {
        console.log(chalk.blue("🔍 Analyzing changes...\n"));

        const configOptions = {
          configFile: argv.config,
        };

        if (argv.mode) configOptions.mode = argv.mode;
        if (argv.targetBranch) {
          configOptions.diff = { targetBranch: argv.targetBranch };
        }

        const config = await loadConfig(configOptions);

        console.log(chalk.gray(`Target branch: ${config.diff.targetBranch}`));
        console.log(chalk.gray(`Test mode: ${config.mode}\n`));

        // Get changed files
        const changedFiles = getChangedFiles(config.diff.targetBranch);

        if (changedFiles.length === 0) {
          console.log(
            chalk.green("✅ No changes detected. Skipping visual tests."),
          );
          return;
        }

        console.log(chalk.gray(`Total files changed: ${changedFiles.length}`));

        // Find affected stories
        const affected = findAffectedStories(changedFiles, config);

        if (affected.allStoryFiles.length === 0) {
          console.log(
            chalk.green("✅ No story files affected. Skipping visual tests."),
          );
          return;
        }

        console.log(
          chalk.gray(`Story files affected: ${affected.allStoryFiles.length}`),
        );
        console.log(
          chalk.gray(`  Direct story changes: ${affected.storyFiles.length}`),
        );
        console.log(
          chalk.gray(
            `  Component changes: ${affected.componentFiles.length}\n`,
          ),
        );

        // Set environment variables
        const env = {
          ...process.env,
          VISUAL_TEST_MODE: config.mode,
          STORY_INCLUDE_PATHS: affected.allStoryFiles.join(","),
          CI: "1",
          VISUAL_TESTS_DATA_FILE: dataFile,
        };

        console.log(
          chalk.blue(
            `🚀 Running visual tests for ${filteredStories.length} affected stories...\n`,
          ),
        );

        // Run Playwright
        const playwrightProcess = spawn(
          "npx",
          ["playwright", ...playwrightArgs],
          {
            stdio: "inherit",
            shell: true,
            env,
          },
        );

        const exitCode = await new Promise((resolve) => {
          playwrightProcess.on("exit", (code) => resolve(code || 0));
        });

        if (exitCode === 0) {
          console.log(chalk.green("\n✅ Visual tests completed successfully"));
        } else {
          console.log(chalk.red("\n❌ Visual tests failed"));
          process.exit(exitCode);
        }
        // Clean up temp files
        cleanupTestFiles({ dataFile, specFile });
      } catch (error) {
        console.error(chalk.red("Error running diff tests:"), error.message);
        process.exit(1);
      }
    },
  );
};
