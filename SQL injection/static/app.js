/*
 * CampusShield Lab — browser interactions.
 *
 * The backend (server.py) executes both SQL queries. This JavaScript never
 * simulates authentication outcomes and never executes SQL in the browser.
 *
 * Important defensive choice: use textContent, not innerHTML, when displaying
 * user-controlled values. This keeps the SQLi lab from also introducing XSS.
 */

"use strict";

const ATTACK = "' OR 1=1 -- ";
const ACCOUNTS = {
  normal: { username: "student@campusshield.test", password: "Student@123!" },
  attack: { username: ATTACK, password: "not-the-password" }
};

// Collect frequently used elements once to keep the event handlers readable.
const $ = (id) => document.getElementById(id);
const ui = {
  form: $("loginForm"), username: $("username"), password: $("password"),
  vulnerable: $("modeVulnerable"), secure: $("modeSecure"), detail: $("modeDetail"),
  runButton: $("runButton"), runText: $("runText"), modeLabel: $("requestModeLabel"),
  traceMode: $("traceMode"), query: $("queryText"), codeIndex: $("codeIndex"),
  boundValues: $("boundValues"), responseEmpty: $("responseEmpty"),
  responseResult: $("responseResult"), resultIcon: $("resultIcon"),
  resultTag: $("resultTag"), resultTitle: $("resultTitle"),
  resultMessage: $("resultMessage"), resultUser: $("resultUser"),
  resultName: $("resultName"), resultEmail: $("resultEmail"),
  resultAvatar: $("resultAvatar"), resultRole: $("resultRole"),
  resultReason: $("resultReason"), portalButton: $("openPortal"),
  lastExecution: $("lastExecution"), portalOverlay: $("portalOverlay"),
  portalUser: $("portalUser"), portalSubtitle: $("portalSubtitle"),
  toast: $("toast"), hint: $("injectionHint")
};

let mode = "vulnerable";
let latestExecutedMode = null;
let loading = false;
let toastTimer = null;
// Preserve each mode's last result for the evidence board.
const evidence = { vulnerable: null, secure: null };

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.add("hidden"), 3500);
}

function setMode(next) {
  if (loading) return;
  mode = next;
  ui.vulnerable.classList.toggle("active", mode === "vulnerable");
  ui.secure.classList.toggle("active", mode === "secure");
  ui.vulnerable.setAttribute("aria-pressed", String(mode === "vulnerable"));
  ui.secure.setAttribute("aria-pressed", String(mode === "secure"));
  ui.detail.classList.toggle("is-secure", mode === "secure");
  ui.detail.textContent = mode === "vulnerable"
    ? "⚠ Insecure SQL query building is enabled for this request."
    : "✓ SQL parameters are enabled. The attack text stays literal data.";
  ui.modeLabel.textContent = `MODE: ${mode.toUpperCase()}`;
  ui.modeLabel.style.color = mode === "secure" ? "#146752" : "#8b4b13";
  renderModeEvidence();
}

function setCredentials(credentials) {
  ui.username.value = credentials.username;
  ui.password.value = credentials.password;
  ui.username.focus();
  if (credentials.username === ATTACK) {
    ui.hint.textContent = "The username now contains the exact SQLi payload. The password is deliberately incorrect. Execute it in both modes.";
    showToast("Injection payload loaded — use it unchanged in both modes.");
  } else {
    ui.hint.textContent = "These are fictional demo credentials. Normal login should succeed in both modes.";
  }
}

function resetTrace() {
  ui.traceMode.textContent = "AWAITING REQUEST";
  ui.query.textContent = "-- Waiting for a login attempt\n-- Select an implementation\n-- Load a payload (optional)\n-- Execute to see the real query";
  ui.codeIndex.textContent = "01\n02\n03\n04";
  ui.codeIndex.style.whiteSpace = "pre-line";
  ui.boundValues.textContent = "None observed yet";
  ui.responseEmpty.classList.remove("hidden");
  ui.responseResult.classList.add("hidden");
  ui.lastExecution.textContent = "—";
}

function reasonFor(result, username) {
  const injection = username === ATTACK;
  if (injection && result.mode === "vulnerable" && result.authenticated) {
    return "ROOT CAUSE → The apostrophe closes the username, OR 1=1 makes the filter true, and -- removes the password check. The first demo account is returned without its password.";
  }
  if (injection && result.mode === "secure" && !result.authenticated) {
    return "MITIGATION → The payload is treated as the literal username value. It cannot modify the SQL syntax. No matching username exists, so access is denied.";
  }
  if (result.authenticated) {
    return "VALID LOGIN → The supplied demo username and password matched a stored account. This is expected in both implementations.";
  }
  return "LOGIN FAILED → The database did not return a matching account. The server did not issue an authenticated session.";
}

