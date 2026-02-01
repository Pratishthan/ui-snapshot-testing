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
        const configOptions = {
          configFile: argv.config,
          mobile: argv.mobile,
          locale: argv.locale && argv.locale !== true ? argv.locale : undefined,
        };

        if (argv.includePaths) {
          configOptions.filters = {
            includePaths: argv.includePaths.split(","),
          };
        }

        if (argv.storyIds) {
          configOptions.filters = configOptions.filters || {};
          configOptions.filters.storyIds = argv.storyIds.split(",");
        }

        const config = await loadConfig(configOptions);

        console.log(chalk.blue("🔍 Discovering stories...\n"));

        // Fetch stories
        // Pass true to include all matching stories, even if they don't have snapshots yet
        // Because dry-run is about what *would* be tested (or created).
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
          // Handle case where viewport might be undefined if not set in config
          if (viewport) {
            console.log(
              chalk.gray(`Mobile mode: ${viewport.width}x${viewport.height}`),
            );
          } else {
            console.log(chalk.gray(`Mobile mode: enabled (default viewport)`));
          }
        }
        if (config.locale) {
          console.log(
            chalk.gray(`Locale: ${config.locale.code} (${config.locale.name})`),
          );
        }
      } catch (error) {
        console.error(chalk.red("Error running dry-run:"), error.message);
        process.exit(1);
      }
    },
  );
};
