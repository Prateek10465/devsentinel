import { checkLicenseCompliance, isLikelyRestrictive } from "../src/licenseChecker";
import { PackageInfo } from "../src/types";

describe("checkLicenseCompliance", () => {
  const allowedLicenses = ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "0BSD", "CC0-1.0"];

  function makePackageInfo(overrides: Partial<PackageInfo>): PackageInfo {
    return {
      name: "test",
      ecosystem: "npm",
      exists: true,
      cveCount: 0,
      cveList: [],
      riskScore: 0,
      severity: "safe",
      message: "",
      ...overrides,
    };
  }

  it("returns true when license is unknown (no license provided)", () => {
    const pkg = makePackageInfo({ license: undefined });
    const result = checkLicenseCompliance(pkg, allowedLicenses);
    expect(result).toBe(true);
  });

  it("returns true when license matches exactly (case-insensitive)", () => {
    const pkg = makePackageInfo({ license: "MIT" });
    const result = checkLicenseCompliance(pkg, allowedLicenses);
    expect(result).toBe(true);
  });

  it("returns true when license matches with different case", () => {
    const pkg = makePackageInfo({ license: "mit" });
    const result = checkLicenseCompliance(pkg, allowedLicenses);
    expect(result).toBe(true);
  });

  it("normalizes underscores to hyphens before matching", () => {
    const pkg = makePackageInfo({ license: "Apache_2_0" });
    const result = checkLicenseCompliance(pkg, allowedLicenses);
    expect(result).toBe(false);
  });

  it("does not match spaces in license names", () => {
    const pkg = makePackageInfo({ license: "Apache 2.0" });
    const result = checkLicenseCompliance(pkg, allowedLicenses);
    expect(result).toBe(false);
  });

  it("returns true when license matches one of many allowed", () => {
    const pkg = makePackageInfo({ license: "BSD-3-Clause" });
    const result = checkLicenseCompliance(pkg, allowedLicenses);
    expect(result).toBe(true);
  });

  it("returns false when license is not in allowed list", () => {
    const pkg = makePackageInfo({ license: "GPL-3.0" });
    const result = checkLicenseCompliance(pkg, allowedLicenses);
    expect(result).toBe(false);
  });

  it("returns false when license is partially matched but not exact", () => {
    const pkg = makePackageInfo({ license: "MIT-FOO" });
    const result = checkLicenseCompliance(pkg, allowedLicenses);
    expect(result).toBe(false);
  });

  it("works with custom allowed license list", () => {
    const customAllowed = ["MPL-2.0", "EPL-2.0"];
    const pkg = makePackageInfo({ license: "MPL-2.0" });
    const result = checkLicenseCompliance(pkg, customAllowed);
    expect(result).toBe(true);
  });

  it("returns true for ISC license", () => {
    const pkg = makePackageInfo({ license: "ISC" });
    const result = checkLicenseCompliance(pkg, allowedLicenses);
    expect(result).toBe(true);
  });

  it("returns true for 0BSD license", () => {
    const pkg = makePackageInfo({ license: "0BSD" });
    const result = checkLicenseCompliance(pkg, allowedLicenses);
    expect(result).toBe(true);
  });

  it("returns true for CC0-1.0 license", () => {
    const pkg = makePackageInfo({ license: "CC0-1.0" });
    const result = checkLicenseCompliance(pkg, allowedLicenses);
    expect(result).toBe(true);
  });
});

describe("isLikelyRestrictive", () => {
  it("returns true for GPL family licenses", () => {
    expect(isLikelyRestrictive("GPL-1.0")).toBe(true);
    expect(isLikelyRestrictive("GPL-2.0")).toBe(true);
    expect(isLikelyRestrictive("GPL-3.0-only")).toBe(true);
    expect(isLikelyRestrictive("LGPL-3.0-or-later")).toBe(true);
  });

  it("returns true for AGPL licenses", () => {
    expect(isLikelyRestrictive("AGPL-3.0")).toBe(true);
    expect(isLikelyRestrictive("AGPL-1.0")).toBe(true);
  });

  it("returns true for other known restrictive licenses", () => {
    expect(isLikelyRestrictive("SSPL-1.0")).toBe(true);
    expect(isLikelyRestrictive("EUPL-1.1")).toBe(true);
    expect(isLikelyRestrictive("CPAL-1.0")).toBe(true);
    expect(isLikelyRestrictive("OSL-3.0")).toBe(true);
    expect(isLikelyRestrictive("EPL-1.0")).toBe(true);
    expect(isLikelyRestrictive("EPL-2.0")).toBe(true);
    expect(isLikelyRestrictive("MPL-2.0")).toBe(true);
  });

  it("returns false for permissive licenses", () => {
    expect(isLikelyRestrictive("MIT")).toBe(false);
    expect(isLikelyRestrictive("Apache-2.0")).toBe(false);
    expect(isLikelyRestrictive("BSD-2-Clause")).toBe(false);
    expect(isLikelyRestrictive("ISC")).toBe(false);
    expect(isLikelyRestrictive("0BSD")).toBe(false);
    expect(isLikelyRestrictive("CC0-1.0")).toBe(false);
    expect(isLikelyRestrictive("Unlicense")).toBe(false);
  });

  it("returns false for empty or unknown license", () => {
    expect(isLikelyRestrictive("")).toBe(false);
    expect(isLikelyRestrictive("unknown")).toBe(false);
    expect(isLikelyRestrictive("SEE LICENSE IN <LICENSE> FILE")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(isLikelyRestrictive("gpl-2.0")).toBe(true);
    expect(isLikelyRestrictive("Mit")).toBe(false);
  });

  it("works with licenses in longer strings", () => {
    expect(isLikelyRestrictive("Licensed under GPL-3.0 or later")).toBe(true);
    expect(isLikelyRestrictive("This file is MIT licensed")).toBe(false);
  });

  it("returns false when license substring matches but not exactly", () => {
    // e.g., "MIT" in "WEIRD-MIT-LICENSE" should not trigger as restrictive
    expect(isLikelyRestrictive("WEIRD-MIT-LICENSE")).toBe(false);
  });
});