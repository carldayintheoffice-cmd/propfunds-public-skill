// Fee for the "Do it for me" claim service.
//
// Owner decision: £299, or the first 3 months of new money, whichever is
// less. Charged once, only if at least one claim we make is approved, after
// the award letter arrives. One fee covers every claim we make.
//
// "New money" = new regular benefit payments plus regular reductions in
// Council Tax or rates. Back pay and one-off or winter payments are not
// counted. Terms still need a solicitor's review (docs/FEE-TERMS-DRAFT.md).

export const PRICING = {
  maxFeeGBP: 299,
  monthsOfNewMoney: 3,
  vatIncluded: true,
};

const round2 = (n) => Math.round(n * 100) / 100;

/** One month of a weekly amount: weekly x 52 / 12. */
export const monthlyFromWeekly = (weekly) => round2((weekly * 52) / 12);

/**
 * Fee due once the outcome is known.
 * @param {{ anyApproved: boolean, newWeekly: number }} outcome
 *   newWeekly - total weekly new money on the award letters
 */
export function feeForOutcome({ anyApproved, newWeekly }) {
  if (!anyApproved) return 0;
  const threeMonths = round2(Math.max(0, newWeekly) * (52 / 12) * PRICING.monthsOfNewMoney);
  return Math.min(PRICING.maxFeeGBP, threeMonths);
}

/**
 * Example shown before sign-up, from an assess() report. Only 'likely'
 * results with an amount count towards the estimate. With no estimate the
 * page says "up to £299".
 */
export function quoteFromReport(report) {
  const weekly = round2(report.results
    .filter((r) => r.status === 'likely' && r.weekly)
    .reduce((sum, r) => sum + r.weekly, 0));
  return {
    weekly,
    monthly: monthlyFromWeekly(weekly),
    yearly: round2(weekly * 52),
    fee: weekly > 0 ? feeForOutcome({ anyApproved: true, newWeekly: weekly }) : null,
  };
}
