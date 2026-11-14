import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: 'alice', password: 'password123' });
  const [transferForm, setTransferForm] = useState({ toAccount: '200002', amount: '5000' });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Fetch account data
  const fetchAccount = async () => {
    try {
      const res = await fetch(`${API_BASE}/account`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setError(null);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch account:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccount();
  }, []);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await fetchAccount();
      } else {
        setError(data.message || 'Login failed.');
      }
    } catch (err) {
      setError('Cannot connect to Bank Backend at http://localhost:5000');
    }
  };

  // Handle Legitimate Money Transfer
  const handleTransfer = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Pass CSRF token in header and/or body if available
          'x-csrf-token': user?.csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({
          toAccount: transferForm.toAccount,
          amount: transferForm.amount,
          _csrf: user?.csrfToken || ''
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage(data.message);
        fetchAccount();
      } else {
        setError(data.message || 'Transfer failed.');
      }
    } catch (err) {
      setError('Network error processing transfer.');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      setMessage(null);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Reset demo accounts
  const handleResetLedger = async () => {
    try {
      await fetch(`${API_BASE}/reset`, {
        method: 'POST',
        credentials: 'include'
      });
      setMessage('Demo ledger has been reset to default state.');
      fetchAccount();
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading Banking Portal...</div>;
  }

  // Not Logged In View
  if (!user) {
    return (
      <div>
        <nav className="navbar">
          <div className="brand">
            <span className="brand-badge">PORT 3000</span>
            <h1>Apex Trust Bank</h1>
          </div>
        </nav>

        <div className="login-wrapper">
          <div className="login-card">
            <h2 style={{ fontSize: 20, marginBottom: 8, color: '#0f172a' }}>Sign In to Internet Banking</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              Fictional Retail Banking Customer Portal
            </p>

            <div className="demo-credentials-box">
              <strong>Demo Credentials:</strong><br />
              Username: <code>alice</code> | Password: <code>password123</code><br />
              <small>Victim Account: 100001 (Balance: ₹25,000)</small>
            </div>

            {error && <div className="alert-msg alert-error">{error}</div>}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  className="form-control"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
                Secure Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Dashboard View
  const isProtected = user.csrfProtectionEnabled;

  return (
    <div>
      <nav className="navbar">
        <div className="brand">
          <span className="brand-badge">PORT 3000</span>
          <h1>Apex Trust Bank</h1>
        </div>

        <div className="nav-actions">
          <span className="user-badge">
            Welcome, <strong>{user.name}</strong> (A/C: {user.accountNumber})
          </span>
          <button className="btn-secondary" onClick={handleResetLedger} title="Reset demo balance to ₹25,000">
            &#x21bb; Reset Ledger
          </button>
          <button className="btn-secondary" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </nav>

      <div className="container">
        {/* CSRF Security Status Banner */}
        <div className={`security-status-bar ${isProtected ? 'sec-protected' : 'sec-vulnerable'}`}>
          <div>
            <strong>Backend CSRF Defense Status: </strong>
            <span>
              {isProtected
                ? 'ENABLED (Protected by Synchronizer Token Pattern)'
                : 'DISABLED (Vulnerable to Cross-Site Request Forgery)'}
            </span>
          </div>
          <span className={isProtected ? 'pill-prot' : 'pill-vuln'}>
            {isProtected ? 'PROTECTED' : 'VULNERABLE'}
          </span>
        </div>

        {/* Success / Error Alerts */}
        {message && <div className="alert-msg alert-success">{message}</div>}
        {error && <div className="alert-msg alert-error">{error}</div>}

        <div className="dashboard-grid">
          {/* Account Balance Card */}
          <div className="card">
            <div className="card-title">
              <span>Account Overview</span>
              <button
                className="btn-secondary"
                onClick={fetchAccount}
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                &#x21bb; Refresh Balance
              </button>
            </div>

            <div className="balance-display">
              <div className="balance-label">Available Clear Balance</div>
              <div className="balance-amount">
                ₹{user.balance.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="account-details">
              <div>
                <span style={{ color: '#64748b' }}>Account Holder:</span>
                <strong>{user.name}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Account Number:</span>
                <code>{user.accountNumber}</code>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Account Type:</span>
                <span>Savings / Prime Retail</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Active CSRF Token:</span>
                <code style={{ fontSize: 11, color: '#2563eb' }}>
                  {user.csrfToken ? `${user.csrfToken.slice(0, 16)}...` : 'None'}
                </code>
              </div>
            </div>
          </div>

          {/* Money Transfer Card */}
          <div className="card">
            <div className="card-title">
              <span>Transfer Funds (Legitimate Form)</span>
            </div>

            <form onSubmit={handleTransfer}>
              <div className="form-group">
                <label>Recipient Account Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={transferForm.toAccount}
                  onChange={(e) => setTransferForm({ ...transferForm, toAccount: e.target.value })}
                  placeholder="e.g. 200002"
                  required
                />
              </div>

              <div className="form-group">
                <label>Transfer Amount (₹)</label>
                <input
                  type="number"
                  className="form-control"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  placeholder="5000"
                  min="1"
                  required
                />
              </div>

              <button type="submit" className="btn-primary">
                Send ₹{Number(transferForm.amount || 0).toLocaleString('en-IN')}
              </button>
            </form>
          </div>
        </div>

        {/* Transaction Ledger Table */}
        <div className="card">
          <div className="card-title">
            <span>Recent Account Transactions</span>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
              {user.transactions.length} record(s)
            </span>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Txn ID</th>
                  <th>Date & Time</th>
                  <th>Recipient / Description</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Verification Tag</th>
                </tr>
              </thead>
              <tbody>
                {user.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td><code>{tx.id}</code></td>
                    <td>{tx.date}</td>
                    <td><strong>{tx.toAccount}</strong></td>
                    <td>
                      <span className={tx.type === 'CREDIT' ? 'badge-credit' : 'badge-debit'}>
                        {tx.type}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: tx.type === 'CREDIT' ? '#16a34a' : '#dc2626' }}>
                        {tx.type === 'CREDIT' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                      </strong>
                    </td>
                    <td>
                      {tx.tag === 'UNAUTHORIZED (CSRF EXPLOIT)' ? (
                        <span className="tag-forged">&#x26A0; UNAUTHORIZED (CSRF EXPLOIT)</span>
                      ) : tx.tag ? (
                        <span className="tag-legit">&#x2714; AUTHORIZED (LEGITIMATE)</span>
                      ) : (
                        <span style={{ color: '#64748b' }}>INITIAL</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
