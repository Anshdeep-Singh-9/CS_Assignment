"""Run: python3 -m unittest discover -s tests -v"""
import sys
import unittest
from pathlib import Path
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.parse import quote
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import render_lab_html, AppHandler

PAYLOAD = "<script>alert('Reflected XSS')</script>"


class TestRendering(unittest.TestCase):
    def test_vulnerable_reflects_executable_script(self):
        page = render_lab_html('vulnerable', PAYLOAD, True)
        self.assertIn(f"<strong id='reflected-value'>{PAYLOAD}</strong>", page)

    def test_secure_encodes_same_script(self):
        page = render_lab_html('secure', PAYLOAD, True)
        self.assertNotIn(PAYLOAD, page)
        self.assertIn('&lt;script&gt;alert(', page)

    def test_secure_encodes_event_handler_payload(self):
        image = '<img src=x onerror=alert(1)>'
        page = render_lab_html('secure', image, True)
        self.assertNotIn(image, page)
        self.assertIn('&lt;img src=x onerror=alert(1)&gt;', page)

    def test_form_field_is_escaped_even_in_vulnerable_mode(self):
        page = render_lab_html('vulnerable', '" autofocus onfocus=alert(1)', True)
        self.assertIn('value="&quot; autofocus', page)

    def test_no_query_means_no_result(self):
        for mode in ('vulnerable', 'secure'):
            self.assertNotIn('reflected-value', render_lab_html(mode))

    def test_invalid_mode_rejected(self):
        with self.assertRaises(ValueError):
            render_lab_html('unknown', PAYLOAD, True)


class TestRealHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), AppHandler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_address[1]}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_http_vulnerable_and_fixed_responses(self):
        encoded = quote(PAYLOAD, safe='')
        with urlopen(f'{self.base}/lab/vulnerable?query={encoded}') as response:
            vulnerable = response.read().decode()
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
        with urlopen(f'{self.base}/lab/secure?query={encoded}') as response:
            secure = response.read().decode()
        self.assertIn(f"<strong id='reflected-value'>{PAYLOAD}</strong>", vulnerable)
        self.assertNotIn(f"<strong id='reflected-value'>{PAYLOAD}</strong>", secure)
        self.assertIn('&lt;script&gt;', secure)


if __name__ == '__main__':
    unittest.main()
