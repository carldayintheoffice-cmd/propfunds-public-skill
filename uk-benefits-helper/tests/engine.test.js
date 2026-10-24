import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess } from '../rules/engine.js';
import { statePensionAgeDate, parseDate } from '../rules/derive.js';
import { visibleQuestions } from '../rules/questions.js';

const TODAY = new Date(Date.UTC(2026, 9, 23));
const find = (report, id) => report.results.find((r) => r.id === id);
const run = (answers) => assess(answers, { today: TODAY });

const base = {
  nation: 'england',
  dob: '1950-03-01',
  couple: 'single',
  currentBenefits: ['statePension'],
  statePensionIncome: { amount: 184.9, period: 'week' },
  otherPensionIncome: { amount: 0, period: 'week' },
  earnings: { amount: 0, period: 'week' },
  otherIncome: { amount: 0, period: 'week' },
  savings: 3000,
  housing: 'rent',
  livesAlone: 'yes',
  paysCouncilTax: 'yes',
  needsCare: 'no',
  mobilityDifficulty: 'no',
  isCarer: 'no',
  taxableIncomeOver35k: 'no',
};

test('State Pension age: phased rise from 66 to 67', () => {
  assert.equal(statePensionAgeDate(parseDate('1958-01-01')).rule, 'Age 66');
  assert.equal(statePensionAgeDate(parseDate('1960-04-06')).rule, 'Age 66 and 1 month');
  assert.equal(statePensionAgeDate(parseDate('1960-05-05')).rule, 'Age 66 and 1 month');
  assert.equal(statePensionAgeDate(parseDate('1961-03-05')).rule, 'Age 66 and 11 months');
  assert.equal(statePensionAgeDate(parseDate('1961-03-06')).rule, 'Age 67');
});

test('low-income single renter: Pension Credit likely with correct shortfall', () => {
  const r = run(base);
  const pc = find(r, 'pensionCredit');
  assert.equal(pc.status, 'likely');
  assert.equal(pc.weekly, 53.1);
  assert.equal(find(r, 'housingBenefit').status, 'possible');
  assert.equal(find(r, 'councilTaxReduction').status, 'possible');
  assert.equal(find(r, 'singlePersonDiscount').status, 'likely');
  assert.equal(find(r, 'tvLicence').status, 'possible');
  assert.equal(find(r, 'winterFuel').yearly, 200);
});

test('savings over £10,000 count as deemed income (£1 per £500 or part)', () => {
  const pc = find(run({ ...base, savings: 20001 }), 'pensionCredit');
  // 10,001 over the disregard -> 21 a week
  assert.equal(pc.weekly, Math.round((238.0 - 184.9 - 21) * 100) / 100);
});

test('full new State Pension only: just over the line, so "check", never "likely"', () => {
  const near = run({ ...base, dob: '1957-06-01', statePensionIncome: { amount: 241.3, period: 'week' }, housing: 'ownOutright' });
  assert.equal(find(near, 'pensionCredit').status, 'possible');
  const r = run({ ...base, dob: '1957-06-01', statePensionIncome: { amount: 241.3, period: 'week' }, otherPensionIncome: { amount: 50, period: 'week' }, housing: 'ownOutright' });
  assert.equal(find(r, 'pensionCredit').status, 'unlikely');
  assert.equal(find(r, 'councilTaxReduction').status, 'possible');
});

test('needs care day and night for 6 months: AA higher rate, and AA unlocks Pension Credit', () => {
  const r = run({
    ...base,
    statePensionIncome: { amount: 241.3, period: 'week' },
    otherPensionIncome: { amount: 300, period: 'month' },
    needsCare: 'yes', careTime: 'both', careSixMonths: 'yes', terminalIllness: 'no', someoneGetsCarersForYou: 'no',
  });
  const aa = find(r, 'attendanceAllowance');
  assert.equal(aa.status, 'likely');
  assert.equal(aa.weekly, 114.6);
  const pc = find(r, 'pensionCredit');
  assert.equal(pc.status, 'possible');
  assert.match(pc.summary, /Attendance Allowance/);
});

