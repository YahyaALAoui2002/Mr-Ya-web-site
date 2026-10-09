/* Mr Ye i18n core: pure functions, used by the browser (inlined in the page) AND by build.mjs (to pre-translate the static pages).
   Dictionaries: src/i18n/{fr,en,zh}.json, flat "key": "text". French is the source and the fallback.
   In a text: {name} is replaced by an argument, {€12.5} by a price written the local way (fr "12,50 €", en/zh "€12.50"). */
const MRYE_I18N_CORE = (() => {
  const LANGS = ['fr', 'en', 'zh'];
  const HTML_LANG = { fr: 'fr', en: 'en', zh: 'zh-Hans' };                 // value of <html lang> and of hreflang
  const OG_LOCALE = { fr: 'fr_FR', en: 'en_GB', zh: 'zh_CN' };
  const NBSP = ' ';
  const fmt = (lang, n, prefix) => {
    const whole = Math.abs(n - Math.round(n)) < 1e-9;
    const num = whole ? String(Math.round(n)) : n.toFixed(2);
    return (prefix || '') + (lang === 'fr' ? num.replace('.', ',') + NBSP + '€' : '€' + num);
  };
  const translate = (dicts, lang, key, args) => {
    const d = dicts[lang] || {}, f = dicts.fr || {};
    const s = key in d ? d[key] : key in f ? f[key] : key;
    return s.replace(/\{€([\d.]+)\}/g, (m, x) => fmt(lang, parseFloat(x)))
      .replace(/\{(\w+)\}/g, (m, k) => (args && k in args ? args[k] : m));
  };
  return { LANGS, HTML_LANG, OG_LOCALE, fmt, translate };
})();
