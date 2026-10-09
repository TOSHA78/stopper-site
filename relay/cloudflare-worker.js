// VRAKK — релей заявок в Telegram (Cloudflare Worker).
// Токен бота и chat_id хранятся в секретах воркера, на сайте их нет.
//   wrangler secret put TG_TOKEN     — токен от @BotFather
//   wrangler secret put TG_CHAT_ID   — id чата, куда слать заявки (см. README)
//   (необязательно) переменная ALLOWED_ORIGIN, по умолчанию https://tosha78.github.io
const MAX = 3500; // Telegram: до 4096 символов в сообщении

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || 'https://tosha78.github.io').split(',').map(s => s.trim());
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    if (origin && !allowed.includes(origin)) return json({ ok: false, error: 'origin' }, 403);

    let d;
    try { d = JSON.parse(await req.text()); } catch { return json({ ok: false, error: 'json' }, 400); }
    if (d.website) return json({ ok: true }); // honeypot: боты заполняют скрытое поле
    const clean = v => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 600);
    const phone = clean(d.phone), digits = phone.replace(/\D/g, '');
    if (!clean(d.name) || digits.length < 10 || digits.length > 15) return json({ ok: false, error: 'validation' }, 400);

    const text = (clean(d.text) ? String(d.text).slice(0, MAX) : [
      'Заявка VRAKK', '', 'Имя: ' + clean(d.name), 'Телефон: ' + phone, '',
      'Автомобиль: ' + (clean(d.car) || 'не указан'), d.vin && 'VIN: ' + clean(d.vin), d.pcd && 'Разболтовка: ' + clean(d.pcd), '',
      d.brand && 'Бренд: ' + clean(d.brand), d.pistons && 'Поршни: ' + clean(d.pistons), d.disc && 'Диск: ' + clean(d.disc),
      d.pads && 'Колодки: ' + clean(d.pads), d.color && 'Цвет: ' + clean(d.color), d.price && 'Цена: ≈ ' + Number(d.price).toLocaleString('ru-RU') + ' ₽ за ось',
      d.link && 'Комплект: ' + clean(d.link), d.comment && '\nКомментарий: ' + clean(d.comment),
    ].filter(Boolean).join('\n'));

    const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text, disable_web_page_preview: true }),
    });
    const t = await r.json().catch(() => ({}));
    return t.ok ? json({ ok: true }) : json({ ok: false, error: 'telegram' }, 502);
  },
};
