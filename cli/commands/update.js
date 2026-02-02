/**
 * Update Command - Update visual test snapshots
 */

import { spawn } from "child_process";
import chalk from "chalk";
import enquirer from "enquirer";
import path from "path";
import fs from "fs";
import { loadConfig } from "../../config-loader.js";
import {
  parseFailures,
  readFailuresFromJsonl,
  readIgnoredFromJsonl,
} from "../../lib/result-processor.js";
import {
  fetchStoriesFromStorybook,
  sanitizeSnapshotName,
} from "../../lib/story-discovery.js";
import {
  generateTestFiles,
  cleanupTestFiles,
} from "../../lib/test-runner-utils.js";

/**
 * Core update logic - runs update for a specific configuration
 */
async function runUpdate(config, argv, localeCode = null) {
  let storyIds = [];

  // Interactive mode
  if (argv.interactive) {
    const failuresFile = path.join(
      process.cwd(),
      config.snapshot.paths.logsDir,
      "visual-test-failures.jsonl",
    );
    const failures = await readFailuresFromJsonl(failuresFile);

    if (failures.length === 0) {
      console.log(chalk.yellow("No failures found. Nothing to update."));
      return 0;
    }

    const choices = failures.map((f) => {
      return {
        name: f.id,
        message: f.id,
        value: f.id,
      };
    });

    const { selectedStories } = await enquirer.prompt({
      type: "multiselect",
      name: "selectedStories",
      message: "Select stories to update:",
      choices,
      result(names) {
        return this.map(names);
      },
    });

    storyIds = Object.keys(selectedStories);

    if (storyIds.length === 0) {
      console.log(chalk.yellow("No stories selected. Exiting."));
      return 0;
    }

    console.log(
      chalk.gray(`\nSelected ${storyIds.length} stories for update\n`),
    );
  } else if (argv.storyIds) {
    storyIds = argv.storyIds.split(",").map((id) => id.trim());
  }

  if (storyIds.length > 0) {
    config.snapshot.filters = config.snapshot.filters || {};
    config.snapshot.filters.storyIds = storyIds;
  }

  // Fetch stories
  console.log(chalk.blue("🔍 Discovering stories..."));

  // In incremental update mode, we need to fetch ALL matching stories first,
  // then filter for those that are missing snapshots.
  // In normal update mode, we usually only want to update EXISTING snapshots (default behavior).

  const includeAllForFiltering = !!argv.incremental;

  // DEBUG: Log testMatcher
  console.log(
    chalk.gray(`DEBUG: testMatcher = ${JSON.stringify(config.testMatcher)}`),
  );
  console.log(chalk.gray(`DEBUG: locale = ${JSON.stringify(config.locale)}`));

  let stories = await fetchStoriesFromStorybook(config, includeAllForFiltering); // true = include match even if no snapshot

  if (argv.incremental) {
    console.log(
      chalk.gray(`Checking ${stories.length} stories for missing snapshots...`),
    );
    const snapshotDir = path.join(
      process.cwd(),
      config.snapshot.paths.snapshotsDir,
    );

    stories = stories.filter((story) => {
      const baseName = sanitizeSnapshotName(story.id);
      const imagePath = path.join(snapshotDir, `${baseName}.png`);
      const jsonPath = path.join(snapshotDir, `${baseName}.positions.json`);

      // Check config to see what should exist
      // Defaults to true if undefined
      const imageEnabled = config.snapshot?.image?.enabled !== false;
      const positionEnabled = config.snapshot?.position?.enabled !== false;

      const imageMissing = imageEnabled && !fs.existsSync(imagePath);
      const jsonMissing = positionEnabled && !fs.existsSync(jsonPath);

      // In incremental mode, we want to run the test if ANYTHING is missing
      return imageMissing || jsonMissing;
    });

    if (stories.length === 0) {
      console.log(
        chalk.green("✨ No missing snapshots found. Nothing to update."),
      );
      return 0;
    }
  }

  console.log(chalk.green(`✅ Found ${stories.length} stories to update`));

  // Generate test files
  const { dataFile, specFile } = generateTestFiles(config, stories);

  // Build Playwright command
  const playwrightArgs = [
    "test",
    specFile,
    `--config=${config.snapshot.paths.playwrightConfig}`,
    `--config=${config.snapshot.paths.playwrightConfig}`,
    config.playwright?.project
      ? `--project=${config.playwright.project}`
      : "--project=chromium",
    "--update-snapshots",
  ];

  // Set environment variables
  const env = {
    ...process.env,
    UPDATE_SNAPSHOTS: "1",
    VISUAL_TEST_UPDATE_SNAPSHOTS: "true",
    VISUAL_TESTS_DATA_FILE: dataFile,
    VISUAL_TEST_MOBILE: argv.mobile ? "true" : "false",
    VISUAL_TEST_LOCALE: localeCode || "",
  };

  if (argv.incremental) {
    env.INCREMENTAL_UPDATE_MODE = "1";
  }

  if (storyIds.length > 0) {
    env.STORY_IDS = storyIds.join(",");
    console.log(chalk.gray(`Updating ${storyIds.length} specific stories\n`));
  }

  // Run Playwright
  // Resolve playwright path locally to avoid dependency on global npx
  const playwrightPath = path.resolve(
    process.cwd(),
    "node_modules",
    ".bin",
    "playwright",
  );

  const executable = fs.existsSync(playwrightPath) ? playwrightPath : "npx";

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

  if (exitCode === 0) {
    console.log(chalk.green("\n✅ Snapshots updated successfully"));
  } else {
    console.log(chalk.red("\n❌ Snapshot update failed"));
  }

  // Clean up temp files
  cleanupTestFiles({ dataFile, specFile });

  return exitCode;
}

