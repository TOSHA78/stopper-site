import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './cloudflare-worker.js';
import { readFileSync } from 'node:fs';

function kv() {
  const store = new Map();
  return {
    store,
    async get(k, type) {
      if (!store.has(k)) return null;
      const v = store.get(k);
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { keys: [], list_complete: true }; },
  };
}
function env(over = {}) {
  return {
    TG_TOKEN: 'test-token',
    TG_CHAT_ID: '111',
    WEBHOOK_SECRET: 'sekret',
    ALLOWED_ORIGIN: 'https://tosha78.github.io',
    LEADS: kv(),
    ...over,
  };
}
const lead = (extra = {}) => JSON.stringify({
  name: 'Иван', phone: '+7 (917) 229-00-00', consent: true, comment: 'город', ...extra,
});
function post(body, headers = {}, path = '/') {
  return new Request('https://vrakk-leads.example' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'CF-Connecting-IP': '203.0.113.10', ...headers },
    body,
  });
}
let tgCalls = 0;
test.beforeEach(() => {
  tgCalls = 0;
  globalThis.fetch = async (url) => {
    tgCalls += 1;
    assert.match(String(url), /bottest-token\//);
    return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
});

test('принимает заявку с сайта и не отражает чужой origin', async () => {
  const res = await worker.fetch(post(lead(), { Origin: 'https://tosha78.github.io', 'CF-Connecting-IP': '203.0.113.20' }), env());
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.ok, true);
  assert.equal(j.id, 1);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://tosha78.github.io');
  assert.equal(tgCalls, 1);
});

test('чужой origin — 403 без Access-Control-Allow-Origin', async () => {
  const res = await worker.fetch(post(lead(), { Origin: 'https://evil.example', 'CF-Connecting-IP': '203.0.113.21' }), env());
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(tgCalls, 0);
});

test('honeypot молча успешен и не пишет в Telegram', async () => {
  const res = await worker.fetch(post(lead({ vrakk_hp: 'http://spam' }), { 'CF-Connecting-IP': '203.0.113.22' }), env());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(tgCalls, 0);
});

test('без согласия и с плохим телефоном — 400', async () => {
  const e = env();
  const a = await worker.fetch(post(lead({ consent: false }), { 'CF-Connecting-IP': '203.0.113.23' }), e);
  assert.equal(a.status, 400);
  assert.equal((await a.json()).error, 'consent');
  const b = await worker.fetch(post(lead({ phone: '123' }), { 'CF-Connecting-IP': '203.0.113.24' }), e);
  assert.equal(b.status, 400);
  assert.equal((await b.json()).error, 'validation');
  assert.equal(tgCalls, 0);
});

test('нет секретов — 503 config', async () => {
  const res = await worker.fetch(post(lead(), { 'CF-Connecting-IP': '203.0.113.25' }), env({ TG_TOKEN: '', TG_CHAT_ID: '' }));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'config');
  assert.equal(tgCalls, 0);
});

test('повтор той же заявки не шлёт второе сообщение', async () => {
  const e = env();
  const h = { 'CF-Connecting-IP': '203.0.113.26' };
  const a = await worker.fetch(post(lead(), h), e);
  const b = await worker.fetch(post(lead(), h), e);
  assert.equal(a.status, 200);
  assert.equal((await b.json()).duplicate, true);
  assert.equal(tgCalls, 1);
});

test('лимит частоты — 429', async () => {
  const e = env();
  let last = 0;
  for (let i = 0; i < 9; i++) {
    const res = await worker.fetch(post('not-json', { 'CF-Connecting-IP': '203.0.113.27' }), e);
    last = res.status;
  }
  assert.equal(last, 429);
});

test('вебхук без секретного заголовка — 403', async () => {
  const res = await worker.fetch(new Request('https://vrakk-leads.example/tg/sekret', {
    method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
  }), env());
  assert.equal(res.status, 403);
});

test('в репозитории нет прежнего chat id', () => {
  const workerSrc = readFileSync(new URL('./cloudflare-worker.js', import.meta.url), 'utf8');
  const toml = readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8');
  assert.equal(workerSrc.includes('969895267'), false);
  assert.equal(toml.includes('969895267'), false);
  assert.equal(toml.includes('account_id'), false);
});
