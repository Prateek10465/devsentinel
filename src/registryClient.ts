import fetch from "node-fetch";
import { RegistryResponse } from "./types";

const NPM_REGISTRY = "https://registry.npmjs.org";
const PYPI_REGISTRY = "https://pypi.org/pypi";

interface NpmPackageResponse {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "dist-tags"?: { latest?: string };
  license?: string;
  versions?: Record<string, { license?: string }>;
  description?: string;
}

interface PypiPackageResponse {
  info?: {
    version?: string;
    license?: string;
    summary?: string;
  };
}

/**
 * Check an npm package against the public npm registry.
 */
export async function checkNpmPackage(name: string): Promise<RegistryResponse> {
  try {
    const res = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(name)}`, { timeout: 5000 });
    if (!res.ok) {
      return { name, exists: false };
    }
    const json = (await res.json()) as NpmPackageResponse;
    const latest = json["dist-tags"]?.latest;
    const versionLicense = latest && json.versions ? json.versions[latest]?.license : undefined;
    return {
      name,
      exists: true,
      latestVersion: latest,
      license: json.license ?? versionLicense,
      description: json.description,
    };
  } catch {
    return { name, exists: false };
  }
}

/**
 * Check a PyPI package against the public PyPI JSON API.
 */
export async function checkPypiPackage(name: string): Promise<RegistryResponse> {
  try {
    const res = await fetch(`${PYPI_REGISTRY}/${encodeURIComponent(name)}/json`, { timeout: 5000 });
    if (!res.ok) {
      return { name, exists: false };
    }
    const json = (await res.json()) as PypiPackageResponse;
    return {
      name,
      exists: true,
      latestVersion: json.info?.version,
      license: json.info?.license,
      description: json.info?.summary,
    };
  } catch {
    return { name, exists: false };
  }
}

/**
 * Dispatch to the correct registry based on ecosystem.
 */
export async function checkPackage(name: string, ecosystem: "npm" | "pypi"): Promise<RegistryResponse> {
  return ecosystem === "npm" ? checkNpmPackage(name) : checkPypiPackage(name);
}
