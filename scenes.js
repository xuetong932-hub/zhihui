// Home scene backgrounds (phone home only): the desk by default, or another scene picked from the sheet. Each scene has
// a day picture and, where one exists, a night picture used in night mode. The choice is kept on this device only.
// Sources and licences: docs/BACKGROUNDS.md.
import { pick } from './i18n.js';

export const SCENE_CATEGORIES = [
  ['cozy', () => pick('默认', 'Default')], ['fresh', () => pick('小清新', 'Fresh')], ['anime', () => pick('二次元', 'Anime')], ['pixel', () => pick('像素风', 'Pixel')],
  ['game', () => pick('游戏风', 'Game')], ['nature', () => pick('风景', 'Scenery')], ['street', () => pick('街景', 'Street')], ['people', () => pick('人像', 'Portrait')],
];
export const SCENES = [
  { id: 'desk', cat: 'cozy', day: '/illustrations/home-desk.webp', night: '/scenes/desk-night.webp', thumb: '/scenes/desk-thumb.webp', name: () => pick('书桌', 'Desk') },
  { id: 'fresh', cat: 'fresh', day: '/scenes/fresh-day.webp', night: '/scenes/fresh-night.webp', name: () => pick('窗边阳台', 'Sunroom') },
  { id: 'anime', cat: 'anime', day: '/scenes/anime-day.webp', night: '/scenes/anime-night.webp', name: () => pick('晴空与夜色', 'Day and night') },
  { id: 'pixel', cat: 'pixel', day: '/scenes/pixel-day.webp', night: '/scenes/pixel-night.webp', name: () => pick('像素小书房', 'Pixel study') },
  { id: 'game', cat: 'game', day: '/scenes/game-day.webp', night: '/scenes/game-night.webp', name: () => pick('森林小屋', 'Forest cottage') },
  { id: 'lake', cat: 'nature', day: '/scenes/lake.webp', name: () => pick('湖光山色', 'Mountain lake') },
  { id: 'forest', cat: 'nature', day: '/scenes/forest.webp', name: () => pick('林间光束', 'Forest light') },
  { id: 'sea', cat: 'nature', day: '/scenes/sea.webp', name: () => pick('黄昏海面', 'Sunset sea') },
  { id: 'street', cat: 'street', day: '/scenes/street-day.webp', night: '/scenes/neon-street.webp', name: () => pick('街角咖啡', 'Corner café') },
  { id: 'neon-city', cat: 'street', day: '/scenes/neon-city.webp', name: () => pick('未来城市', 'Future city') },
  { id: 'portrait', cat: 'people', day: '/scenes/portrait-day.webp', night: '/scenes/silhouette.webp', name: () => pick('窗边阅读', 'Reading by the window') },
];
const KEY = 'knowledge-review.home-scene.v1';
export const sceneById = id => SCENES.find(scene => scene.id === id) || SCENES[0];
export function savedScene() {
  try { return sceneById(localStorage.getItem(KEY)); } catch { return SCENES[0]; }
}
export function saveScene(id) { try { localStorage.setItem(KEY, sceneById(id).id); } catch { /* This visit only. */ } }
// The picture for the current mode; `own` tells whether it is a real night picture (then it is not dimmed again).
export function sceneImage(scene, dark) {
  return dark && scene.night ? { src: scene.night, own: true } : { src: scene.day, own: false };
}
export const sceneThumb = (scene, dark) => scene.thumb && !dark ? scene.thumb : sceneImage(scene, dark).src.replace(/\.webp$/, '-thumb.webp');
