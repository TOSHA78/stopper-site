// Local files, in-page anchors, and external links (404 fails the run).
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pages = ['index.html', 'privacy.html', 'consent.html', '404.html'];
const attr = /(?:href|src)\s*=\s*"([^"]+)"/g;
const idRe = /\sid\s*=\s*"([^"]+)"/g;
const fail = [];
const seenExternal = new Map();

function localPath(from, url) {
  const clean = url.split('#')[0].split('?')[0];
  if (!clean || clean.startsWith('data:')) return null;
  const base = dirname(join(root, from));
  return normalize(clean.startsWith('/') ? join(root, clean) : join(base, clean));
}

for (const page of pages) {
  const html = readFileSync(join(root, page), 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '');
  const ids = new Set([...html.matchAll(idRe)].map(m => m[1]));
  for (const m of html.matchAll(attr)) {
    const url = m[1].trim();
    if (!url || url.startsWith('tel:') || url.startsWith('mailto:') || url.startsWith('data:')) continue;
    if (url.startsWith('#')) {
      const id = url.slice(1);
      if (id && !ids.has(id)) fail.push(`${page}: нет якоря ${url}`);
      continue;
    }
    if (/^https?:\/\//.test(url)) {
      if (!seenExternal.has(url)) seenExternal.set(url, page);
      continue;
    }
    const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
    let path = localPath(page, url);
    if (path && existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (!path || !existsSync(path) || !statSync(path).isFile()) {
      fail.push(`${page}: нет файла ${url}`);
      continue;
    }
    if (hash && path.endsWith('.html')) {
      const target = readFileSync(path, 'utf8');
      const tids = new Set([...target.matchAll(idRe)].map(x => x[1]));
      if (!tids.has(hash)) fail.push(`${page}: в ${url} нет id "${hash}"`);
    }
  }
}

async function checkExternal(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'VRAKK-linkcheck' } });
    if (res.status === 405 || res.status === 403 || res.status === 429) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'VRAKK-linkcheck' } });
    }
    if (res.status === 404 || res.status === 410) return `${res.status}`;
    return '';
  } catch (e) {
    return `сеть: ${e.name === 'AbortError' ? 'таймаут' : e.message}`;
  } finally {
    clearTimeout(t);
  }
}

const externals = [...seenExternal.entries()];
const results = await Promise.all(externals.map(async ([url, page]) => {
  const err = await checkExternal(url);
  return err ? `${page}: ${url} — ${err}` : '';
}));
for (const r of results) if (r) fail.push(r);

if (fail.length) {
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log(`ok: ${pages.length} страниц, локальные ссылки и ${externals.length} внешних`);
