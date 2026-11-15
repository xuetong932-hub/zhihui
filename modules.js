import { translate } from './i18n.js';
// Learning modules: twelve built-in subjects plus user-defined custom modules stored in the profile.
// Questions are asked in one place and the model files each knowledge card into one of the active modules, so a
// book appears on the shelf once it holds cards. Deleting a module archives it (hidden, records kept, restorable);
// built-in modules always keep their entry, and a custom module without records is removed outright.
// Shared by the browser and the local server.
export const PRESET_MODULES = ['coding', 'english', 'work', 'life', 'health', 'finance', 'design', 'science', 'humanities', 'law', 'mind', 'other'];
// The first four existed before the subject list grew (2026-11-15): every saved profile has them; the others are
// added when an older profile is read (withAllPresets).
export const LEGACY_PRESETS = ['coding', 'english', 'work', 'life'];
// Questions are asked in this module's conversations; cards it cannot place elsewhere stay in it.
export const ASK_MODULE = 'other';
export const LEVELS = ['beginner', 'some', 'advanced'];
export const MAX_CUSTOM_MODULES = 8;
// Icons a custom module may pick (drawn in module-icons.js). Optional; profiles without one show a bookmark.
export const CUSTOM_ICONS = ['bookmark', 'bulb', 'flask', 'globe', 'music', 'palette', 'chart', 'heart', 'camera', 'leaf'];
// Book-cover colours a module may pick on the phone bookshelf (optional; without one a default is used).
export const COVER_COLORS = ['sky', 'sage', 'honey', 'coral', 'lavender', 'teal', 'rose', 'olive'];
export const MIN_DAILY_MINUTES = 1, MAX_DAILY_MINUTES = 120;
const PRESET_NAMES = {
  coding: ['编程技术', 'Coding'], english: ['语言学习', 'Languages'], work: ['职场技能', 'Work skills'], life: ['生活常识', 'Everyday knowledge'],
  health: ['健康医疗', 'Health'], finance: ['金融理财', 'Money and finance'], design: ['设计创意', 'Design and creativity'], science: ['科学自然', 'Science and nature'],
  humanities: ['人文历史', 'History and culture'], law: ['法律常识', 'Law basics'], mind: ['情感心理', 'Mind and relationships'], other: ['其他', 'Other'],
};
export const isPresetModule = id => PRESET_MODULES.includes(id);
export const isCustomModule = id => typeof id === 'string' && /^c-[a-z0-9]{8}$/.test(id);
export const isModuleId = id => isPresetModule(id) || isCustomModule(id);
// Names are shown in the UI and passed to the model as data: one line, no control or markup characters.
export const cleanModuleName = value => String(value ?? '').replace(/[\p{C}<>]/gu, ' ').replace(/\s+/g, ' ').trim();
export const validModuleName = value => typeof value === 'string' && value === cleanModuleName(value) && value.length >= 1 && value.length <= 20;
export const validDailyMinutes = value => Number.isInteger(value) && value >= MIN_DAILY_MINUTES && value <= MAX_DAILY_MINUTES;
export function newCustomModuleId(random = () => crypto.getRandomValues(new Uint8Array(8))) {
  return `c-${[...random()].map(byte => 'abcdefghijklmnopqrstuvwxyz0123456789'[byte % 36]).join('')}`;
}
export function moduleLabel(profile, id, locale) {
  if (isPresetModule(id)) return translate(PRESET_NAMES[id][0], PRESET_NAMES[id][1], undefined, locale);
  return profile?.modules?.[id]?.name || translate('已删除的模块', 'Deleted module', undefined, locale);
}
export const isActiveModule = (profile, id) => Boolean(profile?.modules?.[id]?.enabled && !profile.modules[id].archived);
// Modules shown in the app, in settings order (presets first, then custom modules in the order added).
export const activeModuleIds = profile => [...PRESET_MODULES, ...Object.keys(profile?.modules || {}).filter(isCustomModule)].filter(id => isActiveModule(profile, id));
// An older profile gets the subjects added since it was saved (switched on, beginner level). Returns the same object
// when nothing is missing.
export function withAllPresets(modules) {
  if (!modules || typeof modules !== 'object' || Array.isArray(modules)) return modules;
  const missing = PRESET_MODULES.filter(id => !modules[id]);
  return missing.length ? { ...modules, ...Object.fromEntries(missing.map(id => [id, { enabled: true, level: 'beginner' }])) } : modules;
}
export const customModuleIds = profile => Object.keys(profile?.modules || {}).filter(isCustomModule);
export function validModules(modules) {
  if (!modules || typeof modules !== 'object' || Array.isArray(modules)) return false;
  const entries = Object.entries(modules), custom = entries.filter(([id]) => isCustomModule(id));
  const names = new Set();
  return LEGACY_PRESETS.every(id => modules[id])
    && entries.every(([id, item]) => isModuleId(id) && item && typeof item.enabled === 'boolean' && LEVELS.includes(item.level)
      && (item.archived === undefined || typeof item.archived === 'boolean') && (isPresetModule(id) || validModuleName(item.name)) && (item.icon === undefined || (!isPresetModule(id) && CUSTOM_ICONS.includes(item.icon))) && (item.color === undefined || COVER_COLORS.includes(item.color)))
    // Up to 8 visible custom modules, plus room for archived ones that still hold records.
    && custom.filter(([, item]) => !item.archived).length <= MAX_CUSTOM_MODULES && custom.length <= MAX_CUSTOM_MODULES * 3
    && custom.filter(([, item]) => !item.archived).every(([, item]) => { const key = item.name.toLowerCase(); if (names.has(key)) return false; names.add(key); return true; })
    && entries.some(([, item]) => item.enabled && !item.archived);
}
