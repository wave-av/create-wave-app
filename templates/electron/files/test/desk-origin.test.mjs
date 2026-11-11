// desk-origin.test.mjs — allowlist for the loopback desk URL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isDeskUrl } = require("../desk-origin.js");

const PORT = 7727;
const DESK = `http://127.0.0.1:${PORT}/`;

test("admits the loopback desk URL and in-origin paths", () => {
  assert.equal(isDeskUrl(DESK, PORT), true);
  assert.equal(isDeskUrl(`http://127.0.0.1:${PORT}/api/state`, PORT), true);
  assert.equal(isDeskUrl(`http://127.0.0.1:${PORT}`, PORT), true);
});

test("refuses other origins, schemes, ports, and userinfo", () => {
  const attacks = [
    "https://evil.example/",
    "https://127.0.0.1:7727/",
    "http://localhost:7727/",
    "http://127.0.0.1:80/",
    "http://127.0.0.1:7728/",
    "http://127.0.0.1.evil.example/",
    "http://evil.example/",
    "http://[::1]:7727/",
    "file:///etc/passwd",
    "data:text/html,pwn",
    "javascript:alert(1)",
    "http://user@127.0.0.1:7727/",
    "http://127.0.0.1:7727@",
    "",
    "not a url",
  ];
  for (const url of attacks) {
    assert.equal(isDeskUrl(url, PORT), false, url);
  }
});
