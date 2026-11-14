
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = 5000;


const ENABLE_CSRF_PROTECTION = true ;



const INITIAL_VICTIM_BALANCE = 25000;
const accounts = {
  '100001': {
    accountNumber: '100001',
    username: 'alice',
    password: 'password123',
    name: 'Alice Sharma',
    balance: INITIAL_VICTIM_BALANCE,
    transactions: [
      {
        id: 'TXN-1001',
        date: new Date(Date.now() - 86400000).toLocaleString('en-IN'),
        toAccount: 'Salary Credit - Employer Inc',
        amount: 25000,
        type: 'CREDIT',
        status: 'SUCCESS'
      }
    ]
  },
  '200002': {
    accountNumber: '200002',
    name: 'Attacker Mule Account',
    balance: 0,
    transactions: []
  }
};

// Middleware: Enable CORS for React frontends
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:3000', 'http://127.0.0.1:4000'],
  credentials: true
}));

// Middleware: Parse both JSON and standard HTML form POST submissions
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: Session Management with Cookies
// Configured so that cross-site requests between localhost ports carry the cookie
app.use(session({
  name: 'bank_session_id',
  secret: 'fictional-bank-secret-key-98765',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // Defends against XSS cookie theft
    // In RFC 6265bis, localhost:3000, localhost:4000, and localhost:5000 share the 'localhost' site.
    // sameSite: 'lax' allows the authenticated session cookie to be attached to cross-site POST form requests on localhost.
    sameSite: 'lax',
    secure: false   // Local HTTP development
  }
}));

// Helper: Get authenticated account from session
function getAuthenticatedAccount(req) {
  if (!req.session || !req.session.accountNumber) return null;
  return accounts[req.session.accountNumber] || null;
}

/**
 * POST /api/login
 * Authenticates user credentials and establishes a session.
 * Also generates a secure random CSRF Synchronizer Token.
 */
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`\n[AUTH] Login attempt for username: "${username}"`);

  const userAcc = Object.values(accounts).find(
    acc => acc.username === username && acc.password === password
  );

  if (!userAcc) {
    console.warn(`[AUTH FAILED] Invalid credentials for: "${username}"`);
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }

  // Set session
  req.session.accountNumber = userAcc.accountNumber;

  // Generate cryptographically secure random CSRF Synchronizer Token
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');

  console.log(`[AUTH SUCCESS] User "${userAcc.name}" logged in. Account: ${userAcc.accountNumber}`);
  console.log(`[CSRF TOKEN GENERATED] ${req.session.csrfToken}`);

  res.json({
    success: true,
    message: 'Logged in successfully',
    accountNumber: userAcc.accountNumber,
    name: userAcc.name,
    csrfToken: req.session.csrfToken
  });
});

/**
 * GET /api/account
 * Returns current authenticated user's profile, balance, and transaction history.
 */
app.get('/api/account', (req, res) => {
  const account = getAuthenticatedAccount(req);
  if (!account) {
    return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
  }

  // Ensure CSRF token exists
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.json({
    success: true,
    accountNumber: account.accountNumber,
    name: account.name,
    balance: account.balance,
    transactions: account.transactions,
    csrfToken: req.session.csrfToken,
    csrfProtectionEnabled: ENABLE_CSRF_PROTECTION
  });
});

/**
 * ============================================================================
 * POST /api/transfer  (TARGET TRANSACTION ENDPOINT)
 * ============================================================================
 * Accepts a transfer request to send money to another account.
 * 
 * In VULNERABLE mode (ENABLE_CSRF_PROTECTION = false):
 *   - Only checks if the user has an active session cookie.
 *   - Ignores whether a CSRF token is provided.
 *   - Cross-site POST requests from shopping app succeed automatically!
 * 
 * In MITIGATED mode (ENABLE_CSRF_PROTECTION = true):
 *   - Validates that the submitted token matches req.session.csrfToken.
 *   - Rejects forged requests with missing or invalid tokens (HTTP 403 Forbidden).
 */
