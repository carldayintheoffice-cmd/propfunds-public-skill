// HTTP handler: the website, the sign-up API and the staff page.
//
//   GET  /web/*, /rules/*              the website (static files)
//   POST /api/signups                  receive a call-back request
//   GET  /admin                        staff list (password protected)
//   POST /admin/signups/:ref           update status / notes
//   POST /admin/signups/:ref/delete    delete on request (UK GDPR erasure)

import { readFile } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeRecord } from '../rules/signup.js';
import { adminPage } from './admin.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC_DIRS = ['/web/', '/rules/'];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
const MAX_BODY = 16 * 1024;

const sha = (s) => createHash('sha256').update(String(s)).digest();

/**
 * @param {object} opts
 * @param {ReturnType<import('./store.js').openStore>} opts.store
 * @param {string} [opts.adminPassword] staff page is disabled unless set (12+ characters)
 * @param {(msg: string) => Promise<void>} [opts.notify] told about each new request (no personal details)
 * @param {boolean} [opts.trustProxy] read the client IP from X-Forwarded-For (behind a hosting proxy)
 * @param {number} [opts.signupsPerHour] per IP
 */
export function createHandler({ store, adminPassword = '', notify = async () => {}, trustProxy = false, signupsPerHour = 5 }) {
  const adminEnabled = adminPassword.length >= 12;
  const adminHash = sha(adminPassword);
  const hits = new Map(); // ip -> timestamps of recent sign-ups

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
  };
  const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json' });

  const clientIp = (req) =>
    (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';

  function rateLimited(ip) {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
    if (recent.length >= signupsPerHour) { hits.set(ip, recent); return true; }
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 10_000) hits.clear(); // simple memory bound
    return false;
  }

  async function readBody(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  function isAdmin(req) {
    if (!adminEnabled) return false;
    const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
    if (!m) return false;
    const decoded = Buffer.from(m[1], 'base64').toString('utf8');
    const password = decoded.slice(decoded.indexOf(':') + 1);
    return timingSafeEqual(sha(password), adminHash);
  }

  // Basic auth is sent automatically by the browser, so reject staff form
  // posts that did not come from our own page (cross-site request forgery).
  const sameOrigin = (req) => {
    const site = req.headers['sec-fetch-site'];
    if (site) return site === 'same-origin';
    try {
      return new URL(req.headers.origin).host === req.headers.host;
    } catch {
      return false;
    }
  };

  async function postSignup(req, res) {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
      return json(res, 415, { error: 'Send JSON' });
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (err) {
      return json(res, err.status || 400, { error: 'Could not read the request' });
    }
    // Honeypot: a hidden field people never see. Bots fill it in.
    if (body?.website) return json(res, 201, { reference: 'CR-RECEIVED' });
    if (rateLimited(clientIp(req))) return json(res, 429, { error: 'Too many requests. Please try again later.' });
    const { record, errors } = sanitizeRecord(body);
    if (errors) return json(res, 400, { error: 'Some answers need checking', fields: errors });
    const reference = store.add(record);
    notify(`New ClaimRight call-back request ${reference} (call ${record.contact.callTime}).`).catch(() => {});
    return json(res, 201, { reference });
  }

  async function adminRoutes(req, res, path) {
    if (!adminEnabled) return send(res, 404, 'Not found');
    if (!isAdmin(req)) {
      return send(res, 401, 'Staff sign-in required', { 'WWW-Authenticate': 'Basic realm="ClaimRight staff", charset="UTF-8"' });
    }
    // same-origin referrer so the browser sends a real Origin on staff form posts
    const noStore = { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'same-origin' };
    if (req.method === 'GET' && path === '/admin') {
      const flash = new URL(req.url, 'http://x').searchParams.get('done') || '';
      const messages = { saved: 'Saved.', deleted: 'Deleted.' };
      return send(res, 200, adminPage(store.list(), messages[flash] || ''), noStore);
    }
    const m = /^\/admin\/signups\/(CR-[A-Z0-9]{6})(\/delete)?$/.exec(path);
    if (req.method === 'POST' && m) {
      if (!sameOrigin(req)) return send(res, 403, 'Forbidden');
      const [, reference, del] = m;
      if (del) {
        if (!store.remove(reference)) return send(res, 404, 'Not found');
        return send(res, 303, '', { Location: '/admin?done=deleted' });
      }
      const form = new URLSearchParams(await readBody(req));
      try {
        if (!store.update(reference, { status: form.get('status'), notes: form.get('notes') })) return send(res, 404, 'Not found');
      } catch {
        return send(res, 400, 'Unknown status');
      }
      return send(res, 303, '', { Location: '/admin?done=saved' });
    }
    return send(res, 404, 'Not found');
  }

  async function staticFile(req, res, path) {
    if (path === '/' || path === '/web') return send(res, 302, '', { Location: '/web/' });
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!PUBLIC_DIRS.some((d) => file.startsWith(join(ROOT, d)))) return send(res, 404, 'Not found');
    try {
      const body = await readFile(file);
      return send(res, 200, body, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    } catch {
      return send(res, 404, 'Not found');
    }
  }

  return async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path === '/api/signups') {
        return req.method === 'POST' ? await postSignup(req, res) : send(res, 405, 'Method not allowed', { Allow: 'POST' });
      }
      if (path === '/admin' || path.startsWith('/admin/')) return await adminRoutes(req, res, path);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return await staticFile(req, res, path);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, 'Something went wrong');
    }
  };
}
