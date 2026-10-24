// One rule per benefit or entitlement. Each rule reads the derived facts and
// returns a result. Rules are deliberately CONSERVATIVE: when we cannot be
// sure, the status is 'possible' and we say exactly what to check. We never
// tell someone they are entitled to something the rules say they are not.
//
// Result shape:
//   { id, name, status, summary, weekly?, yearly?, reasons[], nextSteps[],
//     links[{label,url}], phone?, warnings[] }
//
// Status meanings (shown to the user):
//   likely        - the answers meet the rules; you should claim
//   possible      - you may qualify; a check or claim is needed to be sure
//   automatic     - you should get this without claiming
//   already       - you told us you get this
//   notYet        - not available yet (e.g. under State Pension age)
//   unlikely      - the answers do not meet the rules
//   notApplicable - does not apply to your situation (hidden by default)

import { RATES, v } from './rates-2026-27.js';
import { round2 } from './derive.js';

const scot = (f) => f.nation === 'scotland';
const ni = (f) => f.nation === 'northernIreland';
const gets = (f, id) => f.getting.has(id) || f.partnerGetting.has(id);

function result(id, name, status, fields = {}) {
  return { id, name, status, reasons: [], nextSteps: [], links: [], warnings: [], ...fields };
}

const money = (n) => `£${n.toFixed(2)}`;

// ---------------------------------------------------------------- Pension Credit

/** The Pension Credit sums, shared by several rules. */
export function pensionCreditCalc(f, { assumeDisabilityBenefit = false } = {}) {
  const pc = RATES.pensionCredit;
  const reasons = [];
  let guarantee = f.isCouple ? v(pc.standardMinimumGuarantee.couple) : v(pc.standardMinimumGuarantee.single);
  reasons.push(`Standard amount for a ${f.isCouple ? 'couple' : 'single person'}: ${money(guarantee)} a week`);

  // Severe disability addition: qualifying disability benefit, nobody else
  // aged 18+ living with you (partner aside, who must also qualify), and
  // nobody paid Carer's Allowance for looking after you. We only add one
  // addition for couples - conservative.
  const disabled = f.disabilityBenefit || assumeDisabilityBenefit;
  const sdaEligible = disabled && !f.someoneGetsCarersForYou && (f.isCouple ? false : f.livesAlone);
  if (sdaEligible) {
    guarantee += v(pc.severeDisabilityAddition);
    reasons.push(`Severe disability extra amount: ${money(v(pc.severeDisabilityAddition))} a week`);
  }

  if (gets(f, 'carersAllowance')) {
    guarantee += v(pc.carerAddition);
    reasons.push(`Carer extra amount: ${money(v(pc.carerAddition))} a week`);
  }

  const excessSavings = Math.max(0, f.savings - v(pc.capitalDisregard));
  const deemedIncome = Math.ceil(excessSavings / v(pc.deemedIncomePer));
  if (deemedIncome > 0) {
    reasons.push(`Savings over £10,000 count as ${money(deemedIncome)} a week of income`);
  }
  const income = round2(f.incomeWeekly + deemedIncome);
  reasons.push(`Your weekly income counted: ${money(income)}`);

  const shortfall = round2(guarantee - income);
  const scMax = f.isCouple ? v(pc.savingsCreditMax.couple) : v(pc.savingsCreditMax.single);
  // Savings Credit tapers away completely once income exceeds the guarantee
  // by scMax / 40%.
  const savingsCreditCeiling = round2(guarantee + scMax / 0.4);

  return { guarantee: round2(guarantee), income, shortfall, sdaEligible, savingsCreditCeiling, reasons };
}

/** True if the person gets, or very probably could get, Guarantee Credit. */
export function onOrLikelyGuaranteeCredit(f) {
  if (gets(f, 'pensionCredit')) return 'already';
  if (!f.allReachedSPA) return false;
  return pensionCreditCalc(f).shortfall > 0 ? 'likely' : false;
}

