# LinkedIn Post Template for DevSentinel 🚀

Copy and paste this directly to LinkedIn! Attach the screenshots you took (`demo_fake_package.png`, `demo_axios.png`, `demo_moment_cve.png`).

---

🚀 Proud to share my first VS Code extension: **DevSentinel** — an AI Code Hallucination & Dependency Security Proxy! 🛡️

As a 1st-year B.Tech Computer Science student (just 2 months into college!), I've been fascinated by how AI tools like Copilot and ChatGPT have changed software development. But there's a growing security risk: **AI hallucinating non-existent package names** and developers unwittingly importing them. Threat actors now exploit this attack vector through **slopsquatting** (registering hallucinated names with malicious code).

To solve this, I built **DevSentinel** directly into VS Code.

### 💡 What does DevSentinel do?
✅ **Real-Time Import Scanning**: Continuously scans JS, TS, and Python imports as you code.
✅ **Hallucination & Slopsquatting Detection**: Instantly flags non-existent npm/PyPI packages with red underlines (`Risk: 100/100`).
✅ **NVD CVE Lookups**: Queries the NIST National Vulnerability Database API in real-time to compute CVSS-based vulnerability risk scores.
✅ **License Compliance Check**: Validates package licenses against an allowable license whitelist.
✅ **Zero-friction Hover Tooltips**: Hover over any dependency to see its risk score, CVE list, and latest verified version.

### 🛠️ Built with:
- **TypeScript** & **VS Code Extension API**
- **NIST NVD REST API v2.0**
- **npm & PyPI JSON APIs**
- **Jest** (85 unit tests, 97% parser code coverage)
- **ESLint** & **vsce**

🔗 **VS Code Marketplace**: https://marketplace.visualstudio.com/items?itemName=prateek-0dev.devsentinel
💻 **GitHub Repository**: https://github.com/Prateek10465/devsentinel

A huge thanks to the open-source community. I’d love for you to try it out, leave feedback, or star the repo! Any suggestions for v0.2.0? 👇

#VSCode #CyberSecurity #OpenSource #TypeScript #AI #SoftwareEngineering #Python #FirstProject #BTech #DevSecOps
