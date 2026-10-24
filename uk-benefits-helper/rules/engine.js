// Entry point for every front end (web, app, adviser tools).
//
//   import { assess } from './rules/engine.js';
//   const report = assess(answers);
//
// Pure function: no network, no storage. The same answers always give the
// same report, which makes every result explainable and testable.

import { deriveFacts, round2 } from './derive.js';
import { RULES } from './benefits.js';
import { TAX_YEAR, unverifiedRates } from './rates-2026-27.js';

export const STATUS_ORDER = ['likely', 'possible', 'automatic', 'already', 'notYet', 'unlikely', 'notApplicable'];

export const STATUS_LABELS = {
  likely: 'You should claim',
  possible: 'You may qualify - check',
  automatic: 'Should come automatically',
  already: 'You get this already',
  notYet: 'Not yet',
  unlikely: 'Probably not',
  notApplicable: 'Does not apply',
};

export function assess(answers, { today = new Date() } = {}) {
  const facts = deriveFacts(answers, today);
  const results = RULES.flatMap((rule) => [].concat(rule(facts)))
    .filter(Boolean)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const newMoneyWeekly = round2(
    results.filter((r) => r.status === 'likely' && r.weekly).reduce((sum, r) => sum + r.weekly, 0),
  );

  return {
    taxYear: TAX_YEAR,
    generatedAt: today.toISOString(),
    facts: { age: facts.age, reachedSPA: facts.reachedSPA, spa: facts.spa, incomeWeekly: facts.incomeWeekly },
    results,
    newMoneyWeekly,
    newMoneyYearly: round2(newMoneyWeekly * 52),
    unverifiedRates: unverifiedRates().map((r) => r.path),
    disclaimer:
      'This is an estimate based on your answers, not a decision. Only DWP, Social Security Scotland, ' +
      'your council or the relevant office can decide a claim. Always answer claim forms truthfully.',
  };
}
