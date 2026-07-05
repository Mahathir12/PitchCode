/* ==========================================================================
   utils.js — generic helpers shared across pages
   ========================================================================== */

const Utils = (() => {
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

  function generateId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /** Generates a short human-friendly room/tournament code, checked against
   *  an existing-codes set to avoid collisions (HashSet membership check). */
  function generateUniqueCode(existingCodesObj, length = 6) {
    const existing = new Set(Object.keys(existingCodesObj || {}));
    let code;
    do {
      code = '';
      for (let i = 0; i < length; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      }
    } while (existing.has(code));
    return code;
  }

  /** Fisher–Yates shuffle — unbiased O(n) shuffle. Never use array.sort(random). */
  function fisherYatesShuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formatOvers(legalBalls) {
    const overs = Math.floor(legalBalls / 6);
    const balls = legalBalls % 6;
    return `${overs}.${balls}`;
  }

  function formatCurrency(amount) {
    // Simple lakh/crore-aware formatting for auction purses
    if (amount >= 10000000) return (amount / 10000000).toFixed(2).replace(/\.00$/, '') + ' Cr';
    if (amount >= 100000) return (amount / 100000).toFixed(2).replace(/\.00$/, '') + ' L';
    return amount.toLocaleString();
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function toast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'toast';
    if (type === 'error') el.style.borderColor = 'var(--boundary-red)';
    if (type === 'success') el.style.borderColor = 'var(--success-green)';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem('pitchcodeSession') || 'null'); }
    catch (e) { return null; }
  }

  function setSession(data) {
    sessionStorage.setItem('pitchcodeSession', JSON.stringify(data));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  return {
    generateId, generateUniqueCode, fisherYatesShuffle, formatOvers,
    formatCurrency, deepClone, toast, qs, getSession, setSession, escapeHtml
  };
})();
