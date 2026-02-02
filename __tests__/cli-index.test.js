/**
 * CLI Index Tests
 * 
 * Note: CLI index is primarily a configuration file that sets up yargs.
 * The actual command logic is tested in individual command test files.
 */

import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";

describe("CLI Index", () => {
  it("should have correct file structure", () => {
    const cliIndexPath = path.join(
      process.cwd(),
      "cli",
      "index.js",
    );
    expect(fs.existsSync(cliIndexPath)).toBe(true);
  });

  it("should import all required command modules", async () => {
    const cliIndexContent = fs.readFileSync(
      path.join(process.cwd(), "cli", "index.js"),
      "utf8",
    );

    expect(cliIndexContent).toContain("runCommand");
    expect(cliIndexContent).toContain("updateCommand");
    expect(cliIndexContent).toContain("diffCommand");
    expect(cliIndexContent).toContain("reportCommand");
    expect(cliIndexContent).toContain("orphansCommand");
    expect(cliIndexContent).toContain("dryRunCommand");
    expect(cliIndexContent).toContain("recommendMobileCommand");
  });

  it("should configure yargs with scriptName", async () => {
    const cliIndexContent = fs.readFileSync(
      path.join(process.cwd(), "cli", "index.js"),
      "utf8",
    );

    expect(cliIndexContent).toContain('scriptName("snapshot-testing")');
  });

  it("should have shebang for CLI execution", async () => {
    const cliIndexContent = fs.readFileSync(
      path.join(process.cwd(), "cli", "index.js"),
      "utf8",
    );

    expect(cliIndexContent).toContain("#!/usr/bin/env node");
  });
});
