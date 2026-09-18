import { fetchCvesForPackage } from "../src/nvdClient";

jest.mock("node-fetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedFetch = require("node-fetch").default;

beforeEach(() => {
  jest.clearAllMocks();
});

const makeVulnerability = (id: string, score: number, severity: string): any => ({
  cve: {
    id,
    descriptions: [{ lang: "en", value: `${id} test vulnerability` }],
    metrics: {
      cvssMetricV31: [{ cvssData: { baseScore: score, baseSeverity: severity } }],
    },
    configurations: [],
  },
});

describe("fetchCvesForPackage", () => {
  it("fetches CVEs with the NVD API and API key header", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        totalResults: 1,
        vulnerabilities: [makeVulnerability("CVE-2024-0001", 9.8, "CRITICAL")],
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await fetchCvesForPackage("lodash", "test-api-key");

    expect(mockedFetch).toHaveBeenCalledWith(
      "https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=lodash&resultsPerPage=10",
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          apiKey: "test-api-key",
        },
        timeout: 10000,
      })
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: "CVE-2024-0001",
        severity: "critical",
        cvssScore: 9.8,
        summary: "CVE-2024-0001 test vulnerability",
      }),
    ]);
  });

  it("sends no API key header when key is empty", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        totalResults: 0,
        vulnerabilities: [],
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    await fetchCvesForPackage("lodash", "");

    expect(mockedFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Accept: "application/json" },
        timeout: 10000,
      })
    );
  });

  it("uses a custom maxResults value", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        totalResults: 0,
        vulnerabilities: [],
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    await fetchCvesForPackage("lodash", "test-api-key", 25);

    expect(mockedFetch).toHaveBeenCalledWith(
      "https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=lodash&resultsPerPage=25",
      expect.anything()
    );
  });

  it("returns an empty array when NVD responds with 404", async () => {
    const mockResponse = { ok: false, status: 404 };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await fetchCvesForPackage("nonexistent", "test-api-key");

    expect(result).toEqual([]);
  });

  it("warns when NVD responds with 401 or 403", async () => {
    const mockResponse = { ok: false, status: 401 };
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    mockedFetch.mockResolvedValueOnce(mockResponse);
    await fetchCvesForPackage("nonexistent", "bad-key");

    expect(warnSpy).toHaveBeenCalledWith(
      "DevSentinel: NVD API returned 401 — check your API key"
    );
    warnSpy.mockRestore();
  });

  it("returns an empty array when fetch throws", async () => {
    mockedFetch.mockRejectedValueOnce(new Error("Network error"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await fetchCvesForPackage("lodash", "test-api-key");

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      "DevSentinel: NVD lookup failed for lodash:",
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });

  it("sorts CVEs by CVSS score descending", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        totalResults: 2,
        vulnerabilities: [
          makeVulnerability("CVE-2024-0001", 7.5, "HIGH"),
          makeVulnerability("CVE-2024-0002", 9.8, "CRITICAL"),
        ],
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await fetchCvesForPackage("lodash", "test-api-key");

    expect(result.map((c) => c.id)).toEqual(["CVE-2024-0002", "CVE-2024-0001"]);
  });

  it("falls back to CVSS v3.0 when v3.1 is unavailable", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        totalResults: 1,
        vulnerabilities: [{
          cve: {
            id: "CVE-2023-0001",
            descriptions: [{ lang: "en", value: "CVSS v3.0 test" }],
            metrics: {
              cvssMetricV30: [{ cvssData: { baseScore: 8.1, baseSeverity: "HIGH" } }],
            },
            configurations: [],
          },
        }],
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await fetchCvesForPackage("test-pkg", "test-api-key");

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "CVE-2023-0001",
        cvssScore: 8.1,
        severity: "high",
      })
    );
  });

  it("falls back to CVSS v2 when v3.x is unavailable", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        totalResults: 1,
        vulnerabilities: [{
          cve: {
            id: "CVE-2022-0001",
            descriptions: [{ lang: "en", value: "CVSS v2 test" }],
            metrics: {
              cvssMetricV2: [{ cvssData: { baseScore: 6.4 } }],
            },
            configurations: [],
          },
        }],
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await fetchCvesForPackage("test-pkg", "test-api-key");

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "CVE-2022-0001",
        cvssScore: 6.4,
        severity: "moderate",
      })
    );
  });

  it("normalizes missing severity to low", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        totalResults: 1,
        vulnerabilities: [{
          cve: {
            id: "CVE-2021-0001",
            descriptions: [{ lang: "en", value: "Unknown severity test" }],
            metrics: {
              cvssMetricV31: [{ cvssData: { baseScore: 2.1 } }],
            },
            configurations: [],
          },
        }],
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await fetchCvesForPackage("test-pkg", "test-api-key");

    expect(result[0].severity).toBe("low");
  });

  it("uses the lastModified timestamp when published is missing", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        totalResults: 1,
        vulnerabilities: [{
          cve: {
            id: "CVE-2020-0001",
            descriptions: [{ lang: "en", value: "Timestamp test" }],
            metrics: {
              cvssMetricV31: [{ cvssData: { baseScore: 1.0 } }],
            },
            configurations: [],
            lastModified: "2020-02-03T00:00:00.000Z",
          },
        }],
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await fetchCvesForPackage("test-pkg", "test-api-key");

    expect(result[0].published).toBe("2020-02-03T00:00:00.000Z");
  });
});