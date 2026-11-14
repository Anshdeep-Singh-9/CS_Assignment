# CSRF Demonstration Video Recording Script & Viva Guide (React.js + Express)

This script is structured for your 2.5–3.5 minute assignment video recording or live viva presentation. It pairs exact on-screen actions with concise, natural spoken narration and includes in-depth DevTools inspection.

---

## Pre-Recording Checklist

1. **Start all services** in your terminal:
   ```bash
   node run-all.js
   ```
2. **Open your browser** with two tabs:
   - **Tab 1 (Banking App):** `http://localhost:3000`
   - **Tab 2 (Shopping / Attacker Site):** `http://localhost:4000`
3. **Open VS Code** showing `backend/server.js` with Line 26 visible (`ENABLE_CSRF_PROTECTION = false`).
4. Ensure browser DevTools can be opened with `F12` or `Ctrl+Shift+I`.

---

## Timed Script & Action Table

| Timestamp | Exact On-Screen Action | Spoken Narration |
| :--- | :--- | :--- |
| **0:00 – 0:25** | Screen showing VS Code with the project folder (`banking-app`, `shopping-app`, `backend`). Show Line 26 in `backend/server.js`: `ENABLE_CSRF_PROTECTION = false`. | *"Hello everyone. Today I am demonstrating a POST-based Cross-Site Request Forgery (CSRF) attack and its defense using the Synchronizer Token Pattern. The demonstration uses React with Vite for the frontends, Express for the backend API on port 5000, and fictional demo accounts on localhost. We will start with CSRF protection disabled."* |
| **0:25 – 0:55** | Switch to Tab 1 (`http://localhost:3000`). Show the login page. Sign in with `alice` / `password123`. Point cursor to the balance **₹25,000** and the **DISABLED (Vulnerable)** security badge. Open DevTools → Application → Cookies (`http://localhost:5000` or `localhost`). Show `bank_session_id`. | *"First, I open our legitimate banking application, Apex Trust Bank, running on port 3000. I log in as Alice Sharma. On the dashboard, her starting balance is ₹25,000, and backend CSRF defense is currently DISABLED. In DevTools under Cookies, we can see the server issued a session cookie named `bank_session_id`. Alice is now authenticated."* |
| **0:55 – 1:35** | Switch to Tab 2 (`http://localhost:4000`). Show the e-commerce store MegaDeals.in. Open DevTools (`F12`). In **Elements tab**, inspect the **🎟️ ₹5,000 OFF Gift Voucher** card. Expand the DOM to highlight the hidden `<form>` right below it: `action="http://localhost:5000/api/transfer"`, `method="POST"`, `<input name="toAccount" value="200002">`, `<input name="amount" value="5000">`. | *"Now, while Alice remains logged in, she visits an attractive shopping website on port 4000 advertising a 'Mega Sale – Up to 80% Off'. Notice this promotional voucher banner. Let's inspect it in DevTools Elements. Embedded right beside the clickable image is a hidden HTML `<form>` pointing to our banking transfer endpoint on port 5000 with method `POST`. Its hidden inputs specify recipient account `200002` and amount `5000`. The promotional image is configured with an `onClick` handler that calls `form.submit()`."* |
| **1:35 – 2:05** | Switch DevTools to the **Network tab**. Click the **🎟️ ₹5,000 OFF Gift Voucher** image. Click on the `transfer` network request in the list. Show **Headers**: Request URL: `http://localhost:5000/api/transfer`, Method: `POST`, Status: `200 OK`. Show **Payload**: `toAccount: 200002`, `amount: 5000`. Show **Request Cookies**: `bank_session_id`. | *"Now let's watch the Network tab as I click the voucher image. A POST request was immediately dispatched to `http://localhost:5000/api/transfer`. Looking at the request headers: the destination URL is the bank API; the method is POST; the payload is recipient 200002 and amount 5000; and critically, the browser automatically attached Alice's `bank_session_id` cookie! Notice the response status is 200 OK."* |
| **2:05 – 2:30** | Switch back to Tab 1 (`http://localhost:3000`). Click **Refresh Balance**. Point cursor to the updated balance **₹20,000** and the transaction table showing `-₹5,000 | UNAUTHORIZED (CSRF EXPLOIT)`. | *"Switching back to Alice's banking tab and clicking Refresh Balance, look at the result: Alice's balance dropped from ₹25,000 to ₹20,000, and an unauthorized transfer to account 200002 appears in her ledger! Alice never authorized this transfer, yet the server executed it because it blindly trusted the automatically attached session cookie. This is a successful CSRF attack."* |
| **2:30 – 2:55** | Switch to VS Code. Open `backend/server.js`. Change Line 26 from `ENABLE_CSRF_PROTECTION = false;` to `true;`. Save. In the backend terminal, press `Ctrl+C` and restart (`node server.js`). | *"To fix this, we enable the Synchronizer Token Pattern. In `backend/server.js`, I toggle `ENABLE_CSRF_PROTECTION` to `true`. Now, the server creates a unique, cryptographically random CSRF token tied to Alice's session. The legitimate React bank app receives this token and attaches it to transfers, but the cross-origin attacker page cannot read it due to the Same-Origin Policy."* |
| **2:55 – 3:30** | Switch to Tab 1. Log in again. Point to the **PROTECTED** security badge. Click **Reset Ledger** to restore balance to ₹25,000. Switch to Tab 2 (`http://localhost:4000`), keep Network tab open. Click the voucher image again. Select the `transfer` network request. Show **Status: 403 Forbidden** and the response `{ "error": "CSRF_ATTACK_DETECTED" }`. Switch to Tab 1, click Refresh Balance: balance is still **₹25,000**. | *"With protection enabled, I log in again. The security badge now reads 'PROTECTED'. I reset the ledger to ₹25,000. Now let's repeat the exact same attack: I click the promotional voucher again. In the Network panel, the request is sent, but the server responds with HTTP 403 Forbidden: Invalid or missing CSRF Token! Returning to the bank dashboard, Alice's balance remains completely safe at ₹25,000. The attack was genuinely blocked."* |

