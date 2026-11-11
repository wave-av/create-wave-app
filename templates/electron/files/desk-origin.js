// desk-origin.js — allowlist for the loopback desk URL.
//
// The shell may load and talk to only http://127.0.0.1:<port>/… with no
// userinfo. Anything else (https, DNS, IPv6 localhost, file:, a port
// mismatch) is not the desk service this window was built to host.
function isDeskUrl(urlString, port) {
  let parsed;
  try {
    parsed = new URL(String(urlString));
  } catch {
    return false;
  }
  return (
    parsed.protocol === "http:" &&
    parsed.hostname === "127.0.0.1" &&
    parsed.port === String(port) &&
    parsed.username === "" &&
    parsed.password === ""
  );
}

module.exports = { isDeskUrl };
