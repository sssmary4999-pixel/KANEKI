import fs from 'fs';
import path from 'path';

export const PREFIX = process.env.PREFIX || '.';
export const BOT = 'KANEKI';

/* ───── قاعدة بيانات JSON بسيطة ───── */
const file = process.env.BOT_DB_PATH || './data/db.json';
export const db = { users: {}, groups: {}, settings: {} };
try { Object.assign(db, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch {}
db.users ??= {}; db.groups ??= {}; db.settings ??= {};
db.settings.font ??= 'bold';
db.settings.mode ??= 'public';

let timer;
export const save = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(db)); }
    catch (e) { console.error('db save:', e.message); }
  }, 1500);
};
export const user = id => (db.users[id] ??= { coins: 100, xp: 0, daily: 0, work: 0, xpAt: 0 });
export const group = id => (db.groups[id] ??= { welcome: false, antilink: false, warns: {} });

/* ───── أدوات صغيرة ───── */
export const num = j => String(j || '').split('@')[0].split(':')[0];
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const lvl = xp => Math.floor(Math.sqrt(xp / 50));

/* ───── الخطوط المميزة (تعمل على الحروف اللاتينية) ───── */
const OFF = { bold: [0x1D5D4, 0x1D5EE], script: [0x1D4D0, 0x1D4EA], gothic: [0x1D56C, 0x1D586], mono: [0x1D670, 0x1D68A] };
const SMALL = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ';
export const STYLES = ['bold', 'script', 'gothic', 'mono', 'small', 'plain'];

const conv = (s, k) => Array.from(s).map(ch => {
  const c = ch.charCodeAt(0);
  const up = c >= 65 && c <= 90, lo = c >= 97 && c <= 122;
  if (!up && !lo) return ch;
  if (k === 'small') return SMALL[(c | 32) - 97];
  const o = OFF[k];
  if (!o) return ch;
  return String.fromCodePoint(up ? o[0] + c - 65 : o[1] + c - 97);
}).join('');

export const style = (t, k) => (k === 'plain' ? t : conv(t, k));
// يُطبَّق على كل رد، مع حماية الروابط والمنشن
export const fx = (t, k = db.settings.font) =>
  k === 'plain' ? t : t.split(/(https?:\/\/\S+|@\d+)/g).map((p, i) => (i % 2 ? p : conv(p, k))).join('');

/* ───── زخرفة العربي (مدّ الحروف) ───── */
const NOJOIN = 'اأإآدذرزوةىءؤ';
export const stretch = t => t.replace(/[\u0621-\u064A]/g, ch => (NOJOIN.includes(ch) ? ch : ch + 'ـ'));

export const frame = (title, body) =>
  `╭━━━〔 ${title} 〕━━━╮\n${body.split('\n').map(l => '┃ ' + l).join('\n')}\n╰━━━━━━━━━━━━━━╯`;
