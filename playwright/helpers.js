/**
 * Playwright Helpers Module
 *
 * Provides helper functions for common visual testing tasks:
 * - Element masking
 * - Story navigation
 * - Screenshot capture
 * - Waiting for story readiness
 */

/**
 * Masks dynamic elements that change between test runs
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Array<string>} selectors - CSS selectors to mask
 * @returns {Promise<void>}
 */
export async function maskElements(page, selectors = []) {
  if (!selectors || selectors.length === 0) {
    return;
  }

  const cssContent = selectors
    .map((selector) => `${selector} { visibility: hidden !important; }`)
    .join("\n");

  try {
    await page.addStyleTag({ content: cssContent });
  } catch (error) {
    console.error("Failed to mask elements:", error.message);
  }
}

/**
 * Default mask selectors for common dynamic elements
 */
export const DEFAULT_MASK_SELECTORS = [
  '[data-testid="timeElapsed"]',
  '[data-testid="bsqDate"]',
];

/**
 * Masks timestamp elements (timeElapsed and bsqDate)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function maskTimestampElements(page) {
  await maskElements(page, DEFAULT_MASK_SELECTORS);
}

/**
 * Navigates to a Storybook story
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} storyId - Story ID
 * @param {object} config - Configuration object
 * @returns {Promise<void>}
 */
export async function navigateToStory(page, storyId, config = {}) {
  const host = config.storybook?.host || "localhost";
  const port = config.storybook?.port || "6006";
  let url = `http://${host}:${port}/iframe.html?id=${storyId}&viewMode=story`;

  // Inject locale parameter if locale is configured
  if (config.locale?.code) {
    const globalParam = config.locale.storybookGlobalParam || "locale";
    url += `&globals=${globalParam}:${config.locale.code}`;
  }

  await page.goto(url, { waitUntil: "networkidle" });
}

/**
 * Waits for a story to be ready for screenshot
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} targetSelector - CSS selector for the main content area
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} - True if ready, false if timeout
 */
export async function waitForStoryReady(
  page,
  targetSelector = "#storybook-root",
  timeout = 5000,
) {
  try {
    // Wait for the target element to be attached (not checking visibility since aria-hidden may be present)
    await page.waitForSelector(targetSelector, {
      state: "attached",
      timeout,
    });

    // Wait for any animations and content to render
    // Increased wait time to allow story content to fully load
    await page.waitForTimeout(2000);

    // Check if element is actually visible and has content
    const debugInfo = await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { found: false };

      const rect = element.getBoundingClientRect();

      // Also check alternative selectors
      const alternatives = {
        body: document.body?.getBoundingClientRect(),
        "#storybook-docs": document
          .querySelector("#storybook-docs")
          ?.getBoundingClientRect(),
        "#root": document.querySelector("#root")?.getBoundingClientRect(),
        ".sb-show-main": document
          .querySelector(".sb-show-main")
          ?.getBoundingClientRect(),
      };

      // Check for any visible content on the page (handles dialogs/modals)
      const hasAnyVisibleContent = () => {
        // Check if body has any visible children with dimensions
        const allElements = document.querySelectorAll("body *");
        for (const el of allElements) {
          const elRect = el.getBoundingClientRect();
          if (elRect.width > 0 && elRect.height > 0) {
            return true;
          }
        }
        return false;
      };

      return {
        found: true,
        hasChildren: element.hasChildNodes(),
        childCount: element.childNodes.length,
        width: rect.width,
        height: rect.height,
        ariaHidden: element.getAttribute("aria-hidden"),
        display: window.getComputedStyle(element).display,
        visibility: window.getComputedStyle(element).visibility,
        innerHTML: element.innerHTML.substring(0, 200), // First 200 chars
        hasAnyVisibleContent: hasAnyVisibleContent(),
        alternatives: Object.fromEntries(
          Object.entries(alternatives).map(([key, rect]) => [
            key,
            rect ? { width: rect.width, height: rect.height } : null,
          ]),
        ),
      };
    }, targetSelector);

    // Story is ready if:
    // 1. Target element exists AND has children with dimensions, OR
    // 2. There's ANY visible content on the page (handles dialogs/modals)
    const isReady =
      debugInfo.found &&
      ((debugInfo.hasChildren && debugInfo.width > 0 && debugInfo.height > 0) ||
        debugInfo.hasAnyVisibleContent);

    return isReady;
  } catch (error) {
    console.error(`Story not ready within ${timeout}ms:`, error.message);
    return false;
  }
}

/**
 * Captures a screenshot of a story
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} targetSelector - CSS selector for the element to screenshot
 * @param {object} options - Screenshot options
 * @returns {Promise<Buffer>}
 */
export async function captureStoryScreenshot(
  page,
  targetSelector = "#storybook-root",
  options = {},
) {
  // Check if target element has dimensions
  const hasContent = await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }, targetSelector);

  const screenshotOptions = {
    animations: "disabled",
    ...options,
  };

  // If target element is empty (e.g., for dialogs/modals), screenshot the body instead
  if (!hasContent) {
    return await page.screenshot(screenshotOptions);
  }

  // Otherwise screenshot the target element
  const element = await page.locator(targetSelector);
  return await element.screenshot(screenshotOptions);
}

/**
 * Prepares a story for screenshot (navigate, wait, mask)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} storyId - Story ID
 * @param {object} config - Configuration object
 * @returns {Promise<{ready: boolean, error?: string}>}
 */
export async function prepareStoryForScreenshot(page, storyId, config = {}) {
  try {
    // Navigate to story
    await navigateToStory(page, storyId, config);

    // Wait for story to be ready
    const targetSelector = config.targetSelector || "#storybook-root";
    const ready = await waitForStoryReady(page, targetSelector);

    if (!ready) {
      return {
        ready: false,
        error: "Story element not visible or has no dimensions",
      };
    }

    // Apply masking
    const maskSelectors = config.maskSelectors || DEFAULT_MASK_SELECTORS;
    await maskElements(page, maskSelectors);

    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      error: error.message,
    };
  }
}

/**
 * Gets the sanitized snapshot name for a story
 * @param {string} storyId - Story ID
 * @returns {string} - Sanitized snapshot name
 */
export function getSnapshotName(storyId) {
  return storyId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Checks if an error should be ignored based on patterns
 * @param {Error} error - Error object
 * @param {Array<string>} ignorePatterns - Patterns to ignore
 * @returns {boolean}
 */
export function shouldIgnoreError(error, ignorePatterns = []) {
  if (!error || !error.message) {
    return false;
  }

  const message = error.message.toLowerCase();

  // Never ignore snapshot/image mismatch errors
  if (message.includes("snapshot") || message.includes("image")) {
    return false;
  }

  // Check against ignore patterns
  return ignorePatterns.some((pattern) =>
    message.includes(pattern.toLowerCase()),
  );
}

/**
 * Retries an async operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise<any>}
 */
export async function retryOperation(
  operation,
  maxRetries = 3,
  initialDelay = 1000,
) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Warms up Storybook server by making a request to index.json
 * @param {object} config - Configuration object
 * @returns {Promise<boolean>} - True if successful
 */
export async function warmupStorybook(config = {}) {
  const host = config.storybook?.host || "localhost";
  const port = config.storybook?.port || "6006";
  const url = `http://${host}:${port}/index.json`;

  try {
    const response = await fetch(url);
    if (response.ok) {
      console.log("✓ Storybook server is ready");
      return true;
    }
    console.error("✗ Storybook server returned error:", response.status);
    return false;
  } catch (error) {
    console.error("✗ Failed to connect to Storybook:", error.message);
    return false;
  }
}
