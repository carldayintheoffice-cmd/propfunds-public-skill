// ClaimRight web front end. Plain ES modules, no build step, no tracking.
// All logic lives in ../rules - this file only asks questions and shows results.

import { visibleQuestions, questionText } from '../rules/questions.js';
import { assess, STATUS_LABELS } from '../rules/engine.js';
import { quoteFromReport, PRICING } from '../rules/pricing.js';

const app = document.getElementById('app');
const STORE_KEY = 'claimright-answers';

let answers = load();
let step = -1; // -1 = start page, questions.length = results, or 'signup' / 'signupDone'
let signup = {}; // kept in memory only, never stored

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
      <p style="margin:0"><strong>Free:</strong> this check is free, and so is claiming. You can claim yourself, or ask us
         to do it for you - you only pay us if your claim is successful.</p>
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
    ${act.length ? `
      <div class="panel">
        <h2 style="margin-top:0">Want us to do it for you?</h2>
        <p>We fill in the forms with you, send them and chase them up. You only pay if your claim is successful.</p>
        <button id="doit">Find out more</button>
      </div>` : ''}
    <p>You can also claim yourself for free, or get free help from Age UK (0800 678 1602), Citizens Advice or
      Independent Age (0800 319 6789).</p>
    <div class="actions">
      <button id="print">Print or save these results</button>
      <button class="secondary" id="change">Change my answers</button>
      <button class="link" id="restart">Start again and clear my answers</button>
    </div>
    <p class="hint">Rates for ${esc(report.taxYear)}.</p>`;
  document.getElementById('print').onclick = () => window.print();
  const doit = document.getElementById('doit');
  if (doit) doit.onclick = () => { step = 'signup'; render(); };
  document.getElementById('change').onclick = () => { step = 0; render(); };
  document.getElementById('restart').onclick = () => {
    answers = {};
    signup = {};
    try { sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    step = -1;
    render();
  };
}

// ------------------------------------------------------- "Do it for me" sign-up
// DRAFT: nothing is sent anywhere yet. The back end (secure storage, call-back
// queue, e-signature, payment link after award) is still to be built.

const SIGNUP_FIELDS = {
  forWhom: (v) => (v ? '' : 'Choose who the claim is for'),
  claimantName: (v) => (v.trim().length > 1 ? '' : 'Enter the full name of the person claiming'),
  helperName: (v, d) => (d.forWhom !== 'someoneElse' || v.trim().length > 1 ? '' : 'Enter your name'),
  helperRelationship: (v, d) => (d.forWhom !== 'someoneElse' || v.trim() ? '' : 'Tell us how you know them'),
  phone: (v) => (/^\+?[\d\s()-]{10,16}$/.test(v.trim()) && v.replace(/\D/g, '').length >= 10 ? '' : 'Enter a phone number, for example 07700 900123'),
  email: (v) => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter an email address like name@example.com, or leave it empty'),
  postcode: (v) => (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(v.trim()) ? '' : 'Enter a postcode, for example SW1A 1AA'),
  callTime: (v) => (v ? '' : 'Choose the best time to call'),
  freeHelpUnderstood: (v) => (v ? '' : 'Tick to show you understand free help is available'),
  termsAgreed: (v) => (v ? '' : 'Tick to agree to the fee terms'),
  contactAgreed: (v) => (v ? '' : 'Tick to let us contact you about the claim'),
};

function field(id, label, { hint = '', type = 'text', autocomplete = '', inputmode = '', errors = {} } = {}) {
  return `
    <div class="field ${errors[id] ? 'has-error' : ''}">
      <label for="${id}">${esc(label)}</label>
      ${hint ? `<p class="hint" id="${id}-hint">${esc(hint)}</p>` : ''}
      ${errors[id] ? `<p class="error" id="${id}-error">${esc(errors[id])}</p>` : ''}
      <input type="${type}" id="${id}" name="${id}" value="${esc(signup[id] || '')}"
        ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''}
        ${hint || errors[id] ? `aria-describedby="${[hint && `${id}-hint`, errors[id] && `${id}-error`].filter(Boolean).join(' ')}"` : ''}>
    </div>`;
}

function radios(id, legend, options, errors) {
  return `
    <fieldset class="field ${errors[id] ? 'has-error' : ''}">
      <legend class="label">${esc(legend)}</legend>
      ${errors[id] ? `<p class="error">${esc(errors[id])}</p>` : ''}
      ${options.map(([value, label]) => `
        <label class="option"><input type="radio" name="${id}" value="${value}" ${signup[id] === value ? 'checked' : ''}>
        <span>${esc(label)}</span></label>`).join('')}
    </fieldset>`;
}

function tick(id, label, errors) {
  return `
    <div class="field ${errors[id] ? 'has-error' : ''}">
      ${errors[id] ? `<p class="error">${esc(errors[id])}</p>` : ''}
      <label class="option"><input type="checkbox" id="${id}" ${signup[id] ? 'checked' : ''}><span>${label}</span></label>
    </div>`;
}

function renderSignup(errors = {}) {
  const quote = quoteFromReport(assess(answers));
  const errorList = Object.values(errors).filter(Boolean);
  const someoneElse = signup.forWhom === 'someoneElse';

  app.innerHTML = `
    <p class="preview">Preview: this form does not send your details anywhere yet.</p>
    <h1>Let us do your claim for you</h1>
    ${errorList.length ? `<div class="error-summary" role="alert" tabindex="-1"><h2>Please check these answers</h2>
      <ul>${errorList.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}

    <h2>What we do</h2>
    <ol class="steps">
      <li>We phone you at a time that suits you.</li>
      <li>We fill in the claim forms with you, using your answers.</li>
      <li>You check everything and sign the claim yourself.</li>
      <li>We send it and chase it up until there is a decision.</li>
      <li>The money is paid straight into <strong>your own</strong> bank account. Your award letter comes to you.</li>
    </ol>

    <div class="panel">
      <h2 style="margin-top:0">What it costs</h2>
      <p><strong>Nothing, unless your claim is successful.</strong></p>
      <p>If it is, our fee is <strong>${money(PRICING.maxFeeGBP)}</strong>, or ${PRICING.monthsOfNewMoney} months of your new
        money if that is less. You pay once, and it covers every claim we make for you. You pay after your award letter
        arrives - we send you a secure payment link then, never before.</p>
      ${quote.fee ? `<p>From your answers you could get about <strong>${money(quote.monthly)} a month</strong>
        (${money(quote.yearly)} a year) in new money. The fee would be <strong>${money(quote.fee)}</strong>.</p>` : ''}
      <p style="margin:0">No hidden extras. No percentage of your money. No monthly charges.</p>
    </div>

    <div class="panel free">
      <h2 style="margin-top:0">You do not have to pay</h2>
      <p>You can claim yourself, free, using the phone numbers and links in your results. You can also get free help from:</p>
      <ul>
        <li>Age UK Advice Line: 0800 678 1602</li>
        <li>Independent Age: 0800 319 6789</li>
        <li>Citizens Advice: citizensadvice.org.uk</li>
      </ul>
      <p style="margin:0">Choose us if you would rather we do the work for you.</p>
    </div>

    <form id="signupForm" novalidate>
      <h2>Your details</h2>
      ${radios('forWhom', 'Who is the claim for?', [['me', 'Me'], ['someoneElse', 'Someone else - I am helping them, with their permission']], errors)}
      ${field('claimantName', someoneElse ? 'Full name of the person claiming' : 'Your full name', { autocomplete: someoneElse ? '' : 'name', errors })}
      ${someoneElse ? field('helperName', 'Your name', { autocomplete: 'name', errors }) : ''}
      ${someoneElse ? field('helperRelationship', 'How do you know them?', { hint: 'For example: daughter, son, neighbour', errors }) : ''}
      ${field('phone', 'Phone number', { type: 'tel', autocomplete: 'tel', hint: 'We will call you on this number.', errors })}
      ${field('email', 'Email address (optional)', { type: 'email', autocomplete: 'email', errors })}
      ${field('postcode', 'Postcode', { autocomplete: 'postal-code', errors })}
      ${radios('callTime', 'When is the best time to call?', [['morning', 'Morning (9am to 12pm)'], ['afternoon', 'Afternoon (12pm to 5pm)'], ['evening', 'Early evening (5pm to 7pm)']], errors)}

      <h2>Before you send</h2>
      ${tick('freeHelpUnderstood', 'I understand I can claim myself, or get free help from a charity, instead of paying.', errors)}
      ${tick('termsAgreed', `I agree to pay a one-off fee of ${money(PRICING.maxFeeGBP)} (or ${PRICING.monthsOfNewMoney} months of my new money if that is less), only if a claim you make for me is approved.`, errors)}
      ${tick('contactAgreed', 'You can contact me and keep my details to help with my claim.', errors)}
      <details>
        <summary>Read the full terms in plain English</summary>
        <ul>
          <li>You can cancel within 14 days of signing up, free, for any reason.</li>
          <li>After that you can still cancel at any time. If we have already sent your claim and it is later successful, the fee still applies.</li>
          <li>If every claim we make for you is refused, you pay nothing.</li>
          <li>The fee is never more than ${money(PRICING.maxFeeGBP)}, however many claims are approved.</li>
          <li>"New money" means new regular benefit payments and Council Tax or rates reductions. Back pay and one-off or
            winter payments are not counted.</li>
          <li>If paying would cause you hardship, tell us and we will reduce or waive the fee.</li>
          <li>We will never ask for your bank details, passwords, or GOV.UK or Government Gateway logins on the phone.</li>
          <li>You must answer every question on the claim honestly. We will not help with a claim we think is not correct.</li>
          <li>We keep your details securely and only use them for your claim. You can ask us to delete them.</li>
        </ul>
      </details>
      <div class="actions">
        <button type="submit">Ask for a call back</button>
        <button type="button" class="link" id="back">Back to my results</button>
      </div>
    </form>`;

  const form = document.getElementById('signupForm');
  const collect = () => {
    for (const id of ['claimantName', 'helperName', 'helperRelationship', 'phone', 'email', 'postcode']) {
      const el = form.querySelector(`#${id}`);
      if (el) signup[id] = el.value;
    }
    for (const id of ['forWhom', 'callTime']) signup[id] = form.querySelector(`input[name="${id}"]:checked`)?.value || '';
    for (const id of ['freeHelpUnderstood', 'termsAgreed', 'contactAgreed']) signup[id] = form.querySelector(`#${id}`).checked;
  };
  form.querySelectorAll('input[name="forWhom"]').forEach((el) => {
    el.onchange = () => { collect(); renderSignup(); };
  });
  document.getElementById('back').onclick = () => { collect(); step = visibleQuestions(answers).length; render(); };
  form.onsubmit = (e) => {
    e.preventDefault();
    collect();
    const found = {};
    for (const [id, check] of Object.entries(SIGNUP_FIELDS)) {
      const msg = check(typeof signup[id] === 'string' ? signup[id] : signup[id] ? 'yes' : '', signup);
      if (msg) found[id] = msg;
    }
    if (Object.keys(found).length) {
      renderSignup(found);
      app.querySelector('.error-summary')?.focus();
      return;
    }
    step = 'signupDone';
    render();
  };
}

