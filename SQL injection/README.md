# CampusShield

**Localhost only. Do not deploy vulnerable mode to public web hosts.**

A local web app for comparing SQL injection authentication bypass with parameterized-query mitigation. Uses Python's standard library, SQLite, and offline browser assets. No package installation, build step, or internet connection is required.

## Run

Install Python **3.10 or newer** and open a terminal in the `SQL injection` folder.

- Linux / macOS: `bash start_linux.sh`
- Windows: double-click `start_windows.bat`, or run `py -3 server.py`
- Any platform: `python3 server.py` (use `python` if that is your Python 3 command)

Open **http://127.0.0.1:8000** in a modern browser. Keep the terminal open. Press **Ctrl+C** there to stop. If port 8000 is occupied, stop the existing application using it before starting this app.

The app intentionally contains an unsafe login implementation. It binds only to `127.0.0.1` and rejects non-local hostnames and cross-origin requests. Keep it local; do not deploy it or expose it through a tunnel, proxy, port forwarding, or a public interface. All accounts are fictional.

## Use the workspace

1. Select **Vulnerable**, then **Demo account** and **Execute login request**. A normal login succeeds. **View protected profile** verifies the session with the real server.
2. Select **Injection payload**. It fills the username with `' OR 1=1 -- ` and a deliberately incorrect password. Execute the request in **Vulnerable** mode: the login bypass returns the administrator account.
3. Select **Mitigated**, keep the identical inputs, and execute again. The login is rejected because the payload remains a literal bound value.
4. Inspect the SQL statement, bound parameters, authentication result, and comparison cards. These come from the server; outcomes are not simulated. Passwords are redacted in traces.
5. Try a valid account in **Mitigated** mode to confirm normal login still works. **Sign out** ends the session; **Reset workspace** clears results, input fields, and the session.

The comparison retains each mode's most recent result. A previous successful result is historical evidence; only the latest successful login has an active session. A processed failed login revokes the previous session. Input validation errors do not execute authentication or change a session.

### Demo accounts

| Username | Password | Role |
| --- | --- | --- |
| `student@campusshield.test` | `Student@123!` | Student |
| `admin@campusshield.test` | `Admin@123!` | Administrator |

Passwords are stored as salted PBKDF2 hashes. Hashing does not prevent SQL injection: the vulnerable query can skip password verification entirely. The mitigated query uses `?` placeholders and a separate tuple of values. Both implementations are documented beside their code in `server.py`.

## Local data

The app creates `data/campusshield.db` on first run. To restore the initial fictional accounts, stop the server, delete that file, and restart. Sessions are stored in memory and expire after two hours or when the server restarts. Browser result cards clear on reload; an existing server session can remain until logout, expiry, or restart.

## Checks

From the project directory:

```sh
python3 -m unittest discover -s tests -v
```

Tests use temporary databases and a temporary loopback HTTP port. They cover both login implementations, real sessions, logout, failed-login revocation, input validation, error handling, static routes, local request restrictions, and password redaction.
