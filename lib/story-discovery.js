/**
 * Story Discovery Module
 * Handles fetching and filtering stories from Storybook
 */

import fs from "fs";
import path from "path";

/**
 * Parse comma-separated list from string
 * @param {string} value - Comma-separated string
 * @returns {string[]} Array of trimmed values
 */
const parseList = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

/**
 * Sanitize snapshot name (convert story ID to valid filename)
 * @param {string} storyId - Story ID
 * @returns {string} Sanitized name
 */
export const sanitizeSnapshotName = (storyId, viewport = null) => {
  const sanitized = storyId.replace(/[^a-z0-9]+/gi, "-");

  if (viewport && viewport.width && viewport.height) {
    return `${sanitized}-${viewport.width}x${viewport.height}`;
  }

  return sanitized;
};

/**
 * Check if a snapshot exists for a story
 * @param {string} storyId - Story ID
 * @param {object} config - Configuration object
 * @returns {boolean} True if snapshot exists
 */
export const snapshotExists = (storyId, config) => {
  const baseName = sanitizeSnapshotName(storyId, config.activeViewport);
  const snapshotDir = path.join(process.cwd(), config.paths.snapshotsDir);

  const imageSnapshotPath = path.join(snapshotDir, `${baseName}.png`);
  const positionSnapshotPath = path.join(
    snapshotDir,
    `${baseName}.positions.json`,
  );

  // Story is considered to have a snapshot if either image or position snapshot exists
  return (
    fs.existsSync(imageSnapshotPath) || fs.existsSync(positionSnapshotPath)
  );
};

/**
 * Check if story matches exclusion patterns
 * @param {object} entry - Story entry
 * @param {string[]} exclusions - Exclusion patterns
 * @returns {boolean} True if story matches exclusion patterns
 */
export const matchesExclusionPatterns = (entry, exclusions) => {
  if (!exclusions || exclusions.length === 0) {
    return false;
  }

  const exclusionPatterns = parseList(exclusions).map((p) => p.toLowerCase());

  if (exclusionPatterns.length === 0) {
    return false;
  }

  const id = entry.id?.toLowerCase() ?? "";
  const displayName = entry.name?.toLowerCase() ?? "";
  const importPath = entry.importPath?.toLowerCase() ?? "";

  return exclusionPatterns.some(
    (pattern) =>
      id.includes(pattern) ||
      displayName.includes(pattern) ||
      importPath.includes(pattern),
  );
};

/**
 * Check if story matches visual criteria (tags, suffix, or keywords)
 * @param {object} entry - Story entry
 * @param {object} testMatcher - Matcher configuration
 * @returns {boolean} True if story matches visual criteria
 */
export const matchesVisualCriteria = (entry, testMatcher) => {
  if (!testMatcher) return false;

  const id = entry.id?.toLowerCase() ?? "";
  const displayName = entry.name?.toLowerCase() ?? "";
  const storySegment = id.split("--").pop() ?? "";

  // 1. Check tags (primary method)
  if (
    testMatcher.tags &&
    entry.tags &&
    Array.isArray(entry.tags) &&
    testMatcher.tags.some((tag) => entry.tags.includes(tag))
  ) {
    return true;
  }

  // 2. Check suffix (legacy/optional method)
  if (testMatcher.suffix) {
    const suffixes = Array.isArray(testMatcher.suffix)
      ? testMatcher.suffix
      : [testMatcher.suffix];

    // Check if any suffix matches
    if (
      suffixes.some((s) => {
        const suffix = s.toLowerCase();
        return storySegment.endsWith(suffix) || displayName.endsWith(suffix);
      })
    ) {
      return true;
    }
  }

  // 3. Check keywords (legacy/optional method)
  if (testMatcher.keywords) {
    const keywords = Array.isArray(testMatcher.keywords)
      ? testMatcher.keywords
      : [testMatcher.keywords];

    // Check if any keyword matches
    if (
      keywords.some((k) => {
        const keyword = k.toLowerCase();
        return storySegment.includes(keyword) || displayName.includes(keyword);
      })
    ) {
      return true;
    }
  }

  // 4. Check parameter (legacy/direct override)
  if (entry.parameters && entry.parameters.snapshot === true) {
    return true;
  }

  return false;
};

