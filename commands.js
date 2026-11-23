import { db, save, user, group, num, pick, rand, lvl, style, STYLES, stretch, frame, PREFIX as P, BOT } from './lib.js';

export const cmds = [];
const add = (cat, names, desc, run, o = {}) => cmds.push({ cat, names: names.split(' '), desc, run, ...o });
const G = { group: true }, A = { group: true, admin: true }, AB = { group: true, admin: true, botAdmin: true };
const target = c => c.mentioned[0] || c.quoted?.participant ||
  (c.args[0]?.replace(/\D/g, '').length > 6 ? c.args[0].replace(/\D/g, '') + '@s.whatsapp.net' : null);
const toggle = (key, label) => c => {
  const g = group(c.jid), a = (c.args[0] || '').toLowerCase();
  g[key] = ['on', 'تشغيل', 'فعل', '1'].includes(a) ? true : ['off', 'ايقاف', 'عطل', '0'].includes(a) ? false : !g[key];
  save(); c.reply(`${label}: ${g[key] ? '✅ مفعّل' : '❌ معطّل'}`);
};

export async function addWarn(c, t) {
  const g = group(c.jid), k = num(t);
  g.warns[k] = (g.warns[k] || 0) + 1;
  if (g.warns[k] >= 3) {
    delete g.warns[k];
    await c.sock.groupParticipantsUpdate(c.jid, [t], 'remove');
    c.reply(`🚫 @${k} وصل 3 تحذيرات وتم طرده`, [t]);
  } else c.reply(`⚠️ @${k} تحذير ${g.warns[k]}/3`, [t]);
  save();
}

/* ═════════ عامة ═════════ */
const ICONS = { 'عامة': '🌐', 'مجموعات': '👥', 'ترفيه': '🎮', 'اقتصاد': '💰', 'أدوات': '🧰', 'مالك': '👑' };
add('عامة', 'اوامر قائمة menu help', 'قائمة الأوامر', c => {
  const cats = [...new Set(cmds.map(x => x.cat))];
  let t = '';
  for (const cat of cats) {
    t += `\n┏━ ${ICONS[cat] || '✦'} ${cat} ━\n`;
    t += cmds.filter(x => x.cat === cat).map(x => `┃ ◈ ${P}${x.names[0]} ‹ ${x.desc}`).join('\n') + '\n┗━━━━━━━━';
  }
  c.reply(frame(BOT, `👤 @${num(c.sender)}\n⌨️ البادئة: ${P}\n📦 الأوامر: ${cmds.length}`) + '\n' + t, [c.sender]);
});
add('عامة', 'بينغ ping', 'سرعة الاستجابة', c => c.reply(`🏓 ${Math.abs(Date.now() - Number(c.m.messageTimestamp) * 1000)}ms`));
add('عامة', 'وقت time', 'الوقت والتاريخ', c => c.reply('🕐 ' + new Date().toLocaleString('ar-EG', { timeZone: process.env.TZ_NAME || 'Asia/Riyadh' })));
add('عامة', 'حالة status', 'حالة البوت', c => {
  const s = process.uptime() | 0;
  c.reply(frame(BOT, `⏱️ التشغيل: ${(s / 3600) | 0}س ${((s % 3600) / 60) | 0}د\n💾 الذاكرة: ${(process.memoryUsage().rss / 1048576) | 0}MB\n👥 المستخدمين: ${Object.keys(db.users).length}`));
});
add('عامة', 'المطور owner', 'رقم المطور', c => c.reply(`👑 wa.me/${c.owners[0] || ''}`));
add('عامة', 'ايدي id', 'معرّفك ومعرّف المحادثة', c => c.reply(`🆔 ${c.uid}\n💬 ${c.jid}`));

