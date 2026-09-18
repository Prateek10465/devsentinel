import { checkPackage, checkNpmPackage, checkPypiPackage } from "../src/registryClient";

jest.mock("node-fetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedFetch = require("node-fetch").default;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("checkNpmPackage", () => {
  it("returns exists: true with package details when registry responds 200", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        "dist-tags": { latest: "9.0.0" },
        license: "MIT",
        version: "9.0.0",
        description: "A utilitys library",
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await checkNpmPackage("lodash");

    expect(mockedFetch).toHaveBeenCalledWith(
      "https://registry.npmjs.org/lodash",
      expect.objectContaining({ timeout: 5000 })
    );
    expect(result).toEqual({
      name: "lodash",
      exists: true,
      latestVersion: "9.0.0",
      license: "MIT",
      description: "A utilitys library",
    });
  });

  it("returns exists: false when registry responds with 404", async () => {
    const mockResponse = { ok: false, status: 404 };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await checkNpmPackage("nonexistent-pkg-12345");

    expect(result).toEqual({ name: "nonexistent-pkg-12345", exists: false });
  });

  it("returns exists: false when fetch throws", async () => {
    mockedFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await checkNpmPackage("some-package");

    expect(result).toEqual({ name: "some-package", exists: false });
  });

  it("returns license from versions array when dist-tags latest points to a version", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        "dist-tags": { latest: "9.0.0" },
        license: undefined,
        versions: {
          "9.0.0": { license: "Apache-2.0" },
        },
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await checkNpmPackage("test-pkg");

    expect(result.license).toBe("Apache-2.0");
  });

  it("defaults license to undefined when neither dist-tags nor versions have it", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        "dist-tags": { latest: "1.0.0" },
        versions: { "1.0.0": {} },
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await checkNpmPackage("no-license-pkg");

    expect(result.license).toBeUndefined();
  });
});

describe("checkPypiPackage", () => {
  it("returns exists: true with package details when PyPI responds 200", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        info: {
          version: "8.3.0",
          license: "BSD-3-Clause",
          summary: "A test package",
        },
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await checkPypiPackage("requests");

    expect(result).toEqual({
      name: "requests",
      exists: true,
      latestVersion: "8.3.0",
      license: "BSD-3-Clause",
      description: "A test package",
    });
  });

  it("returns exists: false when PyPI responds with 404", async () => {
    const mockResponse = { ok: false, status: 404 };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await checkPypiPackage("definitely-not-a-real-package-xyz");

    expect(result).toEqual({ name: "definitely-not-a-real-package-xyz", exists: false });
  });

  it("returns exists: false when fetch throws", async () => {
    mockedFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await checkPypiPackage("some-package");

    expect(result).toEqual({ name: "some-package", exists: false });
  });

  it("uses empty string for summary when no description provided", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        info: {
          version: "1.0.0",
          license: "MIT",
          summary: "",
        },
      }),
    };

    mockedFetch.mockResolvedValueOnce(mockResponse);
    const result = await checkPypiPackage("empty-summary-pkg");

    expect(result.description).toBe("");
  });
});

describe("checkPackage", () => {
  it("dispatches to npm for ecosystem 'npm'", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const result = await checkPackage("lodash", "npm");
    expect(mockedFetch).toHaveBeenCalledWith(
      "https://registry.npmjs.org/lodash",
      expect.anything()
    );
    expect(result.exists).toBe(true);
  });

  it("dispatches to PyPI for ecosystem 'pypi'", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const result = await checkPackage("requests", "pypi");
    expect(mockedFetch).toHaveBeenCalledWith(
      "https://pypi.org/pypi/requests/json",
      expect.anything()
    );
    expect(result.exists).toBe(true);
  });
});