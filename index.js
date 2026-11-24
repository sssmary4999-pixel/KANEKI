import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import http from 'http';
import { cmds, addWarn } from './commands.js';
import { db, save, user, group, num, fx, lvl, rand, PREFIX } from './lib.js';

const SESSION = process.env.SESSION_DIR || './session';
const PHONE = (process.env.PHONE_NUMBER || '').replace(/\D/g, '');
const OWNERS = (process.env.OWNER_NUMBER || PHONE).split(',').map(s => s.replace(/\D/g, '')).filter(Boolean);
const logger = pino({ level: 'silent' });
const metas = new Map();

process.on('unhandledRejection', e => console.error('rejection:', e?.message || e));
process.on('uncaughtException', e => console.error('exception:', e?.message || e));

const getMeta = async (sock, jid) => {
  const h = metas.get(jid);
  if (h && Date.now() - h.t < 60000) return h.m;
  const m = await sock.groupMetadata(jid);
  metas.set(jid, { m, t: Date.now() });
  return m;
};
const ids = p => [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).map(num);
const find = (meta, jid) => meta?.participants.find(p => ids(p).includes(num(jid)));

const bodyOf = m => {
  let x = m.message;
  x = x?.ephemeralMessage?.message ?? x?.viewOnceMessage?.message ?? x?.documentWithCaptionMessage?.message ?? x;
  return x?.conversation || x?.extendedTextMessage?.text || x?.imageMessage?.caption || x?.videoMessage?.caption || '';
};
const ctxInfoOf = m => {
  const x = m.message?.ephemeralMessage?.message ?? m.message;
  return x?.extendedTextMessage?.contextInfo || x?.imageMessage?.contextInfo || x?.videoMessage?.contextInfo || {};
};

async function handle(sock, m) {
  if (!m.message || m.key.remoteJid === 'status@broadcast') return;
  const jid = m.key.remoteJid, isGroup = jid.endsWith('@g.us');
  const sender = isGroup ? m.key.participant : m.key.fromMe ? sock.user.id : jid;
  if (!sender) return;
  const raw = bodyOf(m).trim();
  const meta = isGroup ? await getMeta(sock, jid) : null;
  const me = find(meta, sock.user.id) || find(meta, sock.user.lid);
  const p = find(meta, sender);
  const pn = num(p?.phoneNumber || (sender.endsWith('@s.whatsapp.net') ? sender : ''));
  const ci = ctxInfoOf(m);

  const c = {
    sock, m, jid, sender, meta, isGroup, owners: OWNERS, uid: num(sender),
    text: '', args: [], fx: t => fx(t),
    mentioned: ci.mentionedJid || [],
    quoted: ci.quotedMessage ? { participant: ci.participant, id: ci.stanzaId } : null,
    isAdmin: !!p?.admin,
    isBotAdmin: !!me?.admin,
    isOwner: !!m.key.fromMe || [...OWNERS, ...db.settings.devs].some(o => o === pn || o === num(sender)),
    reply: (t, mentions = []) => sock.sendMessage(jid, { text: fx(t), mentions }, { quoted: m }),
    raw: t => sock.sendMessage(jid, { text: t }, { quoted: m }),
  };

  // XP: مرة كل دقيقة
  const u = user(c.uid);
  if (Date.now() - u.xpAt > 60000) {
    const before = lvl(u.xp); u.xp += rand(5, 15); u.xpAt = Date.now(); save();
    if (isGroup && lvl(u.xp) > before) c.reply(`🎉 @${num(sender)} ارتقيت إلى LVL ${lvl(u.xp)}`, [sender]);
  }

  // مضاد الروابط
  if (isGroup && group(jid).antilink && /chat\.whatsapp\.com\/\S+/i.test(raw) && !c.isAdmin && !c.isOwner && c.isBotAdmin) {
    await sock.sendMessage(jid, { delete: m.key });
    return addWarn(c, sender);
  }

  if (!raw.startsWith(PREFIX)) return;
  const [name, ...args] = raw.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = cmds.find(x => x.names.includes(name.toLowerCase()));
  if (!cmd) return;
  if (db.settings.mode === 'private' && !c.isOwner) return;
  if (cmd.owner && !c.isOwner) return c.reply('👑 للمالك فقط');
  if (cmd.group && !isGroup) return c.reply('👥 هذا الأمر للمجموعات فقط');
  if (cmd.admin && !c.isAdmin && !c.isOwner) return c.reply('👮 للمشرفين فقط');
  if (cmd.botAdmin && !c.isBotAdmin)
    return c.reply('🤖 اجعلني مشرفاً أولاً');

  c.args = args; c.text = args.join(' ');
  try { await cmd.run(c); } catch (e) { console.error(`[${name}]`, e.message); c.reply('❌ حدث خطأ في الأمر'); }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version, logger, browser: Browsers.ubuntu('Chrome'), markOnlineOnConnect: false, syncFullHistory: false,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
  });
  sock.ev.on('creds.update', saveCreds);

  let asked = false;
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !state.creds.registered && !asked) {
      if (!PHONE) return console.log('⚠️ ضع PHONE_NUMBER في المتغيرات للحصول على كود الاقتران');
      asked = true;
      try { const code = await sock.requestPairingCode(PHONE); console.log('🔑 PAIRING CODE:', code.match(/.{1,4}/g).join('-')); }
      catch (e) { console.log('pairing error:', e.message); asked = false; }
    }
    if (connection === 'open') console.log('✅ KANEKI متصل:', sock.user?.id);
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) return console.log('❌ تم تسجيل الخروج: احذف مجلد الجلسة وأعد التشغيل');
      setTimeout(start, 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) { try { await handle(sock, m); } catch (e) { console.error('handle:', e.message); } }
  });

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (!group(id).welcome || !['add', 'remove'].includes(action)) return;
    const list = participants.map(x => (typeof x === 'string' ? x : x.id));
    const txt = list.map(j => (action === 'add' ? '👋 أهلاً بك @' : '👋 وداعاً @') + num(j)).join('\n');
    sock.sendMessage(id, { text: fx(txt), mentions: list }).catch(() => {});
  });
}
http.createServer((_, r) => r.end('KANEKI is alive')).listen(process.env.PORT || 3000);
start();
