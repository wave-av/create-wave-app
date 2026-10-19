// rollout-guard.js — staged-rollout gate for auto-updates. Pure logic, zero
// Electron imports, so it unit-tests under plain node (see test/).
//
// Flow: updater.js finds version V on the feed, then calls rolloutAllows().
// The feed serves rollout.json {version, rollout} next to latest-mac.yml:
// version pins which release is rolling out, rollout is the fraction
// (0..1) of machines that may take it. Cohort membership is a stable hash
// of (machineId, version), so a machine in the cohort stays in until the
// rollout version changes. Any failure (no manifest, wrong version, fetch
// error) fails CLOSED: no update.
const { createHash } = require("node:crypto");
const os = require("node:os");

const BUCKETS = 1000;

function cohort(machineId, version) {
  const hex = createHash("sha256").update(`${machineId}@${version}`).digest("hex").slice(0, 8);
  return parseInt(hex, 16) % BUCKETS;
}

function inRollout(machineId, version, fraction) {
  const f = Number(fraction);
  if (!Number.isFinite(f) || f <= 0) return false;
  if (f >= 1) return true;
  return cohort(machineId, version) < Math.floor(f * BUCKETS);
}

function defaultMachineId() {
  return createHash("sha256").update(`${os.hostname()}@${os.homedir()}`).digest("hex").slice(0, 32);
}

async function fetchRollout(feedUrl, fetchImpl = fetch) {
  const base = String(feedUrl).replace(/\/+$/, "");
  const res = await fetchImpl(`${base}/rollout.json`, { redirect: "follow" });
  if (!res.ok) throw new Error(`rollout manifest HTTP ${res.status}`);
  const body = await res.json();
  return { version: String(body.version || ""), rollout: Number(body.rollout) };
}

// Returns {allowed, reason, version?, rollout?}. Never throws for feed
// problems — those become allowed:false with a reason.
async function rolloutAllows({ feedUrl, version, machineId = defaultMachineId(), fetchImpl = fetch }) {
  let manifest;
  try {
    manifest = await fetchRollout(feedUrl, fetchImpl);
  } catch (err) {
    return { allowed: false, reason: `no-rollout-manifest: ${err.message}` };
  }
  if (!manifest.version) return { allowed: false, reason: "rollout-manifest-missing-version" };
  if (manifest.version !== String(version)) {
    return { allowed: false, reason: `version-not-in-rollout (manifest pins ${manifest.version})` };
  }
  if (!inRollout(machineId, manifest.version, manifest.rollout)) {
    return { allowed: false, reason: "deferred-by-rollout", version: manifest.version, rollout: manifest.rollout };
  }
  return { allowed: true, reason: "in-rollout-cohort", version: manifest.version, rollout: manifest.rollout };
}

module.exports = { BUCKETS, cohort, inRollout, defaultMachineId, fetchRollout, rolloutAllows };
