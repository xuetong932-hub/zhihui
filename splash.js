// Loading screen text in the saved interface language (it runs before the app and its catalogs load).
// The "slow network" line only becomes visible after 8 s (CSS); app.js removes the whole screen when ready.
(() => {
  const TEXT = {
    zh: ['加载中', '网络有点慢，小回还在努力赶来…'],
    'zh-TW': ['載入中', '網路有點慢，小回還在努力趕來…'],
    en: ['Loading', 'The network is slow. Backy is still on the way…'],
    ja: ['読み込み中', '通信が少し遅いようです。Backy が向かっています…'],
    ko: ['불러오는 중', '네트워크가 조금 느려요. Backy가 열심히 오고 있어요…'],
    ms: ['Memuatkan', 'Rangkaian agak perlahan. Backy masih dalam perjalanan…'],
    es: ['Cargando', 'La conexión va lenta. Backy sigue en camino…'],
    fr: ['Chargement', 'La connexion est lente. Backy arrive bientôt…'],
    pt: ['Carregando', 'A conexão está lenta. Backy ainda está a caminho…'],
    de: ['Wird geladen', 'Die Verbindung ist langsam. Backy ist noch unterwegs…'],
  };
  let code = null;
  try { code = localStorage.getItem('knowledge-review.locale.v1'); } catch { /* Private mode: fall back below. */ }
  const [label, slow] = TEXT[code] || TEXT.en;
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.setAttribute('aria-label', label);
  const line = splash.querySelector('.splash-slow');
  if (line) line.textContent = slow;
})();
