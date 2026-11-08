/**
 * mitigated_server.js
 *
 * (d) Mitigation implemented: avoid the shell entirely by using
 *     execFile() with an argument vector instead of exec() with a
 *     concatenated string. execFile() calls the "ping" binary directly
 *     (no /bin/sh -c involved), so the "host" value is always passed
 *     as ONE literal argument and shell metacharacters in it are never
 *     interpreted.
 *
 * A light allow-list check on the input is also added as defence in
 * depth (see the theory paragraph on allow-list validation).
 *
 * Try the SAME exploit payload used against vulnerable_server.js:
 *     GET /ping?host=127.0.0.1;whoami
 * It will now fail safely (ping gets a malformed "hostname" and errors
 * out, or the allow-list check rejects it before ping even runs).
 */

const express = require("express");
const { execFile } = require("child_process");

const app = express();
const PORT = 3001;

// Allow-list: only digits, dots, letters, and hyphens — a conservative
// pattern for IPv4 addresses / simple hostnames. Anything else is rejected
// before we even attempt to run a command.
const HOST_PATTERN = /^[A-Za-z0-9.\-]+$/;

app.get("/ping", (req, res) => {
  const host = req.query.host;

  if (!host) {
    return res.status(400).send("Usage: /ping?host=<hostname-or-ip>\n");
  }

  if (!HOST_PATTERN.test(host)) {
    console.log(`[mitigated] rejected invalid host: ${host}`);
    return res.status(400).send(`Rejected: "${host}" is not a valid hostname/IP.\n`);
  }

  // SAFE: execFile runs the "ping" binary directly with an argument
  // vector. No shell is invoked, so metacharacters have no special
  // meaning — they are just literal characters inside the "host" arg.
  execFile("ping", ["-c", "1", host], (error, stdout, stderr) => {
    res.type("text/plain");
    res.send(
      `$ ping -c 1 ${host}\n\n` +
        `--- stdout ---\n${stdout}\n` +
        `--- stderr ---\n${stderr}\n` +
        (error ? `--- error ---\n${error.message}\n` : "")
    );
  });
});

app.listen(PORT, () => {
  console.log(`Mitigated server listening on http://localhost:${PORT}`);
  console.log(`Try:  GET /ping?host=127.0.0.1`);
  console.log(`Blocked exploit attempt:  GET /ping?host=127.0.0.1;whoami`);
});
