// VRAKK — релей заявок с сайта в Telegram + мини-CRM в боте (Cloudflare Worker).
// Секреты: TG_TOKEN (токен @BotFather), WEBHOOK_SECRET (случайная строка: путь вебхука /tg/<секрет> и X-Telegram-Bot-Api-Secret-Token).
// Переменные (wrangler.toml): TG_CHAT_ID — чат менеджера, ALLOWED_ORIGIN — сайт. KV: LEADS — заявки.
// После деплоя один раз: GET https://<worker>/tg/<WEBHOOK_SECRET>/setup — ставит вебхук и меню команд.
const MAX = 3500;
const TZ = 3 * 3600e3; // Москва, UTC+3
const ST = {
  new:  { e: '🆕', n: 'новая' },
  work: { e: '🔧', n: 'в работе' },
  sold: { e: '✅', n: 'продано' },
  lost: { e: '❌', n: 'отказ' },
};
const COMMANDS = [
  { command: 'stats', description: 'Статистика: сегодня, неделя, месяц' },
  { command: 'leads', description: 'Открытые заявки' },
  { command: 'lead', description: 'Заявка подробно: /lead 12' },
  { command: 'sold', description: 'Отметить продажу: /sold 12 350000' },
  { command: 'help', description: 'Справка' },
];
const HELP = [
  'VRAKK · заявки с сайта',
  '',
  'Под каждой заявкой кнопки: В работе / Продано ✅ / Отказ ❌.',
  'После «Продано» ответьте на сообщение суммой сделки, например 350000 или 350к — сумма попадёт в статистику.',
  '',
  '/stats — заявки, в работе, продано, отказы, конверсия и сумма продаж за сегодня, неделю и месяц',
  '/leads — открытые заявки (новые и в работе)',
  '/lead 12 — заявка №12 подробно',
  '/sold 12 350000 — отметить продажу (сумма необязательна)',
  '/help — эта справка',
].join('\n');

const fmtN = n => Math.round(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
const msk = t => { const d = new Date(t + TZ); const p = x => String(x).padStart(2, '0'); return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; };
const who = u => u ? ([u.first_name, u.last_name].filter(Boolean).join(' ') || (u.username ? '@' + u.username : 'id ' + u.id)) : 'бот';
function parseAmount(s) {
  const m = /^\s*(\d[\d\s.,]*)\s*(к|k|тыс\.?|млн|m)?\s*(₽|руб\.?|р\.?)?\s*$/i.exec(String(s || ''));
  if (!m) return null;
  let v = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
  const u = (m[2] || '').toLowerCase();
  if (/^(к|k|тыс)/.test(u)) v *= 1e3; else if (/^(млн|m)$/.test(u)) v *= 1e6;
  return v > 0 && v < 1e9 ? Math.round(v) : null;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const sec = env.WEBHOOK_SECRET || '';
    if (sec && url.pathname.startsWith('/tg/')) {
      const rest = url.pathname.slice(4);
      if (rest === sec && req.method === 'POST') return webhook(req, env);
      if (rest === sec + '/setup' && req.method === 'GET') return setup(url, env);
      if (rest.startsWith(sec + '/lead/') && req.method === 'GET') {
        const l = await getLead(env, +rest.split('/').pop());
        return Response.json(l ? { ...l, text: undefined, consent: l.consent ? { at: l.consent.at, doc: l.consent.doc } : undefined } : { ok: false });
      }
      return new Response('not found', { status: 404 });
    }
    return siteLead(req, env);
  },
};

// ---------- Telegram API
async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({ ok: false }));
  console.log('tg', method, j.ok ? 'ok' : 'fail: ' + (j.description || r.status));
  return j;
}
const chatId = env => String(env.TG_CHAT_ID || '969895267');

// ---------- storage: lead:<000123> (value = JSON, metadata = короткая сводка для /stats и /leads), m:<message_id> → id
const key = id => 'lead:' + String(id).padStart(6, '0');
async function getLead(env, id) { if (!env.LEADS || !id) return null; return env.LEADS.get(key(id), 'json'); }
async function putLead(env, l) {
  l.updated = Date.now();
  await env.LEADS.put(key(l.id), JSON.stringify(l), {
    metadata: { s: l.status, c: l.created, u: l.updated, a: l.amount || 0, t: l.test ? 1 : 0, n: (l.name || '').slice(0, 40), p: (l.phone || '').slice(0, 24), car: (l.car || '').split(' · ')[0].slice(0, 60) },
  });
}
async function allMeta(env) {
  const out = []; let cursor;
  do { const r = await env.LEADS.list({ prefix: 'lead:', cursor }); for (const k of r.keys) out.push({ id: +k.name.slice(5), ...(k.metadata || {}) }); cursor = r.list_complete ? null : r.cursor; } while (cursor);
  return out;
}