function pensionCredit(f) {
  const name = 'Pension Credit';
  const links = [
    ni(f)
      ? { label: 'Pension Credit (nidirect)', url: 'https://www.nidirect.gov.uk/articles/pension-credit' }
      : { label: 'Pension Credit on GOV.UK', url: 'https://www.gov.uk/pension-credit' },
  ];
  if (!ni(f)) links.push({ label: 'Official Pension Credit calculator', url: 'https://www.gov.uk/pension-credit-calculator' });
  const phone = ni(f) ? undefined : 'Pension Credit claim line: 0800 99 1234';

  if (gets(f, 'pensionCredit')) {
    return result('pensionCredit', name, 'already', {
      summary: 'You already get Pension Credit. It also unlocks other help - see the rest of this list.',
      links,
    });
  }
  if (!f.reachedSPA) {
    return result('pensionCredit', name, 'notYet', { summary: 'You can get Pension Credit once you reach State Pension age.', links });
  }
  if (f.isCouple && !f.partnerReachedSPA) {
    return result('pensionCredit', name, 'unlikely', {
      summary: 'Couples where one partner is under State Pension age usually claim Universal Credit instead.',
      reasons: ['Since May 2019 both partners must have reached State Pension age for a new Pension Credit claim.'],
      links,
    });
  }
  const calc = pensionCreditCalc(f);
  const nextSteps = [
    'Claim online, by phone, or by post. You can backdate a claim by up to 3 months.',
    'Have ready: National Insurance number, bank details, and details of income, savings and pensions.',
  ];
  const warnings = [];
  if (f.housing === 'mortgage') warnings.push('Pension Credit can also include help with mortgage interest (as a loan). This is not included in the estimate.');
  if (f.housing === 'careHome') warnings.push('Care home fees and arrangements change how Pension Credit is worked out. Ask the care home or council for a benefits check.');

  if (calc.shortfall > 0) {
    if (!calc.sdaEligible && !f.disabilityBenefit && f.needsCare && f.careSixMonths) {
      const withAA = pensionCreditCalc(f, { assumeDisabilityBenefit: true });
      if (withAA.shortfall > calc.shortfall) {
        warnings.push(`If you are awarded ${scot(f) ? 'Pension Age Disability Payment' : 'Attendance Allowance'}, tell the Pension Service: your Pension Credit could rise to about ${money(withAA.shortfall)} a week.`);
      }
    }
    return result('pensionCredit', name, 'likely', {
      summary: `Your income looks lower than the Pension Credit level. Estimated ${money(calc.shortfall)} a week.`,
      weekly: calc.shortfall,
      yearly: round2(calc.shortfall * 52),
      reasons: calc.reasons,
      nextSteps,
      links,
      phone,
      warnings: [...warnings, 'Even a small award is worth claiming: it opens the door to help with rent, Council Tax, heating and a free TV licence for over 75s.'],
    });
  }

  if (f.savingsCreditEra && calc.income < calc.savingsCreditCeiling) {
    return result('pensionCredit', name, 'possible', {
      summary: 'You may get the "Savings Credit" part of Pension Credit, a smaller weekly top-up for people who saved for retirement.',
      reasons: [...calc.reasons, 'You reached State Pension age before 6 April 2016, so Savings Credit can apply.'],
      nextSteps: ['Use the official calculator or call the claim line to check the exact amount.', ...nextSteps],
      links,
      phone,
      warnings,
    });
  }

  // Could an Attendance Allowance award tip them into Pension Credit?
  if (!f.disabilityBenefit && f.needsCare && f.careSixMonths) {
    const withAA = pensionCreditCalc(f, { assumeDisabilityBenefit: true });
    if (withAA.shortfall > 0) {
      return result('pensionCredit', name, 'possible', {
        summary: `If you are awarded ${scot(f) ? 'Pension Age Disability Payment' : 'Attendance Allowance'}, you could then also qualify for Pension Credit (about ${money(withAA.shortfall)} a week).`,
        reasons: withAA.reasons,
        nextSteps: ['Claim the disability benefit first.', 'Once it is awarded, claim Pension Credit straight away - it can be backdated to the date of the disability award.'],
        links,
        phone,
        warnings,
      });
    }
  }

  if (calc.shortfall > -10) {
    return result('pensionCredit', name, 'possible', {
      summary: 'Your income is only just above the Pension Credit level. Housing costs or extra amounts we have not asked about could change this.',
      reasons: calc.reasons,
      nextSteps: ['Use the official calculator to check.', ...nextSteps],
      links,
      phone,
      warnings,
    });
  }

  return result('pensionCredit', name, 'unlikely', {
    summary: 'Your income looks higher than the Pension Credit level.',
    reasons: [...calc.reasons, `Pension Credit level for you: ${money(calc.guarantee)} a week`],
    links,
  });
}