/* ═════════ مجموعات ═════════ */
add('مجموعات', 'طرد kick', 'طرد عضو (منشن/رد)', async c => {
  const t = target(c); if (!t) return c.reply('↩️ منشن أو رد على العضو');
  await c.sock.groupParticipantsUpdate(c.jid, [t], 'remove'); c.reply(`🚫 تم طرد @${num(t)}`, [t]);
}, AB);
add('مجموعات', 'ترقية promote', 'ترقية لمشرف', async c => {
  const t = target(c); if (!t) return c.reply('↩️ منشن أو رد على العضو');
  await c.sock.groupParticipantsUpdate(c.jid, [t], 'promote'); c.reply(`⬆️ @${num(t)} صار مشرف`, [t]);
}, AB);
add('مجموعات', 'خفض demote', 'خفض مشرف', async c => {
  const t = target(c); if (!t) return c.reply('↩️ منشن أو رد على المشرف');
  await c.sock.groupParticipantsUpdate(c.jid, [t], 'demote'); c.reply(`⬇️ @${num(t)} لم يعد مشرف`, [t]);
}, AB);
add('مجموعات', 'كتم mute', 'إغلاق المجموعة للمشرفين', async c => { await c.sock.groupSettingUpdate(c.jid, 'announcement'); c.reply('🔇 المجموعة مغلقة'); }, AB);
add('مجموعات', 'فتح unmute', 'فتح المجموعة للجميع', async c => { await c.sock.groupSettingUpdate(c.jid, 'not_announcement'); c.reply('🔊 المجموعة مفتوحة'); }, AB);
add('مجموعات', 'منشن tagall', 'منشن للجميع', c => {
  const ids = c.meta.participants.map(p => p.id);
  c.reply(`📢 ${c.text || 'نداء للجميع'}\n\n` + ids.map(i => '@' + num(i)).join(' '), ids);
}, A);
add('مجموعات', 'رابط link', 'رابط المجموعة', async c => c.reply('🔗 https://chat.whatsapp.com/' + await c.sock.groupInviteCode(c.jid)), { group: true, botAdmin: true });
add('مجموعات', 'حذف del', 'حذف رسالة (رد عليها)', async c => {
  if (!c.quoted) return c.reply('↩️ رد على الرسالة');
  await c.sock.sendMessage(c.jid, { delete: { remoteJid: c.jid, fromMe: false, id: c.quoted.id, participant: c.quoted.participant } });
}, AB);
add('مجموعات', 'تحذير warn', 'تحذير عضو (3 = طرد)', async c => {
  const t = target(c); if (!t) return c.reply('↩️ منشن أو رد على العضو'); await addWarn(c, t);
}, AB);
add('مجموعات', 'مشرفين admins', 'قائمة المشرفين', c => {
  const ad = c.meta.participants.filter(p => p.admin).map(p => p.id);
  c.reply(frame('المشرفين', ad.map(i => '👮 @' + num(i)).join('\n')), ad);
}, G);
add('مجموعات', 'مجموعة ginfo', 'معلومات المجموعة', c => {
  const m = c.meta;
  c.reply(frame('المجموعة', `📛 ${m.subject}\n👥 الأعضاء: ${m.participants.length}\n👮 المشرفين: ${m.participants.filter(p => p.admin).length}\n📅 ${new Date((m.creation || 0) * 1000).toLocaleDateString('ar-EG')}`));
}, G);
add('مجموعات', 'ترحيب welcome', 'تشغيل/إيقاف الترحيب', toggle('welcome', '👋 الترحيب'), A);
add('مجموعات', 'مضاد-روابط antilink', 'مضاد الروابط (3 تحذيرات)', toggle('antilink', '🔗 مضاد الروابط'), A);