// ---------- lead message
function statusLine(l) {
  const s = ST[l.status] || ST.new;
  let t = `Статус: ${s.e} ${s.n}`;
  if (l.status !== 'new' && l.by) t += ` — ${l.by}, ${msk(l.updated || Date.now())}`;
  if (l.status === 'sold' && l.amount) t += `\nСумма сделки: ${fmtN(l.amount)} ₽`;
  return t;
}
const leadMsg = l => `${l.text}\n\n— — —\n${statusLine(l)}`;
function keyboard(l) {
  const b = (st, label) => ({ text: (l.status === st ? '• ' : '') + label, callback_data: `st:${l.id}:${st}` });
  return { inline_keyboard: [[b('work', 'В работе')], [b('sold', 'Продано ✅'), b('lost', 'Отказ ❌')]] };
}
async function refreshMsg(env, l) {
  if (!l.msg) return;
  await tg(env, 'editMessageText', { chat_id: chatId(env), message_id: l.msg, text: leadMsg(l), reply_markup: keyboard(l), disable_web_page_preview: true });
}
async function setStatus(env, l, status, user, amount) {
  if (l.status !== status) (l.history = l.history || []).push({ s: status, by: who(user), at: Date.now() });
  l.status = status; l.by = who(user);
  if (status === 'sold') { l.soldAt = l.soldAt || Date.now(); if (amount) l.amount = amount; }
  else { delete l.soldAt; delete l.amount; }
  await putLead(env, l); await refreshMsg(env, l);
}

// ---------- site → lead
async function siteLead(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || 'https://tosha78.github.io').split(',').map(s => s.trim());
  const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  if (origin && !allowed.includes(origin)) return json({ ok: false, error: 'origin' }, 403);

  let d;
  try { d = JSON.parse(await req.text()); } catch { return json({ ok: false, error: 'json' }, 400); }
  if (d.website) return json({ ok: true }); // honeypot
  const clean = v => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 600);
  const phone = clean(d.phone), digits = phone.replace(/\D/g, '');
  if (!clean(d.name) || digits.length < 10 || digits.length > 15) return json({ ok: false, error: 'validation' }, 400);
  if (d.consent !== true) return json({ ok: false, error: 'consent' }, 400); // 152-ФЗ: без согласия заявку не принимаем
  const consentAt = (() => { const t = Date.parse(d.consentAt); return isFinite(t) && Math.abs(t - Date.now()) < 7 * 86400e3 ? t : Date.now(); })();

  let id = 0;
  if (env.LEADS) { id = (+(await env.LEADS.get('seq')) || 0) + 1; await env.LEADS.put('seq', String(id)); }
  let text = clean(d.text) ? String(d.text).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, MAX) : [
    'Заявка VRAKK', '', 'Имя: ' + clean(d.name), 'Телефон: ' + phone, '',
    'Автомобиль: ' + (clean(d.car) || 'не указан'), d.vin && 'VIN: ' + clean(d.vin), d.pcd && 'Разболтовка: ' + clean(d.pcd), '',
    d.brand && 'Бренд: ' + clean(d.brand), d.pistons && 'Поршни: ' + clean(d.pistons), d.disc && 'Диск: ' + clean(d.disc),
    d.pads && 'Колодки: ' + clean(d.pads), d.color && 'Цвет: ' + clean(d.color), d.price && 'Цена: ≈ ' + fmtN(+d.price) + ' ₽ за ось',
    d.discount && 'Скидка: ' + Number(d.discount) + ' % (промокод ' + clean(d.promo) + ')', d.discount && d.finalPrice && 'Итого: ≈ ' + fmtN(+d.finalPrice) + ' ₽ за ось',
    d.link && 'Комплект: ' + clean(d.link), d.calc && '\n' + clean(d.calc), d.comment && '\nКомментарий: ' + clean(d.comment),
    '\nСогласие на обработку ПДн: дано ' + msk(consentAt) + ' МСК',
  ].filter(x => typeof x === 'string').join('\n').replace(/\n{3,}/g, '\n\n');
  if (id) text = text.replace(/^Заявка VRAKK/, `Заявка VRAKK #${id}`);
  if (id && !text.startsWith('Заявка VRAKK #')) text = `Заявка VRAKK #${id}\n\n` + text;

  const test = /тест/i.test([d.name, d.comment, d.car].join(' '));
  const now = Date.now();
  const lead = id ? {
    id, status: 'new', created: now, updated: now, test, text,
    name: clean(d.name), phone, car: clean(d.car), vin: clean(d.vin), pcd: clean(d.pcd), brand: clean(d.brand), pistons: clean(d.pistons),
    disc: clean(d.disc), pads: clean(d.pads), color: clean(d.color), price: +d.price || 0, discount: +d.discount || 0, promo: clean(d.promo),
    finalPrice: +d.finalPrice || 0, kit: clean(d.kit), link: clean(d.link), calc: clean(d.calc), comment: clean(d.comment),
    consent: { at: consentAt, doc: clean(d.consentDoc) || 'consent.html', ip: req.headers.get('CF-Connecting-IP') || '', ua: clean(req.headers.get('User-Agent')).slice(0, 200) }, history: [{ s: 'new', by: 'сайт', at: now }],
  } : null;

  const t = await tg(env, 'sendMessage', { chat_id: chatId(env), text: lead ? leadMsg(lead) : text, disable_web_page_preview: true, ...(lead ? { reply_markup: keyboard(lead) } : {}) });
  if (!t.ok) return json({ ok: false, error: 'telegram' }, 502);
  if (lead) { lead.msg = t.result.message_id; await putLead(env, lead); await env.LEADS.put('m:' + lead.msg, String(id)); }
  return json({ ok: true, id: id || undefined });
}