function renderModeEvidence() {
  const saved = evidence[mode];
  if (!saved) {
    resetTrace();
    return;
  }
  const { result, username } = saved;
  ui.traceMode.textContent = mode === "vulnerable" ? "UNSAFE EXECUTION" : "PARAMETERIZED";
  ui.traceMode.style.color = mode === "vulnerable" ? "#8b4b13" : "#146752";
  // Query text comes from the server's actual SQL execution path.
  ui.query.textContent = result.trace.sql;
  ui.codeIndex.textContent = result.trace.sql.split("\n").map((_, i) => String(i + 1).padStart(2, "0")).join("\n");
  ui.codeIndex.style.whiteSpace = "pre-line";
  ui.boundValues.textContent = result.trace.parameters === null
    ? "NONE — text concatenated into SQL"
    : JSON.stringify(result.trace.parameters);
  ui.responseEmpty.classList.add("hidden");
  ui.responseResult.classList.remove("hidden");
  ui.responseResult.classList.toggle("is-failure", !result.authenticated);
  ui.resultIcon.textContent = result.authenticated ? "✓" : "×";
  ui.resultTag.textContent = result.authenticated ? "SESSION CREATED" : "ACCESS DENIED";
  ui.resultTitle.textContent = result.authenticated ? "Login accepted" : "Login rejected";
  ui.resultMessage.textContent = result.message;
  ui.resultUser.classList.toggle("hidden", !result.authenticated);
  if (result.user) {
    ui.resultName.textContent = result.user.full_name;
    ui.resultEmail.textContent = result.user.username;
    ui.resultAvatar.textContent = result.user.full_name.split(" ").map(word => word[0]).slice(0, 2).join("");
    ui.resultRole.textContent = result.user.role.toUpperCase();
  }
  ui.resultReason.textContent = reasonFor(result, username);
  // Earlier successful attempts are evidence, not necessarily active sessions.
  ui.portalButton.classList.toggle("hidden", !result.authenticated || latestExecutedMode !== mode);
  ui.lastExecution.textContent = result.timestamp.slice(11, 19) + " UTC";
}

function renderComparison() {
  for (const key of ["vulnerable", "secure"]) {
    const saved = evidence[key];
    const card = $(key === "vulnerable" ? "vulnerableCard" : "secureCard");
    const state = $(key === "vulnerable" ? "vulnerableState" : "secureState");
    const explanation = $(key === "vulnerable" ? "vulnerableExplanation" : "secureExplanation");
    const proof = $(key === "vulnerable" ? "vulnerableEvidence" : "secureEvidence");
    card.classList.remove("is-success", "is-failure", "is-mitigated", "is-bypassed");
    if (!saved) {
      state.textContent = "NOT TESTED";
      explanation.textContent = key === "vulnerable" ? "Switch to Vulnerable and run a login attempt." : "Switch to Mitigated and run the identical login attempt.";
      proof.textContent = "Awaiting evidence";
      continue;
    }
    const { result, username } = saved;
    state.textContent = result.authenticated ? "ACCESS GRANTED" : "ACCESS DENIED";
    if (username === ATTACK && key === "secure" && !result.authenticated) {
      state.textContent = "ATTACK BLOCKED";
      card.classList.add("is-mitigated");
    } else if (username === ATTACK && key === "vulnerable" && result.authenticated) {
      state.textContent = "BYPASS SUCCESSFUL";
      card.classList.add("is-bypassed");
    } else {
      card.classList.add(result.authenticated ? "is-success" : "is-failure");
    }
    explanation.textContent = result.authenticated
      ? `Server authenticated ${result.user.full_name} (${result.user.role}).`
      : "No matching account. The server refused to authenticate.";
    proof.textContent = `INPUT: ${username} · PASSWORD: [redacted]`;
  }
  if (evidence.vulnerable && evidence.secure &&
      (evidence.vulnerable.username !== evidence.secure.username ||
       evidence.vulnerable.password !== evidence.secure.password)) {
    showToast("Evidence uses different inputs. Reload the payload and rerun both modes for a valid comparison.");
  }
}

