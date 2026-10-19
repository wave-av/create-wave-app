// rollout-guard.test.mjs — unit tests for the staged-rollout gate.
// Zero deps; `npm test`. Cohort math is pure; fetch paths run against a
// loopback stub server (never the real feed).
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const guard = require("../rollout-guard.js");

test("cohort is stable: same machine+version always lands in the same bucket", () => {
  const a = guard.cohort("machine-1", "1.2.3");
  assert.equal(guard.cohort("machine-1", "1.2.3"), a);
  assert.ok(a >= 0 && a < guard.BUCKETS);
});

test("cohort differs across versions for the same machine (most of the time)", () => {
  // A rollout pin change must reshuffle; assert at least one of several
  // versions lands elsewhere (hash collision on all five is ~1e-15).
  const buckets = new Set(["1.0.0", "1.0.1", "1.1.0", "2.0.0", "2.0.1"].map((v) => guard.cohort("m", v)));
  assert.ok(buckets.size > 1, "version change reshuffles the cohort");
});

test("inRollout honors the fraction boundaries", () => {
  assert.equal(guard.inRollout("m", "1.0.0", 0), false);
  assert.equal(guard.inRollout("m", "1.0.0", -1), false);
  assert.equal(guard.inRollout("m", "1.0.0", Number.NaN), false);
  assert.equal(guard.inRollout("m", "1.0.0", 1), true);
  assert.equal(guard.inRollout("m", "1.0.0", 2), true);
});

test("inRollout admits roughly the fraction over many machines", () => {
  let hits = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) if (guard.inRollout(`machine-${i}`, "9.9.9", 0.25)) hits++;
  const rate = hits / N;
  assert.ok(rate > 0.2 && rate < 0.3, `25% rollout admitted ${(rate * 100).toFixed(1)}%`);
});

function stubServer(manifest, status = 200) {
  const server = http.createServer((_req, res) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(typeof manifest === "string" ? manifest : JSON.stringify(manifest));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

test("rolloutAllows admits cohort members when the manifest pins their version", async () => {
  const { server, url } = await stubServer({ version: "1.2.3", rollout: 1 });
  try {
    const r = await guard.rolloutAllows({ feedUrl: url, version: "1.2.3", machineId: "any" });
    assert.equal(r.allowed, true);
    assert.equal(r.reason, "in-rollout-cohort");
  } finally {
    server.close();
  }
});

test("rolloutAllows defers non-cohort members (fail-closed)", async () => {
  const { server, url } = await stubServer({ version: "1.2.3", rollout: 0 });
  try {
    const r = await guard.rolloutAllows({ feedUrl: url, version: "1.2.3", machineId: "any" });
    assert.equal(r.allowed, false);
    assert.equal(r.reason, "deferred-by-rollout");
  } finally {
    server.close();
  }
});

test("rolloutAllows refuses versions the manifest does not pin", async () => {
  const { server, url } = await stubServer({ version: "1.2.3", rollout: 1 });
  try {
    const r = await guard.rolloutAllows({ feedUrl: url, version: "9.9.9", machineId: "any" });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /version-not-in-rollout/);
  } finally {
    server.close();
  }
});

test("rolloutAllows fails closed when the feed is unreachable", async () => {
  const r = await guard.rolloutAllows({
    feedUrl: "http://127.0.0.1:1/",
    version: "1.2.3",
    machineId: "any",
  });
  assert.equal(r.allowed, false);
  assert.match(r.reason, /no-rollout-manifest/);
});

test("rolloutAllows fails closed on manifest HTTP errors", async () => {
  const { server, url } = await stubServer({ error: true }, 500);
  try {
    const r = await guard.rolloutAllows({ feedUrl: url, version: "1.2.3", machineId: "any" });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /no-rollout-manifest/);
  } finally {
    server.close();
  }
});
