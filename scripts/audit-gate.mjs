#!/usr/bin/env node
//
// `npm audit` as a CI gate, with an expiring allowlist.
//
// A bare `npm audit` is useless as a gate: it is red the moment any upstream
// advisory lands, so teams set `--audit-level` so high it catches nothing, or
// they stop looking. This blocks on every high/critical advisory in the
// *production* dependency tree except the ones explicitly accepted in
// .github/audit-allowlist.json — and each acceptance carries an expiry date,
// so an ignored advisory comes back as a CI failure instead of quietly
// becoming permanent.
//
// Usage:
//   node scripts/audit-gate.mjs            # gate: production deps, exit 1 on failure
//   node scripts/audit-gate.mjs --report   # full tree incl. devDependencies, never fails
//
// No dependencies, deliberately: a security gate that needs its own supply
// chain to run is a worse gate.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWLIST_PATH = resolve(REPO_ROOT, ".github/audit-allowlist.json");
const BLOCKING_SEVERITIES = new Set(["high", "critical"]);

const reportOnly = process.argv.includes("--report");

function runAudit(productionOnly) {
  const args = ["audit", "--json"];
  if (productionOnly) args.push("--omit=dev");
  try {
    // npm exits non-zero whenever it finds anything, so the useful JSON
    // arrives on the error path far more often than the success path.
    return JSON.parse(execFileSync("npm", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  } catch (err) {
    if (err.stdout) return JSON.parse(err.stdout);
    throw err;
  }
}

/** Flattens npm's nested `via` graph into one advisory per GHSA id. */
function collectAdvisories(report) {
  const found = new Map();
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via === "string") continue; // a transitive edge, not an advisory
      const ghsa = (via.url ?? "").split("/").pop() || `npm-${via.source}`;
      if (!found.has(ghsa)) {
        found.set(ghsa, { ghsa, package: via.name, severity: via.severity, title: via.title, url: via.url });
      }
    }
  }
  return [...found.values()];
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return { entries: new Map(), expired: [] };

  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const entries = new Map();
  const expired = [];

  for (const entry of raw.advisories ?? []) {
    if (!entry.ghsa || !entry.reason || !entry.expires) {
      throw new Error(`audit-allowlist.json: every entry needs "ghsa", "reason" and "expires" — got ${JSON.stringify(entry)}`);
    }
    if (entry.expires < today) expired.push(entry);
    else entries.set(entry.ghsa, entry);
  }
  return { entries, expired };
}

function severityRank(s) {
  return ["critical", "high", "moderate", "low", "info"].indexOf(s);
}

if (reportOnly) {
  const advisories = collectAdvisories(runAudit(false)).sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  console.log(`Full dependency audit (including devDependencies): ${advisories.length} advisories\n`);
  for (const a of advisories) {
    console.log(`  ${a.severity.padEnd(8)} ${a.package} — ${a.title}\n           ${a.url}`);
  }
  console.log("\nReport only — devDependency advisories do not reach the deployed app and never fail this job.");
  process.exit(0);
}

const { entries: allowlist, expired } = loadAllowlist();
const advisories = collectAdvisories(runAudit(true));
const blocking = advisories.filter((a) => BLOCKING_SEVERITIES.has(a.severity));

const unaccepted = blocking.filter((a) => !allowlist.has(a.ghsa));
const accepted = blocking.filter((a) => allowlist.has(a.ghsa));

console.log(`Production dependency audit: ${advisories.length} advisories, ${blocking.length} at high/critical\n`);

if (accepted.length) {
  console.log("Accepted (tracked in .github/audit-allowlist.json):");
  for (const a of accepted) {
    const entry = allowlist.get(a.ghsa);
    console.log(`  ${a.severity.padEnd(8)} ${a.package} ${a.ghsa} — expires ${entry.expires}`);
    console.log(`           ${entry.reason}`);
  }
  console.log("");
}

let failed = false;

if (expired.length) {
  failed = true;
  console.log("Allowlist entries have EXPIRED — re-assess them, then fix the advisory or extend the expiry:");
  for (const entry of expired) {
    console.log(`  ${entry.ghsa} (${entry.package ?? "?"}) expired ${entry.expires} — ${entry.reason}`);
  }
  console.log("");
}

if (unaccepted.length) {
  failed = true;
  console.log("BLOCKING — new high/critical advisories in the production dependency tree:");
  for (const a of unaccepted.sort((x, y) => severityRank(x.severity) - severityRank(y.severity))) {
    console.log(`  ${a.severity.padEnd(8)} ${a.package} ${a.ghsa}`);
    console.log(`           ${a.title}`);
    console.log(`           ${a.url}`);
  }
  console.log(
    "\nFix with `npm audit fix` where a non-breaking fix exists. If this genuinely cannot be" +
      "\nfixed now, add it to .github/audit-allowlist.json with a reason and an expiry date."
  );
}

if (failed) process.exit(1);
console.log("No unaccepted high/critical advisories in the production dependency tree.");
