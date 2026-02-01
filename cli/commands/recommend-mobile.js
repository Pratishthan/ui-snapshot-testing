import { loadConfig } from "../../config-loader.js";
import { findRecommendations } from "../../lib/recommendation-engine.js";
import chalk from "chalk";

export const recommendMobileCommand = (yargs) => {
  yargs.command(
    "recommend-mobile [options]",
    "Analyze desktop snapshots and recommend stories for mobile testing",
    (yargs) => {
      return yargs
        .option("config", {
          alias: "c",
          type: "string",
          description: "Path to configuration file",
        })
        .option("threshold", {
          type: "number",
          description: "Minimum width threshold for recommendation",
        });
    },
    async (argv) => {
      try {
        const config = await loadConfig({
          configFile: argv.config,
          // Pass CLI override for threshold if present
          snapshot: {
            mobile: {
              discovery: argv.threshold
                ? { thresholds: { minWidth: argv.threshold } }
                : undefined,
            },
          },
        });

        console.log(chalk.bold("\n📱 Mobile Recommendation Analysis\n"));
        console.log(
          chalk.dim(
            `Threshold: >${
              config.snapshot?.mobile?.discovery?.thresholds?.minWidth || 400
            }px width`,
          ),
        );

        const recommendations = await findRecommendations(config);

        if (recommendations.length === 0) {
          console.log(chalk.green("\n✅ No missing mobile coverage detected!"));
          return;
        }

        console.log(
          chalk.yellow(
            `\n⚠️  Found ${recommendations.length} stories that may benefit from mobile testing:\n`,
          ),
        );

        // Group by component (prefix before --) if possible, or just list
        recommendations.forEach((rec) => {
          console.log(
            `${chalk.cyan(rec.storyId)} ${chalk.dim(
              `(${rec.width}x${rec.height}px)`,
            )}`,
          );
        });

        console.log(chalk.bold("\n💡 Action Items:"));
        console.log(
          "To add these to mobile tests, add the 'visual-mobile' tag to the stories:",
        );
        console.log(chalk.dim("\n  export const Default: Story = {"));
        console.log(chalk.dim("    tags: ['visual', 'visual-mobile'],"));
        console.log(chalk.dim("  };\n"));
      } catch (error) {
        console.error(chalk.red("\n❌ Analysis failed:"), error.message);
        process.exit(1);
      }
    },
  );
};