async function runLogin(event) {
  if (event) event.preventDefault();
  if (loading) return;
  const username = ui.username.value;
  const password = ui.password.value;
  if (!username || !password) {
    showToast("Username and password are both required.");
    return;
  }

  loading = true;
  ui.runButton.disabled = true;
  ui.runText.textContent = "Executing on local server…";
  try {
    const response = await fetch("/api/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password, mode })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    // Store the precise input along with its genuine server result for comparison.
    evidence[mode] = { result: data, username, password };
    latestExecutedMode = mode;
    renderModeEvidence();
    renderComparison();
    if (username === ATTACK && mode === "vulnerable" && data.authenticated) {
      showToast("Bypass demonstrated: wrong password, authenticated admin session.");
    } else if (username === ATTACK && mode === "secure" && !data.authenticated) {
      showToast("Mitigation verified: the identical injection was rejected.");
    }
  } catch (error) {
    showToast(`Could not execute login: ${error.message}`);
  } finally {
    loading = false;
    ui.runButton.disabled = false;
    ui.runText.textContent = "Execute login request";
  }
}

async function openProtectedPortal() {
  try {
    const response = await fetch("/api/me", { credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok || !data.authenticated) {
      showToast("There is no active authenticated session. Log in again.");
      return;
    }
    // Render all server-provided profile fields with textContent (XSS-safe).
    ui.portalUser.textContent = [
      `IDENTITY  ${data.user.full_name}`,
      `EMAIL     ${data.user.username}`,
      `ROLE      ${data.user.role}`,
      `DIVISION  ${data.user.department}`,
      `SESSION   AUTHENTICATED`
    ].join("\n");
    ui.portalUser.style.whiteSpace = "pre-wrap";
    ui.portalSubtitle.textContent = "The real /api/me endpoint verified the login session and returned this fictional protected profile.";
    ui.portalOverlay.showModal();
    $("closePortal").focus();
  } catch (_error) {
    showToast("The protected endpoint could not be reached.");
  }
}

async function logOut() {
  try {
    const response = await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    if (!response.ok) throw new Error("Logout failed");
    ui.portalOverlay.close();
    latestExecutedMode = null;
    renderModeEvidence();
    showToast("Session revoked. Previous results remain in the evidence board.");
  } catch (_error) {
    showToast("Logout request could not be completed.");
  }
}

// Event handlers: all interaction is triggered by real user actions.
ui.vulnerable.addEventListener("click", () => setMode("vulnerable"));
ui.secure.addEventListener("click", () => setMode("secure"));
$("loadNormal").addEventListener("click", () => setCredentials(ACCOUNTS.normal));
$("loadAttack").addEventListener("click", () => setCredentials(ACCOUNTS.attack));
$("clearFields").addEventListener("click", () => {
  ui.username.value = "";
  ui.password.value = "";
  ui.username.focus();
});
$("togglePassword").addEventListener("click", () => {
  const visible = ui.password.type === "password";
  ui.password.type = visible ? "text" : "password";
  $("togglePassword").textContent = visible ? "Hide" : "Show";
  $("togglePassword").setAttribute("aria-pressed", String(visible));
  $("togglePassword").setAttribute("aria-label", visible ? "Hide password" : "Show password");
});
ui.form.addEventListener("submit", runLogin);
ui.portalButton.addEventListener("click", openProtectedPortal);
$("closePortal").addEventListener("click", () => ui.portalOverlay.close());
$("portalLogout").addEventListener("click", logOut);
ui.portalOverlay.addEventListener("click", (event) => {
  const bounds = ui.portalOverlay.getBoundingClientRect();
  if (event.target === ui.portalOverlay && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) ui.portalOverlay.close();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") ui.portalOverlay.close();
});
$("resetEvidence").addEventListener("click", async () => {
  if (loading) return;
  loading = true;
  ui.runButton.disabled = true;
  try {
    const response = await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    if (!response.ok) throw new Error("Reset failed");
    evidence.vulnerable = null;
    evidence.secure = null;
    latestExecutedMode = null;
    ui.username.value = "";
    ui.password.value = "";
    ui.password.type = "password";
    $("togglePassword").textContent = "Show";
    $("togglePassword").setAttribute("aria-pressed", "false");
    $("togglePassword").setAttribute("aria-label", "Show password");
    ui.hint.textContent = "Load a demo account for a valid login, or try the same injection in both modes.";
    renderComparison();
    resetTrace();
    showToast("Workspace reset. Active session revoked.");
  } catch (_error) {
    showToast("Reset could not complete. Check the local server and try again.");
  } finally {
    loading = false;
    ui.runButton.disabled = false;
  }
});

// Start with the unsafe implementation active, ready for a quick live demo.
setMode("vulnerable");
renderComparison();
