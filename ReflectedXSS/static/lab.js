'use strict';
(() => {
  const params = new URLSearchParams(window.location.search);
  const mode = location.pathname.endsWith('/secure') ? 'secure' : 'vulnerable';
  // The reflected sink is server-rendered HTML, NOT DOM-based JavaScript.
  parent.postMessage({
    type: 'lab-navigation', mode,
    query: params.get('query') || '', submitted: params.has('query')
  }, '*');
})();