---

## Technical Deep-Dive for Your Explanation

### 1. Breakdown of the Forged HTTP Request
When explaining the Network tab during the video or viva, distinguish the 4 key components:
1. **Request URL (`http://localhost:5000/api/transfer`):** Where the request is sent. The attacker's hidden form `action` directs the browser to the victim bank's API.
2. **HTTP Method (`POST`):** The type of HTTP verb. It performs a state-changing financial transfer on the server.
3. **Parameters / Form Data (`toAccount: 200002`, `amount: 5000`):** The attacker-controlled values specifying the beneficiary account and the amount of money to steal.
4. **Session Cookie (`bank_session_id`):** The ambient credential. Tells the server *who* is making the request (Alice). The attacker never saw this cookie; the victim's own browser attached it.

### 2. How and Why Cookies Are Attached
- **Authentication Step:** Alice logs in on `http://localhost:3000`. The server at `http://localhost:5000` responds with `Set-Cookie: bank_session_id=...; Path=/; HttpOnly; SameSite=Lax`.
- **Browser Cookie Storage:** The browser stores the cookie scoped to the domain `localhost` and path `/`.
- **Selective Attachment Rule:** Browsers do **not** blindly attach cookies to every request across the web. A cookie is sent only when the outgoing request matches the cookie's `Domain`, `Path`, and conforms to its `Secure` and `SameSite` flags.
- **Why It Was Sent Here:** When the hidden form on `http://localhost:4000` submits a top-level POST request to `http://localhost:5000/api/transfer`:
  - Destination hostname (`localhost`) matches cookie domain.
  - Path (`/api/transfer`) matches cookie path (`/`).
  - Under browser specifications (RFC 6265bis), `http://localhost:4000` and `http://localhost:5000` share the scheme `http` and hostname `localhost`, so they are **same-site**. Therefore, a `SameSite=Lax` cookie is permitted on top-level POST form navigations.
- **Ambient Authority:** The attacker never needs to access, read, or steal the cookie string. The browser attaches it automatically behind the scenes.

---

## Comprehensive Viva Questions & Model Answers

