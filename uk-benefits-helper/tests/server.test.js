import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openStore } from '../server/store.js';
import { createHandler } from '../server/app.js';

const PASSWORD = 'correct horse battery';
const notified = [];
let server, base, store;

before(async () => {
  store = openStore(':memory:');
  server = createServer(createHandler({ store, adminPassword: PASSWORD, notify: async (m) => { notified.push(m); }, signupsPerHour: 3 }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); store.close(); });

const valid = {
  contact: { forWhom: 'someoneElse', claimantName: 'Margaret Smith', helperName: 'Carl Day', helperRelationship: 'Son',
    phone: '07700 900123', email: '', postcode: 'sw1a 1aa', callTime: 'morning' },
  consents: { freeHelpUnderstood: true, termsAgreed: true, contactAgreed: true },
  check: { taxYear: '2026/27', toClaim: [{ id: 'pensionCredit', name: 'Pension Credit', status: 'likely', weekly: 53.1 }], estimateMonthly: 230.1, quotedFee: 299 },
};
const post = (body, headers = {}) => fetch(`${base}/api/signups`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const auth = { Authorization: 'Basic ' + Buffer.from(`staff:${PASSWORD}`).toString('base64') };

test('a valid sign-up is stored and gets a reference', async () => {
  const res = await post(valid);
  assert.equal(res.status, 201);
  const { reference } = await res.json();
  assert.match(reference, /^CR-[2-9A-HJ-NP-Z]{6}$/);
  const saved = store.get(reference);
  assert.equal(saved.contact.postcode, 'SW1A 1AA');
  assert.equal(saved.status, 'new');
  assert.equal(saved.check.toClaim[0].name, 'Pension Credit');
  assert.ok(notified.some((m) => m.includes(reference) && !m.includes('Margaret')), 'notification has no personal details');
});

test('missing consent or bad phone is refused', async () => {
  const res = await post({ ...valid, consents: { ...valid.consents, termsAgreed: false }, contact: { ...valid.contact, phone: '123' } });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.fields.termsAgreed && body.fields.phone);
});

test('unknown fields are dropped, not stored', async () => {
  const res = await post({ ...valid, contact: { ...valid.contact, nationalInsurance: 'AB123456C' }, extra: 'x' });
  const saved = store.get((await res.json()).reference);
  assert.equal(saved.contact.nationalInsurance, undefined);
  assert.equal(saved.extra, undefined);
});

test('honeypot submissions are accepted silently but not stored', async () => {
  const before = store.list().length;
  const res = await post({ ...valid, website: 'http://spam.example' });
  assert.equal(res.status, 201);
  assert.equal(store.list().length, before);
});

test('too many sign-ups from one address are slowed down', async () => {
  const res = await post(valid); // 4th from this IP with a limit of 3
  assert.equal(res.status, 429);
});

test('staff page needs the password', async () => {
  assert.equal((await fetch(`${base}/admin`)).status, 401);
  const res = await fetch(`${base}/admin`, { headers: auth });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Margaret Smith/);
});

test('staff can update status, but not from another site', async () => {
  const { reference } = store.list()[0];
  const form = { method: 'POST', redirect: 'manual', headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'status=called&notes=Left+voicemail' };
  assert.equal((await fetch(`${base}/admin/signups/${reference}`, { ...form, headers: { ...form.headers, Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await fetch(`${base}/admin/signups/${reference}`, { ...form, headers: { ...form.headers, 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await fetch(`${base}/admin/signups/${reference}`, { ...form, headers: { ...form.headers, Origin: 'null' } })).status, 403);
  assert.equal((await fetch(`${base}/admin/signups/${reference}`, { ...form, headers: { ...form.headers, Origin: base } })).status, 303);
  assert.equal(store.get(reference).status, 'called');
  assert.equal(store.get(reference).notes, 'Left voicemail');
});

test('staff can delete a record on request', async () => {
  const { reference } = store.list()[0];
  const res = await fetch(`${base}/admin/signups/${reference}/delete`, { method: 'POST', redirect: 'manual', headers: { ...auth, Origin: base } });
  assert.equal(res.status, 303);
  assert.equal(store.get(reference), undefined);
});

test('only the website files are public', async () => {
  assert.equal((await fetch(`${base}/web/`)).status, 200);
  assert.equal((await fetch(`${base}/rules/engine.js`)).status, 200);
  assert.equal((await fetch(`${base}/server/app.js`)).status, 404);
  assert.equal((await fetch(`${base}/data/claimright.db`)).status, 404);
  assert.equal((await fetch(`${base}/web/../package.json`)).status, 404);
});