/* ═════════ ترفيه ═════════ */
add('ترفيه', 'نرد dice', 'رمي نرد', c => c.reply(`🎲 ${rand(1, 6)}`));
add('ترفيه', 'حجر rps', 'حجر ورقة مقص', c => {
  const o = ['حجر', 'ورقة', 'مقص'], u = c.args[0], b = pick(o);
  if (!o.includes(u)) return c.reply('✋ اكتب: حجر / ورقة / مقص');
  const w = u === b ? '🤝 تعادل' : (u === 'حجر' && b === 'مقص') || (u === 'ورقة' && b === 'حجر') || (u === 'مقص' && b === 'ورقة') ? '🏆 فزت' : '💀 خسرت';
  c.reply(`أنت: ${u}\nأنا: ${b}\n${w}`);
});
add('ترفيه', 'حظ luck', 'حظك اليوم', c => c.reply(`🍀 حظك ${rand(0, 100)}%`));
add('ترفيه', 'نسبة rate', 'نسبة لأي شي', c => c.reply(`📊 نسبة ${c.text || 'الغباء'}: ${rand(0, 100)}%`));
add('ترفيه', 'اختر pick', 'اختيار (افصل بـ | )', c => {
  const o = c.text.split(/\||\sاو\s/).map(s => s.trim()).filter(Boolean);
  c.reply(o.length < 2 ? '❓ مثال: .اختر شاي | قهوة' : `✅ ${pick(o)}`);
});
add('ترفيه', 'نكتة joke', 'نكتة', c => c.reply('😂 ' + pick([
  'واحد غبي سأله صاحبه: كم الساعة؟ قال: نفس اللي مرّ عليها أمس.',
  'قال له: أنت ذكي جداً! قال: لا والله، بس الباقين يساعدوني.',
  'مرة واحد نسي الباسورد، سجّل دخول بـ "نسيت كلمة المرور".',
  'سألوا الكسول: ليش واقف؟ قال: الجلوس يتعب.',
  'المبرمج راح يشتري حليب، قالت له زوجته: وإذا لقيت بيض جيب 6. رجع بـ 6 حليب.'])));
add('ترفيه', 'صراحة truth', 'سؤال صراحة', c => c.reply('🎤 ' + pick([
  'مين آخر شخص فكرت فيه؟', 'أكبر كذبة قلتها؟', 'شي ندمت عليه؟', 'أغرب عادة عندك؟',
  'مين أكثر شخص تثق فيه؟', 'لو تقدر ترجع بالزمن وش تغير؟'])));
add('ترفيه', 'سؤال 8ball', 'اسأل البوت', c => c.reply(c.text ? '🔮 ' + pick(['نعم', 'لا', 'ممكن', 'أكيد', 'مستحيل', 'اسأل لاحقاً', 'الأغلب نعم']) : '❓ اكتب سؤالك'));

/* ═════════ اقتصاد ═════════ */
add('اقتصاد', 'رصيد bal', 'رصيدك', c => { const t = target(c), u = user(t ? num(t) : c.uid); c.reply(`💰 ${u.coins.toLocaleString()} عملة`); });
add('اقتصاد', 'راتب daily', 'راتب يومي 500', c => {
  const u = user(c.uid), left = 86400000 - (Date.now() - u.daily);
  if (left > 0) return c.reply(`⏳ بعد ${Math.ceil(left / 3600000)} ساعة`);
  u.daily = Date.now(); u.coins += 500; save(); c.reply('💵 +500 عملة');
});
add('اقتصاد', 'عمل work', 'اشتغل كل ساعة', c => {
  const u = user(c.uid), left = 3600000 - (Date.now() - u.work);
  if (left > 0) return c.reply(`⏳ بعد ${Math.ceil(left / 60000)} دقيقة`);
  const g = rand(50, 150); u.work = Date.now(); u.coins += g; save();
  c.reply(`🛠️ اشتغلت ${pick(['حارس', 'مبرمج', 'سواق', 'طباخ', 'صياد'])} وكسبت ${g}`);
});
add('اقتصاد', 'مقامرة bet', 'مقامرة بمبلغ', c => {
  const u = user(c.uid), a = parseInt(c.args[0]);
  if (!a || a < 1 || a > u.coins) return c.reply('❌ مبلغ غير صالح');
  const win = Math.random() < 0.45; u.coins += win ? a : -a; save();
  c.reply(win ? `🎉 ربحت ${a}` : `💸 خسرت ${a}`);
});
add('اقتصاد', 'تحويل pay', 'تحويل عملات (منشن + مبلغ)', c => {
  const t = target(c), a = parseInt(c.args.find(x => /^\d{1,9}$/.test(x))), u = user(c.uid);
  if (!t || !a || a > u.coins || num(t) === c.uid) return c.reply('❌ مثال: .تحويل @شخص 100');
  u.coins -= a; user(num(t)).coins += a; save(); c.reply(`✅ حوّلت ${a} إلى @${num(t)}`, [t]);
});
add('اقتصاد', 'مستوى level', 'مستواك', c => {
  const u = user(c.uid), l = lvl(u.xp);
  c.reply(frame('المستوى', `⭐ LVL ${l}\n✨ ${u.xp} / ${50 * (l + 1) ** 2} XP\n💰 ${u.coins}`));
});
add('اقتصاد', 'ترتيب top', 'أعلى 10', c => {
  const t = Object.entries(db.users).sort((a, b) => b[1].xp - a[1].xp).slice(0, 10);
  c.reply(frame('المتصدرين', t.map(([id, u], i) => `${i + 1}. ••${id.slice(-4)} ‹ LVL ${lvl(u.xp)}`).join('\n')));
});

