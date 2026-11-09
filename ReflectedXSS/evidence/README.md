# Capture these real screenshots in your browser

1. `01-vulnerable-alert.png`: show the **native browser alert** in Vulnerable mode, with the malicious URL visible.
2. `02-secured-no-alert.png`: submit the **same payload** in Secured mode. It should appear as text, with no dialog.
3. `03-vulnerable-code.png`: show `reflected = query` in `app.py`.
4. `04-secure-code.png`: show `html.escape(query, quote=True)` in `app.py`.

Include these in the video, and narrate the before/after behavior personally. Automated headless screenshots generally do not capture browser-native alert dialogs, so take the alert screenshot manually in your desktop browser. Do not fabricate evidence.
