'use strict';
(() => {
  const frame = document.querySelector('#target');
  const address = document.querySelector('#address');
  const feedback = document.querySelector('#feedback');
  const bad = document.querySelector('#mode-vulnerable');
  const good = document.querySelector('#mode-secure');
  const caption = document.querySelector('#mode-caption');
  const payload = "<script>alert('Reflected XSS')</script>";
  let mode = 'vulnerable';
  let query = null;

  function localUrl() {
    const url = new URL('/lab/' + mode, location.origin);
    if (query !== null) url.searchParams.set('query', query);
    return url;
  }
  function load() {
    const url = localUrl();
    address.value = url.href;
    frame.src = url.href;
  }
  function setMode(next) {
    mode = next;
    bad.classList.toggle('active', mode === 'vulnerable');
    good.classList.toggle('active', mode === 'secure');
    bad.setAttribute('aria-pressed', String(mode === 'vulnerable'));
    good.setAttribute('aria-pressed', String(mode === 'secure'));
    caption.textContent = mode === 'vulnerable' ? 'INSECURE OUTPUT PATH' : 'ENCODED OUTPUT PATH';
    caption.style.color = mode === 'vulnerable' ? '#ffbd7c' : '#8fe2b8';
    load();
    feedback.textContent = mode === 'vulnerable'
      ? 'Vulnerable response: untrusted input is rendered as HTML.'
      : 'Secured response: the same input is HTML-escaped. No alert should appear.';
  }
  function go() {
    let url;
    try { url = new URL(address.value, location.href); }
    catch { feedback.textContent = 'Invalid URL. Use the local lab address.'; return; }
    if (url.origin !== location.origin || !/^\/lab\/(vulnerable|secure)$/.test(url.pathname)) {
      feedback.textContent = 'For safety, this browser accepts only the two LOCAL lab routes.';
      return;
    }
    query = url.searchParams.has('query') ? url.searchParams.get('query') : null;
    setMode(url.pathname.endsWith('/secure') ? 'secure' : 'vulnerable');
  }
  bad.addEventListener('click', () => setMode('vulnerable'));
  good.addEventListener('click', () => setMode('secure'));
  document.querySelector('#go').addEventListener('click', go);
  address.addEventListener('keydown', event => { if (event.key === 'Enter') go(); });
  document.querySelector('#run-payload').addEventListener('click', () => {
    query = payload;
    load();
    feedback.textContent = mode === 'vulnerable'
      ? 'Attack submitted. A JavaScript alert should appear in the sandboxed frame.'
      : 'Same attack submitted. The payload should display as text, without an alert.';
  });
  document.querySelector('#reset').addEventListener('click', () => {
    query = null;
    load();
    feedback.textContent = 'Lab reset.';
  });
  document.querySelector('#copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(localUrl().href); feedback.textContent = 'Local URL copied.'; }
    catch { address.select(); feedback.textContent = 'Copy the selected local URL manually.'; }
  });
  // No HTML injection in the parent page: only string values are copied into inputs.
  // The sandboxed frame has an opaque origin. Validate the message source.
  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.type !== 'lab-navigation' || data.mode !== mode ||
        typeof data.query !== 'string' || data.query.length > 10000 ||
        typeof data.submitted !== 'boolean') return;
    query = data.submitted ? data.query : null;
    address.value = localUrl().href;
  });
  load();
})();
