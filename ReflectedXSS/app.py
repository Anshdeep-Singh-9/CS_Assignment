"""Local-only Reflected XSS lab; one route is deliberately vulnerable."""
from __future__ import annotations
import html
from string import Template
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent
HOST, PORT = '127.0.0.1', 8008


def render_lab_html(mode: str, query: str = '', submitted: bool = False) -> str:
    if mode not in ('vulnerable', 'secure'):
        raise ValueError('Unknown lab mode')
    field_value = html.escape(query, quote=True)  # HTML attribute is always safe
    if submitted:
        if mode == 'vulnerable':
            reflected = query  # INTENTIONAL XSS VULNERABILITY: no output encoding
        else:
            reflected = html.escape(query, quote=True)  # IMPLEMENTED MITIGATION
        result = ("<div class='result' id='result'>No results were found for "
                  f"<strong id='reflected-value'>{reflected}</strong>. Try again.</div>")
    else:
        result = '<div class="empty" id="result">Your search results will appear here.</div>'
    template = (ROOT / 'templates/search.html').read_text(encoding='utf-8')
    return Template(template).substitute(INPUT_VALUE=field_value, RESULT_HTML=result, MODE=mode)


class AppHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        path = url.path
        if path in ('/', '/index.html'):
            return self.asset('templates/index.html', 'text/html; charset=utf-8')
        if path in ('/static/style.css', '/static/parent.js', '/static/lab.js'):
            mime = 'text/css' if path.endswith('.css') else 'text/javascript'
            return self.asset(path.lstrip('/'), mime + '; charset=utf-8')
        if path in ('/lab/vulnerable', '/lab/secure'):
            mode = path.rsplit('/', 1)[-1]
            params = parse_qs(url.query, keep_blank_values=True)
            query = params.get('query', [''])[0]
            body = render_lab_html(mode, query, submitted=('query' in params))
            return self.send_data(200, body.encode('utf-8'), 'text/html; charset=utf-8')
        self.send_data(404, b'Not found', 'text/plain; charset=utf-8')

    def asset(self, relative_path: str, mime: str):
        try:
            body = (ROOT / relative_path).read_bytes()
        except FileNotFoundError:
            return self.send_data(404, b'Not found', 'text/plain; charset=utf-8')
        self.send_data(200, body, mime)

    def send_data(self, status: int, body: bytes, mime: str):
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        # No CSP is set: HTML output encoding is the sole demonstrated XSS fix.
        self.end_headers()
        self.wfile.write(body)


def main():
    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print(f'Lab ready: http://{HOST}:{PORT} (local only)')
    print('Stop with Ctrl+C. Do not expose the intentionally vulnerable route.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
