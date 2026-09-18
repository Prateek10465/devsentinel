import fetch from "node-fetch";
import { CveEntry, NvdCve, NvdResponse } from "./types";

const NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0";

/**
 * Query NVD for CVEs affecting a specific package.
 * Returns up to `maxResults` entries sorted by CVSS score descending.
 */
export async function fetchCvesForPackage(
  pkgName: string,
  apiKey: string,
  maxResults = 10
): Promise<CveEntry[]> {
  const url = new URL(NVD_BASE);
  url.searchParams.set("keywordSearch", pkgName);
  url.searchParams.set("resultsPerPage", String(maxResults));

  const headers: Record<string, string> = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Accept: "application/json",
  };
  if (apiKey) {
    headers["apiKey"] = apiKey;
  }

  try {
    const res = await fetch(url.toString(), { headers, timeout: 10000 });
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        console.warn(`DevSentinel: NVD API returned ${res.status} — check your API key`);
      }
      return [];
    }
    const data = (await res.json()) as NvdResponse;
    return (data.vulnerabilities ?? []).map(parseNvdCve).sort((a, b) => b.cvssScore - a.cvssScore);
  } catch (err) {
    console.warn(`DevSentinel: NVD lookup failed for ${pkgName}:`, err);
    return [];
  }
}

interface RawCveDescription {
  lang: string;
  value: string;
}

interface RawCvePayload {
  id: string;
  descriptions?: RawCveDescription[];
  metrics?: {
    cvssMetricV31?: { cvssData?: { baseScore?: number; baseSeverity?: string } }[];
    cvssMetricV30?: { cvssData?: { baseScore?: number; baseSeverity?: string } }[];
    cvssMetricV2?: { cvssData?: { baseScore?: number; baseSeverity?: string } }[];
  };
  configurations?: {
    edges?: {
      cpeMatch?: {
        isVulnerable?: boolean;
        versionEndExcluding?: string;
      };
    }[];
  }[];
  published?: string;
  lastModified?: string;
}

function parseNvdCve(v: NvdCve | { cve: RawCvePayload }): CveEntry {
  const cve = ("cve" in v && v.cve ? v.cve : v) as RawCvePayload;
  const descArr = cve.descriptions ?? [];
  const summary = descArr.find((d: RawCveDescription) => d.lang === "en")?.value ?? "No description";

  const metrics = cve.metrics ?? {};
  const cvss31 = metrics.cvssMetricV31?.[0]?.cvssData;
  const cvss30 = metrics.cvssMetricV30?.[0]?.cvssData;
  const cvss2 = metrics.cvssMetricV2?.[0]?.cvssData;

  const cvssScore = cvss31?.baseScore ?? cvss30?.baseScore ?? cvss2?.baseScore ?? 0;
  const severity = cvss31?.baseSeverity ?? cvss30?.baseSeverity ?? cvss2?.baseSeverity ?? "unknown";

  let fixedIn: string | undefined;
  const configs = cve.configurations ?? [];
  for (const node of configs) {
    for (const edge of node?.edges ?? []) {
      if (edge?.cpeMatch?.isVulnerable && edge?.cpeMatch?.versionEndExcluding) {
        fixedIn = edge.cpeMatch.versionEndExcluding;
        break;
      }
    }
    if (fixedIn) {
      break;
    }
  }

  return {
    id: cve.id,
    severity: normalizeSeverity(severity, cvssScore),
    cvssScore,
    summary,
    published: cve.published ?? cve.lastModified ?? "",
    fixedIn,
  };
}

function normalizeSeverity(severity: string, score: number): CveEntry["severity"] {
  if (severity === "CRITICAL" || score >= 9.0) {
    return "critical";
  }
  if (severity === "HIGH" || score >= 7.0) {
    return "high";
  }
  if (severity === "MODERATE" || score >= 4.0) {
    return "moderate";
  }
  return "low";
}
