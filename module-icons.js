// Line icons for learning modules: 24px grid, 1.6 stroke, currentColor, drawn for 知回 (no third-party icon set).
// Built-in modules have a fixed icon; a custom module uses the icon picked in settings, bookmark by default.
import { CUSTOM_ICONS, isPresetModule } from './modules.js';
const PATHS = {
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 5l-4 14"/>',
  book: '<path d="M3 5.5c2.8-1 5.8-1 9 1v13c-3.2-2-6.2-2-9-1zM21 5.5c-2.8-1-5.8-1-9 1v13c3.2-2 6.2-2 9-1z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
  house: '<path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.5 15h9"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
  chart: '<path d="M4 20h16M7 16v-4M12 16V8M17 16V9"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.5"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l8-8"/>',
  // Built-in subjects added 2026-11-15 (with heart, palette, flask and bulb above).
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2.1 0 2.9 5.8 1.5 5.8 4.3 0 1.3-1.2 2.1-3 2.1-1.4 0-2.5-.6-3-1.6M12 6v1.8M12 16.3V18"/>',
  scale: '<path d="M12 4v16M8 20h8M5 7h14M7 7l-3 6a3 3 0 0 0 6 0zM17 7l-3 6a3 3 0 0 0 6 0z"/>',
  columns: '<path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5h.01M15 9.5h.01"/>',
  shapes: '<circle cx="7.5" cy="7.5" r="3.5"/><rect x="13.5" y="4" width="7" height="7" rx="1"/><path d="M7.5 13.5l4 7h-8zM17 13.5v7M13.5 17h7"/>',
  cross: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
  // Phone tab bar (with house and book above).
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  // First-run guide: ask by voice or by typing.
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  // Phone "Me" page: download the Android app.
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
};
const PRESET_ICONS = { coding: 'code', english: 'book', work: 'briefcase', life: 'house', health: 'cross', finance: 'coin', design: 'palette', science: 'flask', humanities: 'columns', law: 'scale', mind: 'smile', other: 'shapes' };
// colour is an SVG attribute, not inline CSS, so the page's style-src 'self' policy allows it.
export const iconSvg = (name, size = 20, color = 'currentColor') => `<svg class="mod-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${/^#[0-9a-f]{3,8}$/i.test(color) ? color : 'currentColor'}"stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.bookmark}</svg>`;
export const moduleIconName = (profile, id) => isPresetModule(id) ? PRESET_ICONS[id] : CUSTOM_ICONS.includes(profile?.modules?.[id]?.icon) ? profile.modules[id].icon : 'bookmark';
export const moduleIcon = (profile, id, size, color) => iconSvg(moduleIconName(profile, id), size, color);
export { CUSTOM_ICONS };