// ------------------------------------------------------------ State Pension

function statePension(f) {
  const name = 'State Pension';
  const links = [
    { label: 'Check your State Pension forecast', url: 'https://www.gov.uk/check-state-pension' },
    { label: 'Check your National Insurance record', url: 'https://www.gov.uk/check-national-insurance-record' },
  ];
  if (!f.reachedSPA) {
    const when = f.spa?.date ? f.spa.date.toISOString().slice(0, 10) : 'unknown';
    return result('statePension', name, 'notYet', {
      summary: `Your State Pension age is ${f.spa?.rule?.toLowerCase() ?? 'not known'} (on ${when}).`,
      nextSteps: [
        'Check your forecast and National Insurance record now.',
        'Gaps can sometimes be filled with voluntary contributions - check before you pay.',
        'You should get an invitation to claim about 2 months before your State Pension age. If you do not, call the claim line.',
      ],
      links,
    });
  }
  if (f.getting.has('statePension')) {
    return result('statePension', name, 'already', { summary: 'You already get State Pension.', links });
  }
  return result('statePension', name, 'possible', {
    summary: 'You have reached State Pension age but told us you do not get State Pension. It is not paid automatically - you have to claim it.',
    reasons: ['You usually need at least 10 qualifying years on your National Insurance record.'],
    nextSteps: ['Claim online or by phone. It can be backdated by up to 12 months.', 'If you chose to put it off (defer), you may get extra money when you claim.'],
    links: [{ label: 'Claim your State Pension', url: 'https://www.gov.uk/get-state-pension' }, ...links],
    phone: 'State Pension claim line: 0800 731 7898',
  });
}

// ------------------------------------------------ Attendance Allowance / PADP

function attendanceAllowance(f) {
  const isScot = scot(f);
  const name = isScot ? 'Pension Age Disability Payment' : 'Attendance Allowance';
  const links = isScot
    ? [{ label: 'Pension Age Disability Payment (mygov.scot)', url: 'https://www.mygov.scot/pension-age-disability-payment' }]
    : ni(f)
      ? [{ label: 'Attendance Allowance (nidirect)', url: 'https://www.nidirect.gov.uk/articles/attendance-allowance' }]
      : [{ label: 'Attendance Allowance on GOV.UK', url: 'https://www.gov.uk/attendance-allowance' }];
  const phone = isScot ? 'Social Security Scotland: 0800 182 2222' : ni(f) ? undefined : 'Attendance Allowance helpline: 0800 731 0122';

  if (['attendanceAllowance', 'padp', 'pip', 'dla'].some((b) => f.getting.has(b))) {
    return result('attendanceAllowance', name, 'already', {
      summary: 'You already get a disability benefit. If your needs have increased, you can ask for it to be looked at again.',
      links,
    });
  }
  if (!f.needsCare) {
    return result('attendanceAllowance', name, 'unlikely', {
      summary: 'This is for people who need help or supervision because of illness or disability. If that changes, come back and check again.',
      links,
    });
  }
  if (!f.reachedSPA) {
    return result('attendanceAllowance', isScot ? 'Adult Disability Payment' : 'Personal Independence Payment (PIP)', 'possible', {
      summary: 'Under State Pension age, the disability benefit is PIP (Adult Disability Payment in Scotland).',
      links: [isScot
        ? { label: 'Adult Disability Payment', url: 'https://www.mygov.scot/adult-disability-payment' }
        : { label: 'PIP on GOV.UK', url: 'https://www.gov.uk/pip' }],
    });
  }

  const higher = f.terminalIllness || f.careTime === 'both';
  const weekly = higher ? v(RATES.attendanceAllowance.higherWeekly) : v(RATES.attendanceAllowance.lowerWeekly);
  const warnings = [
    'It is not means-tested: your income and savings do not matter, and it is tax-free.',
    'It can also increase Pension Credit, Housing Benefit and Council Tax Reduction.',
  ];
  if (f.housing === 'careHome') warnings.push('If the council pays towards your care home fees, this benefit usually stops after 4 weeks.');

  if (f.terminalIllness) {
    return result('attendanceAllowance', name, 'likely', {
      summary: `Claims for people who may have 12 months or less to live are fast-tracked and paid at the higher rate: ${money(weekly)} a week.`,
      weekly,
      yearly: round2(weekly * 52),
      reasons: ['Special rules apply: you do not have to wait 6 months.'],
      nextSteps: ['Ask your doctor or nurse for form SR1 and send it with your claim.'],
      links,
      phone,
      warnings,
    });
  }
  if (!f.careSixMonths) {
    return result('attendanceAllowance', name, 'possible', {
      summary: 'You can claim once you have needed help for 6 months.',
      reasons: ['The rules say you must have needed help for at least 6 months.'],
      nextSteps: ['Keep a diary of the help you need. Come back and claim when you reach 6 months.'],
      links,
      phone,
    });
  }
  return result('attendanceAllowance', name, 'likely', {
    summary: `From your answers you may get the ${higher ? 'higher' : 'lower'} rate: ${money(weekly)} a week.`,
    weekly,
    yearly: round2(weekly * 52),
    reasons: [
      `You need help ${f.careTime === 'both' ? 'both day and night' : `during the ${f.careTime ?? 'day'}`}.`,
      'You have needed help for 6 months or more.',
    ],
    nextSteps: [
      'Get the claim form (online, by phone or by post).',
      'Describe your worst days, and what help you need even if nobody gives it. Many claims are refused only because the form undersells the need.',
      'Free help filling in the form: Age UK (0800 678 1602), Citizens Advice, or your local council welfare rights team.',
    ],
    links,
    phone,
    warnings,
  });
}

