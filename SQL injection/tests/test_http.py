"""Exercise real HTTP endpoints using an isolated loopback server and database."""
import http.client
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
import server


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.db = Path(cls.temp.name) / 'test.db'
        server.initialize_database(cls.db)
        original_connect = server.connect
        cls.db_patch = patch.object(server, 'connect', lambda db_file=None: original_connect(cls.db))
        cls.db_patch.start()
        cls.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()
        cls.db_patch.stop()
        cls.temp.cleanup()

    def setUp(self):
        self.cookie = ''
        server.SESSIONS.clear()

    def request(self, path, data=None, method=None, headers=None, raw=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port, timeout=5)
        request_headers = {'Cookie': self.cookie}
        if data is not None:
            raw = json.dumps(data)
            request_headers['Content-Type'] = 'application/json'
        request_headers.update(headers or {})
        connection.request(method or ('POST' if raw is not None else 'GET'), path, raw, request_headers)
        response = connection.getresponse()
        body = response.read()
        cookie = response.getheader('Set-Cookie')
        if cookie:
            self.cookie = cookie.split(';')[0]
        result = (response.status, dict(response.getheaders()), body)
        connection.close()
        return result

    def login(self, username="student@campusshield.test", password="Student@123!", mode="secure"):
        return self.request('/api/login', dict(username=username, password=password, mode=mode))

    def test_static_and_health_routes(self):
        for path, mime in [('/', 'text/html'), ('/static/style.css','text/css'), ('/static/app.js','application/javascript'), ('/api/health','application/json')]:
            with self.subTest(path=path):
                status, headers, body = self.request(path)
                self.assertEqual(status, 200)
                self.assertTrue(headers['Content-Type'].startswith(mime))
                self.assertTrue(body)
                self.assertIn("default-src 'self'", headers['Content-Security-Policy'])

    def test_login_session_logout(self):
        self.assertEqual(self.request('/api/me')[0], 401)
        status, headers, body = self.login()
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)['authenticated'])
        self.assertIn('HttpOnly', headers['Set-Cookie'])
        self.assertIn('SameSite=Lax', headers['Set-Cookie'])
        self.assertEqual(self.request('/api/me')[0], 200)
        self.assertEqual(self.request('/api/logout', method='POST')[0], 200)
        self.assertEqual(self.request('/api/me')[0], 401)

    def test_bypass_then_mitigation_revokes_session(self):
        payload = "' OR 1=1 -- "
        status, _, body = self.login(payload, 'wrong', 'vulnerable')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)['user']['role'], 'Administrator')
        self.assertEqual(self.request('/api/me')[0], 200)
        _, _, body = self.login(payload, 'wrong', 'secure')
        self.assertFalse(json.loads(body)['authenticated'])
        self.assertEqual(self.request('/api/me')[0], 401)

    def test_expired_and_unknown_sessions(self):
        self.cookie = 'campusshield_session=expired'
        server.SESSIONS['expired'] = (1, 0)
        self.assertEqual(self.request('/api/me')[0], 401)
        self.assertNotIn('expired', server.SESSIONS)
        self.cookie = 'campusshield_session=missing'
        self.assertEqual(self.request('/api/me')[0], 401)
        self.cookie = 'campusshield_session=orphan'
        server.SESSIONS['orphan'] = (99999, 99999999999)
        self.assertEqual(self.request('/api/me')[0], 401)

    def test_bad_inputs(self):
        cases = [{}, [], {'username': [], 'password':'x','mode':'secure'}, {'username':'x','password':'x','mode':[]}, {'username':'x'*301,'password':'x','mode':'secure'}]
        for data in cases:
            with self.subTest(data=data):
                self.assertEqual(self.request('/api/login', data)[0], 400)
        for raw in ['{', '', 'x'*8193]:
            self.assertEqual(self.request('/api/login', raw=raw, headers={'Content-Type':'application/json'})[0], 400)
        self.assertEqual(self.request('/api/login', raw='x')[0], 415)

    def test_missing_and_traversal_routes(self):
        for path in ['/missing', '/server.py', '/data/campusshield.db', '/../server.py', '/static/../server.py']:
            self.assertEqual(self.request(path)[0], 404)
        self.assertEqual(self.request('/missing', method='POST')[0], 404)

    def test_local_host_and_origin_restrictions(self):
        self.assertEqual(self.request('/api/health', headers={'Host':'remote.example'})[0], 403)
        self.assertEqual(self.request('/api/logout', method='POST', headers={'Origin':'https://remote.example'})[0], 403)
        origin = f'http://127.0.0.1:{self.httpd.server_port}'
        self.assertEqual(self.request('/api/logout', method='POST', headers={'Origin':origin})[0], 200)
        self.assertEqual(self.request('/api/health', headers={'Host':f'localhost:{self.httpd.server_port}'})[0], 200)
        self.assertEqual(server.HOST, '127.0.0.1')


if __name__ == '__main__':
    unittest.main()
