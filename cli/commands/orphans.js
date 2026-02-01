import fs from "fs";
import path from "path";
import chalk from "chalk";
import enquirer from "enquirer";
import { loadConfig } from "../../config-loader.js";
import {
  fetchStoriesFromStorybook,
  sanitizeSnapshotName,
} from "../../lib/story-discovery.js";

export const orphansCommand = (yargs) => {
  yargs.command(
    "orphans [options]",
    "Identify orphaned snapshot files",
    (yargs) => {
      return yargs
        .option("config", {
          alias: "c",
          type: "string",
          description: "Path to config file",
        })
        .option("delete", {
          type: "boolean",
          description: "Delete orphaned files (use with caution)",
          default: false,
        })
        .option("mobile", {
          type: "boolean",
          description: "Check mobile snapshots",
          default: false,
        })
        .option("locale", {
          type: "string",
          description: "Check specific locale snapshots (or --locale for all)",
        })
        .option("all", {
          type: "boolean",
          description: "Check all modes (desktop, mobile, all locales)",
          default: false,
        })
        .example("$0 orphans", "List orphaned desktop snapshots")
        .example("$0 orphans --mobile", "List orphaned mobile snapshots")
        .example(
          "$0 orphans --locale de-DE",
          "List orphaned German locale snapshots",
        )
        .example("$0 orphans --all", "Check all modes")
        .example("$0 orphans --delete", "Delete orphaned snapshots");
    },
    async (argv) => {
      try {
        // Group checks by directory to avoid false positives in shared folders
        const checksByDir = new Map();

        const addCheck = (directory, modeName, config, storyParams = {}) => {
          if (!checksByDir.has(directory)) {
            checksByDir.set(directory, {
              modes: [],
              config, // Use base config for file scanning logic
              expectedFiles: new Set(),
              params: [],
            });
          }
          const check = checksByDir.get(directory);
          check.modes.push(modeName);
          check.params.push({ config, storyParams });
        };

        if (argv.all) {
          const baseConfig = await loadConfig({ configFile: argv.config });

          // Desktop
          addCheck(
            path.join(process.cwd(), baseConfig.paths.snapshotsDir),
            "desktop",
            baseConfig,
          );

          // Mobile
          if (baseConfig.snapshot?.mobile?.enabled) {
            const viewports = baseConfig.snapshot.mobile.viewports || [];
            const mobileDir = path.join(
              process.cwd(),
              baseConfig.paths.snapshotsDir,
              "mobile",
            );

            if (viewports.length > 0) {
              // Add all viewports that share the mobile directory
              for (const viewport of viewports) {
                // We construct a specific config object or just pass params.
                // To be safe, we can reuse baseConfig but we need to ensure correct viewport is used.
                // We pass {viewport} in params which will override config.activeViewport in the loop below.
                addCheck(
                  mobileDir,
                  `mobile-${viewport.width}x${viewport.height}`,
                  baseConfig,
                  { viewport },
                );
              }
            } else {
              // Add default mobile if no viewports
              addCheck(mobileDir, "mobile-default", baseConfig, {
                mobile: true,
              });
            }
          }

          // Locales
          if (baseConfig.snapshot?.locale?.enabled) {
            const locales = baseConfig.snapshot.locale.locales || [];
            for (const locale of locales) {
              const localeConfig = await loadConfig({
                configFile: argv.config,
                locale: locale.code,
              });
              const baseSnapshotDir = path.join(
                process.cwd(),
                localeConfig.paths.snapshotsDir,
              );

              let snapshotDir = baseSnapshotDir;
              if (!locale.default) {
                snapshotDir = path.join(baseSnapshotDir, locale.code);
              }

              addCheck(snapshotDir, `locale-${locale.code}`, localeConfig, {
                locale: locale.code,
              });
            }
          }
        } else {
          // Specific mode
          if (argv.mobile) {
            const baseConfig = await loadConfig({ configFile: argv.config });
            // NOTE: We load base config first to see viewports list,
            // because loading with {mobile:true} only gives us active viewport.

            const snapshotMobileConfig = baseConfig.snapshot?.mobile || {};
            const viewports = snapshotMobileConfig.viewports || [];
            const mobileDir = path.join(
              process.cwd(),
              baseConfig.paths.snapshotsDir,
              "mobile",
            );

            if (snapshotMobileConfig.enabled && viewports.length > 0) {
              // If user asks for mobile orphans, check ALL mobile viewports!
              for (const viewport of viewports) {
                const vpConfig = await loadConfig({
                  configFile: argv.config,
                  mobile: true,
                });
                addCheck(
                  mobileDir,
                  `mobile-${viewport.width}x${viewport.height}`,
                  vpConfig,
                  { viewport },
                );
              }
            } else {
              // Fallback/Default
              const mobConfig = await loadConfig({
                configFile: argv.config,
                mobile: true,
              });
              addCheck(mobileDir, "mobile", mobConfig, { mobile: true });
            }
          } else if (argv.locale) {
            const code = argv.locale;
            const config = await loadConfig({
              configFile: argv.config,
              locale: code,
            });
            const baseSnapshotDir = path.join(
              process.cwd(),
              config.paths.snapshotsDir,
            );
            let snapshotDir = baseSnapshotDir;

            // If not default, append code
            // Ideally we should know if it's default from config.
            // We can check config.locale.default if loaded correctly.
            if (config.locale?.code === code && !config.locale?.default) {
              snapshotDir = path.join(baseSnapshotDir, code);
            }
            addCheck(snapshotDir, `locale-${code}`, config, { locale: code });
          } else {
            // Desktop (default)
            const config = await loadConfig({ configFile: argv.config });
            addCheck(
              path.join(process.cwd(), config.paths.snapshotsDir),
              "desktop",
              config,
            );
          }
        }

        let totalOrphans = [];

        for (const [directory, check] of checksByDir) {
          const modes = check.modes.join(", ");
          console.log(
            chalk.blue(
              `\n🔍 Checking ${modes} snapshots in ${path.relative(process.cwd(), directory)}...`,
            ),
          );

          // Collect all expected snapshots for this directory
          const expectedSnapshots = check.expectedFiles; // Set

          for (const param of check.params) {
            const { config, storyParams } = param;
            // Fetch stories for this specific configuration
            const stories = await fetchStoriesFromStorybook(config, true);

            for (const story of stories) {
              const currentViewport =
                storyParams.viewport || config.activeViewport;
              const baseName = sanitizeSnapshotName(story.id, currentViewport);

              if (config.snapshot?.image?.enabled !== false) {
                expectedSnapshots.add(`${baseName}.png`);
              }
              if (config.snapshot?.position?.enabled !== false) {
                expectedSnapshots.add(`${baseName}.positions.json`);
              }
            }
          }

          // Scan directory
          if (!fs.existsSync(directory)) {
            console.log(chalk.gray(`  Directory not found: ${directory}`));
            continue;
          }

          const actualFiles = fs
            .readdirSync(directory)
            .filter((f) => f.endsWith(".png") || f.endsWith(".positions.json"));

          // Find orphans
          const orphans = actualFiles.filter((f) => !expectedSnapshots.has(f));

          // Report
          if (orphans.length === 0) {
            console.log(chalk.green(`  ✅ No orphaned snapshots found`));
          } else {
            console.log(
              chalk.yellow(`  ⚠️  Found ${orphans.length} orphaned snapshots:`),
            );
            orphans.forEach((f) => {
              console.log(chalk.gray(`    - ${f}`));
              totalOrphans.push({ file: f, dir: directory, mode: modes });
            });
          }
        }

        // Summary and deletion
        if (totalOrphans.length === 0) {
          console.log(
            chalk.green(
              "\n✅ No orphaned snapshots found across all checked modes",
            ),
          );
          return;
        }

        console.log(
          chalk.yellow(`\n📊 Total orphaned snapshots: ${totalOrphans.length}`),
        );

        if (argv.delete) {
          // Delete with confirmation
          const response = await enquirer.prompt({
            type: "confirm",
            name: "confirm",
            message: `Delete ${totalOrphans.length} orphaned files?`,
            initial: false,
          });

          if (response.confirm) {
            totalOrphans.forEach(({ file, dir }) => {
              fs.unlinkSync(path.join(dir, file));
            });
            console.log(
              chalk.green(
                `\n✅ Deleted ${totalOrphans.length} orphaned snapshots`,
              ),
            );
          } else {
            console.log(chalk.gray("\nDeletion cancelled"));
          }
        }
      } catch (error) {
        console.error(chalk.red("Error checking orphans:"), error.message);
        process.exit(1);
      }
    },
  );
};
