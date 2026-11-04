import { translate } from './i18n.js';
// Learning modules: four built-in presets plus user-defined custom modules stored in the profile.
// Deleting a module archives it (hidden, records kept, restorable); built-in modules always keep their entry,
// and a custom module without records is removed outright. Shared by the browser and the local server.
export const PRESET_MODULES = ['coding', 'english', 'work', 'life'];
export const LEVELS = ['beginner', 'some', 'advanced'];
export const MAX_CUSTOM_MODULES = 8;
// Icons a custom module may pick (drawn in module-icons.js). Optional; profiles without one show a bookmark.
export const CUSTOM_ICONS = ['bookmark', 'bulb', 'flask', 'globe', 'music', 'palette', 'chart', 'heart', 'camera', 'leaf'];
export const MIN_DAILY_MINUTES = 1, MAX_DAILY_MINUTES = 120;
const PRESET_NAMES = {
  zh: { coding: '编程', english: '英语', work: '工作知识', life: '生活常识' },
  en: { coding: 'Coding', english: 'English', work: 'Work knowledge', life: 'Everyday knowledge' },
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
  if (isPresetModule(id)) return translate(PRESET_NAMES.zh[id], PRESET_NAMES.en[id], undefined, locale);
  return profile?.modules?.[id]?.name || translate('已删除的模块', 'Deleted module', undefined, locale);
}
export const isActiveModule = (profile, id) => Boolean(profile?.modules?.[id]?.enabled && !profile.modules[id].archived);
// Modules shown in the app, in settings order (presets first, then custom modules in the order added).
export const activeModuleIds = profile => Object.keys(profile?.modules || {}).filter(id => isActiveModule(profile, id));
export const customModuleIds = profile => Object.keys(profile?.modules || {}).filter(isCustomModule);
export function validModules(modules) {
  if (!modules || typeof modules !== 'object' || Array.isArray(modules)) return false;
  const entries = Object.entries(modules), custom = entries.filter(([id]) => isCustomModule(id));
  const names = new Set();
  return PRESET_MODULES.every(id => modules[id])
    && entries.every(([id, item]) => isModuleId(id) && item && typeof item.enabled === 'boolean' && LEVELS.includes(item.level)
      && (item.archived === undefined || typeof item.archived === 'boolean') && (isPresetModule(id) || validModuleName(item.name)) && (item.icon === undefined || (!isPresetModule(id) && CUSTOM_ICONS.includes(item.icon))))
    // Up to 8 visible custom modules, plus room for archived ones that still hold records.
    && custom.filter(([, item]) => !item.archived).length <= MAX_CUSTOM_MODULES && custom.length <= MAX_CUSTOM_MODULES * 3
    && custom.filter(([, item]) => !item.archived).every(([, item]) => { const key = item.name.toLowerCase(); if (names.has(key)) return false; names.add(key); return true; })
    && entries.some(([, item]) => item.enabled && !item.archived);
}
