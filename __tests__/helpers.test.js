/**
 * Playwright Helpers Tests
 */

import { jest } from "@jest/globals";
import { getSnapshotName } from "../playwright/helpers.js";

describe("Playwright Helpers", () => {
  describe("getSnapshotName", () => {
    it("should sanitize simple story IDs", () => {
      expect(getSnapshotName("button--primary")).toBe("button-primary");
    });

    it("should sanitize complex story IDs", () => {
      expect(getSnapshotName("Components/Button--Large Red")).toBe(
        "components-button-large-red",
      );
    });

    it("should remove leading/trailing dashes", () => {
      expect(getSnapshotName("-button-")).toBe("button");
    });

    it("should include viewport dimensions for mobile", () => {
      const viewport = { width: 375, height: 667 };
      expect(getSnapshotName("button--primary", {}, viewport)).toBe(
        "button-primary-375x667",
      );
    });

    it("should handle mixed case and special chars", () => {
      expect(getSnapshotName("User Profile @ Header!")).toBe(
        "user-profile-header",
      );
    });

    it("should ignore empty config", () => {
      expect(getSnapshotName("story", undefined, null)).toBe("story");
    });
  });
});
