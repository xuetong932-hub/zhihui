// How a growth milestone (journey.js) reads: its title, its rule and its picture. Used by the beanstalk's category
// sheet (garden-ui.js openLimb).
import { pick } from './i18n.js';
import { badgeName, RULE, levelTitle } from './badges-ui.js';
import { itemName, itemIcon } from './shop-ui.js';

const TIER = () => [pick('铜', 'Bronze'), pick('银', 'Silver'), pick('金', 'Gold')];
export function stepText(step) {
  if (step.kind === 'badge') return { title: `${badgeName(step.id)}${step.tiers.length > 1 ? ` · ${TIER()[step.tier - 1]}` : ''}`, rule: RULE[step.id](step.need), icon: `/illustrations/badges/${step.id}.webp` };
  if (step.kind === 'level') return { title: pick('升到 Lv.{n}', 'Reached Lv.{n}', { n: step.level }), rule: levelTitle(step.level), icon: '/illustrations/mascot-cheer.webp' };
  if (step.kind === 'ask') return { title: pick('提问 {n} 次', '{n} questions', { n: step.need }), rule: pick('累计提出 {n} 个问题', 'Asked {n} questions in all', { n: step.need }), icon: '/illustrations/badges/first.webp' };
  return { title: pick('第一件新衣服', 'First outfit piece'), rule: itemName(step.item), icon: itemIcon(step.item) };
}
