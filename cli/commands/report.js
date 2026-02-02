/**
 * Report Command - View visual test reports
 */

import chalk from "chalk";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { loadConfig } from "../../config-loader.js";
import { generateJsonReport } from "../../lib/report-generator.js";
import {
  readFailuresFromJsonl,
  readPassedFromJsonl,
  readIgnoredFromJsonl,
  readSkippedFromJsonl,
  allFailuresIgnorable,
} from "../../lib/result-processor.js";

export const reportCommand = (yargs) => {
  yargs.command(
    "report [options]",
    "View or generate visual test reports",
    (yargs) => {
      return yargs
        .option("open", {
          alias: "o",
          type: "boolean",
          description: "Open report in browser",
          default: true,
        })
        .option("format", {
          alias: "f",
          type: "string",
          choices: ["html", "json", "both"],
          description: "Report format",
          default: "html",
        })
        .option("generate", {
          alias: "g",
          type: "boolean",
          description: "Generate new report from results",
          default: false,
        })
        .option("config", {
          alias: "c",
          type: "string",
          description: "Path to config file",
        })
        .example("$0 report", "Open HTML report in browser")
        .example("$0 report --format json", "View JSON report")
        .example("$0 report --generate", "Generate new report from results");
    },
    async (argv) => {
      try {
        const config = await loadConfig({ configFile: argv.config });
        const logsDir = path.join(process.cwd(), config.snapshot.paths.logsDir);

        // Generate new report if requested
        if (argv.generate) {
          console.log(chalk.blue("📊 Generating reports...\n"));

          // Read results from JSONL files
          const failures = await readFailuresFromJsonl(
            path.join(logsDir, "visual-test-failures.jsonl"),
          );
          const passed = await readPassedFromJsonl(
            path.join(logsDir, "visual-test-passed.jsonl"),
          );
          const ignored = await readIgnoredFromJsonl(
            path.join(logsDir, "visual-test-ignored.jsonl"),
          );
          const skipped = await readSkippedFromJsonl(
            path.join(logsDir, "visual-test-skipped.jsonl"),
          );

          const results = {
            totalStories:
              failures.length + passed.length + ignored.length + skipped.length,
            failures,
            passed,
            ignored,
            skipped,
          };

          if (argv.format === "json" || argv.format === "both") {
            const jsonPath = await generateJsonReport(results, config);
            if (jsonPath) {
              console.log(chalk.green(`✅ JSON report generated: ${jsonPath}`));
            }
          }

          console.log("");
        }

        // Open report
        if (argv.open) {
          let reportPath;

          if (argv.format === "html") {
            reportPath = path.join(
              logsDir,
              "playwright/storybook/reports/index.html",
            );
          } else if (argv.format === "json") {
            reportPath = path.join(logsDir, "visual-test-results.json");
          }

          if (reportPath && fs.existsSync(reportPath)) {
            console.log(chalk.blue(`📖 Opening report: ${reportPath}\n`));

            const openCommand =
              process.platform === "darwin"
                ? "open"
                : process.platform === "win32"
                  ? "start"
                  : "xdg-open";

            spawn(openCommand, [reportPath], {
              stdio: "ignore",
              detached: true,
            }).unref();

            console.log(chalk.green("✅ Report opened in default application"));
          } else {
            console.log(chalk.yellow(`⚠️  Report not found: ${reportPath}`));
            console.log(
              chalk.gray(
                "Run tests first or use --generate to create a new report",
              ),
            );
          }
        }
      } catch (error) {
        console.error(
          chalk.red("Error generating/opening report:"),
          error.message,
        );
        process.exit(1);
      }
    },
  );
};
