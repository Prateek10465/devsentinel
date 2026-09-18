import * as vscode from "vscode";
import { parseImports, ImportInfo } from "./packageParser";
import { checkPackage } from "./registryClient";
import { fetchCvesForPackage } from "./nvdClient";
import { checkLicenseCompliance } from "./licenseChecker";
import { PackageInfo } from "./types";

export const SUPPORTED_LANGUAGES = [
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
  "python",
];

let diagnosticCollection: vscode.DiagnosticCollection;
let hoverProvider: vscode.Disposable | undefined;
let enableRealTime = true;
let nvdApiKey = "";
let allowedLicenses: string[] = [];

export const CACHE = new Map<string, PackageInfo>();
const DEBOUNCE_MS = 600;
let pendingTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection("devsentinel");

  hoverProvider = vscode.languages.registerHoverProvider(
    SUPPORTED_LANGUAGES.map((language) => ({ language })),
    { provideHover }
  );

  const scanCmd = vscode.commands.registerCommand("devsentinel.scanDocument", scanActiveDocument);
  const toggleCmd = vscode.commands.registerCommand("devsentinel.toggleEnablement", toggleEnablement);

  const cfg = vscode.workspace.getConfiguration("devsentinel");
  nvdApiKey = cfg.get<string>("nvdApiKey", "");
  allowedLicenses = cfg.get<string[]>("allowedLicenses", [
    "MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "0BSD", "CC0-1.0",
  ]);
  enableRealTime = cfg.get<boolean>("enableRealTimeScan", true);

  const docChangeListener = vscode.workspace.onDidChangeTextDocument((e) => {
    if (!enableRealTime) {
      return;
    }
    if (pendingTimer) {
      clearTimeout(pendingTimer);
    }
    pendingTimer = setTimeout(() => scanDocument(e.document), DEBOUNCE_MS);
  });

  const openListener = vscode.workspace.onDidOpenTextDocument((doc) => {
    if (enableRealTime) {
      scanDocument(doc);
    }
  });

  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("devsentinel")) {
      const updatedCfg = vscode.workspace.getConfiguration("devsentinel");
      nvdApiKey = updatedCfg.get<string>("nvdApiKey", "");
      allowedLicenses = updatedCfg.get<string[]>("allowedLicenses", [
        "MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "0BSD", "CC0-1.0",
      ]);
      enableRealTime = updatedCfg.get<boolean>("enableRealTimeScan", true);
      CACHE.clear();
      if (vscode.window.activeTextEditor) {
        scanDocument(vscode.window.activeTextEditor.document);
      }
    }
  });

  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && enableRealTime) {
      scanDocument(editor.document);
    }
  });

  context.subscriptions.push(
    diagnosticCollection,
    hoverProvider,
    scanCmd,
    toggleCmd,
    docChangeListener,
    openListener,
    configListener,
    activeEditorListener
  );

  // Scan active document on startup
  if (vscode.window.activeTextEditor) {
    scanDocument(vscode.window.activeTextEditor.document);
  }
}

export async function scanDocument(doc: vscode.TextDocument) {
  if (!SUPPORTED_LANGUAGES.includes(doc.languageId)) {
    diagnosticCollection.delete(doc.uri);
    return;
  }

  const imports = parseImports(doc.getText(), doc.languageId);
  if (imports.length === 0) {
    diagnosticCollection.delete(doc.uri);
    return;
  }

  const diagnostics = new Map<string, vscode.Diagnostic>();

  for (const imp of imports) {
    const lineIndex = imp.line - 1;
    if (lineIndex < 0 || lineIndex >= doc.lineCount) {
      continue;
    }
    const cacheKey = `${imp.ecosystem}:${imp.name}`;
    let info = CACHE.get(cacheKey);
    if (!info) {
      info = await resolvePackageInfo(imp);
      CACHE.set(cacheKey, info);
    }
    if (info.severity !== "safe") {
      const range = doc.lineAt(lineIndex).range;
      const diag = new vscode.Diagnostic(range, info.message, severityToDiagnosticSeverity(info.severity));
      diag.code = info.severity === "danger" ? "security" : "warning";
      diag.source = "DevSentinel";
      diagnostics.set(`${imp.line}:${imp.name}`, diag);
    }
  }

  diagnosticCollection.set(doc.uri, [...diagnostics.values()]);
}