test('pending AA award flags the Pension Credit severe disability uplift', () => {
  const pc = find(run({ ...base, needsCare: 'yes', careTime: 'day', careSixMonths: 'yes', someoneGetsCarersForYou: 'no' }), 'pensionCredit');
  assert.equal(pc.status, 'likely');
  assert.ok(pc.warnings.some((w) => w.includes('£139.15')));
});

test('Scotland uses Scottish benefit names', () => {
  const r = run({ ...base, nation: 'scotland', needsCare: 'yes', careTime: 'day', careSixMonths: 'yes' });
  assert.equal(find(r, 'attendanceAllowance').name, 'Pension Age Disability Payment');
  assert.ok(find(r, 'pawhp'));
  assert.equal(find(r, 'winterFuel'), undefined);
});

test('mixed-age couple is pointed to Universal Credit, not Pension Credit', () => {
  const r = run({ ...base, couple: 'couple', partnerDob: '1975-01-01', livesAlone: undefined });
  assert.equal(find(r, 'pensionCredit').status, 'unlikely');
  assert.equal(find(r, 'universalCredit').status, 'possible');
});

test('carer already on State Pension gets underlying entitlement advice, not a payment', () => {
  const ca = find(run({ ...base, isCarer: 'yes', carerEarnings: { amount: 0, period: 'week' } }), 'carersAllowance');
  assert.equal(ca.status, 'possible');
  assert.equal(ca.weekly, undefined);
});

test('never says "likely" for someone over the limits (no false entitlement)', () => {
  const r = run({ ...base, statePensionIncome: { amount: 241.3, period: 'week' }, otherPensionIncome: { amount: 30000, period: 'year' }, savings: 80000 });
  for (const id of ['pensionCredit', 'housingBenefit', 'councilTaxReduction', 'tvLicence']) {
    assert.equal(find(r, id).status, 'unlikely', id);
  }
  assert.equal(r.newMoneyWeekly, 0);
});

test('Northern Ireland: no Council Tax, Lone Pensioner Allowance at 70+', () => {
  const r = run({ ...base, nation: 'northernIreland' });
  assert.equal(find(r, 'lonePensioner').status, 'likely');
  assert.equal(find(r, 'singlePersonDiscount'), undefined);
  assert.equal(find(r, 'warmHomeDiscount'), undefined);
});

test('question flow hides partner questions for single people', () => {
  const ids = visibleQuestions({ couple: 'single' }).map((q) => q.id);
  assert.ok(!ids.includes('partnerDob'));
  assert.ok(visibleQuestions({ couple: 'couple' }).some((q) => q.id === 'partnerDob'));
});

import { feeForOutcome, quoteFromReport, monthlyFromWeekly } from '../rules/pricing.js';

test('fee is £299 or 3 months of new money, whichever is less', () => {
  assert.equal(feeForOutcome({ anyApproved: true, newWeekly: 65.77 }), 299); // 3 months = £855
  assert.equal(feeForOutcome({ anyApproved: true, newWeekly: 5 }), 65); // 3 months = £65
  assert.equal(feeForOutcome({ anyApproved: false, newWeekly: 65.77 }), 0);
  assert.equal(monthlyFromWeekly(65.77), 285);
});

test('quote estimate only counts results we are confident about', () => {
  const q = quoteFromReport(run(base));
  assert.equal(q.weekly, 53.1);
  assert.equal(q.fee, 299);
  const none = quoteFromReport(run({ ...base, statePensionIncome: { amount: 241.3, period: 'week' }, otherPensionIncome: { amount: 30000, period: 'year' }, savings: 80000, livesAlone: 'no' }));
  assert.equal(none.weekly, 0);
  assert.equal(none.fee, null);
});
