// Facts derived from raw answers: ages, State Pension age, weekly amounts.
// Dates are handled as UTC calendar dates ("YYYY-MM-DD") to avoid timezone drift.

export function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export function ageOn(dob, on) {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dob.getUTCMonth() ||
    (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() < dob.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

function addYearsMonths(date, years, months) {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth() + months, date.getUTCDate()));
}

const ymd = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

/**
 * State Pension age date under current legislation (Pensions Acts 1995-2014).
 * Returns { date, rule } or { date: null, rule } for people whose SPA was
 * reached long ago under the older (60-65) rules.
 */
export function statePensionAgeDate(dob) {
  if (dob < ymd(1954, 10, 6)) {
    return { date: null, rule: 'Reached State Pension age under earlier rules' };
  }
  if (dob < ymd(1960, 4, 6)) {
    return { date: addYearsMonths(dob, 66, 0), rule: 'Age 66' };
  }
  if (dob < ymd(1961, 3, 6)) {
    // Phased rise from 66 to 67: each month band (6th to 5th) adds one month.
    const day = dob.getUTCDate();
    let month = dob.getUTCMonth() + 1;
    let year = dob.getUTCFullYear();
    if (day < 6) {
      month -= 1;
      if (month === 0) { month = 12; year -= 1; }
    }
    const extra = (year - 1960) * 12 + (month - 4) + 1;
    return { date: addYearsMonths(dob, 66, extra), rule: `Age 66 and ${extra} month${extra > 1 ? 's' : ''}` };
  }
  return {
    date: addYearsMonths(dob, 67, 0),
    rule: dob >= ymd(1977, 4, 6) ? 'Age 67 (may rise to 68 - future law change)' : 'Age 67',
  };
}

export function hasReachedSPA(dob, today) {
  const { date } = statePensionAgeDate(dob);
  return date === null || date <= today;
}

/** Convert { amount, period } into a weekly amount. */
export function weekly(money) {
  if (money == null) return 0;
  if (typeof money === 'number') return money;
  const amount = Number(money.amount) || 0;
  switch (money.period) {
    case 'month': return (amount * 12) / 52;
    case 'year': return amount / 52;
    case 'fourWeeks': return amount / 4;
    default: return amount;
  }
}

export const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Build the derived "facts" object the rules work from.
 * @param {object} a raw answers (see questions.js)
 * @param {Date} today
 */
export function deriveFacts(a, today = new Date()) {
  const dob = parseDate(a.dob);
  const partnerDob = a.couple === 'couple' ? parseDate(a.partnerDob) : null;
  const age = dob ? ageOn(dob, today) : null;
  const partnerAge = partnerDob ? ageOn(partnerDob, today) : null;
  const spa = dob ? statePensionAgeDate(dob) : null;
  const reachedSPA = dob ? hasReachedSPA(dob, today) : false;
  const partnerReachedSPA = partnerDob ? hasReachedSPA(partnerDob, today) : false;

  const getting = new Set(a.currentBenefits || []);
  const partnerGetting = new Set(a.partnerBenefits || []);

  const incomeWeekly =
    weekly(a.statePensionIncome) +
    weekly(a.otherPensionIncome) +
    weekly(a.earnings) +
    weekly(a.otherIncome);

  const disabilityBenefit = ['attendanceAllowance', 'pip', 'dla', 'padp'].some((b) => getting.has(b));

  return {
    nation: a.nation || 'england',
    isCouple: a.couple === 'couple',
    age,
    partnerAge,
    oldestAge: Math.max(age ?? 0, partnerAge ?? 0),
    spa,
    reachedSPA,
    partnerReachedSPA,
    allReachedSPA: reachedSPA && (a.couple !== 'couple' || partnerReachedSPA),
    // Savings Credit is only for people who reached SPA before 6 April 2016.
    // Men born before 6 Apr 1951 / women before 6 Apr 1953 - we ask directly
    // when the date of birth falls in the uncertain window.
    savingsCreditEra:
      (dob && dob < ymd(1951, 4, 6)) ||
      (partnerDob && partnerDob < ymd(1951, 4, 6)) ||
      a.reachedSPABefore2016 === 'yes',
    getting,
    partnerGetting,
    incomeWeekly: round2(incomeWeekly),
    savings: Number(a.savings) || 0,
    housing: a.housing || null,
    livesAlone: a.livesAlone === 'yes',
    paysCouncilTax: a.paysCouncilTax !== 'no',
    needsCare: a.needsCare === 'yes',
    careTime: a.careTime || null, // 'day' | 'night' | 'both'
    careSixMonths: a.careSixMonths === 'yes',
    terminalIllness: a.terminalIllness === 'yes',
    disabilityBenefit,
    someoneGetsCarersForYou: a.someoneGetsCarersForYou === 'yes',
    isCarer: a.isCarer === 'yes',
    carerEarningsWeekly: weekly(a.carerEarnings),
    taxableIncomeOver35k: a.taxableIncomeOver35k === 'yes',
    mobilityDifficulty: a.mobilityDifficulty === 'yes',
  };
}
