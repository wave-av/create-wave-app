// scratch-server.mjs — dist-proof helper (dev only, never packaged).
// Serves a minimal __APP_NAME__ desk page on an EPHEMERAL loopback port and
// prints one JSON line {url, port} to stdout. Never binds :__PORT__: the
// live desk service is untouched. Implements just enough of the desk
// contract for smoke assertions: GET /api/state -> 200 and a <title> that
// carries the product name.
import http from "node:http";

const APP = "__APP_NAME__";
const LIVE_PORT = Number("__PORT__");

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/api/state") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, app: APP, scratch: true }));
    return;
  }
  res.writeHead(200, { "content-type": "text/html" });
  res.end(`<!doctype html><html><head><title>${APP} — WAVE OS</title></head><body><h1>${APP} (scratch)</h1></body></html>`);
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const { port } = server.address();
if (port === LIVE_PORT) {
  console.error("refusing to serve on live :" + LIVE_PORT);
  process.exit(2);
}
console.log(JSON.stringify({ url: `http://127.0.0.1:${port}/`, port }));
setInterval(() => {}, 1 << 30);
