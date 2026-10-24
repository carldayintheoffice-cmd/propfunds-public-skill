// Benefit rates for the 2026/27 tax year (6 April 2026 - 5 April 2027).
//
// Every figure carries the source it was taken from and whether it has been
// checked against an official DWP / GOV.UK publication. `verified: false`
// figures MUST be checked before the app is released to the public. The
// GOV.UK watcher (tools/govuk-watch.js) flags when a source page changes.

export const TAX_YEAR = '2026/27';
export const EFFECTIVE_FROM = '2026-04-06';
export const EFFECTIVE_TO = '2027-04-05';

const DWP_RATES_2026 =
  'https://www.gov.uk/government/publications/benefit-and-pension-rates-2026-to-2027';

export const RATES = {
  statePension: {
    newFullWeekly: { value: 241.3, source: DWP_RATES_2026, verified: true },
    basicFullWeekly: { value: 184.9, source: DWP_RATES_2026, verified: false },
  },

  pensionCredit: {
    standardMinimumGuarantee: {
      single: { value: 238.0, source: DWP_RATES_2026, verified: true },
      couple: { value: 363.25, source: DWP_RATES_2026, verified: true },
    },
    severeDisabilityAddition: { value: 86.05, source: DWP_RATES_2026, verified: true },
    carerAddition: { value: 48.15, source: DWP_RATES_2026, verified: true },
    savingsCreditMax: {
      single: { value: 17.96, source: DWP_RATES_2026, verified: true },
      couple: { value: 20.1, source: DWP_RATES_2026, verified: true },
    },
    // Pension-age capital rules: first £10,000 ignored, then £1 a week of
    // "deemed income" for every £500 (or part of £500) above that.
    capitalDisregard: { value: 10000, source: 'https://www.gov.uk/pension-credit/eligibility', verified: true },
    deemedIncomePer: { value: 500, source: 'https://www.gov.uk/pension-credit/eligibility', verified: true },
  },

  attendanceAllowance: {
    lowerWeekly: { value: 76.7, source: DWP_RATES_2026, verified: true },
    higherWeekly: { value: 114.6, source: DWP_RATES_2026, verified: true },
  },

  carersAllowance: {
    weekly: { value: 86.45, source: DWP_RATES_2026, verified: false },
    // Weekly earnings limit after allowable expenses. Not yet confirmed.
    earningsLimitWeekly: { value: 204, source: DWP_RATES_2026, verified: false },
  },

  winterFuelPayment: {
    // England & Wales (and Northern Ireland). Paid automatically to people of
    // State Pension age; recovered through tax if taxable income > £35,000.
    standard: { value: 200, source: 'https://www.gov.uk/winter-fuel-payment', verified: false },
    over80: { value: 300, source: 'https://www.gov.uk/winter-fuel-payment', verified: false },
    incomeRecoveryThreshold: { value: 35000, source: 'https://www.gov.uk/winter-fuel-payment', verified: true },
  },

  coldWeatherPayment: {
    perColdSpell: { value: 25, source: 'https://www.gov.uk/cold-weather-payment', verified: true },
  },

  warmHomeDiscount: {
    annual: { value: 150, source: 'https://www.gov.uk/the-warm-home-discount-scheme', verified: true },
  },

  housingAndCouncilTax: {
    // Pension-age Housing Benefit and most Council Tax Reduction schemes stop
    // at £16,000 of capital unless you get Guarantee Credit.
    capitalUpperLimit: { value: 16000, source: 'https://www.gov.uk/housing-benefit/eligibility', verified: true },
    singlePersonDiscountPct: { value: 25, source: 'https://www.gov.uk/council-tax/discounts-for-people-who-live-alone', verified: true },
  },
};

/** Plain number for a rate entry. */
export const v = (entry) => entry.value;

/** Every rate entry that still needs checking against an official source. */
export function unverifiedRates(node = RATES, path = []) {
  if (node && typeof node === 'object' && 'value' in node && 'verified' in node) {
    return node.verified ? [] : [{ path: path.join('.'), ...node }];
  }
  return Object.entries(node).flatMap(([k, child]) => unverifiedRates(child, [...path, k]));
}
