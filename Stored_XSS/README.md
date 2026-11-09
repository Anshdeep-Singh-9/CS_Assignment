# Signal & Story — Stored XSS Lab

A locally run message board for demonstrating one vulnerability category: **stored cross-site scripting (stored XSS)**. The two routes share one original app and visual design, while keeping their saved notes separate:

- `/vulnerable` renders saved message markup unsafely.
- `/fixed` renders saved messages with Jinja's normal HTML auto-escaping.

## Run locally

Python 3.10 or newer is recommended.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:5002>. The server binds only to the local computer. Keep the vulnerable route local; do not deploy it or test it against another system.

## Demonstration

1. Open `http://127.0.0.1:5002/vulnerable`.
2. Enter `Student` as the name and this harmless proof payload as the message:

   ```html
   <script>alert("Stored XSS demo")</script>
   ```

3. Publish the note. The page reloads and the browser shows the alert because the saved message is emitted as raw HTML. Dismiss it; the saved note remains and the alert appears again on reload.
4. Open `http://127.0.0.1:5002/fixed`, submit the same message, and publish it. The text appears literally and no alert runs.
5. Use **Clear this demo board** on each route to remove its entries.

The alert is a harmless execution proof. Do not use payloads that access cookies, send data elsewhere, or affect other users.

## What the code demonstrates

- **Flaw:** `templates/board.html` uses `{{ entry['message'] | safe }}` on the vulnerable route. The `safe` marker disables the template engine's normal HTML escaping.
- **Storage:** `app.py` saves the submitted message in SQLite, then retrieves it when that board is opened. The issue occurs when it is rendered, not when it is stored.
- **Root cause:** untrusted, persistent text is treated as trusted HTML. The browser parses it as markup and executes the script element.
- **Implemented mitigation:** on `/fixed`, the value is output as a normal Jinja variable, so Jinja encodes HTML-significant characters at render time. The browser receives text rather than executable markup.

## Other XSS defenses to explain

- **Context-aware output encoding:** encode untrusted values for the exact output context (HTML text, attributes, URLs, or JavaScript). It prevents input from changing the surrounding syntax. This demo implements HTML-text encoding through Jinja auto-escaping.
- **Framework auto-escaping:** templates encode variables by default, reducing the chance that a developer forgets. Avoid bypass features such as `safe` for user content.
- **HTML sanitization for rich text:** when a product must allow selected formatting, a maintained sanitizer can parse the HTML and retain only an explicitly allowed subset.
- **Content Security Policy (CSP):** a restrictive browser policy can limit which scripts may run, providing a backup layer if markup injection occurs.
- **HttpOnly cookies:** prevents JavaScript from reading session cookies; it limits one possible impact but does not prevent XSS itself.
- **Safe DOM sinks:** use `textContent` instead of `innerHTML` when inserting text through client-side JavaScript.

## Assignment evidence to prepare

For your individual portion, capture the vulnerable and fixed routes using the same harmless payload, explain the code path and root cause, identify output encoding as your implemented mitigation, and describe the other defenses above. Add your name and roll number to your group's ownership table and narrate your own video segment. Integrate this module into the group's repository when your team is ready. Follow the course instructions for the separate PDF and submission location.
