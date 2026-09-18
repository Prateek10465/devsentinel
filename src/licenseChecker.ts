import { PackageInfo } from "./types";

const KNOWN_RESTRICTIVE_LICENSES = [
  "GPL-1.0", "GPL-2.0", "GPL-3.0", "LGPL-2.1", "LGPL-3.0",
  "AGPL-1.0", "AGPL-3.0", "SSPL-1.0", "EUPL-1.1", "EUPL-1.2",
  "CPAL-1.0", "OSL-3.0", "EPL-1.0", "EPL-2.0", "MPL-2.0",
];

/**
 * Check whether a package's license is in the allowed list.
 */
export function checkLicenseCompliance(pkg: PackageInfo, allowedLicenses: string[]): boolean {
  if (!pkg.license) {
    return true; // unknown -> don't penalize
  }
  const normalized = pkg.license.toUpperCase().replace(/[-_]+/g, "-");
  return allowedLicenses.some((a) => a.toUpperCase() === normalized);
}

/**
 * Quick heuristic to detect if a license string looks restrictive.
 */
export function isLikelyRestrictive(licenseStr: string): boolean {
  const upper = licenseStr.toUpperCase();
  return KNOWN_RESTRICTIVE_LICENSES.some((l) => upper.includes(l));
}