// ------------------------------------------------------- Carer's Allowance

function carersAllowance(f) {
  const isScot = scot(f);
  const name = isScot ? 'Carer Support Payment' : "Carer's Allowance";
  const links = isScot
    ? [{ label: 'Carer Support Payment (mygov.scot)', url: 'https://www.mygov.scot/carer-support-payment' }]
    : ni(f)
      ? [{ label: "Carer's Allowance (nidirect)", url: 'https://www.nidirect.gov.uk/articles/carers-allowance' }]
      : [{ label: "Carer's Allowance on GOV.UK", url: 'https://www.gov.uk/carers-allowance' }];
  if (!f.isCarer) return result('carersAllowance', name, 'notApplicable', { links });
  if (f.getting.has('carersAllowance')) return result('carersAllowance', name, 'already', { summary: 'You already get this.', links });

  const rate = v(RATES.carersAllowance.weekly);
  const limit = v(RATES.carersAllowance.earningsLimitWeekly);
  if (f.carerEarningsWeekly > limit) {
    return result('carersAllowance', name, 'unlikely', {
      summary: `Your earnings are above the weekly limit (about ${money(limit)} after allowable expenses).`,
      links,
    });
  }
  const warnings = [
    'Important: if you are PAID this, the person you care for may lose the severe disability extra amount of their Pension Credit or other benefits. Check first.',
  ];
  if (f.getting.has('statePension')) {
    return result('carersAllowance', name, 'possible', {
      summary: 'You cannot be paid this on top of your State Pension, but claiming it can still be worth it.',
      reasons: [
        'Your State Pension is likely more than the carer payment, so it is not paid ("underlying entitlement").',
        `Underlying entitlement can add ${money(v(RATES.pensionCredit.carerAddition))} a week to Pension Credit, and increase Housing Benefit and Council Tax Reduction.`,
        'Underlying entitlement does NOT affect the benefits of the person you care for.',
      ],
      nextSteps: ['Claim only if you get, or are claiming, Pension Credit, Housing Benefit or Council Tax Reduction.'],
      links,
    });
  }
  return result('carersAllowance', name, 'likely', {
    summary: `You may get ${money(rate)} a week for caring.`,
    weekly: rate,
    yearly: round2(rate * 52),
    reasons: ['You care for someone 35 hours or more a week.', 'Your earnings are under the limit.'],
    links,
    phone: isScot ? 'Social Security Scotland: 0800 182 2222' : ni(f) ? undefined : "Carer's Allowance Unit: 0800 731 0297",
    warnings,
  });
}

