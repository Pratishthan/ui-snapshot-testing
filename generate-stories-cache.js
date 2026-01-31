#!/usr/bin/env node

/**
 * Generate Stories Cache
 *
 * Pre-generates a cache file of filtered stories from Storybook.
 * This is a workaround for Playwright's limitation with async HTTP fetch in test files.
 *
 * The cache file is read synchronously by the test file, which Playwright handles correctly.
 *
 * Usage:
 *   node generate-stories-cache.js
 *
 * Environment Variables:
 *   - STORY_INCLUDE_PATHS: Comma-separated paths to filter stories
 *   - STORY_IDS: Comma-separated story IDs to include
 *   - UPDATE_SNAPSHOTS: Set to '1' or 'true' to include stories without snapshots
 *   - All other config-loader environment variables
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { loadConfig } from "./config-loader.js";
import { fetchStoriesFromStorybook } from "./lib/story-discovery.js";

const main = async () => {
  try {
    // Load configuration (respects env vars and config file)
    const config = await loadConfig();

    // Determine if we're in update mode
    const isUpdateMode =
      process.argv.includes("--update-snapshots") ||
      process.env.UPDATE_SNAPSHOTS === "1" ||
      process.env.UPDATE_SNAPSHOTS === "true";

    // Override config filters from environment variables if set
    if (process.env.STORY_INCLUDE_PATHS) {
      config.filters.includePaths = process.env.STORY_INCLUDE_PATHS.split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    }

    if (process.env.STORY_IDS) {
      config.filters.storyIds = process.env.STORY_IDS.split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    }

    // Fetch stories from Storybook
    // In update mode, include all matching stories (includeAllMatching=true)
    // In verify mode, only include stories with existing snapshots
    const stories = await fetchStoriesFromStorybook(config, isUpdateMode);

    // Determine cache file location
    const cacheDir = join(process.cwd(), "playwright", "storybook-visual");
    const cacheFile = join(cacheDir, ".stories-cache.json");

    // Ensure directory exists
    mkdirSync(cacheDir, { recursive: true });

    // Write cache file
    writeFileSync(cacheFile, JSON.stringify(stories, null, 2), "utf-8");

    console.log(`✅ Stories cache generated: ${stories.length} stories`);
    console.log(`📄 Cache file: ${cacheFile}`);

    if (config.filters.includePaths?.length > 0) {
      console.log(
        `🔍 Filtered by paths: ${config.filters.includePaths.join(", ")}`,
      );
    }

    if (config.filters.storyIds?.length > 0) {
      console.log(`🔍 Filtered by IDs: ${config.filters.storyIds.join(", ")}`);
    }

    console.log(`📊 Operation: ${isUpdateMode ? "update" : "verify"}`);
  } catch (error) {
    console.error("❌ Failed to generate stories cache:", error.message);
    process.exit(1);
  }
};

main();
