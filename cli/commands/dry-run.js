import chalk from "chalk";
import { loadConfig } from "../../config-loader.js";
import { fetchStoriesFromStorybook } from "../../lib/story-discovery.js";

export const dryRunCommand = (yargs) => {
  yargs.command(
    "dry-run [options]",
    "Preview which stories would be tested",
    (yargs) => {
      return yargs
        .option("config", {
          alias: "c",
          type: "string",
          description: "Path to config file",
        })
        .option("include-paths", {
          type: "string",
          description: "Comma-separated path segments to include",
        })
        .option("story-ids", {
          type: "string",
          description: "Comma-separated story IDs",
        })
        .option("mobile", {
          type: "boolean",
          description: "Use mobile configuration",
          default: false,
        })
        .option("locale", {
          type: "string",
          description: "Use locale configuration",
        })
        .option("verbose", {
          alias: "v",
          type: "boolean",
          description: "Show detailed story information",
          default: false,
        })
        .example("$0 dry-run", "Preview all stories")
        .example(
          "$0 dry-run --include-paths components/Button",
          "Preview Button stories",
        )
        .example("$0 dry-run --verbose", "Show detailed story info");
    },
    async (argv) => {
      try {
        console.log(chalk.blue("🔍 Discovering stories...\n"));

        // Helper to run dry-run for a specific config
        const executeDryRun = async (config, localeCode = null) => {
          if (localeCode) {
            console.log(
              chalk.cyan(
                `\n${"=".repeat(60)}\n📍 Dry Run for locale: ${localeCode}\n${"=".repeat(60)}\n`,
              ),
            );
          }

          // Fetch stories
          // Pass true to include all matching stories
          const stories = await fetchStoriesFromStorybook(config, true);

          console.log(
            chalk.green(
              `✅ Found ${stories.length} stories that would be tested\n`,
            ),
          );

          if (argv.verbose) {
            // Group by file
            const byFile = stories.reduce((acc, story) => {
              const file = story.importPath || "unknown";
              if (!acc[file]) acc[file] = [];
              acc[file].push(story);
              return acc;
            }, {});

            Object.entries(byFile).forEach(([file, fileStories]) => {
              console.log(chalk.cyan(`\n${file}`));
              fileStories.forEach((story) => {
                console.log(`  - ${story.id} (${story.name})`);
              });
            });
          } else {
            // Just list story IDs
            stories.forEach((story) => {
              console.log(`  - ${story.id}`);
            });
          }

          // Summary
          console.log(chalk.gray(`\n${"─".repeat(60)}`));
          console.log(chalk.blue(`Total stories: ${stories.length}`));

          if (config.snapshot?.image?.enabled !== false) {
            console.log(chalk.gray(`Image snapshots: enabled`));
          }
          if (config.snapshot?.position?.enabled !== false) {
            console.log(chalk.gray(`Position snapshots: enabled`));
          }
          if (config.mobile) {
            const viewport = config.playwrightConfig?.use?.viewport;
            if (viewport) {
              console.log(
                chalk.gray(`Mobile mode: ${viewport.width}x${viewport.height}`),
              );
            } else {
              console.log(
                chalk.gray(`Mobile mode: enabled (default viewport)`),
              );
            }
          }
          if (config.locale) {
            console.log(
              chalk.gray(
                `Locale: ${config.locale.code} (${config.locale.name})`,
              ),
            );
          }
        };

        // Determine mode (All Locales vs Single/Default)
        if (
          argv.locale === "" ||
          argv.locale === true ||
          argv.locale === "all"
        ) {
          // All Locales Mode
          const baseConfig = await loadConfig({
            configFile: argv.config,
            mobile: argv.mobile,
          });

          const locales = baseConfig.snapshot?.locale?.locales || [];

          if (locales.length === 0) {
            console.error(
              chalk.red("❌ No locales configured in snapshot.locale.locales"),
            );
            process.exit(1);
          }

          for (const locale of locales) {
            //Skip default in all-locales mode
            if (locale.default) {
              console.log(
                chalk.yellow(
                  `\n⚠️  Skipping default locale: ${locale.code} (run without --locale to check)`,
                ),
              );
              continue;
            }

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
            if (argv.storyIds) {
              configOptions.snapshot = configOptions.snapshot || {};
              configOptions.snapshot.filters =
                configOptions.snapshot.filters || {};
              configOptions.snapshot.filters.storyIds =
                argv.storyIds.split(",");
            }

            const config = await loadConfig(configOptions);
            await executeDryRun(config, locale.code);
          }
        } else {
          // Single Run Mode
          const configOptions = {
            configFile: argv.config,
            mobile: argv.mobile,
            locale:
              argv.locale && argv.locale !== true ? argv.locale : undefined,
          };

          if (argv.includePaths) {
            configOptions.snapshot = configOptions.snapshot || {};
            configOptions.snapshot.filters =
              configOptions.snapshot.filters || {};
            configOptions.snapshot.filters.includePaths =
              argv.includePaths.split(",");
          }
          if (argv.storyIds) {
            configOptions.snapshot = configOptions.snapshot || {};
            configOptions.snapshot.filters =
              configOptions.snapshot.filters || {};
            configOptions.snapshot.filters.storyIds = argv.storyIds.split(",");
          }

          const config = await loadConfig(configOptions);
          await executeDryRun(config, argv.locale);
        }
      } catch (error) {
        console.error(chalk.red("Error running dry-run:"), error.message);
        process.exit(1);
      }
    },
  );
};
