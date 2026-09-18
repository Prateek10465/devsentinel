/**
 * Parses JavaScript/TypeScript and Python files to extract imported package names.
 * Handles ES imports, CommonJS requires, and Python imports.
 */

export type ImportInfo = { name: string; ecosystem: "npm" | "pypi"; line: number; raw: string };

const JS_IMPORT_RE = /\bimport(?:\s+type)?(?:\s+[^;="'()]+\s+from\s*|\s+)["']([^'"\s;]+)["']/g;
const CJS_RE = /\brequire\(\s*["']([^'"\s;]+)["']\s*\)/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*["']([^'"\s;]+)["']\s*\)/g;
const PY_IMPORT_RE = /^[ \t]*(?:from|import)\s+([a-zA-Z0-9_.]+)/gm;

/**
 * Extract package names from a document's text.
 */
export function parseImports(text: string, languageId: string): ImportInfo[] {
  if (languageId === "python") {
    return parsePythonImports(text);
  }
  return parseJsImports(text);
}

function parseJsImports(text: string): ImportInfo[] {
  const results: ImportInfo[] = [];
  let m: RegExpExecArray | null;

  JS_IMPORT_RE.lastIndex = 0;
  while ((m = JS_IMPORT_RE.exec(text))) {
    const name = extractPackageName(m[1]);
    if (name) {
      results.push({ name, ecosystem: "npm", line: lineAt(text, m.index), raw: m[0] });
    }
  }

  CJS_RE.lastIndex = 0;
  while ((m = CJS_RE.exec(text))) {
    const name = extractPackageName(m[1]);
    if (name) {
      results.push({ name, ecosystem: "npm", line: lineAt(text, m.index), raw: m[0] });
    }
  }

  DYNAMIC_IMPORT_RE.lastIndex = 0;
  while ((m = DYNAMIC_IMPORT_RE.exec(text))) {
    const name = extractPackageName(m[1]);
    if (name) {
      results.push({ name, ecosystem: "npm", line: lineAt(text, m.index), raw: m[0] });
    }
  }

  results.sort((a, b) => a.line - b.line);
  return results;
}

function parsePythonImports(text: string): ImportInfo[] {
  const results: ImportInfo[] = [];
  let m: RegExpExecArray | null;

  PY_IMPORT_RE.lastIndex = 0;
  while ((m = PY_IMPORT_RE.exec(text))) {
    const raw = m[1];
    const name = raw.split(".")[0];
    results.push({ name, ecosystem: "pypi", line: lineAt(text, m.index), raw: m[0] });
  }

  results.sort((a, b) => a.line - b.line);
  return results;
}

/**
 * Convert a bare package spec to its base name (e.g. "lodash.get@4.4.2" -> "lodash.get",
 * "@scope/pkg" stays as-is, "pkg/sub" -> "pkg").
 */
function extractPackageName(spec: string): string | null {
  spec = spec.trim();
  // Skip relative and absolute paths
  if (spec.startsWith(".") || spec.startsWith("/")) {
    return null;
  }

  // Scoped packages: @scope/pkg@1.0.0/sub -> @scope/pkg
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    if (parts.length < 2) {
      return null;
    }
    const scope = parts[0];
    const rest = parts[1].split(/[@~^>=<]/)[0];
    return rest ? `${scope}/${rest}` : null;
  }

  // Remove version specifier: lodash@4.4.2, lodash@^4, etc.
  const withoutVersion = spec.split(/[@~^>=<]/)[0];
  // Path-based: pkg/sub -> pkg
  return withoutVersion.split("/")[0] || null;
}

function lineAt(text: string, offset: number): number {
  return text.slice(0, offset).split("\n").length;
}
