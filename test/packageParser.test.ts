import { parseImports, ImportInfo } from "../src/packageParser";

describe("parseImports", () => {
  describe("JavaScript / TypeScript", () => {
    it("extracts ES module imports", () => {
      const result = parseImports(`
        import React from "react";
        import { readFile } from 'fs';
        import defaultExport from "@scope/pkg";
      `, "javascript");

      expect(result.map((i) => [i.name, i.line])).toEqual([
        ["react", 2],
        ["fs", 3],
        ["@scope/pkg", 4],
      ]);
    });

    it("extracts CommonJS require calls", () => {
      const result = parseImports(`
        const lodash = require("lodash");
        const axios = require('axios');
        const express = require("@nestjs/core");
      `, "typescript");

      expect(result.map((i) => i.name)).toEqual(["lodash", "axios", "@nestjs/core"]);
    });

    it("extracts dynamic imports", () => {
      const result = parseImports(`
        const mod = import("webpack");
        const lazy = import('react-dom');
      `, "javascript");

      expect(result.map((i) => i.name)).toEqual(["webpack", "react-dom"]);
    });

    it("handles multiple imports on the same line", () => {
      const result = parseImports(
        `import { a } from "left-pad"; const b = require("chalk");`,
        "javascript"
      );

      expect(result.map((i) => i.name)).toEqual(["left-pad", "chalk"]);
    });

    it("extracts package names from subpath imports", () => {
      const result = parseImports(`
        import { something } from "lodash/fp";
        const mod = require("@babel/core/parser");
      `, "javascript");

      expect(result.map((i) => i.name)).toEqual(["lodash", "@babel/core"]);
    });

    it("ignores relative and absolute paths", () => {
      const result = parseImports(`
        import { helper } from "./helper";
        const util = require("../util");
        const config = require("/absolute/path");
      `, "javascript");

      expect(result).toEqual([]);
    });

    it("ignores non-import statements containing the word import", () => {
      const result = parseImports(`
        const message = "import this is just text";
        function importSomething() {}
      `, "javascript");

      expect(result).toEqual([]);
    });
  });

  describe("Python", () => {
    it("extracts from import statements", () => {
      const result = parseImports(`
        import requests
        import numpy as np
        import pandas
      `, "python");

      expect(result.map((i) => [i.name, i.line])).toEqual([
        ["requests", 2],
        ["numpy", 3],
        ["pandas", 4],
      ]);
    });

    it("extracts from from-import statements", () => {
      const result = parseImports(`
        from flask import Flask
        from django.http import HttpResponse
        from requests.auth import HTTPBasicAuth
      `, "python");

      expect(result.map((i) => i.name)).toEqual(["flask", "django", "requests"]);
    });

    it("handles dotted imports by using the top-level package", () => {
      const result = parseImports(`
        import scipy.optimize
        from PIL import Image
      `, "python");

      expect(result.map((i) => i.name)).toEqual(["scipy", "PIL"]);
    });

    it("ignores non-import statements", () => {
      const result = parseImports(`
        # import this is a comment
        def import_something():
            pass
      `, "python");

      expect(result).toEqual([]);
    });
  });

  describe("mixed documents", () => {
    it("uses the correct parser based on languageId", () => {
      const jsResult = parseImports(`import lodash from "lodash";`, "javascript");
      const pyResult = parseImports(`import requests`, "python");

      expect(jsResult).toEqual([
        expect.objectContaining({ name: "lodash", ecosystem: "npm" }),
      ]);
      expect(pyResult).toEqual([
        expect.objectContaining({ name: "requests", ecosystem: "pypi" }),
      ]);
    });

    it("defaults to JavaScript parsing for unknown languages", () => {
      const result = parseImports(`import chalk from "chalk";`, "plaintext");

      expect(result).toEqual([
        expect.objectContaining({ name: "chalk", ecosystem: "npm" }),
      ]);
    });
  });
});