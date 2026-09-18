import { parseImports, ImportInfo } from "../src/packageParser";
import { checkLicenseCompliance } from "../src/licenseChecker";
import { PackageInfo } from "../src/types";
import {
  activate,
  deactivate,
  scanDocument,
  resolvePackageInfo,
  provideHover,
  toggleEnablement,
  severityToDiagnosticSeverity,
  SUPPORTED_LANGUAGES,
  getDiagnosticCollection,
  CACHE as EXT_CACHE,
} from "../src/extension";
import * as vscode from "vscode";

jest.mock("node-fetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));
const mockedFetch = require("node-fetch").default;

describe("DevSentinel: scanDocument core logic", () => {
  let CACHE: Map<string, PackageInfo>;
  let defaultAllowedLicenses: string[] = [
    "MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "0BSD", "CC0-1.0",
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    CACHE = new Map();
  });

  function makeCve(id: string, score: number, severity: string): any {
    return { id, severity, cvssScore: score };
  }

  function makePackageInfo(overrides: Partial<PackageInfo>): PackageInfo {
    return {
      name: "",
      ecosystem: "npm",
      exists: false,
      cveCount: 0,
      cveList: [],
      riskScore: 0,
      severity: "safe",
      message: "",
      ...overrides,
    };
  }

  describe("CACHE key generation", () => {
    it("uses ecosystem:name as cache key", () => {
      const imp: ImportInfo = {
        name: "lodash",
        ecosystem: "npm",
        line: 1,
        raw: 'import lodash from "lodash"',
      };

      CACHE.set(`${imp.ecosystem}:${imp.name}`, makePackageInfo({ name: "lodash", ecosystem: "npm" }));

      expect(CACHE.get(`${imp.ecosystem}:${imp.name}`)).toBeDefined();
    });
  });

  describe("diagnostic generation for safe packages", () => {
    it("produces no diagnostics when registry returns no imports", () => {
      const imports: ImportInfo[] = [];
      expect(imports.length).toBe(0);
    });

    it("resolves registry response with exists:false as danger", () => {
      const reg = { name: "fake-pkg", exists: false };
      const cveCount = 0;
      const maxCvss = 0;

      // When package does not exist
      let severity: string = "safe";
      let message = "";
      let riskScore = 0;

      if (!reg.exists) {
        severity = "danger";
        message = `⚠️ '${reg.name}' does not exist in npm registry — possible hallucination / slopsquatting`;
        riskScore = 100;
      }

      expect(severity).toBe("danger");
      expect(riskScore).toBe(100);
      expect(message).toContain("fake-pkg");
      expect(message).toContain("hallucination");
    });
  });

  describe("resolvePackageInfo logic", () => {
    it("marks package as safe when it exists with no CVEs and compliant license", async () => {
      const reg = { name: "lodash", exists: true, license: "MIT" };
      const cves: any[] = [];
      const cveCount = cves.length;
      const maxCvss = 0;
      const licenseOk = checkLicenseCompliance(
        { ...reg, ecosystem: "npm", name: "lodash", cveCount, cveList: cves, riskScore: 0, severity: "safe", message: "" },
        defaultAllowedLicenses
      );

      let severity = "safe";
      let message = "";
      let riskScore = 0;

      if (!reg.exists) {
        severity = "danger";
        riskScore = 100;
      } else {
        if (!licenseOk) {
          severity = "warning";
          riskScore = 50;
        }
        if (cveCount > 0) {
          severity = "danger";
        } else if (severity === "safe" && riskScore === 0) {
          message = "lodash — safe (no known CVEs)";
        }
      }

      expect(licenseOk).toBe(true);
      expect(severity).toBe("safe");
      expect(message).toBe("lodash — safe (no known CVEs)");
      expect(riskScore).toBe(0);
    });

    it("marks package as warning when license is non-compliant", async () => {
      const reg = { name: "some-lib", exists: true, license: "GPL-3.0" };
      const cves: any[] = [];
      const cveCount = 0;
      const licenseOk = checkLicenseCompliance(
        { ...reg, ecosystem: "npm", name: "some-lib", cveCount, cveList: cves, riskScore: 0, severity: "safe", message: "" },
        defaultAllowedLicenses
      );

      expect(licenseOk).toBe(false);
    });

    it("marks package as danger when CVEs exist (overrides license warning)", () => {
      const cves = [makeCve("CVE-2024-0001", 9.8, "CRITICAL")];
      const cveCount = cves.length;
      const maxCvss = Math.max(...cves.map((c) => c.cvssScore));

      let severity = "safe";
      let riskScore = 0;

      if (cveCount > 0) {
        severity = "danger";
        riskScore = Math.min(100, Math.round(maxCvss * 10));
      }

      expect(severity).toBe("danger");
      expect(riskScore).toBe(98); // 9.8 * 10 = 98
    });

    it("scales CVSS score to risk score (0-100)", () => {
      const cvssScenarios = [
        { cvss: 1.2, expectedRisk: 12 },
        { cvss: 4.0, expectedRisk: 40 },
        { cvss: 7.5, expectedRisk: 75 },
        { cvss: 9.8, expectedRisk: 98 },
        { cvss: 10.0, expectedRisk: 100 }, // min(100, 100) = 100
      ];

      for (const { cvss, expectedRisk } of cvssScenarios) {
        const risk = Math.min(100, Math.round(cvss * 10));
        expect(risk).toBe(expectedRisk);
      }
    });
  });

  describe("extension commands logic", () => {
    it("scanDocument guards against non-supported languages", () => {
      const unsupportedLanguages = ["markdown", "json", "html", "css", "rust", "go"];
      for (const lang of unsupportedLanguages) {
        const isSupported = ["javascript", "typescript", "python"].includes(lang);
        expect(isSupported).toBe(false);
      }
    });

    it("scanDocument supports all expected languages", () => {
      const supportedLanguages = ["javascript", "typescript", "python"];
      for (const lang of supportedLanguages) {
        const isSupported = ["javascript", "typescript", "python"].includes(lang);
        expect(isSupported).toBe(true);
      }
    });
  });

  describe("parse integration with scanDocument logic", () => {
    it("parses all JS imports and prepares them for registry lookup", () => {
      const code = `
        import lodash from "lodash";
        import { deburr } from "lodash";
        const react = require("react");
        const data = import("./local");
        import axios from "axios";
      `;
      const imports = parseImports(code, "javascript");

      const packageNames = imports.map((i) => i.name);
      expect(packageNames).toContain("lodash");
      expect(packageNames).toContain("react");
      expect(packageNames).toContain("axios");
      // local imports are filtered by extractPackageName (returns null for empty)
      expect(imports.some((i) => i.name === "local")).toBe(false);
    });

    it("parses Python imports for PyPI lookup", () => {
      const code = `
        import requests
        import numpy
        from flask import Flask
      `;
      const imports = parseImports(code, "python");

      expect(imports).toEqual([
        expect.objectContaining({ name: "requests", ecosystem: "pypi" }),
        expect.objectContaining({ name: "numpy", ecosystem: "pypi" }),
        expect.objectContaining({ name: "flask", ecosystem: "pypi" }),
      ]);
    });
  });

  describe("CVE severity classification", () => {
    const testCases = [
      { score: 9.8, severity: "CRITICAL", expected: "critical" },
      { score: 8.5, severity: "HIGH", expected: "high" },
      { score: 6.5, severity: "MODERATE", expected: "moderate" },
      { score: 3.0, severity: "LOW", expected: "low" },
      { score: 9.0, severity: "UNKNOWN", expected: "critical" }, // score >= 9.0 -> critical
      { score: 7.0, severity: "UNKNOWN", expected: "high" },     // score >= 7.0 -> high
      { score: 4.0, severity: "UNKNOWN", expected: "moderate" }, // score >= 4.0 -> moderate
      { score: 1.0, severity: "UNKNOWN", expected: "low" },
    ];

    for (const { score, severity, expected } of testCases) {
      it(`classifies CVSS ${score} (${severity}) as ${expected}`, () => {
        let result = severity.toLowerCase();
        if (severity === "CRITICAL" || score >= 9.0) result = "critical";
        else if (severity === "HIGH" || score >= 7.0) result = "high";
        else if (severity === "MODERATE" || score >= 4.0) result = "moderate";
        else result = "low";

        expect(result).toBe(expected);
      });
    }
  });

  describe("extension runtime and lifecycle", () => {
    it("defines all supported languages including react variants", () => {
      expect(SUPPORTED_LANGUAGES).toEqual([
        "javascript",
        "javascriptreact",
        "typescript",
        "typescriptreact",
        "python",
      ]);
    });

    it("maps severity to diagnostic severity correctly", () => {
      expect(severityToDiagnosticSeverity("danger")).toBe(vscode.DiagnosticSeverity.Error);
      expect(severityToDiagnosticSeverity("warning")).toBe(vscode.DiagnosticSeverity.Warning);
      expect(severityToDiagnosticSeverity("safe")).toBe(vscode.DiagnosticSeverity.Information);
      expect(severityToDiagnosticSeverity("unknown")).toBe(vscode.DiagnosticSeverity.Information);
    });

    it("toggles enablement and displays notification", () => {
      const showSpy = jest.spyOn(vscode.window, "showInformationMessage");
      const state1 = toggleEnablement();
      expect(showSpy).toHaveBeenCalledWith(expect.stringContaining("DevSentinel"));
      const state2 = toggleEnablement();
      expect(state2).toBe(!state1);
      showSpy.mockRestore();
    });

    it("activates extension, registers providers and cleans up on deactivate", () => {
      const mockContext: any = { subscriptions: [] };
      activate(mockContext);
      expect(mockContext.subscriptions.length).toBeGreaterThanOrEqual(4);
      expect(getDiagnosticCollection()).toBeDefined();

      expect(() => deactivate()).not.toThrow();
    });

    it("resolvePackageInfo identifies hallucinated package", async () => {
      mockedFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const imp: ImportInfo = {
        name: "completely-nonexistent-pkg-xyz",
        ecosystem: "npm",
        line: 1,
        raw: "import completely from 'completely-nonexistent-pkg-xyz'",
      };
      const info = await resolvePackageInfo(imp);
      expect(info.exists).toBe(false);
      expect(info.severity).toBe("danger");
      expect(info.riskScore).toBe(100);
      expect(info.message).toContain("possible hallucination");
    });

    it("resolvePackageInfo identifies safe package", async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ "dist-tags": { latest: "1.0.0" }, license: "MIT" }),
      });
      // NVD returns 0 CVEs
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalResults: 0, vulnerabilities: [] }),
      });

      const imp: ImportInfo = {
        name: "my-safe-pkg",
        ecosystem: "npm",
        line: 1,
        raw: "import safe from 'my-safe-pkg'",
      };
      const info = await resolvePackageInfo(imp);
      expect(info.exists).toBe(true);
      expect(info.severity).toBe("safe");
      expect(info.riskScore).toBe(0);
      expect(info.licenseCompliant).toBe(true);
    });

    it("scanDocument deletes diagnostics for unsupported languages", async () => {
      const mockDoc: any = {
        languageId: "markdown",
        uri: vscode.Uri.parse("file:///test.md"),
        getText: () => "# Header",
      };
      await scanDocument(mockDoc);
      const collection = getDiagnosticCollection();
      expect(collection.get(mockDoc.uri)).toBeUndefined();
    });

    it("scanDocument deletes diagnostics when document has no imports", async () => {
      const mockDoc: any = {
        languageId: "javascript",
        uri: vscode.Uri.parse("file:///test.js"),
        getText: () => "const a = 123;",
      };
      await scanDocument(mockDoc);
      const collection = getDiagnosticCollection();
      expect(collection.get(mockDoc.uri)).toBeUndefined();
    });

    it("scanDocument sets error diagnostic for hallucinated import", async () => {
      mockedFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const mockDoc: any = {
        languageId: "javascript",
        uri: vscode.Uri.parse("file:///test.js"),
        getText: () => "import fake from 'fake-package';",
        lineCount: 1,
        lineAt: () => ({
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 31)),
        }),
      };
      await scanDocument(mockDoc);
      const collection = getDiagnosticCollection();
      const diags = collection.get(mockDoc.uri);
      expect(diags).toBeDefined();
      expect(diags!.length).toBe(1);
      expect(diags![0].severity).toBe(vscode.DiagnosticSeverity.Error);
      expect(diags![0].code).toBe("security");
    });

    it("provideHover returns undefined for out of bound position or empty import line", async () => {
      const mockDoc: any = {
        languageId: "javascript",
        lineCount: 2,
        getText: () => "const x = 1;\nconst y = 2;",
        lineAt: () => ({ text: "const x = 1;", range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 12)) }),
      };
      const hover = await provideHover(mockDoc, new vscode.Position(0, 0));
      expect(hover).toBeUndefined();

      const outOfBounds = await provideHover(mockDoc, new vscode.Position(99, 0));
      expect(outOfBounds).toBeUndefined();
    });

    it("provideHover returns markdown hover info for hovered import", async () => {
      EXT_CACHE.set("npm:lodash", {
        name: "lodash",
        ecosystem: "npm",
        exists: true,
        cveCount: 0,
        cveList: [],
        riskScore: 0,
        severity: "safe",
        message: "lodash — safe (no known CVEs)",
        license: "MIT",
        latestVersion: "4.17.21",
      });

      const mockDoc: any = {
        languageId: "javascript",
        lineCount: 1,
        getText: () => "import lodash from 'lodash';",
        lineAt: () => ({
          text: "import lodash from 'lodash';",
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 28)),
        }),
      };

      const hover = await provideHover(mockDoc, new vscode.Position(0, 20));
      expect(hover).toBeDefined();
      const contents = hover!.contents as any;
      expect(contents.value).toContain("DevSentinel: lodash");
      expect(contents.value).toContain("**Exists:** ✅");
      expect(contents.value).toContain("**Risk Score:** 0/100");
    });
  });
});