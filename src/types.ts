export interface PackageInfo {
  name: string;
  ecosystem: "npm" | "pypi";
  version?: string;
  exists: boolean;
  latestVersion?: string;
  license?: string;
  licenseCompliant?: boolean;
  cveCount: number;
  cveList: CveEntry[];
  riskScore: number; // 0-100
  severity: "safe" | "warning" | "danger";
  message: string;
}

export interface CveEntry {
  id: string;
  severity: "critical" | "high" | "moderate" | "low";
  cvssScore: number;
  summary: string;
  published: string;
  fixedIn?: string;
}

export interface ScanResult {
  documentUri: string;
  timestamp: number;
  packages: PackageInfo[];
  summary: {
    total: number;
    hallucinated: number;
    vulnerable: number;
    nonCompliant: number;
  };
}

export interface RegistryResponse {
  name: string;
  exists: boolean;
  latestVersion?: string;
  license?: string;
  description?: string;
}

export interface NvdCpeMatch {
  isVulnerable?: boolean;
  versionEndExcluding?: string;
}

export interface NvdConfigNode {
  edges?: { cpeMatch?: NvdCpeMatch }[];
}

export interface NvdCve {
  cve: {
    id: string;
    descriptions?: { lang: string; value: string }[];
    metrics?: {
      cvssMetricV31?: { cvssData?: { baseScore: number; baseSeverity?: string } }[];
      cvssMetricV30?: { cvssData?: { baseScore: number; baseSeverity?: string } }[];
      cvssMetricV2?: { cvssData?: { baseScore: number; baseSeverity?: string } }[];
    };
    configurations?: NvdConfigNode[];
  };
  published?: string;
  lastModified?: string;
}

export interface NvdResponse {
  totalResults: number;
  vulnerabilities: NvdCve[];
}