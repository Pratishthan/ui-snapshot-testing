#!/usr/bin/env node

/**
 * CLI Entry Point for Storybook Visual Tests
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";

// Import commands
import { runCommand } from "./commands/run.js";
import { updateCommand } from "./commands/update.js";
import { diffCommand } from "./commands/diff.js";
import { reportCommand } from "./commands/report.js";
import { orphansCommand } from "./commands/orphans.js";
import { dryRunCommand } from "./commands/dry-run.js";
import { recommendMobileCommand } from "./commands/recommend-mobile.js";

const cli = yargs(hideBin(process.argv))
  .scriptName("snapshot-testing")
  .usage("$0 <command> [options]")
  .version()
  .help()
  .alias("h", "help")
  .alias("v", "version")
  .demandCommand(1, chalk.red("Please specify a command"))
  .recommendCommands()
  .strict()
  .fail((msg, err, yargs) => {
    if (err) {
      console.error(chalk.red("Error:"), err.message);
      process.exit(1);
    }
    console.error(chalk.red(msg));
    console.error("\n" + yargs.help());
    process.exit(1);
  });

// Register commands
runCommand(cli);
updateCommand(cli);
diffCommand(cli);
reportCommand(cli);
orphansCommand(cli);
dryRunCommand(cli);
recommendMobileCommand(cli);

// Parse and execute
cli.parse();
