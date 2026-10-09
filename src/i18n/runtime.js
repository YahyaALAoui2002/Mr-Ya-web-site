/* Mr Ye i18n runtime (browser). Inlined in the page right after src/i18n/core.js, before the scripts that build the UI.
   Static text carries data-i18n="key" (the element's text), data-i18n-attr="attr:key;attr:key" (attributes) or data-price="12.5" (a price).
   build.mjs pre-translates every page, so the text is already right before this runs; this script makes a language switch work in place.
   Exposes window.mryeT(key, args) and window.mryeLang(), and fires a "langchange" event on document after a switch. */
(() => {
  const C = MRYE_I18N_CORE, D = /*__I18N_DICTS__*/{};
  const html = document.documentElement;
  const mode = html.getAttribute('data-lang-mode') || 'inline';                // "pages": one real URL per language (production); "inline": one file, switched in place (portable build)
  let lang = html.getAttribute('data-lang') || 'fr';
  const t = (k, a) => C.translate(D, lang, k, a);
  window.mryeT = t; window.mryeLang = () => lang;
  function apply() {
    html.lang = C.HTML_LANG[lang]; html.setAttribute('data-lang', lang);
    document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-attr]').forEach((e) => e.getAttribute('data-i18n-attr').split(';').forEach((p) => { const i = p.indexOf(':'); e.setAttribute(p.slice(0, i), t(p.slice(i + 1))); }));
    document.querySelectorAll('[data-price]').forEach((e) => { const p = C.fmt(lang, parseFloat(e.getAttribute('data-price')), e.getAttribute('data-price-prefix') || ''); e.textContent = e.hasAttribute('data-price-from') ? t('from', { p }) : p; });
    document.querySelectorAll('[data-lang-set]').forEach((a) => { if (a.getAttribute('data-lang-set') === lang) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  function set(l) {
    if (C.LANGS.indexOf(l) < 0 || l === lang) return;
    lang = l; apply();
    try { if (mode === 'inline') localStorage.setItem('mrye-lang', l); } catch (e) { /* private mode: the choice just is not remembered */ }
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }
  if (mode === 'inline') {                                                     // ?lang=en wins, then the remembered choice, then French
    let want = null;
    try { want = new URLSearchParams(location.search).get('lang'); } catch (e) { /* no URLSearchParams */ }
    if (!want) { try { want = localStorage.getItem('mrye-lang'); } catch (e) { /* storage blocked */ } }
    if (want && C.LANGS.indexOf(want) >= 0 && want !== lang) { lang = want; apply(); }
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-lang-set]');
    if (!a || mode !== 'inline') return;                                       // in "pages" mode the link is a normal link to the other page
    e.preventDefault(); set(a.getAttribute('data-lang-set'));
  });
})();
