
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DB_FILE = ROOT / "data" / "campusshield.db"
HOST = "127.0.0.1"  # Intentional: the vulnerable demonstration must stay local.
PORT = 8000
SESSION_LIFETIME = 2 * 60 * 60
SESSIONS: dict[str, tuple[int, float]] = {}

# Two dummy accounts, not associated with real people or services.
DEMO_USERS = (
    ("admin@campusshield.test", "Admin@123!", "Morgan Vale", "Administrator", "Systems Operations"),
    ("student@campusshield.test", "Student@123!", "Avery Stone", "Student", "Computer Science"),
)

# Both implementations use the same projection to make the difference obvious.
FIELDS = "SELECT id, username, full_name, role, department\nFROM users"
VULNERABLE_TEMPLATE = (
    FIELDS + "\nWHERE username = '{username}' "
    "AND verify_password('{password}', password_hash) = 1 LIMIT 1"
)
SECURE_SQL = (
    FIELDS + "\nWHERE username = ? "
    "AND verify_password(?, password_hash) = 1 LIMIT 1"
)


def hash_password(password: str) -> str:
    """Store salted PBKDF2 hashes instead of plaintext dummy passwords.

    Note: password hashing is important but does NOT replace SQL parameters.
    """
    salt = secrets.token_bytes(16)
    iterations = 160_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"{iterations}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> int:
    """Expose a password checker to SQLite through a custom SQL function.

    This allows both login variants to share identical password verification,
    isolating *how the username reaches the SQL parser* as the vulnerability.
    """
    try:
        count, salt_hex, digest_hex = encoded.split("$", 2)
        count_int = int(count)
        if count_int < 1 or count_int > 1_000_000:
            return 0
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), count_int
        )
        return int(hmac.compare_digest(digest, bytes.fromhex(digest_hex)))
    except (AttributeError, TypeError, ValueError):
        return 0


def connect(db_file: Path = DB_FILE) -> sqlite3.Connection:
    """Create an isolated SQLite connection with our password-check function."""
    connection = sqlite3.connect(str(db_file), timeout=5)
    connection.row_factory = sqlite3.Row
    connection.create_function("verify_password", 2, verify_password)
    return connection


def initialize_database(db_file: Path = DB_FILE) -> None:
    """Seed a local throwaway database on first run; preserve it thereafter."""
    db_file.parent.mkdir(parents=True, exist_ok=True)
    with connect(db_file) as database:
        database.execute(
            """CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL,
                department TEXT NOT NULL
            )"""
        )
        count = database.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if count == 0:
            for username, password, name, role, department in DEMO_USERS:
                database.execute(
                    """INSERT INTO users
                       (username, password_hash, full_name, role, department)
                       VALUES (?, ?, ?, ?, ?)""",
                    (username, hash_password(password), name, role, department),
                )
        database.commit()


def public_user(row: sqlite3.Row) -> dict[str, Any]:
    """Return safe, non-secret profile fields only."""
    return {
        "id": row["id"],
        "username": row["username"],
        "full_name": row["full_name"],
        "role": row["role"],
        "department": row["department"],
    }


def login_vulnerable(
    username: str, password: str, db_file: Path = DB_FILE
) -> dict[str, Any]:
    """INTENTIONALLY UNSAFE: concatenating username turns it into SQL syntax.

    Payload in the username field: ' OR 1=1 --
    This makes the WHERE clause true and comments out password verification.
    Only a locally hosted, synthetic database should ever call this function.
    """
    # Escape password quotes only so this exercise isolates the username flaw.
    # The username is deliberately left unescaped: THAT is the bug.
    escaped_password = password.replace("'", "''")

    # VULNERABLE LINE: direct interpolation of untrusted username into SQL.
    query = VULNERABLE_TEMPLATE.format(
        username=username, password=escaped_password
    )
    # The trace masks the password even though the (unsafe) executed query uses it.
    visible_query = VULNERABLE_TEMPLATE.format(
        username=username, password="[redacted]"
    )
    trace = {
        "sql": visible_query,
        "parameters": None,
        "execution": "String concatenation: user input is interpreted as SQL.",
    }

    try:
        with connect(db_file) as database:
            row = database.execute(query).fetchone()
    except sqlite3.Error:
        # Avoid leaking internal database errors to the browser.
        return {
            "authenticated": False,
            "user": None,
            "trace": trace,
            "message": "The vulnerable SQL statement could not be executed.",
        }

    return {
        "authenticated": row is not None,
        "user": public_user(row) if row else None,
        "trace": trace,
        "message": (
            "Login accepted. The application created an authenticated session."
            if row else "Credentials did not match an account."
        ),
    }


def login_secure(
    username: str, password: str, db_file: Path = DB_FILE
) -> dict[str, Any]:
    """MITIGATION: bind untrusted values instead of concatenating SQL strings.

    The exact same attack text remains *data* in the bound username variable,
    so it can never become OR, -- or another executable SQL token.
    """
    trace = {
        "sql": SECURE_SQL,
        "parameters": [username, "[redacted]"],
        "execution": "Parameterized query: values are bound separately from SQL.",
    }
    try:
        with connect(db_file) as database:
            # SECURE LINE: placeholders and a separate parameter tuple.
            row = database.execute(SECURE_SQL, (username, password)).fetchone()
    except sqlite3.Error:
        return {
            "authenticated": False,
            "user": None,
            "trace": trace,
            "message": "The login request could not be completed.",
        }

    return {
        "authenticated": row is not None,
        "user": public_user(row) if row else None,
        "trace": trace,
        "message": (
            "Valid credentials. Normal authentication succeeded."
            if row else "Login rejected. No matching account and password."
        ),
    }