app.post('/api/transfer', (req, res) => {
  console.log('\n============================================================');
  console.log(`[TRANSACTION REQUEST] Received POST /api/transfer`);
  console.log(`Origin: ${req.headers.origin || req.headers.referer || 'Unknown/Direct Form'}`);

  // 1. Session Authentication Check
  const account = getAuthenticatedAccount(req);
  if (!account) {
    console.warn('[REJECTED] Unauthorized: No active authenticated session cookie found.');
    return res.status(401).format({
      json: () => res.json({ success: false, message: 'Unauthorized. Please log in first.' }),
      html: () => res.send('<h3>401 Unauthorized: Session expired or invalid.</h3>')
    });
  }

  const toAccount = req.body.toAccount;
  const amount = parseFloat(req.body.amount);
  const submittedToken = req.body._csrf || req.headers['x-csrf-token'];
  const sessionToken = req.session.csrfToken;

  console.log(`Sender: ${account.name} (A/C ${account.accountNumber})`);
  console.log(`Recipient A/C: ${toAccount}`);
  console.log(`Amount: ₹${amount}`);
  console.log(`Submitted CSRF Token: ${submittedToken || '(None)'}`);
  console.log(`Session Expected Token: ${sessionToken}`);

  // ==========================================================================
  // [CSRF DEFENSE VALIDATION BLOCK]
  // ==========================================================================
  if (ENABLE_CSRF_PROTECTION) {
    console.log('[CSRF MODE] Protection is ENABLED. Validating token...');

    if (!submittedToken || submittedToken !== sessionToken) {
      console.warn('>>> [SECURITY ALERT] CSRF ATTACK BLOCKED! <<<');
      console.warn(`Reason: Token mismatch or absent. (Received: "${submittedToken}", Expected: "${sessionToken}")`);

      return res.status(403).format({
        json: () => res.json({
          success: false,
          error: 'CSRF_ATTACK_DETECTED',
          message: '403 Forbidden: Invalid or missing CSRF Synchronizer Token.'
        }),
        html: () => res.status(403).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>403 Forbidden - CSRF Attack Blocked</title>
            <style>
              body { font-family: sans-serif; background: #fff5f5; color: #2d3748; padding: 40px; text-align: center; }
              .box { max-width: 550px; margin: auto; background: white; border: 2px solid #e53e3e; border-radius: 8px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              h1 { color: #e53e3e; }
              .code { background: #edf2f7; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 13px; text-align: left; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="box">
              <h1>&#x26A0; 403 Forbidden: CSRF Attack Blocked</h1>
              <p>The transaction request was rejected because the <strong>CSRF Synchronizer Token</strong> was missing or invalid.</p>
              <div class="code">
                <strong>Status:</strong> Rejected before financial state change.<br>
                <strong>Reason:</strong> Cross-site request failed cryptographic token verification.
              </div>
              <p>Your bank balance is safe and has <strong>NOT</strong> been modified.</p>
            </div>
          </body>
          </html>
        `)
      });
    }
    console.log('[CSRF SUCCESS] Token verified successfully.');
  } else {
    console.log('[CSRF MODE] Protection is DISABLED. Skipping CSRF token verification!');
  }
  // ==========================================================================

  // Input Validation
  if (!toAccount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid recipient account or amount.' });
  }

  // Balance Check
  if (account.balance < amount) {
    console.warn(`[FAILED] Insufficient funds: Balance ₹${account.balance}, Requested ₹${amount}`);
    return res.status(400).json({ success: false, message: 'Insufficient account balance.' });
  }

  // Execute Financial Transaction (State Change)
  account.balance -= amount;

  // Credit recipient if it exists in our demo ledger
  if (accounts[toAccount]) {
    accounts[toAccount].balance += amount;
  }

  // Record Transaction in History
  const isForged = !submittedToken || submittedToken !== sessionToken;
  const newTxn = {
    id: `TXN-${Date.now().toString().slice(-4)}`,
    date: new Date().toLocaleString('en-IN'),
    toAccount: toAccount === '200002' ? '200002 (Attacker Account)' : toAccount,
    amount: amount,
    type: 'DEBIT',
    status: 'SUCCESS',
    tag: isForged ? 'UNAUTHORIZED (CSRF EXPLOIT)' : 'AUTHORIZED (LEGITIMATE)'
  };
  account.transactions.unshift(newTxn);

  console.log(`[TRANSACTION PROCESSED] ₹${amount} transferred to ${toAccount}.`);
  console.log(`New Balance for ${account.name}: ₹${account.balance}`);
  console.log('============================================================\n');

  // Response: Support both JSON API response and HTML Form POST response
  res.format({
    json: () => res.json({
      success: true,
      message: `₹${amount} transferred successfully to Account ${toAccount}.`,
      newBalance: account.balance,
      transaction: newTxn
    }),
    html: () => res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Transaction Completed</title>
        <style>
          body { font-family: sans-serif; background: #f0fff4; color: #22543d; padding: 40px; text-align: center; }
          .box { max-width: 500px; margin: auto; background: white; border: 2px solid #38a169; border-radius: 8px; padding: 25px; }
          h2 { color: #276749; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>&#x2714; Transaction Processed Successfully</h2>
          <p>₹${amount} transferred to Account <strong>${toAccount}</strong>.</p>
          <p>Updated Balance: <strong>₹${account.balance}</strong></p>
        </div>
      </body>
      </html>
    `)
  });
});

/**
 * POST /api/reset
 * Helper endpoint to reset demo account balances and history for re-demonstrations.
 */
app.post('/api/reset', (req, res) => {
  accounts['100001'].balance = INITIAL_VICTIM_BALANCE;
  accounts['100001'].transactions = [
    {
      id: 'TXN-1001',
      date: new Date().toLocaleString('en-IN'),
      toAccount: 'Salary Credit - Employer Inc',
      amount: 25000,
      type: 'CREDIT',
      status: 'SUCCESS'
    }
  ];
  accounts['200002'].balance = 0;
  console.log('[RESET] Demo account balances and transaction ledger reset to defaults.');
  res.json({ success: true, message: 'Ledger reset to initial state.' });
});

/**
 * POST /api/logout
 * Destroys current session.
 */
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    console.log('[AUTH] User logged out.');
    res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// Start Server
app.listen(PORT, () => {
  console.log('============================================================');
  console.log(` [FICTIONAL BANK BACKEND] Running on: http://localhost:${PORT}`);
  console.log(` CSRF Protection Status: ${ENABLE_CSRF_PROTECTION ? 'ENABLED (Protected)' : 'DISABLED (Vulnerable)'}`);
  console.log(` Demo Account: 100001 (Victim: Alice Sharma, Initial Balance: ₹25,000)`);
  console.log(` Recipient:    200002 (Attacker Account)`);
  console.log('============================================================\n');
});
