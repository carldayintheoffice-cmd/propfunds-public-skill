// Fee for the "Do it for me" claim service.
//
// DRAFT - every value here is a business decision still to be confirmed by the
// owner and checked by a solicitor (see docs/FEE-TERMS-DRAFT.md).
//
// Model: no win, no fee. The fee is one month of the NEW regular payments the
// customer is actually awarded, charged once, after the award letter arrives,
// and never more than the cap. The quote shown before sign-up is only an
// example based on the estimate.

export const PRICING = {
  capGBP: 300, // placeholder - owner to confirm
  vatIncluded: true,
  // Counted: new regular weekly or four-weekly benefit payments.
  // Not counted: backdated arrears, Council Tax / rates reductions, Housing
  // Benefit paid to a landlord, one-off and winter payments, NHS help, bus pass.
};

const round2 = (n) => Math.round(n * 100) / 100;

/** One month of a weekly amount: weekly x 52 / 12. */
export const monthlyFromWeekly = (weekly) => round2((weekly * 52) / 12);

export function feeForAward(newWeekly) {
  const monthly = monthlyFromWeekly(Math.max(0, newWeekly));
  const fee = Math.min(monthly, PRICING.capGBP);
  return { monthly, fee: round2(fee), capped: monthly > PRICING.capGBP };
}

/** Example quote from an assess() report. Only 'likely' results with an amount count. */
export function quoteFromReport(report) {
  const weekly = report.results
    .filter((r) => r.status === 'likely' && r.weekly)
    .reduce((sum, r) => sum + r.weekly, 0);
  return { weekly: round2(weekly), ...feeForAward(weekly) };
}