// ------------------------------------------------------- Housing Benefit

function housingBenefit(f) {
  const name = 'Housing Benefit';
  const links = ni(f)
    ? [{ label: 'Housing Benefit (NI Housing Executive)', url: 'https://www.nihe.gov.uk/housing-help/housing-benefit' }]
    : [{ label: 'Housing Benefit on GOV.UK', url: 'https://www.gov.uk/housing-benefit' }];
  if (f.housing !== 'rent') {
    if (f.housing === 'mortgage' && onOrLikelyGuaranteeCredit(f)) {
      return result('housingBenefit', 'Support for Mortgage Interest', 'possible', {
        summary: 'If you get Pension Credit you can apply for a loan towards your mortgage interest.',
        warnings: ['This is a loan secured on your home, repaid when you sell or from your estate. Get independent advice before taking it.'],
        links: [{ label: 'Support for Mortgage Interest', url: 'https://www.gov.uk/support-for-mortgage-interest' }],
      });
    }
    return result('housingBenefit', name, 'notApplicable', { links });
  }
  if (gets(f, 'housingBenefit')) return result('housingBenefit', name, 'already', { summary: 'You already get Housing Benefit.', links });
  if (f.isCouple && f.reachedSPA !== f.partnerReachedSPA) {
    return result('housingBenefit', name, 'possible', {
      summary: 'As one of you is under State Pension age, help with rent normally comes through Universal Credit.',
      links: [{ label: 'Universal Credit', url: 'https://www.gov.uk/universal-credit' }],
    });
  }
  if (!f.reachedSPA) return result('housingBenefit', name, 'notApplicable', { links });

  const gc = onOrLikelyGuaranteeCredit(f);
  if (gc) {
    return result('housingBenefit', name, gc === 'already' ? 'likely' : 'possible', {
      summary: 'People on the Guarantee Credit part of Pension Credit usually get their full eligible rent paid.',
      reasons: [gc === 'already' ? 'You get Pension Credit.' : 'You look likely to qualify for Pension Credit.'],
      nextSteps: ['Ask for Housing Benefit when you claim Pension Credit - the Pension Service can pass it to your council.'],
      links,
    });
  }
  if (f.savings < v(RATES.housingAndCouncilTax.capitalUpperLimit)) {
    return result('housingBenefit', name, 'possible', {
      summary: 'You rent and your savings are under £16,000, so you may get some help with rent depending on your income and rent.',
      nextSteps: ['Apply to your local council (in NI, the Housing Executive).'],
      links,
    });
  }
  return result('housingBenefit', name, 'unlikely', { summary: 'Savings of £16,000 or more usually stop Housing Benefit unless you get Guarantee Credit.', links });
}

// ----------------------------------------------- Council Tax / rates relief

