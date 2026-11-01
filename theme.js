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
