# POST-Based CSRF Attack and Synchronizer Token Mitigation (React.js + Express)

An educational, fully working demonstration of a **POST-based Cross-Site Request Forgery (CSRF)** attack against a fictional banking application and its defense using the **Synchronizer Token Pattern**.

Built with **React.js (Vite)** on the frontend and **Node.js + Express** on the backend for Cyber Security coursework and live viva presentations.

---

## 1. What is Cross-Site Request Forgery (CSRF)?

**Cross-Site Request Forgery (CSRF)** is an attack where a malicious website tricks an authenticated user's web browser into executing unwanted, state-changing actions on a trusted web application.

### Why Does It Occur?
1. **Ambient Authority:** Browsers automatically attach stored credentials (such as session cookies) to outgoing HTTP requests targeting a domain, even when the request originates from a completely different, third-party site.
2. **Missing Intent Verification:** If the target application relies solely on the presence of the session cookie to authorize state-changing actions (such as transferring funds or changing passwords), it cannot distinguish between a user's intentional action and an attacker's forged request.

---

## 2. Technology Stack

- **Banking Frontend:** React.js 18, Vite (Port 3000)
- **Attacker / Shopping Frontend:** React.js 18, Vite (Port 4000)
- **Backend API Server:** Node.js, Express.js (Port 5000)
- **Authentication & Sessions:** `express-session` (cookie-based session storage)
- **CORS:** `cors` middleware with `credentials: true`
- **Cryptography:** Node.js built-in `crypto` module (for cryptographically secure 256-bit random synchronizer tokens)
- **Styling:** Pure CSS (no heavy UI frameworks)

---

## 3. Project Structure

```text
csrf-assignment-react/
├── backend/                     # Port 5000 (Express API Server)
│   ├── server.js                # Session store, transfer endpoint, CSRF toggle
│   └── package.json
├── banking-app/                 # Port 3000 (Legitimate React Banking App)
│   ├── src/
│   │   ├── App.jsx              # Dashboard, balance card, transfer form, history
│   │   ├── index.css            # Clean, professional banking UI styles
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── shopping-app/                # Port 4000 (Fictional E-Commerce Exploit Site)
│   ├── src/
│   │   ├── App.jsx              # Flash sale banner, clickable voucher trigger
│   │   ├── index.css            # Modern shopping UI styling
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── run-all.js                   # Single script to launch all 3 servers concurrently
├── package.json                 # Root script definitions
├── README.md                    # Technical documentation & viva guide
└── DEMONSTRATION_SCRIPT.md      # Exact 2–3 minute video presentation script
```

---

## 4. Installation & Setup

All dependencies for all three components can be installed using npm:

```bash
# 1. Install Backend dependencies
cd backend && npm install && cd ..

# 2. Install Banking App dependencies
cd banking-app && npm install && cd ..

# 3. Install Shopping App dependencies
cd shopping-app && npm install && cd ..
```

*(Note: On systems with IPv6 delays, pass `NODE_OPTIONS="--dns-result-order=ipv4first"` if npm hangs).*

---

## 5. How to Run All Three Services

You can start all three applications simultaneously with a single command from the project root:

```bash
node run-all.js
```
*(Or run `npm start`)*

