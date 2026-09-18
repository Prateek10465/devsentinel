/**
 * Minimal mock of the `vscode` module for unit tests.
 * Only the symbols used by src/extension.ts are stubbed.
 */

export const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
};

export const DiagnosticTag = {
  Unnecessary: 1,
  Deprecated: 2,
};

export class Diagnostic {
  constructor(
    public range: any,
    public message: string,
    public severity?: number,
    public code?: any,
    public source?: string,
    public relatedInformation?: any[]
  ) {}
}

export class Range {
  constructor(
    public start: { line: number; character: number },
    public end: { line: number; character: number }
  ) {}
  static isRange(value: any): value is Range {
    return value instanceof Range;
  }
}

export class Position {
  constructor(public line: number, public character: number) {}
}

export class Hover {
  constructor(public contents: any, public range?: any) {}
}

export class MarkdownString {
  public value: string = "";
  public isTrusted: boolean | { supportHtml?: boolean } | undefined = undefined;
  public supportHtml?: boolean;

  appendMarkdown(value: string): MarkdownString {
    this.value += value;
    return this;
  }
  appendText(value: string): MarkdownString {
    this.value += value;
    return this;
  }
}

export class DiagnosticCollection {
  private _diags = new Map<string, Diagnostic[]>();
  set(uri: any, diagnostics: Diagnostic[] | undefined): void {
    if (diagnostics === undefined) {
      this._diags.delete(uri.toString());
    } else {
      this._diags.set(uri.toString(), diagnostics);
    }
  }
  get(uri: any): Diagnostic[] | undefined {
    return this._diags.get(uri.toString());
  }
  delete(uri: any): void {
    this._diags.delete(uri.toString());
  }
  clear(): void {
    this._diags.clear();
  }
  dispose(): void {}
  forEach(callback: (uri: any, diags: Diagnostic[]) => void): void {
    for (const [uri, diags] of this._diags) {
      callback(uri, diags);
    }
  }
  has(uri: any): boolean {
    return this._diags.has(uri.toString());
  }
  get size(): number {
    return this._diags.size;
  }
}

export const workspace = {
  getConfiguration: () => ({
    get: (key: string, def: any) => def,
  }),
  onDidChangeTextDocument: () => ({ dispose() {} }),
  onDidOpenTextDocument: () => ({ dispose() {} }),
  onDidChangeConfiguration: () => ({ dispose() {} }),
};

export const window = {
  activeTextEditor: undefined as any,
  showInformationMessage: async () => undefined,
  onDidChangeActiveTextEditor: () => ({ dispose() {} }),
};

export const languages = {
  createDiagnosticCollection: (name: string) => new DiagnosticCollection(),
  registerHoverProvider: () => ({ dispose() {} }),
};

export const commands = {
  registerCommand: () => ({ dispose() {} }),
};

export const Uri = {
  parse: (str: string) => ({ toString: () => str, fsPath: str }),
};

export enum ExtensionMode {
  Production = 1,
  Development = 2,
}