export const updateCommand = (yargs) => {
  yargs.command(
    "update [options]",
    "Update visual test snapshots",
    (yargs) => {
      return yargs
        .option("incremental", {
          type: "boolean",
          description: "Only update missing snapshots",
          default: false,
        })
        .option("interactive", {
          alias: "i",
          type: "boolean",
          description: "Interactively select which snapshots to update",
          default: false,
        })
        .option("story-ids", {
          type: "string",
          description: "Comma-separated story IDs to update",
        })
        .option("config", {
          alias: "c",
          type: "string",
          description: "Path to config file",
        })
        .option("include-paths", {
          type: "string",
          description: "Comma-separated path segments to include",
        })
        .option("mobile", {
          type: "boolean",
          description: "Run in mobile mode (uses mobile config overrides)",
          default: false,
        })
        .option("locale", {
          type: "string",
          description:
            "Run in locale mode with specified locale code (e.g., de-DE, ar-SA), or use without value to update all configured locales",
        })
        .example("$0 update", "Update all snapshots")
        .example("$0 update --incremental", "Update only missing snapshots")
        .example(
          "$0 update --interactive",
          "Interactively select snapshots to update",
        )
        .example(
          "$0 update --include-paths components/Button",
          "Update Button component",
        )
        .example(
          "$0 update --story-ids button--default,input--error",
          "Update specific stories",
        )
        .example(
          "$0 update --locale de-DE",
          "Update snapshots in German locale",
        )
        .example(
          "$0 update --locale",
          "Update snapshots for all configured locales",
        );
    },
    async (argv) => {
      try {
        console.log(chalk.blue("📸 Updating visual test snapshots...\n"));

        // Check if --locale flag is used without a value (all locales mode)
        // Yargs parses --locale as "" (empty string) when no value is provided because type is string
        if (
          argv.locale === "" ||
          argv.locale === true ||
          argv.locale === "all"
        ) {
          // All locales mode - iterate through all configured locales
          const config = await loadConfig({
            configFile: argv.config,
            mobile: argv.mobile,
          });

          const locales = config.snapshot?.locale?.locales || [];

          if (locales.length === 0) {
            console.error(
              chalk.red(
                "❌ No locales configured in snapshot.locale.locales\n" +
                  "   Please add locale configuration to your visual-tests.config.js",
              ),
            );
            process.exit(1);
          }

          console.log(
            chalk.blue(
              `📍 Running update for ${locales.length} configured locales\n`,
            ),
          );

          let hasFailure = false;

          for (const locale of locales) {
            console.log(
              chalk.cyan(
                `\n${"=".repeat(60)}\n📍 Updating snapshots for locale: ${locale.code} (${locale.name})\n${"=".repeat(60)}\n`,
              ),
            );

            const configOptions = {
              configFile: argv.config,
              mobile: argv.mobile,
              locale: locale.code,
            };

            if (argv.includePaths) {
              configOptions.snapshot = configOptions.snapshot || {};
              configOptions.snapshot.filters =
                configOptions.snapshot.filters || {};
              configOptions.snapshot.filters.includePaths =
                argv.includePaths.split(",");
            }

            const localeConfig = await loadConfig(configOptions);
            const exitCode = await runUpdate(localeConfig, argv, locale.code);

            if (exitCode !== 0) {
              hasFailure = true;
            }
          }

          if (hasFailure) {
            console.log(
              chalk.red(
                "\n❌ Some locale updates failed. See output above for details.",
              ),
            );
            process.exit(1);
          } else {
            console.log(
              chalk.green(
                `\n✅ Successfully updated snapshots for all ${locales.length} locales`,
              ),
            );
          }
        } else {
          // Single locale mode
          // If argv.locale is empty string here, it means it fell through (should have been caught above)
          // But just in case, treat empty string as undefined/null
          const localeCode = argv.locale || undefined;

          const configOptions = {
            configFile: argv.config,
            mobile: argv.mobile,
            locale: localeCode,
          };

          if (argv.includePaths) {
            configOptions.snapshot = configOptions.snapshot || {};
            configOptions.snapshot.filters =
              configOptions.snapshot.filters || {};
            configOptions.snapshot.filters.includePaths =
              argv.includePaths.split(",");
          }

          const config = await loadConfig(configOptions);
          const exitCode = await runUpdate(config, argv, localeCode);

          if (exitCode !== 0) {
            process.exit(exitCode);
          }
        }
      } catch (error) {
        console.error(chalk.red("Error updating snapshots:"), error.message);
        process.exit(1);
      }
    },
  );
};