export async function resolvePackageInfo(imp: ImportInfo): Promise<PackageInfo> {
  const reg = await checkPackage(imp.name, imp.ecosystem);
  const cves = reg.exists ? await fetchCvesForPackage(imp.name, nvdApiKey, 5) : [];
  const cveCount = cves.length;
  const maxCvss = cves.length > 0 ? Math.max(...cves.map((c) => c.cvssScore)) : 0;

  // Build base info
  let severity: PackageInfo["severity"] = "safe";
  let message = `${imp.name} — safe (no known CVEs)`;
  let riskScore = 0;
  let licenseOk = true;

  if (!reg.exists) {
    severity = "danger";
    message = `⚠️ '${imp.name}' does not exist in ${imp.ecosystem} registry — possible hallucination / slopsquatting`;
    riskScore = 100;
  } else {
    licenseOk = checkLicenseCompliance(
      { ...reg, ecosystem: imp.ecosystem, name: imp.name, cveCount, cveList: cves, riskScore: 0, severity: "safe", message: "" },
      allowedLicenses
    );
    if (!licenseOk) {
      severity = "warning";
      message = `⚠️ '${imp.name}': License "${reg.license}" may not be compliant`;
      riskScore = 50;
    }
    if (cveCount > 0) {
      severity = "danger";
      message = `${imp.name} has ${cveCount} CVE(s) (max CVSS ${maxCvss.toFixed(1)}): ${cves.map((c) => c.id).join(", ")}`;
      riskScore = Math.min(100, Math.round(maxCvss * 10));
    } else if (licenseOk) {
      message = `${imp.name} — safe (no known CVEs)`;
    }
  }

  return {
    name: imp.name,
    ecosystem: imp.ecosystem,
    exists: reg.exists,
    latestVersion: reg.latestVersion,
    license: reg.license,
    licenseCompliant: licenseOk,
    cveCount,
    cveList: cves,
    riskScore,
    severity,
    message,
  };
}

export function severityToDiagnosticSeverity(s: string): vscode.DiagnosticSeverity {
  switch (s) {
    case "danger":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

export async function provideHover(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.Hover | undefined> {
  if (pos.line < 0 || pos.line >= doc.lineCount) {
    return undefined;
  }
  const line = doc.lineAt(pos.line).text;
  const imports = parseImports(doc.getText(), doc.languageId);
  const lineImports = imports.filter((i) => i.line === pos.line + 1);
  if (lineImports.length === 0) {
    return undefined;
  }

  let hit = lineImports.find((i) => {
    const col = line.indexOf(i.name);
    return col !== -1 && pos.character >= col && pos.character <= col + i.name.length;
  });
  if (!hit) {
    hit = lineImports[0];
  }

  const cacheKey = `${hit.ecosystem}:${hit.name}`;
  let info = CACHE.get(cacheKey);
  if (!info) {
    info = await resolvePackageInfo(hit);
    CACHE.set(cacheKey, info);
  }

  const md = new vscode.MarkdownString();
  md.appendMarkdown(`### DevSentinel: ${info.name}\n`);
  md.appendMarkdown(`- **Exists:** ${info.exists ? "✅" : "❌"}\n`);
  md.appendMarkdown(`- **Risk Score:** ${info.riskScore}/100\n`);
  md.appendMarkdown(`- **CVEs:** ${info.cveCount}\n`);
  if (info.cveList.length > 0) {
    md.appendMarkdown(`- **Top CVE:** ${info.cveList[0].id} (CVSS ${info.cveList[0].cvssScore})\n`);
  }
  md.appendMarkdown(`- **License:** ${info.license ?? "unknown"}\n`);
  md.appendMarkdown(`- **Latest:** ${info.latestVersion ?? "N/A"}\n`);
  md.isTrusted = true;
  return new vscode.Hover(md, doc.lineAt(pos.line).range);
}

export function scanActiveDocument() {
  if (vscode.window.activeTextEditor) {
    scanDocument(vscode.window.activeTextEditor.document);
  }
}

export function toggleEnablement(): boolean {
  enableRealTime = !enableRealTime;
  vscode.window.showInformationMessage(`DevSentinel ${enableRealTime ? "enabled" : "disabled"}`);
  return enableRealTime;
}

export function getDiagnosticCollection(): vscode.DiagnosticCollection {
  return diagnosticCollection;
}

export function deactivate() {
  diagnosticCollection?.dispose();
  hoverProvider?.dispose();
}