/* ═════════ أدوات ═════════ */
add('أدوات', 'زخرفة deco', 'زخرفة نص', c => {
  const t = c.text; if (!t) return c.reply('✍️ اكتب النص بعد الأمر');
  const out = [...STYLES.filter(s => s !== 'plain').map(s => style(t, s)), stretch(t), `『${t}』`, `꧁${t}꧂`, `✦ ${t} ✦`];
  c.raw(out.map((x, i) => `${i + 1}. ${x}`).join('\n'));
});
add('أدوات', 'عكس rev', 'عكس النص', c => c.reply(Array.from(c.text || '...').reverse().join('')));
add('أدوات', 'حاسبة calc', 'حاسبة (مثال: .حاسبة 5*3)', c => {
  const e = c.text.replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/×/g, '*').replace(/÷/g, '/');
  if (!/^[\d+\-*/%().\s]+$/.test(e)) return c.reply('❌ عملية غير صالحة');
  try { c.reply(`🧮 ${e} = ${Function('"use strict";return (' + e + ')')()}`); } catch { c.reply('❌ خطأ في العملية'); }
});

/* ═════════ مالك ═════════ */
const OW = { owner: true };
add('مالك', 'خط font', 'تغيير خط البوت (1-6)', c => {
  const i = parseInt(c.args[0]) - 1;
  if (STYLES[i]) { db.settings.font = STYLES[i]; save(); return c.reply('✅ تم تغيير الخط: KANEKI Bot'); }
  c.raw(frame('الخطوط', STYLES.map((s, j) => `${j + 1}. ${style('KANEKI Bot', s)}`).join('\n')) + `\n\nمثال: ${P}خط 3`);
}, OW);
add('مالك', 'وضع mode', 'عام / خاص (public|private)', c => {
  db.settings.mode = ['private', 'خاص'].includes(c.args[0]) ? 'private' : 'public'; save();
  c.reply(`⚙️ الوضع: ${db.settings.mode}`);
}, OW);
add('مالك', 'بث bc', 'بث رسالة لكل المجموعات', async c => {
  if (!c.text) return c.reply('✍️ اكتب الرسالة');
  const gs = Object.keys(await c.sock.groupFetchAllParticipating());
  for (const id of gs) { await c.sock.sendMessage(id, { text: c.fx('📣 ' + c.text) }); await new Promise(r => setTimeout(r, 1500)); }
  c.reply(`✅ أُرسلت إلى ${gs.length} مجموعة`);
}, OW);
