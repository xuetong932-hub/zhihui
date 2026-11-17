// Day / night appearance. Runs in <head> before the page paints so there is no light flash in night mode.
// Two modes only, chosen per device: 'light' (default, also for older 'system' values) or 'dark'. Never synced.
(function () {
  var KEY = 'knowledge-review.theme.v1';
  function read() { try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch (error) { return 'light'; } }
  function apply(theme) {
    var root = document.documentElement;
    root.dataset.theme = theme; root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', theme === 'dark' ? '#121417' : '#ffffff');
    var scheme = document.querySelector('meta[name="color-scheme"]'); if (scheme) scheme.setAttribute('content', theme);
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
  }
  var theme = read(); apply(theme);
  window.knowledgeReviewTheme = {
    get theme() { return theme; },
    toggle: function () { theme = theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(KEY, theme); } catch (error) { /* This page only. */ } apply(theme); return theme; }
  };
})();

// Display settings (我的 → 个性化 → 显示): text size, higher contrast, less motion. Kept on this device, applied before
// the first paint as data attributes on <html>. "Less motion" also answers the app's prefers-reduced-motion checks.
(function () {
  var KEY = 'knowledge-review.display.v1', DEFAULTS = { text: 'normal', contrast: false, motion: false };
  var root = document.documentElement;
  function read() {
    try { var data = JSON.parse(localStorage.getItem(KEY) || '{}'); return { text: ['normal', 'large', 'xlarge'].indexOf(data.text) >= 0 ? data.text : 'normal', contrast: data.contrast === true, motion: data.motion === true }; }
    catch (error) { return { text: 'normal', contrast: false, motion: false }; }
  }
  var settings = read();
  function apply() {
    if (settings.text === 'normal') delete root.dataset.text; else root.dataset.text = settings.text;
    if (settings.contrast) root.dataset.contrast = 'high'; else delete root.dataset.contrast;
    if (settings.motion) root.dataset.motion = 'reduce'; else delete root.dataset.motion;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (error) { /* This page only. */ } apply(); }
  var media = window.matchMedia && window.matchMedia.bind(window);
  if (media) window.matchMedia = function (query) {
    if (settings.motion && /prefers-reduced-motion:\s*reduce/.test(query)) return { matches: true, media: query, onchange: null, addEventListener: function () {}, removeEventListener: function () {}, addListener: function () {}, removeListener: function () {}, dispatchEvent: function () { return false; } };
    return media(query);
  };
  apply();
  window.knowledgeReviewDisplay = {
    get: function () { return { text: settings.text, contrast: settings.contrast, motion: settings.motion }; },
    set: function (patch) { for (var key in patch) if (key in DEFAULTS) settings[key] = patch[key]; save(); },
    reset: function () { settings = { text: 'normal', contrast: false, motion: false }; save(); },
    isDefault: function () { return settings.text === 'normal' && !settings.contrast && !settings.motion; }
  };
})();
