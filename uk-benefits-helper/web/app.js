// ClaimRight web front end. Plain ES modules, no build step, no tracking.
// All logic lives in ../rules - this file only asks questions and shows results.

import { visibleQuestions, questionText } from '../rules/questions.js';
import { assess, STATUS_LABELS } from '../rules/engine.js';

const app = document.getElementById('app');
const STORE_KEY = 'claimright-answers';

let answers = load();
let step = -1; // -1 = start page, questions.length = results

function load() {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function save() {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(answers)); } catch { /* private mode */ }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function focusHeading() {
  const h = app.querySelector('h1');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- screens

function renderStart() {
  app.innerHTML = `
    <h1>Find out what help you could be missing</h1>
    <p>Millions of pensioners in the UK do not claim money they are entitled to. Pension Credit alone
       goes unclaimed by hundreds of thousands of households.</p>
    <p>Answer some simple questions. It takes about 5 minutes. You will get a list of what you may be
       entitled to, roughly how much, and exactly how to claim.</p>
    <div class="panel">
      <p><strong>Private:</strong> your answers stay on this device.</p>
      <p><strong>Honest:</strong> we only tell you about help the rules say you can get. If we are not sure, we say so.</p>
      <p style="margin:0"><strong>Free:</strong> claiming benefits never costs anything. Never pay anyone to claim for you.</p>
    </div>
    <div class="actions"><button id="go">Start now</button></div>`;
  document.getElementById('go').onclick = () => { step = 0; render(); };
}

function inputFor(q) {
  const val = answers[q.id];
  switch (q.type) {
    case 'choice':
    case 'multi': {
      const type = q.type === 'choice' ? 'radio' : 'checkbox';
      const chosen = q.type === 'multi' ? new Set(val || []) : new Set(val ? [val] : []);
      return q.options.map((o) => `
        <label class="option">
          <input type="${type}" name="${q.id}" value="${esc(o.value)}" ${chosen.has(o.value) ? 'checked' : ''}>
          <span>${esc(o.label)}</span>
        </label>`).join('') + (q.type === 'multi' ? '<p class="hint">If none apply, just press Continue.</p>' : '');
    }
    case 'date': {
      const [y, m, d] = (val || '').split('-');
      return `<div class="date-row">
        <label>Day<input type="text" inputmode="numeric" id="d" maxlength="2" value="${esc(d ? +d : '')}" autocomplete="bday-day"></label>
        <label>Month<input type="text" inputmode="numeric" id="m" maxlength="2" value="${esc(m ? +m : '')}" autocomplete="bday-month"></label>
        <label>Year<input type="text" inputmode="numeric" id="y" class="year" maxlength="4" value="${esc(y || '')}" autocomplete="bday-year"></label>
      </div><p class="hint">For example, 27 3 1955</p>`;
    }
    case 'money': {
      const amount = val?.amount ?? '';
      const period = val?.period ?? 'week';
      const opt = (p, label) => `<option value="${p}" ${period === p ? 'selected' : ''}>${label}</option>`;
      return `<div class="money-row">
        <label>Amount<span><span class="prefix">£</span><input type="text" inputmode="decimal" id="amount" value="${esc(amount)}"></span></label>
        <label>How often<select id="period">${opt('week', 'Every week')}${opt('fourWeeks', 'Every 4 weeks')}${opt('month', 'Every month')}${opt('year', 'Every year')}</select></label>
      </div>`;
    }
    case 'number':
      return `<div class="money-row"><label>Amount<span><span class="prefix">${esc(q.prefix || '')}</span>
        <input type="text" inputmode="decimal" id="amount" value="${esc(val ?? '')}"></span></label></div>`;
    default:
      return '';
  }
}

function readInput(q) {
  const num = (s) => Number(String(s).replace(/[£,\s]/g, ''));
  switch (q.type) {
    case 'choice': {
      const el = app.querySelector(`input[name="${q.id}"]:checked`);
      return el ? { value: el.value } : { error: 'Choose one of the answers' };
    }
    case 'multi':
      return { value: [...app.querySelectorAll(`input[name="${q.id}"]:checked`)].map((el) => el.value) };
    case 'date': {
      const d = num(app.querySelector('#d').value);
      const m = num(app.querySelector('#m').value);
      const y = num(app.querySelector('#y').value);
      const date = new Date(Date.UTC(y, m - 1, d));
      const ok = y > 1900 && y <= new Date().getFullYear() && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
      if (!ok) return { error: 'Enter a real date, for example 27 3 1955' };
      return { value: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }
    case 'money': {
      const raw = app.querySelector('#amount').value.trim();
      const amount = raw === '' ? 0 : num(raw);
      if (Number.isNaN(amount) || amount < 0) return { error: 'Enter an amount in pounds, for example 185.50, or 0' };
      return { value: { amount, period: app.querySelector('#period').value } };
    }
    case 'number': {
      const raw = app.querySelector('#amount').value.trim();
      const n = raw === '' ? 0 : num(raw);
      if (Number.isNaN(n) || n < 0) return { error: 'Enter an amount in pounds, or 0' };
      return { value: n };
    }
    default:
      return { value: null };
  }
}

function renderQuestion(error) {
  const qs = visibleQuestions(answers);
  const q = qs[step];
  const pct = Math.round((step / qs.length) * 100);
  app.innerHTML = `
    <p class="progress">Question ${step + 1} of about ${qs.length}</p>
    <div class="progress-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
    <form id="qform" novalidate>
      <fieldset>
        <legend><h1>${esc(questionText(q, answers))}</h1></legend>
        ${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ''}
        ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
        ${inputFor(q)}
      </fieldset>
      <div class="actions">
        <button type="submit">Continue</button>
        <button type="button" class="link" id="back">Back</button>
      </div>
    </form>`;
  document.getElementById('back').onclick = () => { step -= 1; render(); };
  document.getElementById('qform').onsubmit = (e) => {
    e.preventDefault();
    const { value, error: err } = readInput(q);
    if (err) return renderQuestion(err);
    answers[q.id] = value;
    save();
    step += 1;
    render();
  };
}

function card(r) {
  const amount = r.weekly
    ? `<p class="amount">About ${money(r.weekly)} a week (${money(r.yearly)} a year)</p>`
    : r.yearly ? `<p class="amount">About ${money(r.yearly)} a year</p>` : '';
  const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  return `
    <article class="card ${r.status}">
      <span class="badge ${r.status}">${esc(STATUS_LABELS[r.status])}</span>
      <h3>${esc(r.name)}</h3>
      ${r.summary ? `<p>${esc(r.summary)}</p>` : ''}
      ${amount}
      ${r.warnings.map((w) => `<p class="warn">${esc(w)}</p>`).join('')}
      ${r.nextSteps.length ? `<p><strong>What to do</strong></p>${list(r.nextSteps)}` : ''}
      ${r.phone ? `<p><strong>${esc(r.phone)}</strong> (free)</p>` : ''}
      ${r.links.length ? `<p>${r.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('<br>')}</p>` : ''}
      ${r.reasons.length ? `<details><summary>How we worked this out</summary>${list(r.reasons)}</details>` : ''}
    </article>`;
}

function renderResults() {
  const report = assess(answers);
  const shown = report.results.filter((r) => r.status !== 'notApplicable');
  const group = (statuses) => shown.filter((r) => statuses.includes(r.status));
  const act = group(['likely', 'possible']);
  const auto = group(['automatic', 'already', 'notYet']);
  const no = group(['unlikely']);

  app.innerHTML = `
    <h1>Your results</h1>
    ${report.newMoneyWeekly > 0 ? `
      <div class="panel">
        <p style="margin:0">You could be missing about</p>
        <p class="total">${money(report.newMoneyWeekly)} a week</p>
        <p style="margin:0">That is about ${money(report.newMoneyYearly)} a year, before any help with rent, Council Tax or heating.</p>
      </div>` : ''}
    <p>${esc(report.disclaimer)}</p>
    ${act.length ? `<h2>Things to claim or check</h2>${act.map(card).join('')}` : '<h2>Nothing new to claim from your answers</h2><p>If your situation changes, for example your health or income, check again.</p>'}
    ${auto.length ? `<h2>Help you get, or should get automatically</h2>${auto.map(card).join('')}` : ''}
    ${no.length ? `<details><summary>Help you probably cannot get (${no.length})</summary>${no.map(card).join('')}</details>` : ''}
    <div class="panel">
      <p><strong>Want someone to help you claim?</strong> Age UK, Citizens Advice and Independent Age give free,
        confidential help, including filling in forms over the phone.</p>
    </div>
    <div class="actions">
      <button id="print">Print or save these results</button>
      <button class="secondary" id="change">Change my answers</button>
      <button class="link" id="restart">Start again and clear my answers</button>
    </div>
    <p class="hint">Rates for ${esc(report.taxYear)}.</p>`;
  document.getElementById('print').onclick = () => window.print();
  document.getElementById('change').onclick = () => { step = 0; render(); };
  document.getElementById('restart').onclick = () => {
    answers = {};
    try { sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    step = -1;
    render();
  };
}

function render() {
  const qs = visibleQuestions(answers);
  if (step < 0) renderStart();
  else if (step >= qs.length) renderResults();
  else renderQuestion();
  focusHeading();
}

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
