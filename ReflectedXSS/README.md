# Reflected XSS — Local Security Lab

**Owner:** Aryan Saini · **Roll:** IIT2024008 · **Course:** Cyber Security (IT-30001), IIIT Allahabad, Autumn 2026
**Vulnerability:** Cross-Site Scripting (XSS) · **Chosen variant:** Reflected XSS

## Objective

This is an original, self-contained mock search engine and teaching interface inspired by the *concept* of Google XSS Game Level 1. The goal is to implement a Reflected XSS flaw on our own server, prove it using a harmless JavaScript alert, then implement **one mitigation**: context-aware HTML output encoding.

**Security notice:** One local route is intentionally vulnerable. The server binds to `127.0.0.1` only. **Never publish or expose the vulnerable endpoint on a public network**, deploy it, or proxy it. Only test the group's own application.

## Running (zero third-party dependencies)

You need Python 3.9+; no pip, Flask, Node.js, or database needed.

```bash
cd ReflectedXSS
python3 app.py
```

Open **http://127.0.0.1:8008** in a desktop browser.

## Exploit demonstration

**Same payload in both modes:**

```html
<script>alert('Reflected XSS')</script>
```

1. Open the lab in **VULNERABLE** mode. Click **Run payload**, or paste the payload into Findly's search box and click Search.
2. A native JavaScript **alert** appears. This proves the untrusted search term became executable JavaScript.
3. Switch to **SECURED** mode without changing the query, or enter the same payload again.
4. The payload is shown as escaped, visible text. **No alert executes.**
5. Show the code in `app.py`: the difference is between `reflected = query` and `reflected = html.escape(query, quote=True)`.

The address bar accepts only this local application's two routes:

- `http://127.0.0.1:8008/lab/vulnerable?query=hello`
- `http://127.0.0.1:8008/lab/secure?query=hello`

The `query=` can be replaced with a URL-encoded version of the script payload. The provided button does that automatically.

## Root cause

**Source:** user-controlled `query` parameter in a GET request.
**Sink:** server-built HTML sent to the browser without escaping.
**Effect:** the HTML parser creates a real script element in the result and executes it.
**Why *reflected* XSS:** the malicious content is immediately echoed in that HTTP response; it is **not** persisted in a database, a comment, or a user profile.

### Vulnerable vs. fixed implementation

In `app.py`, function `render_lab_html`:

```python
if mode == 'vulnerable':
    reflected = query  # INTENTIONALLY UNSAFE
else:
    reflected = html.escape(query, quote=True)  # OUR FIX
```

Both paths then insert `reflected` into the same HTML *text* context:

```python
f"<strong id='reflected-value'>{reflected}</strong>"
```

`html.escape` converts `<` and `>` to `&lt;` and `&gt;`, along with `&` and quotes. This prevents the input from creating executable markup. **This specific mitigation is correct for HTML text context; it is not a universal encoding solution for JavaScript, CSS, URLs, or other contexts.**

The iframe is sandboxed with `allow-scripts allow-forms allow-modals` to enable the learning exercise while restricting access to its parent. `allow-same-origin` is deliberately omitted. The app does not add CSP to either mode, so the fix's effect is attributable to encoding, not a second active control.

## Other mitigations (theory for viva)

- **Framework auto-escaping:** template engines like Jinja escape HTML text variables by default; disabling escaping (e.g., `|safe`) is dangerous for untrusted input.
- **HTML sanitizer for rich content:** a proven allow-list sanitizer removes executable or unsafe tags/attributes while preserving specifically allowed formatting.
- **Content Security Policy (CSP):** a restrictive `script-src` helps block inline or unapproved scripts as a second line of defense but does not replace proper encoding.
- **HttpOnly cookies:** make flagged cookies inaccessible to JavaScript. This limits one possible impact but **does not prevent XSS**.
- **Safe DOM sinks:** use `textContent` for untrusted text instead of `innerHTML`; avoid `eval` and dangerous string-to-code APIs.

## Tests

```bash
python3 -m unittest discover -s tests -v
```

These include an actual local HTTP request test, plus safe/unsafe rendering and escaping checks. See `evidence/README.md` for the screenshots to record.

## Structure

```text
ReflectedXSS/
├── app.py                   # Local HTTP server and intentionally flawed/fixed paths
├── templates/
│   ├── index.html           # Lab interface with sandboxed iframe
│   └── search.html          # Original mock search application
├── static/
│   ├── style.css            # Interface design
│   ├── parent.js            # Navigation, toggles, replay
│   └── lab.js               # Safe frame navigation sync
├── tests/test_app.py        # Unit/integration tests
├── evidence/README.md      # Screenshot instructions
└── VIVA_NOTES.md            # 2-minute narration and Q&A
```

## Academic integrity

The source and user interface here are an independent project, not a clone or an iframe of Google's servers. The conceptual inspiration is [Google XSS Game Level 1](https://xss-game.appspot.com/level1). **You should personally understand, adapt, and defend your own work in the individual viva**, as the assignment requires.