def authenticate(
    username: str, password: str, mode: str, db_file: Path = DB_FILE
) -> dict[str, Any]:
    """Apply shared input bounds, then route to the requested implementation."""
    if mode not in {"vulnerable", "secure"}:
        raise ValueError("Mode must be vulnerable or secure.")
    if not isinstance(username, str) or not isinstance(password, str):
        raise ValueError("Username and password must be strings.")
    if not username or not password or len(username) > 300 or len(password) > 300:
        raise ValueError("Enter both fields (maximum 300 characters each).")

    if mode == "vulnerable":
        result = login_vulnerable(username, password, db_file)
    else:
        result = login_secure(username, password, db_file)

    result["mode"] = mode
    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    return result


class Handler(BaseHTTPRequestHandler):
    """Tiny standard-library HTTP application; no pip install required."""

    server_version = "CampusShieldLab/1.0"

    def log_message(self, format_string: str, *args: Any) -> None:
        # The standard request log does not record POST bodies/passwords.
        super().log_message(format_string, *args)

    def send_common(self, status: int, mime_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", mime_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "connect-src 'self'; img-src 'self' data:; "
            "object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        )

    def json_response(
        self, status: int, data: dict[str, Any], cookie: str | None = None
    ) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_common(status, "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if cookie is not None:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def static_response(self, filename: Path, mime_type: str) -> None:
        if not filename.is_file():
            self.json_response(404, {"error": "Not found."})
            return
        body = filename.read_bytes()
        self.send_common(200, mime_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def session_token(self) -> str | None:
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        morsel = cookies.get("campusshield_session")
        return morsel.value if morsel is not None else None

    @staticmethod
    def clear_cookie() -> str:
        return "campusshield_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"

    def revoke_session(self) -> None:
        token = self.session_token()
        if token is not None:
            SESSIONS.pop(token, None)

    def local_request(self) -> bool:
        """Reject alternate hostnames and cross-origin requests to this local lab.

        Loopback binding restricts network access; checking Host also prevents
        a remote hostname rebinding to loopback. No CORS access is granted.
        """
        port = self.server.server_port
        allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        if port == 80:
            allowed_hosts.update({"127.0.0.1", "localhost"})
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin")
        if host not in allowed_hosts or (origin is not None and origin != f"http://{host}"):
            self.json_response(403, {"error": "Only same-origin localhost requests are allowed."})
            return False
        return True

    def do_GET(self) -> None:
        if not self.local_request():
            return
        # Explicit allow-list prevents static path traversal.
        static_files = {
            "/": (ROOT / "index.html", "text/html; charset=utf-8"),
            "/static/style.css": (ROOT / "static" / "style.css", "text/css; charset=utf-8"),
            "/static/app.js": (ROOT / "static" / "app.js", "application/javascript; charset=utf-8"),
        }
        if self.path in static_files:
            self.static_response(*static_files[self.path])
            return
        if self.path == "/api/me":
            token = self.session_token()
            session = SESSIONS.get(token or "")
            if not session or session[1] < time.time():
                if token is not None:
                    SESSIONS.pop(token, None)
                self.json_response(401, {"authenticated": False, "error": "No active session."})
                return
            with connect() as database:
                row = database.execute(
                    FIELDS + " WHERE id = ?", (session[0],)
                ).fetchone()
            if row is None:
                self.json_response(401, {"authenticated": False, "error": "Account not found."})
                return
            self.json_response(200, {"authenticated": True, "user": public_user(row)})
            return
        if self.path == "/api/health":
            self.json_response(200, {"status": "ok", "scope": "local-demo-only"})
            return
        self.json_response(404, {"error": "Not found."})

    def do_POST(self) -> None:
        if not self.local_request():
            return
        if self.path == "/api/logout":
            self.revoke_session()
            self.json_response(200, {"ok": True}, self.clear_cookie())
            return
        if self.path != "/api/login":
            self.json_response(404, {"error": "Not found."})
            return

        if self.headers.get("Content-Type", "").split(";", 1)[0].strip() != "application/json":
            self.json_response(415, {"error": "Send application/json."})
            return
        try:
            length = int(self.headers.get("Content-Length", "-1"))
            if length < 1 or length > 8192:
                raise ValueError("Request body must be between 1 and 8192 bytes.")
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("JSON object expected.")
            username = payload.get("username")
            password = payload.get("password")
            mode = payload.get("mode")
            # Reject malformed inputs before creating an SQL statement.
            result = authenticate(username, password, mode)
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.json_response(400, {"error": str(exc)})
            return

        # An unsuccessful login cannot leave an older authenticated session alive.
        self.revoke_session()
        cookie = self.clear_cookie()
        if result["authenticated"]:
            token = secrets.token_urlsafe(32)
            SESSIONS[token] = (result["user"]["id"], time.time() + SESSION_LIFETIME)
            cookie = (
                f"campusshield_session={token}; HttpOnly; "
                f"SameSite=Lax; Path=/; Max-Age={SESSION_LIFETIME}"
            )
        # 200 indicates a processed login request, not necessarily login success.
        self.json_response(200, result, cookie)


def main() -> None:
    initialize_database()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print("\nCampusShield — SQL Injection Authentication Bypass Lab")
    print("LOCAL ONLY: do not expose or deploy this intentionally vulnerable app.")
    print(f"Open http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
