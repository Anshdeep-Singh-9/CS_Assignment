/**
 * vulnerable_server.js
 *
 * In-band OS Command Injection demo (Node.js / Express)
 * -------------------------------------------------------
 *
 * ENDPOINT: GET /ping?host=<value>
 *
 * (a) Vulnerable implementation:
 *     The "host" parameter from the query string is concatenated directly
 *     into a shell command string and executed with exec(), which spawns
 *     /bin/sh -c "<command>". Because exec() invokes a shell, any shell
 *     metacharacters in `host` (;  &&  ||  |  `  $()  newline) are
 *     interpreted by the shell instead of being treated as plain data.
 *
 * (c) Root cause:
 *     User input is concatenated into a command string that is passed to
 *     a shell for interpretation, so the input can break out of the
 *     intended "host" argument and inject additional commands.
 */

const express = require("express");
const { exec } = require("child_process");

const app = express();
const PORT = 3000;

app.get("/ping", (req, res) => {
  const host = req.query.host;

  if (!host) {
    return res.status(400).send("Usage: /ping?host=<hostname-or-ip>\n");
  }

  // VULNERABLE LINE:
  // user input is concatenated straight into a shell command string.
  const command = `ping -c 1 ${host}`;

  console.log(`[vulnerable] executing: ${command}`);

  exec(command, (error, stdout, stderr) => {
    // In-band: command output (or injected command's output) is
    // returned directly in the HTTP response.
    res.type("text/plain");
    res.send(
      `$ ${command}\n\n` +
        `--- stdout ---\n${stdout}\n` +
        `--- stderr ---\n${stderr}\n` +
        (error ? `--- error ---\n${error.message}\n` : "")
    );
  });
});

app.listen(PORT, () => {
  console.log(`Vulnerable server listening on http://localhost:${PORT}`);
  console.log(`Try:  GET /ping?host=127.0.0.1`);
  console.log(`Exploit:  GET /ping?host=127.0.0.1;whoami`);
});