/**
 * Check if story matches path filters
 * @param {object} entry - Story entry
 * @param {string[]} includePaths - Path segments to include
 * @returns {boolean} True if story matches path filters
 */
export const matchesPathFilters = (entry, includePaths) => {
  if (!includePaths || includePaths.length === 0) {
    return true;
  }

  const pathList = parseList(includePaths);

  if (pathList.length === 0) {
    return true;
  }

  const importPath = entry.importPath ?? "";
  return pathList.some((segment) => importPath.includes(segment));
};

/**
 * Check if story matches story ID filters
 * @param {object} entry - Story entry
 * @param {string[]} storyIds - Story IDs to include
 * @returns {boolean} True if story matches ID filters
 */
export const matchesStoryIdFilters = (entry, storyIds) => {
  if (!storyIds || storyIds.length === 0) {
    return true;
  }

  const idList = parseList(storyIds);

  if (idList.length === 0) {
    return true;
  }

  return idList.includes(entry.id);
};

/**
 * Fetch stories from Storybook
 * @param {object} config - Configuration object
 * @param {boolean} [includeAllMatching=false] - Include all matching stories regardless of snapshot existence
 * @returns {Promise<Array>} Array of story entries
 */
export const fetchStoriesFromStorybook = async (
  config,
  includeAllMatching = false,
) => {
  const indexUrl = `http://${config.storybook.host}:${config.storybook.port}${config.storybook.indexPath}`;

  // Add timeout to prevent hanging indefinitely
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  let response;
  try {
    response = await fetch(indexUrl, { signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Timeout connecting to Storybook at ${indexUrl}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(
      `Unable to load Storybook index (${response.status} ${response.statusText})`,
    );
  }

  const indexJson = await response.json();
  const entries = Object.values(indexJson.entries ?? {});

  // Apply filters in order
  let filtered = entries
    .filter((entry) => entry.type === "story" && entry.id)
    .filter(
      (entry) => !matchesExclusionPatterns(entry, config.filters.exclusions),
    );

  // Determine matchers (cascading: specific > global)
  const globalMatcher = config.testMatcher;
  const imageMatcher = config.snapshot?.image?.testMatcher || globalMatcher;
  const positionMatcher =
    config.snapshot?.position?.testMatcher || globalMatcher;

  // Apply visual criteria and attach test options
  filtered = filtered
    .map((entry) => {
      const matchImage = matchesVisualCriteria(entry, imageMatcher);
      const matchPosition = matchesVisualCriteria(entry, positionMatcher);

      // If matches, attach options
      if (matchImage || matchPosition) {
        return {
          ...entry,
          _testOptions: {
            image: matchImage,
            position: matchPosition,
          },
        };
      }
      return null;
    })
    .filter(Boolean) // Remove non-matching stories
    .filter((entry) => matchesPathFilters(entry, config.filters.includePaths))
    .filter((entry) => matchesStoryIdFilters(entry, config.filters.storyIds));

  // If not including all matching, filter to only stories with snapshots
  if (!includeAllMatching) {
    filtered = filtered.filter((entry) => snapshotExists(entry.id, config));
  }

  return filtered.sort((a, b) => a.id.localeCompare(b.id));
};

/**
 * Filter stories by paths
 * @param {Array} stories - Array of story entries
 * @param {string[]} paths - Path segments to match
 * @returns {Array} Filtered stories
 */
export const filterStoriesByPaths = (stories, paths) => {
  return stories.filter((story) => matchesPathFilters(story, paths));
};

/**
 * Filter stories by exclusions
 * @param {Array} stories - Array of story entries
 * @param {string[]} exclusions - Exclusion patterns
 * @returns {Array} Filtered stories
 */
export const filterStoriesByExclusions = (stories, exclusions) => {
  return stories.filter(
    (story) => !matchesExclusionPatterns(story, exclusions),
  );
};
