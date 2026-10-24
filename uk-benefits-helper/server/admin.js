// Staff page: the call-back list. Plain HTML forms, works without JavaScript.

import { STATUSES } from './store.js';
import { CALL_TIMES } from '../rules/signup.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' });

function card(s) {
  const c = s.contact;
  const options = Object.entries(STATUSES)
    .map(([k, label]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const benefits = (s.check?.toClaim ?? [])
    .map((b) => `<li>${esc(b.name)} - ${b.status === 'likely' ? 'should claim' : 'check'}${b.weekly ? `, about ${money(b.weekly)} a week` : ''}</li>`).join('');
  return `
  <article class="signup status-${esc(s.status)}">
    <header>
      <h2>${esc(c.claimantName)} <span class="ref">${esc(s.reference)}</span></h2>
      <p class="meta">Received ${esc(when(s.createdAt))} · ${esc(STATUSES[s.status] ?? s.status)}</p>
    </header>
    <dl>
      <dt>Phone</dt><dd><strong>${esc(c.phone)}</strong> · ${esc(CALL_TIMES[c.callTime] ?? c.callTime)}</dd>
      <dt>Postcode</dt><dd>${esc(c.postcode)}</dd>
      ${c.email ? `<dt>Email</dt><dd>${esc(c.email)}</dd>` : ''}
      ${c.forWhom === 'someoneElse' ? `<dt>Helper</dt><dd>${esc(c.helperName)} (${esc(c.helperRelationship)})</dd>` : ''}
      <dt>Estimate</dt><dd>${money(s.check?.estimateMonthly)} a month · quoted fee ${s.check?.quotedFee ? money(s.check.quotedFee) : 'not shown'}</dd>
      <dt>Consents</dt><dd>${s.consents?.freeHelpUnderstood && s.consents?.termsAgreed && s.consents?.contactAgreed ? 'All three ticked' : 'MISSING - do not proceed'}</dd>
    </dl>
    ${benefits ? `<details><summary>Benefits to claim (${s.check.toClaim.length})</summary><ul>${benefits}</ul></details>` : ''}
    <form method="post" action="/admin/signups/${esc(s.reference)}" class="update">
      <label>Status <select name="status">${options}</select></label>
      <label>Notes <textarea name="notes" rows="2">${esc(s.notes)}</textarea></label>
      <button type="submit">Save</button>
    </form>
    <details class="danger"><summary>Delete (customer asked us to)</summary>
      <form method="post" action="/admin/signups/${esc(s.reference)}/delete">
        <p>This permanently deletes ${esc(s.reference)}. It cannot be undone.</p>
        <button type="submit">Delete permanently</button>
      </form>
    </details>
  </article>`;
}

export function adminPage(signups, flash = '') {
  const open = signups.filter((s) => !['feePaid', 'feeWaived', 'refused', 'cancelled'].includes(s.status));
  const closed = signups.filter((s) => !open.includes(s));
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>ClaimRight call-backs</title>
<style>
  :root { --ink:#0b0c0c; --muted:#505a5f; --bg:#fff; --panel:#f3f2f1; --brand:#0b3d5c; --new:#d4351c; --ok:#00703c; color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root { --ink:#f3f2f1; --muted:#b1b4b6; --bg:#121212; --panel:#1f1f1f; --new:#ff6b52; --ok:#39b37a; color-scheme: dark; } }
  body { margin:0; font:18px/1.5 system-ui, sans-serif; background:var(--bg); color:var(--ink); }
  .wrap { max-width:56rem; margin:0 auto; padding:16px; }
  h1 { margin:.2em 0; } .flash { background:var(--panel); border-left:6px solid var(--ok); padding:8px 12px; }
  .signup { background:var(--panel); border-left:8px solid var(--muted); padding:12px 16px; margin:16px 0; border-radius:0 6px 6px 0; }
  .status-new { border-color:var(--new); } .status-approved { border-color:var(--ok); }
  .signup h2 { margin:0; font-size:1.25rem; } .ref { font-family:ui-monospace, monospace; font-size:1rem; color:var(--muted); }
  .meta { margin:0 0 8px; color:var(--muted); }
  dl { display:grid; grid-template-columns:max-content 1fr; gap:4px 16px; margin:8px 0; } dt { font-weight:700; } dd { margin:0; min-width:0; }
  .update { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; margin-top:8px; }
  .update label { display:flex; flex-direction:column; font-weight:700; flex:1 1 14rem; }
  select, textarea, button { font:inherit; padding:8px; border-radius:4px; border:2px solid var(--ink); background:var(--bg); color:var(--ink); }
  button { background:var(--brand); color:#fff; border:0; font-weight:700; padding:10px 18px; cursor:pointer; }
  .danger summary { color:var(--new); cursor:pointer; margin-top:8px; } .danger button { background:var(--new); }
  :focus-visible { outline:3px solid #ffdd00; outline-offset:2px; }
</style></head>
<body><div class="wrap">
  <h1>Call-back requests</h1>
  <p>${open.length} open · ${closed.length} closed. Newest first. Only share this page with staff.</p>
  ${flash ? `<p class="flash" role="status">${esc(flash)}</p>` : ''}
  ${open.length ? open.map(card).join('') : '<p>No open requests.</p>'}
  ${closed.length ? `<details><summary>Closed (${closed.length})</summary>${closed.map(card).join('')}</details>` : ''}
</div></body></html>`;
}
