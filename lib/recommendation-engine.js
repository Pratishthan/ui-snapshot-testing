/**
 * Recommendation Engine Module
 * Analyzes existing snapshots to suggest mobile test candidates
 */

import fs from "fs";
import path from "path";
import { imageSize } from "image-size";
import {
  fetchStoriesFromStorybook,
  sanitizeSnapshotName,
} from "./story-discovery.js";
import {
  DEFAULT_MOBILE_DISCOVERY_MIN_WIDTH,
  DEFAULT_MOBILE_DISCOVERY_EXCLUDE_TAGS,
} from "../visual-test-config.js";

/**
 * Find stories that are recommended for mobile snapshot testing
 * @param {object} config - Configuration object
 * @returns {Promise<Array>} List of recommended stories
 */
export const findRecommendations = async (config) => {
  console.log("🔍 Analyzing desktop snapshots for mobile recommendations...");

  const snapshotDir = path.resolve(
    process.cwd(),
    config.snapshot.paths?.snapshotsDir ||
      "playwright/storybook-visual/__visual_snapshots__",
  );
  const mobileSnapshotDir = path.join(snapshotDir, "mobile");

  if (!fs.existsSync(snapshotDir)) {
    console.log("⚠️ Snapshot directory not found, skipping analysis.");
    return [];
  }

  // 1. Get all desktop snapshots
  const desktopSnapshots = fs
    .readdirSync(snapshotDir)
    .filter((file) => file.endsWith(".png"));

  if (desktopSnapshots.length === 0) {
    console.log("ℹ️ No desktop snapshots found to analyze.");
    return [];
  }

  // 2. Get all mobile snapshots (to check for existence)
  let mobileSnapshots = [];
  if (fs.existsSync(mobileSnapshotDir)) {
    mobileSnapshots = fs
      .readdirSync(mobileSnapshotDir)
      .filter((file) => file.endsWith(".png"));
  }

  // 3. Fetch current stories to get metadata (tags)
  // We include all matching stories to get metadata for everything
  let stories = [];
  try {
    stories = await fetchStoriesFromStorybook(config, true);
  } catch (error) {
    console.error("⚠️ Failed to fetch stories:", error.message);
    // Proceed with limited analysis (can't check tags)
  }

  const recommendations = [];
  const minWidth =
    config.snapshot?.mobile?.discovery?.thresholds?.minWidth ||
    DEFAULT_MOBILE_DISCOVERY_MIN_WIDTH;
  const excludeTags =
    config.snapshot?.mobile?.discovery?.excludeTags ||
    DEFAULT_MOBILE_DISCOVERY_EXCLUDE_TAGS;

  for (const file of desktopSnapshots) {
    const filePath = path.join(snapshotDir, file);
    const storyIdFromFilename = file.replace(/\.png$/, "");

    // Find matching story
    // Note: sanitizeSnapshotName converts to lowercase, so we compare sanitized IDs
    // We iterate stories to find one whose sanitized ID matches the filename
    const story = stories.find(
      (s) => sanitizeSnapshotName(s.id) === storyIdFromFilename,
    );

    // If we have story metadata, check exclusions
    if (story) {
      // Check exclude tags
      if (
        excludeTags.length > 0 &&
        story.tags &&
        story.tags.some((tag) => excludeTags.includes(tag))
      ) {
        continue;
      }

      // Also exclude if it already has explicit mobile tag (assuming user handles it manually)
      // Actually, maybe not? If it has mobile tag, it SHOULD be covered.
      // We'll rely on file existence check mostly.
    }

    // 4. Check dimensions
    try {
      const buffer = fs.readFileSync(filePath);
      const dimensions = imageSize(buffer);
      if (dimensions && dimensions.width > minWidth) {
        // 5. Check if covered by mobile snapshot
        // Mobile snapshots follow pattern: sanitizedId-widthxheight.png
        const hasMobileSnapshot = mobileSnapshots.some((mobileFile) =>
          mobileFile.startsWith(`${storyIdFromFilename}-`),
        );

        if (!hasMobileSnapshot) {
          recommendations.push({
            storyId: story ? story.id : storyIdFromFilename,
            name: story ? story.name : storyIdFromFilename,
            width: dimensions.width,
            height: dimensions.height,
            filePath: filePath,
            reason: `Width ${dimensions.width}px > ${minWidth}px`,
          });
        }
      }
    } catch (err) {
      // Ignore files that aren't valid images
    }
  }

  return recommendations;
};
