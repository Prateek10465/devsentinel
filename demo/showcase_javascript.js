// ============================================================================
// DevSentinel Showcase: JavaScript & TypeScript Import Scanner
// ============================================================================

// 1. POPULAR / SAFE PACKAGES
import express from "express";
import dotenv from "dotenv";

// 2. PACKAGES WITH CVEs / HIGH RISK SCORES (Hover to see Risk Score & CVEs!)
import lodash from "lodash";          // Has known Prototype Pollution CVEs
import moment from "moment";          // Flagged for ReDoS / path traversal
import axios from "axios";            // Known SSRF vulnerabilities

// 3. AI HALLUCINATION / SLOPSQUATTING (Will show Red Underlines / Error!)
import { secureAuth } from "react-super-fast-auth-guard"; 
import { parseAI } from "ai-magic-data-parser-v2";

// 4. COMMONJS REQUIRE SYNTAX
const jsonwebtoken = require("jsonwebtoken");
const cryptoHelper = require("non-existent-crypto-lib-xyz");

console.log("DevSentinel Active");
