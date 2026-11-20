// Neon Bay — i18n: one string system for every user-facing word in the game.
//
// CONTRACT (shared with Builders A and B — do not rename these functions):
//   t(key, vars?)        — string in the active language, falling back to
//                          English when the key is missing there; supports
//                          simple {name} interpolation.
//   addStrings(lang, dict) — register a module's strings ('en' | 'id').
//   setLang(lang)        — switch language ('en' | 'id'), persist it to
//                          localStorage, and apply it live without restart.
//   getLang()            — the active language. Default 'en' when nothing
//                          is stored yet.
// Static HTML uses data-i18n="key" (text), data-i18n-html="key" (innerHTML,
// for strings that carry their own <b> markup) and data-i18n-title="key"
// (title attribute); applyI18nToDOM() walks them. Dynamic panels call t()
// when they render, and re-render on the 'neonbay:langchange' window event.
// Proper nouns (people, place names, weapon model names) are NOT
// translated — only the words around them are.

export const LANG_KEY = 'neon-bay-lang-v1';
export const SUPPORTED_LANGS = ['en', 'id'];
export const DEFAULT_LANG = 'en';

const STRINGS = { en: {}, id: {} };

function storedLang() {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    if (v === 'en' || v === 'id') return v;
  } catch {
    // Storage unavailable (private mode, tests) — fall back to English.
  }
  return DEFAULT_LANG;
}

let currentLang = storedLang();

/**
 * Look a string up in the active language, falling back to English, then
 * to the key itself so a missing translation is visible, never blank.
 */
export function t(key, vars) {
  const active = STRINGS[currentLang] || {};
  let s = active[key];
  if (s === undefined) s = STRINGS.en[key];
  if (s === undefined) return key;
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (m, name) => (vars[name] !== undefined ? String(vars[name]) : m));
  }
  return s;
}

/** Register one module's strings. Later calls merge (and may override). */
export function addStrings(lang, dict) {
  if (lang !== 'en' && lang !== 'id') return;
  if (!dict || typeof dict !== 'object') return;
  Object.assign(STRINGS[lang], dict);
}

/** True when the key exists in the active language or in English. */
export function hasString(key) {
  return (STRINGS[currentLang] && STRINGS[currentLang][key] !== undefined)
    || STRINGS.en[key] !== undefined;
}

export function getLang() {
  return currentLang;
}

/**
 * Switch language, persist it, apply it to the static DOM immediately and
 * tell every dynamic panel (map, backpack, settings, HUD buttons) to
 * re-render via the 'neonbay:langchange' window event. No restart needed.
 * Returns false for an unsupported language.
 */
export function setLang(lang) {
  if (lang !== 'en' && lang !== 'id') return false;
  if (lang === currentLang) {
    applyI18nToDOM();
    return true;
  }
  currentLang = lang;
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Keep the in-memory language even when storage is unavailable.
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
  }
  applyI18nToDOM();
  try {
    window.dispatchEvent(new window.CustomEvent('neonbay:langchange', { detail: { lang } }));
  } catch {
    // Event dispatch must never break a language switch.
  }
  return true;
}

/** Subscribe to language changes (fn receives the new language code). */
export function onLangChange(fn) {
  if (typeof window === 'undefined' || typeof fn !== 'function') return () => {};
  const handler = (event) => fn(event && event.detail ? event.detail.lang : currentLang);
  window.addEventListener('neonbay:langchange', handler);
  return () => window.removeEventListener('neonbay:langchange', handler);
}

/**
 * Apply the active language to static HTML: [data-i18n] sets textContent,
 * [data-i18n-html] sets innerHTML (only for our own strings, which may
 * carry <b> markup), [data-i18n-title] sets the title attribute and
 * [data-i18n-aria] sets aria-label. Safe to call before the DOM exists
 * (no-op) and after every language switch.
 */
export function applyI18nToDOM(root) {
  try {
    const doc = root || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function') return;
    doc.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    doc.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    doc.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    doc.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
  } catch {
    // A missing element must never break the game boot.
  }
}
