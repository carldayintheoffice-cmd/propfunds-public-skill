// Fee for the "Do it for me" claim service.
//
// Owner decision: one flat fee of £299, charged once, only if at least one
// claim we make for the customer is approved. One fee covers every claim we
// make for them, however many are approved. The fee is charged after the
// award letter arrives, never up front. Terms still need a solicitor's review
// (see docs/FEE-TERMS-DRAFT.md).

export const PRICING = {
  flatFeeGBP: 299,
  vatIncluded: true,
};

const round2 = (n) => Math.round(n * 100) / 100;

/** One month of a weekly amount: weekly x 52 / 12. Used to show the estimate. */
export const monthlyFromWeekly = (weekly) => round2((weekly * 52) / 12);

/** The fee due once the outcome is known. */
export const feeForOutcome = ({ anyApproved }) => (anyApproved ? PRICING.flatFeeGBP : 0);

/**
 * Example shown before sign-up, from an assess() report. Only 'likely'
 * results with an amount count towards the estimate of new money.
 */
export function quoteFromReport(report) {
  const weekly = round2(report.results
    .filter((r) => r.status === 'likely' && r.weekly)
    .reduce((sum, r) => sum + r.weekly, 0));
  const monthly = monthlyFromWeekly(weekly);
  return {
    weekly,
    monthly,
    yearly: round2(weekly * 52),
    fee: PRICING.flatFeeGBP,
    // Months of new money it takes to cover the fee (null if no estimate).
    paybackMonths: monthly > 0 ? Math.ceil(PRICING.flatFeeGBP / monthly) : null,
  };
}