function councilTax(f) {
  const out = [];
  if (!f.paysCouncilTax || f.housing === 'careHome' || f.housing === 'family') return out;

  if (ni(f)) {
    if (f.livesAlone && f.oldestAge >= 70) {
      out.push(result('lonePensioner', 'Lone Pensioner Allowance', 'likely', {
        summary: 'People aged 70 or over who live alone can get 20% off their rates bill.',
        links: [{ label: 'Lone Pensioner Allowance (nidirect)', url: 'https://www.nidirect.gov.uk/articles/lone-pensioner-allowance' }],
      }));
    }
    const gc = onOrLikelyGuaranteeCredit(f);
    out.push(result('rateRelief', 'Housing Benefit for rates / Rate Relief', gc ? 'possible' : f.savings < 16000 ? 'possible' : 'unlikely', {
      summary: gc ? 'With Pension Credit you may get help with your full rates bill.' : 'You may get help with your rates depending on income and savings.',
      links: [{ label: 'Help with rates (nidirect)', url: 'https://www.nidirect.gov.uk/articles/rate-relief-scheme' }],
    }));
    return out;
  }

  if (f.livesAlone) {
    out.push(result('singlePersonDiscount', 'Council Tax single person discount', 'likely', {
      summary: 'If you are the only adult in your home you can get 25% off Council Tax, whatever your income.',
      nextSteps: ['Contact your council. If you have been eligible for a while, ask for it to be backdated.'],
      links: [{ label: 'Single person discount', url: 'https://www.gov.uk/council-tax/discounts-for-people-who-live-alone' }],
    }));
  }

  const name = scot(f) ? 'Council Tax Reduction' : f.nation === 'wales' ? 'Council Tax Reduction' : 'Council Tax Reduction (Support)';
  const links = [{ label: 'Council Tax Reduction', url: 'https://www.gov.uk/council-tax-reduction' }];
  if (gets(f, 'councilTaxReduction')) {
    out.push(result('councilTaxReduction', name, 'already', { summary: 'You already get this.', links }));
    return out;
  }
  const gc = onOrLikelyGuaranteeCredit(f);
  if (gc) {
    out.push(result('councilTaxReduction', name, gc === 'already' ? 'likely' : 'possible', {
      summary: 'People of pension age on Guarantee Credit can usually get their whole Council Tax bill reduced to nothing.',
      nextSteps: ['Apply to your local council.'],
      links,
    }));
    return out;
  }
  if (f.reachedSPA && f.savings < v(RATES.housingAndCouncilTax.capitalUpperLimit)) {
    // Pension-age schemes reduce support by 20p for each £1 of income above
    // the applicable amount, so modest incomes can still get some help.
    const excess = pensionCreditCalc(f).income - pensionCreditCalc(f).guarantee;
    if (excess < 150) {
      out.push(result('councilTaxReduction', name, 'possible', {
        summary: 'Your income and savings are low enough that you may get some money off your Council Tax.',
        nextSteps: ['Apply to your local council - each council has its own calculator.'],
        links,
      }));
      return out;
    }
  }
  out.push(result('councilTaxReduction', name, 'unlikely', { summary: 'Your income or savings look too high for a reduction.', links }));
  return out;
}

// ----------------------------------------------------- Winter / heating help

function winterHelp(f) {
  const out = [];
  if (!f.reachedSPA) return out;
  const gc = onOrLikelyGuaranteeCredit(f);

  if (scot(f)) {
    out.push(result('pawhp', 'Pension Age Winter Heating Payment', 'automatic', {
      summary: 'Paid automatically each winter in Scotland to people of State Pension age. People on Pension Credit get a higher amount.',
      links: [{ label: 'Pension Age Winter Heating Payment', url: 'https://www.mygov.scot/pension-age-winter-heating-payment' }],
    }));
    out.push(result('winterHeating', 'Winter Heating Payment', gc === 'already' ? 'automatic' : gc ? 'possible' : 'notApplicable', {
      summary: 'A yearly payment for people on Pension Credit and some other benefits in Scotland.',
      links: [{ label: 'Winter Heating Payment', url: 'https://www.mygov.scot/winter-heating-payment' }],
    }));
  } else {
    const amount = f.oldestAge >= 80 ? v(RATES.winterFuelPayment.over80) : v(RATES.winterFuelPayment.standard);
    out.push(result('winterFuel', 'Winter Fuel Payment', 'automatic', {
      summary: `Up to ${money(amount)} each winter, usually paid automatically in November or December.`,
      yearly: amount,
      warnings: f.taxableIncomeOver35k
        ? ['Your taxable income is over £35,000, so HMRC will take this back through your tax. You can opt out.']
        : [],
      nextSteps: ['If you did not get it last winter and you do not get State Pension, call the Winter Fuel Payment Centre.'],
      links: [ni(f)
        ? { label: 'Winter Fuel Payment (nidirect)', url: 'https://www.nidirect.gov.uk/articles/winter-fuel-payment' }
        : { label: 'Winter Fuel Payment', url: 'https://www.gov.uk/winter-fuel-payment' }],
      phone: ni(f) ? undefined : 'Winter Fuel Payment Centre: 0800 731 0160',
    }));
    out.push(result('coldWeather', 'Cold Weather Payment', gc === 'already' ? 'automatic' : gc ? 'possible' : 'notApplicable', {
      summary: `${money(v(RATES.coldWeatherPayment.perColdSpell))} for each 7 days of very cold weather, paid automatically to people on Pension Credit.`,
      links: [{ label: 'Cold Weather Payment', url: 'https://www.gov.uk/cold-weather-payment' }],
    }));
  }

  if (!ni(f)) {
    out.push(result('warmHomeDiscount', 'Warm Home Discount', gc === 'already' ? 'automatic' : gc ? 'possible' : 'notApplicable', {
      summary: `${money(v(RATES.warmHomeDiscount.annual))} off your electricity bill each winter, usually automatic if you get Guarantee Credit.`,
      links: [{ label: 'Warm Home Discount', url: 'https://www.gov.uk/the-warm-home-discount-scheme' }],
    }));
  }
  return out;
}

