// Daily habit: a review goal (cards per day; motivation only, scheduling is unchanged), a calendar reminder the
// phone's own calendar delivers even when 知回 is closed, and a check-in image made on the device and never uploaded.
import { localDay } from './knowledge-store.js';
import { pick } from './i18n.js';
export const DAILY_GOALS = Object.freeze([5, 10, 20, 30]);
export const DEFAULT_GOAL = 10;
export const goalOf = profile => DAILY_GOALS.includes(profile?.dailyGoal) ? profile.dailyGoal : DEFAULT_GOAL;
const dayStart = day => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); };
const shift = (day, n) => { const d = dayStart(day); d.setDate(d.getDate() + n); return localDay(d); };
// Different cards reviewed on each local day.
export function cardsPerDay(events) {
  const days = new Map();
  for (const event of events) { const day = localDay(event.at); if (!days.has(day)) days.set(day, new Set()); days.get(day).add(event.cardId); }
  return days;
}
export const doneToday = (events, now = new Date()) => cardsPerDay(events).get(localDay(now))?.size || 0;
// Days in a row the goal was met, ending today (or yesterday, while today is still in progress).
export function goalStreak(events, goal, now = new Date()) {
  const days = cardsPerDay(events), met = day => (days.get(day)?.size || 0) >= goal;
  let day = localDay(now); if (!met(day)) day = shift(day, -1);
  let count = 0; while (met(day)) { count++; day = shift(day, -1); }
  return count;
}

// A daily repeating calendar event with an alert at the start (iCalendar, RFC 5545). Floating local time, so it
// rings at the same clock time wherever the phone is.
export function reminderCalendar({ time, locale, url, now = new Date() }) {
  const [hh, mm] = /^\d{2}:\d{2}$/.test(time) ? time.split(':') : ['19', '00'], zh = locale === 'zh';
  const date = localDay(now).replaceAll('-', ''), stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const text = value => value.replace(/[\\,;]/g, char => `\\${char}`).replace(/\n/g, '\\n');
  const summary = pick('知回 · 每日复习', 'Knowledge Review · Daily review'), body = pick('花几分钟巩固今天的知识：{url}', 'Spend a few minutes reviewing: {url}', { url });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Knowledge Review//Daily reminder//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:daily-review-${date}${hh}${mm}@knowledge-review`, `DTSTAMP:${stamp}`, `DTSTART:${date}T${hh}${mm}00`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY',
    `SUMMARY:${text(summary)}`, `DESCRIPTION:${text(body)}`, `URL:${url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(summary)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}

// Check-in image, 1080 x 1440, drawn on a canvas. data: {date, done, goal, streak, goalStreak, modules: [names], titles: [..]}.
// No user name is drawn; titles only when the user ticked "show what I learned".
export function drawShareCard(canvas, data, { locale, showTitles = false } = {}) {
  const zh = locale === 'zh', W = 1080, H = 1440, ctx = canvas.getContext('2d'), font = (size, weight = 500) => `${weight} ${size}px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
  canvas.width = W; canvas.height = H;
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#2f6a50'); bg.addColorStop(0.6, '#3f8a68'); bg.addColorStop(1, '#5aa883');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.08)'; [[900, 160, 260], [120, 1300, 320], [980, 1180, 140]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  ctx.font = font(44, 700); ctx.fillText(pick('↗ 知回', '↗ Knowledge Review'), 90, 150);
  ctx.globalAlpha = 0.85; ctx.font = font(36); ctx.fillText(data.date, 90, 215); ctx.globalAlpha = 1;
  // Progress ring with today's count against the goal.
  const cx = W / 2, cy = 560, r = 230, progress = Math.min(1, data.goal ? data.done / data.goal : 0);
  ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(progress, 0.001)); ctx.stroke();
  ctx.textAlign = 'center'; ctx.font = font(150, 800); ctx.fillText(String(data.done), cx, cy + 30);
  ctx.font = font(40); ctx.globalAlpha = 0.9; ctx.fillText(pick('今日复习 / 目标 {v0} 张', 'reviewed / goal {v0}', { v0: data.goal }), cx, cy + 100); ctx.globalAlpha = 1;
  ctx.font = font(64, 800); ctx.fillText(data.done >= data.goal ? (pick('今日目标完成 ✓', 'Goal reached ✓')) : (pick('今天也在坚持', 'Showing up today')), cx, 920);
  ctx.font = font(40, 600); ctx.fillText(pick('连续复习 {v0} 天 · 连续达成 {v1} 天', '{v0}-day streak · goal met {v1} days in a row', { v0: data.streak, v1: data.goalStreak }), cx, 995);
  // Modules reviewed today as pills, centred.
  ctx.font = font(36, 600); const pills = data.modules.slice(0, 4), widths = pills.map(name => ctx.measureText(name).width + 64), gap = 20;
  let x = cx - (widths.reduce((s, w) => s + w, 0) + gap * Math.max(0, pills.length - 1)) / 2;
  pills.forEach((name, i) => { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.roundRect(x, 1050, widths[i], 72, 36); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(name, x + widths[i] / 2, 1099); x += widths[i] + gap; });
  if (showTitles && data.titles.length) {
    ctx.font = font(34); ctx.globalAlpha = 0.95;
    const label = pick('今天弄懂了：', 'Today I learned: '), line = `${label}${data.titles.slice(0, 3).join(pick('、', ', '))}`;
    ctx.fillText(line.length > (zh ? 30 : 56) ? `${line.slice(0, zh ? 29 : 55)}…` : line, cx, 1200); ctx.globalAlpha = 1;
  }
  ctx.font = font(34); ctx.globalAlpha = 0.85; ctx.fillText(pick('把好问题，变成记得住的知识。', 'Turn good questions into knowledge that stays.'), cx, 1340); ctx.globalAlpha = 1; ctx.textAlign = 'left';
  return canvas;
}