function renderSignupDone() {
  const who = signup.forWhom === 'someoneElse' ? signup.helperName : signup.claimantName;
  const when = { morning: 'in the morning', afternoon: 'in the afternoon', evening: 'in the early evening' }[signup.callTime];
  app.innerHTML = `
    <p class="preview">Preview: in the finished service your request would be sent to our team now.</p>
    <h1>Thank you, ${esc(who.split(' ')[0])}</h1>
    <div class="panel">
      <p>We will phone you on <strong>${esc(signup.phone)}</strong> ${esc(when)}, usually within 2 working days.</p>
      <p style="margin:0">When we call, we will say your name and postcode so you know it is us. We will never ask for your bank
        details or passwords.</p>
    </div>
    <h2>Have these ready for the call</h2>
    <ul>
      <li>National Insurance number</li>
      <li>Your latest State Pension and other pension letters</li>
      <li>Recent bank or building society statements, to check your savings total (we will not ask for account numbers)</li>
      <li>Your tenancy agreement or Council Tax bill, if you have them</li>
    </ul>
    <p>Changed your mind? You can cancel free within 14 days.</p>
    <div class="actions"><button class="secondary" id="toResults">Back to my results</button></div>`;
  document.getElementById('toResults').onclick = () => { step = visibleQuestions(answers).length; render(); };
}

function render() {
  const qs = visibleQuestions(answers);
  if (step === 'signup') renderSignup();
  else if (step === 'signupDone') renderSignupDone();
  else if (step < 0) renderStart();
  else if (step >= qs.length) renderResults();
  else renderQuestion();
  focusHeading();
}

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
