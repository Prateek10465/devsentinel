# ============================================================================
# DevSentinel Showcase: Python Import Scanner
# ============================================================================

# 1. POPULAR / SAFE PACKAGES
import flask
import numpy
from math import sqrt

# 2. PACKAGES WITH CVEs / HIGH RISK SCORES (Hover to see Risk Score & CVEs!)
import requests        # CVEs associated with header leak & cert issues
import cryptography    # Known security advisories
import paramiko        # SSH protocol security history
import urllib3         # Proxy / cookie security issues

# 3. AI HALLUCINATED / FAKE PACKAGES (Will show Red Underlines / Error!)
import super_easy_ai_fast_scraper_pro
from fake_ml_data_optimizer import FastModel

print("DevSentinel Python Scan Ready")