// Dialog: preview, optional "show what I learned", then share (system sheet with the image) or save the PNG.
export function openShareDialog({ locale, data }) {
  const zh = locale === 'zh', dialog = document.createElement('dialog'); dialog.className = 'share-dialog';
  let showTitles = false, url = '';
  const canvas = document.createElement('canvas');
  const draw = () => {
    drawShareCard(canvas, data, { locale, showTitles });
    canvas.toBlob(blob => {
      if (!blob) return; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
      const img = dialog.querySelector('.share-preview'); if (img) img.src = url;
      dialog.querySelector('[data-share]').onclick = async () => {
        const file = new File([blob], pick('知回打卡.png', 'knowledge-review-check-in.png'), { type: 'image/png' });
        try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: pick('知回打卡', 'Knowledge Review check-in') }); return; } } catch { return; /* Cancelled. */ }
        save();
      };
      const save = () => { const link = document.createElement('a'); link.href = url; link.download = pick('知回打卡.png', 'knowledge-review-check-in.png'); document.body.append(link); link.click(); link.remove(); };
      dialog.querySelector('[data-save]').onclick = save;
    }, 'image/png');
  };
  dialog.innerHTML = `<div class="share-panel"><div class="section-heading"><h2>${pick('打卡分享图', 'Check-in image')}</h2><button class="text-button" data-close>${pick('关闭', 'Close')}</button></div>
    <img class="share-preview" alt="${pick('打卡图预览', 'Check-in image preview')}">
    ${data.titles.length ? `<label class="check-row"><input type="checkbox" data-titles>${pick('显示今天弄懂的知识点', 'Show what I learned today')}</label>` : ''}
    <p class="field-hint">${pick('图片在这台设备上生成，不会上传；默认不显示你的名字。', 'Made on this device and never uploaded; your name is not shown.')}</p>
    <div class="share-actions"><button class="secondary-button" data-save>${pick('保存图片', 'Save image')}</button><button class="primary-button" data-share>${pick('分享', 'Share')}</button></div></div>`;
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.querySelector('[data-titles]')?.addEventListener('change', event => { showTitles = event.target.checked; draw(); });
  dialog.addEventListener('close', () => { if (url) URL.revokeObjectURL(url); dialog.remove(); });
  document.body.append(dialog); dialog.showModal(); draw();
}
