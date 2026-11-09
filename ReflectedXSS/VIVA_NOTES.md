# Reflected XSS — Viva & 2-Minute Narration

**Student:** Aryan Saini, IIT2024008

## Demonstration script

**0:00–0:25.** "I implemented Reflected Cross-Site Scripting using my own local search application. The server accepts a `query` URL parameter. In vulnerable mode it embeds that string directly into the HTML response."

**0:25–0:55.** "The vulnerability is here in `app.py`: `reflected = query`. The input is untrusted and is copied without output encoding into an HTML element. I'll submit `<script>alert('Reflected XSS')</script>`. The dialog executes inside the lab, demonstrating the exploit."

**0:55–1:30.** "Now I switch to secured mode and submit exactly the same query. The only fix is `html.escape(query, quote=True)`, which encodes the characters used to form HTML tags. It displays the payload as text; there is no JavaScript alert."

**1:30–2:00.** "This is *reflected*, not *stored*, because the payload comes from the current request and nothing is persisted. Alternatives include template auto-escaping, sanitizer libraries for rich HTML, CSP, safe DOM sinks, and HttpOnly cookies for limiting cookie exposure. I implemented HTML encoding as my one required mitigation."

## Common questions

**What makes this reflected XSS?** It comes from the current GET request's `query` and is echoed into the immediate response without being stored.

**Stored vs reflected XSS?** Stored XSS persists in a database or other storage, where a victim loads it later; here a malicious URL is sufficient and input is not saved.

**Why is the script executed?** The server returns `<script>` bytes in HTML; the browser's HTML parser interprets them as an executable element.

**Why an `alert()`?** A harmless proof that arbitrary JavaScript execution is possible, not the vulnerability itself.

**What code contains the flaw?** `render_lab_html` in `app.py`: `reflected = query`, later used inside `<strong>` in the HTML result.

**Where does input enter the server?** `GET /lab/vulnerable?query=...`; `parse_qs` extracts the `query` string.

**What is your one implemented mitigation?** Context-aware HTML output encoding using `html.escape(..., quote=True)`.

**Can `html.escape` be used for JavaScript context too?** No. Encoding must match the output context; this demo inserts into HTML text.

**Why not filter the word `script`?** Blacklists are brittle and XSS has many constructs. Appropriate output encoding avoids interpreting data as code.

**Does CSP replace output escaping?** No, it is defense in depth. The demo deliberately avoids CSP so you can directly prove the encoding fix.

**Does HttpOnly solve XSS?** No, it prevents scripts reading HttpOnly cookies but does not prevent script execution or other impacts.

**What about framework autoescaping?** Jinja and React escape text by default, but unsafe escape hatches such as Jinja `|safe` and React `dangerouslySetInnerHTML` can reintroduce XSS.

**Why iframe?** The iframe recreates an isolated browser-in-browser lab interface. Its sandbox permits JavaScript, forms and alert dialogs but omits same-origin access to the parent.

**Why is this server-reflected instead of DOM-based?** The Python server directly generates the vulnerable HTML response; the sink is not a client-side `innerHTML` assignment.

**Why two modes?** They permit immediate before/after comparison without editing code during the demo; both receive identical input and differ in only the encoding step.
