# Stored XSS Demonstration

This project is a small Flask message board that demonstrates stored cross-site scripting (XSS) and an output-encoding mitigation. It provides two routes in the same application:

- `/vulnerable` displays saved messages as HTML.
- `/fixed` displays saved messages as text using Jinja's automatic HTML escaping.

Each route stores its messages separately in a local SQLite database.

## Requirements

- Python 3.10 or newer
- pip

## Run the application

Create and activate a virtual environment, then install the dependency:

```bash
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:5002>. The development server listens on the local computer only.

## Demonstration

On `/vulnerable`, submit the following harmless message:

```html
<script>alert("Stored XSS demo")</script>
```

After publishing, the message is saved and rendered as raw HTML. The browser executes the script and displays an alert. The message remains stored, so it runs again when the page is loaded.

Submit the same message on `/fixed`. It is saved, but Jinja escapes the HTML characters during rendering. The browser displays the message as text and does not execute it. The **Clear this demo board** control removes saved messages from the current route.

## Implementation

The `/publish` route in `app.py` receives a name and message and stores them in SQLite. When a board is loaded, the app retrieves its saved entries and passes them to `templates/board.html`.

In the template, the vulnerable branch renders the message with `| safe`. This disables Jinja's automatic escaping and causes the browser to interpret submitted markup. The fixed branch renders the message as an ordinary template variable, so Jinja encodes HTML-significant characters before returning the page.

The root cause is treating untrusted, persistent input as trusted HTML. The implemented mitigation is context-appropriate output encoding through Jinja's automatic escaping.

## Additional XSS defenses

- **Framework auto-escaping:** escape template variables by default and avoid bypasses such as `safe` for untrusted content.
- **HTML sanitization:** if user-authored rich HTML is required, use a maintained sanitizer with a restrictive allow-list.
- **Content Security Policy (CSP):** restrict which scripts the browser can execute as an additional layer of defense.
- **HttpOnly cookies:** prevent JavaScript from reading session cookies; this limits one possible impact but does not prevent XSS itself.
- **Safe DOM sinks:** use APIs such as `textContent` to insert plain text instead of parsing it with `innerHTML`.

## Local-use note

The vulnerable route is intentionally unsafe for demonstration. Run it only on localhost with dummy data; do not deploy it or use it to test other systems.
