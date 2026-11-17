"""Behavioral tests for the authorized localhost SQLi demonstration.

Run from the project directory:
    python -m unittest discover -s tests -v

Tests use an ephemeral SQLite database and never touch real accounts.
"""

import tempfile
import unittest
from pathlib import Path

from server import authenticate, connect, initialize_database


ATTACK = "' OR 1=1 -- "
WRONG_PASSWORD = "not-the-password"


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        # Every test starts from a fresh fictional dataset.
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.database = Path(self.temporary_directory.name) / "test.db"
        initialize_database(self.database)

    def tearDown(self):
        self.temporary_directory.cleanup()

    def run_login(self, username, password, mode):
        return authenticate(username, password, mode, self.database)

    def test_vulnerable_query_allows_authentication_bypass(self):
        result = self.run_login(ATTACK, WRONG_PASSWORD, "vulnerable")
        self.assertTrue(result["authenticated"])
        self.assertEqual(result["user"]["role"], "Administrator")
        self.assertIn("OR 1=1 --", result["trace"]["sql"])

    def test_same_exact_payload_blocked_by_parameterized_query(self):
        result = self.run_login(ATTACK, WRONG_PASSWORD, "secure")
        self.assertFalse(result["authenticated"])
        self.assertIsNone(result["user"])
        self.assertIn("username = ?", result["trace"]["sql"])
        self.assertEqual(result["trace"]["parameters"][0], ATTACK)

    def test_normal_login_works_in_both_modes(self):
        for mode in ("vulnerable", "secure"):
            with self.subTest(mode=mode):
                result = self.run_login(
                    "student@campusshield.test", "Student@123!", mode
                )
                self.assertTrue(result["authenticated"])
                self.assertEqual(result["user"]["role"], "Student")

    def test_wrong_password_denied_without_attack(self):
        for mode in ("vulnerable", "secure"):
            with self.subTest(mode=mode):
                result = self.run_login("admin@campusshield.test", "wrong", mode)
                self.assertFalse(result["authenticated"])

    def test_unknown_user_is_denied_in_secure_mode(self):
        result = self.run_login("missing@campusshield.test", "secret", "secure")
        self.assertFalse(result["authenticated"])

    def test_special_characters_are_not_sql_in_secure_mode(self):
        probes = ["' OR 'x'='x' -- ", "admin' -- ", "'; DROP TABLE users; -- "]
        for username in probes:
            with self.subTest(username=username):
                result = self.run_login(username, WRONG_PASSWORD, "secure")
                self.assertFalse(result["authenticated"])
        # No table changes should have occurred.
        with connect(self.database) as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM users").fetchone()[0], 2)

    def test_password_is_redacted_in_traces(self):
        for mode in ("vulnerable", "secure"):
            result = self.run_login("student@campusshield.test", "Student@123!", mode)
            self.assertNotIn("Student@123!", str(result["trace"]))
            self.assertIn("[redacted]", str(result["trace"]))

    def test_database_stores_salted_password_hashes(self):
        with connect(self.database) as db:
            rows = db.execute("SELECT password_hash FROM users").fetchall()
            self.assertEqual(len(rows), 2)
            self.assertNotEqual(rows[0][0], rows[1][0])
            self.assertNotIn("Admin@123!", rows[0][0])
            self.assertEqual(len(rows[0][0].split("$")), 3)

    def test_invalid_mode_rejected(self):
        with self.assertRaises(ValueError):
            self.run_login(ATTACK, WRONG_PASSWORD, "unknown")

    def test_empty_input_rejected(self):
        with self.assertRaises(ValueError):
            self.run_login("", "password", "secure")

    def test_malformed_sql_does_not_leak_engine_errors(self):
        result = self.run_login("' AND ('", "fake", "vulnerable")
        self.assertFalse(result["authenticated"])
        self.assertNotIn("sqlite", result["message"].lower())
        self.assertNotIn("syntax error", result["message"].lower())


if __name__ == "__main__":
    unittest.main()