// --------------------------------------------------- Other help for older people

function otherHelp(f) {
  const out = [];
  const gc = onOrLikelyGuaranteeCredit(f);

  if (f.oldestAge >= 75) {
    out.push(result('tvLicence', 'Free TV licence (75 and over)', gc === 'already' ? 'likely' : gc ? 'possible' : 'unlikely', {
      summary: 'Free for anyone aged 75 or over who gets Pension Credit (or lives with a partner who does).',
      nextSteps: gc ? ['Apply to TV Licensing with your Pension Credit details. You may get a refund if you paid recently.'] : [],
      links: [{ label: 'TV Licensing: aged 75 or over', url: 'https://www.tvlicensing.co.uk/check-if-you-need-one/aged-74-or-over-aud14' }],
    }));
  }

  const nhsSteps = [];
  if (f.nation === 'england' && f.age >= 60) nhsSteps.push('Free NHS prescriptions (you are 60 or over).');
  if (f.nation !== 'england') nhsSteps.push('NHS prescriptions are free for everyone where you live.');
  if (f.age >= 60) nhsSteps.push('Free NHS eye tests (you are 60 or over).');
  if (gc) nhsSteps.push('With Guarantee Credit: free NHS dental treatment, glasses vouchers and help with travel to hospital.');
  else if (f.savings < 16000) nhsSteps.push('You may get help with dental and other costs through the NHS Low Income Scheme (form HC1).');
  if (nhsSteps.length) {
    out.push(result('nhs', 'Help with NHS costs', f.age >= 60 ? 'automatic' : 'possible', {
      summary: 'Help with health costs you may not know about.',
      reasons: nhsSteps,
      links: [{ label: 'Help with health costs (NHS)', url: 'https://www.nhs.uk/nhs-services/help-with-health-costs/' }],
    }));
  }

  const busAge = f.nation === 'england' ? null : 60;
  const busOk = busAge ? f.age >= busAge : f.reachedSPA;
  if (busOk) {
    out.push(result('busPass', 'Free bus pass', 'likely', {
      summary: f.nation === 'england'
        ? 'Free off-peak bus travel in England from State Pension age. You have to apply.'
        : 'Free bus travel from age 60 where you live. You have to apply.',
      nextSteps: ['Apply through your local council (in NI, Translink SmartPass).'],
      links: [{ label: 'Older person’s bus pass', url: 'https://www.gov.uk/apply-for-elderly-person-bus-pass' }],
    }));
  }

  if (f.mobilityDifficulty) {
    out.push(result('blueBadge', 'Blue Badge (disabled parking)', 'possible', {
      summary: 'You may get a Blue Badge if you find walking very difficult. You can use it in any car you travel in.',
      links: [{ label: 'Apply for a Blue Badge', url: 'https://www.gov.uk/apply-blue-badge' }],
    }));
  }

  if (f.isCouple && f.reachedSPA !== f.partnerReachedSPA && !gets(f, 'universalCredit')) {
    out.push(result('universalCredit', 'Universal Credit (mixed-age couple)', 'possible', {
      summary: 'As one of you is under State Pension age, you would claim Universal Credit rather than Pension Credit.',
      links: [{ label: 'Universal Credit', url: 'https://www.gov.uk/universal-credit' }],
    }));
  }
  return out;
}

export const RULES = [statePension, pensionCredit, attendanceAllowance, carersAllowance, housingBenefit, councilTax, winterHelp, otherHelp];