// ---------- Telegram webhook
async function webhook(req, env) {
  if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  let u; try { u = await req.json(); } catch { return new Response('ok'); }
  try {
    if (u.callback_query) await onCallback(env, u.callback_query);
    else if (u.message) await onMessage(env, u.message);
  } catch (e) { console.log('webhook error', e && e.message); }
  return new Response('ok'); // всегда 200, чтобы Telegram не повторял апдейт
}

async function onCallback(env, q) {
  const chat = q.message && q.message.chat && String(q.message.chat.id);
  if (chat !== chatId(env)) { await tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: 'Нет доступа' }); return; }
  const m = /^st:(\d+):(work|sold|lost)$/.exec(q.data || '');
  const l = m && await getLead(env, +m[1]);
  if (!l) { await tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: 'Заявка не найдена' }); return; }
  const st = m[2], same = l.status === st;
  if (!same) await setStatus(env, l, st, q.from);
  await tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: same ? `Уже: ${ST[st].n}` : `Заявка #${l.id}: ${ST[st].n}` });
  if (st === 'sold' && !same) {
    const ask = await tg(env, 'sendMessage', { chat_id: chatId(env), reply_to_message_id: l.msg, text: `Заявка #${l.id} продана ✅\nОтветьте на это сообщение суммой сделки (например, 350000 или 350к) — необязательно.`, reply_markup: { force_reply: true, input_field_placeholder: 'Сумма, ₽' } });
    if (ask.ok) await env.LEADS.put('m:' + ask.result.message_id, String(l.id), { expirationTtl: 30 * 86400 });
  }
}

async function onMessage(env, msg) {
  if (String(msg.chat && msg.chat.id) !== chatId(env)) return; // чужие чаты игнорируем
  const text = (msg.text || '').trim();
  const reply = t => tg(env, 'sendMessage', { chat_id: chatId(env), text: t, disable_web_page_preview: true });

  // ответ суммой на заявку или на вопрос о сумме
  if (msg.reply_to_message && !text.startsWith('/')) {
    const id = +(await env.LEADS.get('m:' + msg.reply_to_message.message_id));
    if (!id) return;
    const amount = parseAmount(text);
    if (!amount) { await reply('Не понял сумму. Напишите число, например 350000 или 350к.'); return; }
    const l = await getLead(env, id); if (!l) return;
    await setStatus(env, l, 'sold', msg.from, amount);
    await reply(`Заявка #${id}: продано, сумма ${fmtN(amount)} ₽ сохранена.`);
    return;
  }
  const m = /^\/(\w+)(?:@\w+)?\s*(.*)$/s.exec(text); if (!m) return;
  const cmd = m[1].toLowerCase(), arg = m[2].trim();
  if (cmd === 'start' || cmd === 'help') return reply(HELP);
  if (cmd === 'stats') return reply(await stats(env));
  if (cmd === 'leads') return reply(await openLeads(env));
  if (cmd === 'lead') { const l = await getLead(env, parseInt(arg)); return reply(l ? details(l) : 'Укажите номер заявки: /lead 12'); }
  if (cmd === 'sold') {
    const mm = /^#?(\d+)\s*(.*)$/.exec(arg); const l = mm && await getLead(env, +mm[1]);
    if (!l) return reply('Формат: /sold 12 350000 (сумма необязательна)');
    const amount = mm[2] ? parseAmount(mm[2]) : null;
    if (mm[2] && !amount) return reply('Не понял сумму. Пример: /sold 12 350000');
    await setStatus(env, l, 'sold', msg.from, amount || l.amount);
    return reply(`Заявка #${l.id}: продано${l.amount ? ', сумма ' + fmtN(l.amount) + ' ₽' : ''}.`);
  }
  return reply('Неизвестная команда. /help — список команд.');
}