### Q1: Why does using a POST request instead of GET not prevent CSRF?
**Answer:** While GET requests can be triggered via `<img>` or `<link>` tags, standard HTML `<form method="POST">` elements can send cross-origin POST requests just as easily. A malicious page can populate hidden inputs and submit the form programmatically using JavaScript (`form.submit()`). Browsers attach matching session cookies to cross-origin POST form submissions unless blocked by cookie policies or application-layer defenses.

### Q2: What does the `action` attribute of an HTML `<form>` do in a CSRF context?
**Answer:** The `action` attribute specifies the destination URL where the form data will be sent. In a CSRF attack, the attacker sets `action="http://localhost:5000/api/transfer"`. Even though the form is hosted on the attacker's origin (`localhost:4000`), the browser sends the HTTP POST directly to the target banking origin specified in the `action` attribute.

### Q3: Why does the browser attach the session cookie to the forged request?
**Answer:** Due to the design principle of **ambient authority**. When web cookies were designed, the browser model mandated that whenever a request is made to a destination domain, any cookie belonging to that destination domain and path should be automatically sent along. The browser does this to maintain user sessions seamlessly, but without additional origin validation, it creates the CSRF vulnerability.

### Q4: What does the `HttpOnly` flag protect against, and why doesn't it stop CSRF?
**Answer:** 
- **What it protects:** `HttpOnly` prevents client-side scripts from accessing the cookie via `document.cookie`, mitigating cookie-theft in **Cross-Site Scripting (XSS)** attacks.
- **Why it fails against CSRF:** In a CSRF attack, the attacker **does not need to read the cookie**. The attacker simply tricks the browser into sending a request to the target site, and the browser itself attaches the cookie automatically at the network layer. Hence, `HttpOnly` has zero effect on CSRF.

### Q5: What is the exact difference between an "Origin" and a "Site"?
**Answer:**
- **Origin:** Defined by the strict tuple **`(Scheme, Host, Port)`**.
  - `http://localhost:3000` and `http://localhost:4000` have different ports, so they are **different origins** (cross-origin).
- **Site:** Defined by **`(Scheme, Registrable Domain / eTLD+1)`**. Port numbers are ignored.
  - Both `http://localhost:3000` and `http://localhost:4000` share the scheme `http` and domain `localhost`, so they belong to the **same site** (same-site).
  - This distinction is why `SameSite=Lax` allows cookies between different ports on `localhost`.

### Q6: What is the difference between the Same-Origin Policy (SOP) and `SameSite` cookies?
**Answer:**
- **Same-Origin Policy (SOP):** A browser security mechanism that restricts how a document or script loaded by one origin can **read** resources from another origin. SOP blocks cross-origin reading of DOM, localStorage, or responses, but by default it **does not block sending** cross-origin write requests (like form POSTs).
- **SameSite Cookie Attribute:** A cookie-level attribute (`Strict`, `Lax`, `None`) that instructs the browser whether to **attach** the cookie when initiating cross-site requests. `SameSite=Strict` completely stops cookies on cross-site requests, acting as defense-in-depth against CSRF.

### Q7: Why is HTTP 403 Forbidden returned when CSRF protection is enabled?
**Answer:** When CSRF protection is active, the banking backend checks for a valid synchronizer token in the incoming request (`req.body._csrf` or `req.headers['x-csrf-token']`) and compares it against `req.session.csrfToken`. When the forged request arrives from the shopping page without a matching token, the server identifies the request as unauthorized and immediately aborts the transaction, returning **HTTP 403 Forbidden** before any balance is modified.

### Q8: What is the fundamental difference between CSRF and XSS?
**Answer:**
- **Cross-Site Scripting (XSS):** Malicious code is injected and executed **inside the execution context of the trusted application**. The attacker can read tokens, steal cookies (if not `HttpOnly`), and manipulate the page DOM.
- **Cross-Site Request Forgery (CSRF):** The trusted application code is unmodified. Instead, an **untrusted external site** tricks the user's browser into transmitting unauthorized requests using credentials already stored in the browser. CSRF exploits the trust a server has in a user's browser, whereas XSS exploits the trust a user has in a specific website.