This launches:
- 🏦 **Banking Application:** [http://localhost:3000](http://localhost:3000)
- 🛍️ **Shopping Website:** [http://localhost:4000](http://localhost:4000)
- ⚙️ **Backend API Server:** [http://localhost:5000](http://localhost:5000)

---

## 6. Demo Accounts & Credentials

- **Victim Username:** `alice`
- **Victim Password:** `password123`
- **Victim Account Number:** `100001` (Alice Sharma)
- **Initial Balance:** `₹25,000`
- **Attacker / Mule Account Number:** `200002`
- **Forged Transfer Amount:** `₹5,000`

---

## 7. Step-by-Step Demonstration

### Part 1: Vulnerable Application Demonstration
1. Open `backend/server.js` and verify line 27 is set to:
   ```javascript
   const ENABLE_CSRF_PROTECTION = false;
   ```
2. Open your browser and navigate to the Banking Portal: `http://localhost:3000`.
3. Sign in as `alice` / `password123`.
4. Note that:
   - Available balance is **₹25,000**.
   - Security status badge displays **`VULNERABLE (CSRF Defense DISABLED)`**.
5. In the **same browser**, open a new tab and visit the shopping website: `http://localhost:4000`.
6. Notice the large promotional flash sale banner: **"MEGA SALE – UP TO 80% OFF"**.
7. Click the glowing **🎟️ ₹5,000 OFF Gift Voucher** promotional image.
8. The shopping site displays an applied voucher toast. Under the hood, a hidden HTML form submitted a `POST` request to `http://localhost:5000/api/transfer`.
9. Return to the Banking tab (`http://localhost:3000`) and click **Refresh Balance**.
10. **Result:** Alice's balance has dropped to **₹20,000**, and an unauthorized ₹5,000 transfer to account `200002` appears in the transaction ledger!

---

### Part 2: CSRF Mitigation Demonstration
1. Open `backend/server.js` and toggle line 27 to `true`:
   ```javascript
   const ENABLE_CSRF_PROTECTION = true;
   ```
2. Restart the backend server (`Ctrl+C` in the backend terminal, then run `node server.js` or restart `run-all.js`).
3. Return to `http://localhost:3000` and sign in again.
4. Observe that the security status badge now reads **`PROTECTED (CSRF Defense ENABLED)`**.
5. Click **Reset Ledger** to restore the balance to ₹25,000 for a fresh test.
6. Return to the shopping website tab (`http://localhost:4000`) and click the exact same **🎟️ ₹5,000 OFF Gift Voucher** image.
7. Switch to the terminal running the backend:
   ```text
   >>> [SECURITY ALERT] CSRF ATTACK BLOCKED! <<<
   Reason: Token mismatch or absent.
   ```
8. Return to the Banking tab (`http://localhost:3000`) and click **Refresh Balance**.
9. **Result:** Alice's balance remains safe at **₹25,000**. The server genuinely rejected the forged request with **HTTP 403 Forbidden** before any financial state change took place.

---

## 8. Code Analysis: Vulnerability vs. Mitigation

### The Vulnerable Code (`backend/server.js`)
```javascript
// Accepts any POST request that carries a valid session cookie
app.post('/api/transfer', (req, res) => {
  const account = getAuthenticatedAccount(req);
  if (!account) return res.status(401).send('Unauthorized');

  // VULNERABILITY: No check is performed to verify user origin/intent!
  account.balance -= req.body.amount;
  res.json({ success: true });
});
```

### The Synchronizer Token Mitigation (`backend/server.js`)
```javascript
// 1. Generation upon login:
req.session.csrfToken = crypto.randomBytes(32).toString('hex');

// 2. Transmitted to legitimate React banking frontend via /api/account.

// 3. Server-side validation before financial state change:
if (ENABLE_CSRF_PROTECTION) {
  const submittedToken = req.body._csrf || req.headers['x-csrf-token'];
  const sessionToken = req.session.csrfToken;

  if (!submittedToken || submittedToken !== sessionToken) {
    return res.status(403).json({ error: 'CSRF_ATTACK_DETECTED' });
  }
}

// 4. Executed only if cryptographic token is validated:
account.balance -= req.body.amount;
```

### Why the Cross-Site Attacker Cannot Bypass This
Due to the **Same-Origin Policy (SOP)** enforced by modern web browsers, client-side code on `http://localhost:4000` is strictly prohibited from reading data, cookies, or the DOM of `http://localhost:3000` or `http://localhost:5000`. Therefore, the attacker cannot read or guess the 256-bit random CSRF token to include in the forged request.

---

## 9. Browser and Cookie Configuration in This Demonstration

In modern browsers, cookies default to `SameSite=Lax`.
- In RFC 6265bis specifications, all ports on `localhost` (`localhost:3000`, `localhost:4000`, `localhost:5000`) share the same registrable domain (`localhost`), making them same-site.
- Setting `sameSite: 'lax'` on the session cookie enables the cookie to be transmitted with top-level POST form submissions between localhost origins.
- In production, applications should enforce defense-in-depth:
  1. Synchronizer Tokens or Double Submit Cookie validation.
  2. `SameSite=Strict` or `SameSite=Lax` cookies.
  3. Strict `Origin` and `Referer` validation.
  4. Re-authentication / password confirmation for sensitive financial operations.
# cs