async function stats(env) {
  const all = (await allMeta(env)).filter(x => !x.t);
  const now = Date.now(), d = new Date(now + TZ);
  const day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - TZ;
  const week0 = day0 - ((d.getUTCDay() + 6) % 7) * 86400e3;
  const month0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - TZ;
  const block = (title, from) => {
    const L = all.filter(x => x.c >= from), n = L.length, c = s => L.filter(x => x.s === s).length;
    const sold = c('sold'), sum = L.filter(x => x.s === 'sold').reduce((a, x) => a + (x.a || 0), 0);
    return `${title}\nЗаявки: ${n} · новые: ${c('new')} · в работе: ${c('work')}\nПродано: ${sold} · отказы: ${c('lost')}\nКонверсия: ${n ? Math.round(sold / n * 100) : 0} % · сумма продаж: ${fmtN(sum)} ₽`;
  };
  const tests = (await allMeta(env)).length - all.length;
  return ['📊 Статистика VRAKK', '', block('Сегодня', day0), '', block('Неделя (с понедельника)', week0), '', block(`Месяц (с 1-го)`, month0), '',
    `Считаются заявки, поступившие за период, с их текущим статусом.${tests ? ` Тестовые (${tests}) не учитываются.` : ''}`].join('\n');
}
async function openLeads(env) {
  const L = (await allMeta(env)).filter(x => x.s === 'new' || x.s === 'work').sort((a, b) => b.id - a.id);
  if (!L.length) return 'Открытых заявок нет 👌';
  const age = c => { const m = Math.round((Date.now() - c) / 6e4); return m < 60 ? m + ' мин' : m < 1440 ? Math.round(m / 60) + ' ч' : Math.round(m / 1440) + ' дн'; };
  return [`Открытые заявки: ${L.length}`, '', ...L.slice(0, 30).map(x => `#${x.id} ${ST[x.s].e} ${x.n || '—'} · ${x.p || ''}${x.car ? ' · ' + x.car : ''} · ${age(x.c)} назад${x.t ? ' · тест' : ''}`),
    L.length > 30 ? `…и ещё ${L.length - 30}` : null, '', 'Подробно: /lead N'].filter(x => x !== null).join('\n');
}
function details(l) {
  const f = (k, v) => v ? `${k}: ${v}` : null;
  return [`Заявка #${l.id}${l.test ? ' (тест)' : ''}`, statusLine(l), f('Поступила', msk(l.created)), '',
    f('Имя', l.name), f('Телефон', l.phone), f('Автомобиль', l.car), f('VIN', l.vin), f('Разболтовка', l.pcd), '',
    f('Бренд', l.brand), f('Поршни', l.pistons), f('Диск', l.disc), f('Колодки', l.pads), f('Цвет', l.color),
    l.price ? `Цена: ≈ ${fmtN(l.price)} ₽ за ось` : null, l.discount ? `Скидка: ${l.discount} % (${l.promo}), итого ≈ ${fmtN(l.finalPrice)} ₽` : null,
    f('Комплект', l.link), l.calc ? '\n' + l.calc : null, l.comment ? '\nКомментарий: ' + l.comment : null, '',
    l.consent ? `Согласие на ПДн: ${msk(l.consent.at)} МСК (${l.consent.doc})` : null,
    'История: ' + (l.history || []).map(h => `${ST[h.s] ? ST[h.s].n : h.s} (${h.by}, ${msk(h.at)})`).join(' → '),
  ].filter(x => x !== null).join('\n').replace(/\n{3,}/g, '\n\n');
}

async function setup(url, env) {
  const hook = `${url.origin}/tg/${env.WEBHOOK_SECRET}`;
  const a = await tg(env, 'setWebhook', { url: hook, secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
  const b = await tg(env, 'setMyCommands', { commands: COMMANDS, scope: { type: 'default' } });
  const c = await tg(env, 'setMyCommands', { commands: COMMANDS, scope: { type: 'chat', chat_id: chatId(env) } });
  const i = await tg(env, 'getWebhookInfo', {});
  const info = i.result || {};
  return Response.json({ setWebhook: a.ok, setMyCommands: b.ok && c.ok, webhook: { set: info.url === hook, pending: info.pending_update_count, last_error: info.last_error_message || null, allowed_updates: info.allowed_updates } });
}
