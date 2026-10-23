// The question flow. One plain-English question per screen.
//
// Each question:  id, type, text, hint?, options?, showIf?(answers)
// Types: 'choice' (one answer), 'multi' (tick all that apply), 'date',
//        'money' ({ amount, period }), 'number'.
//
// Wording rules: short sentences, no jargon, always say why we ask.

const yesNo = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const yesNoNotSure = [...yesNo, { value: 'notSure', label: 'Not sure' }];

const isCouple = (a) => a.couple === 'couple';

export const BENEFIT_OPTIONS = [
  { value: 'statePension', label: 'State Pension' },
  { value: 'pensionCredit', label: 'Pension Credit' },
  { value: 'attendanceAllowance', label: 'Attendance Allowance' },
  { value: 'padp', label: 'Pension Age Disability Payment (Scotland)' },
  { value: 'pip', label: 'Personal Independence Payment (PIP)' },
  { value: 'dla', label: 'Disability Living Allowance (DLA)' },
  { value: 'carersAllowance', label: "Carer's Allowance or Carer Support Payment" },
  { value: 'housingBenefit', label: 'Housing Benefit' },
  { value: 'councilTaxReduction', label: 'Council Tax Reduction (or Support)' },
  { value: 'universalCredit', label: 'Universal Credit' },
];

export const QUESTIONS = [
  {
    id: 'nation',
    type: 'choice',
    text: 'Where in the UK do you live?',
    hint: 'Some benefits have different names and rules in Scotland and Northern Ireland.',
    options: [
      { value: 'england', label: 'England' },
      { value: 'wales', label: 'Wales' },
      { value: 'scotland', label: 'Scotland' },
      { value: 'northernIreland', label: 'Northern Ireland' },
    ],
  },
  {
    id: 'dob',
    type: 'date',
    text: 'What is your date of birth?',
    hint: 'We use this to work out your State Pension age. It stays on this device.',
  },
  {
    id: 'couple',
    type: 'choice',
    text: 'Do you live with a husband, wife or partner?',
    hint: 'Benefits for couples are worked out on your joint income and savings.',
    options: [
      { value: 'single', label: 'No, I live on my own or with family or friends' },
      { value: 'couple', label: 'Yes, I live with my partner' },
    ],
  },
  {
    id: 'partnerDob',
    type: 'date',
    text: "What is your partner's date of birth?",
    hint: 'If one of you is under State Pension age, different rules apply.',
    showIf: isCouple,
  },
  {
    id: 'reachedSPABefore2016',
    type: 'choice',
    text: 'Did you, or your partner, reach State Pension age before 6 April 2016?',
    hint: 'This decides whether you could get the "Savings Credit" part of Pension Credit.',
    options: yesNoNotSure,
    showIf: (a) => {
      // Only ask when the answer is genuinely uncertain from dates of birth
      // (born 6 April 1951 - 5 April 1953: depends on sex under the old rules).
      const inWindow = (d) => d && d >= '1951-04-06' && d < '1953-04-06';
      const before = (d) => d && d < '1951-04-06';
      if (before(a.dob) || (isCouple(a) && before(a.partnerDob))) return false;
      return inWindow(a.dob) || (isCouple(a) && inWindow(a.partnerDob));
    },
  },
  {
    id: 'currentBenefits',
    type: 'multi',
    text: 'Which of these do you get already?',
    hint: 'Tick all that apply. If you are not sure, leave it unticked.',
    options: BENEFIT_OPTIONS,
  },
  {
    id: 'partnerBenefits',
    type: 'multi',
    text: 'Which of these does your partner get already?',
    hint: 'Tick all that apply.',
    options: BENEFIT_OPTIONS,
    showIf: isCouple,
  },
  {
    id: 'statePensionIncome',
    type: 'money',
    text: (a) => (isCouple(a) ? 'How much State Pension do you both get, added together?' : 'How much State Pension do you get?'),
    hint: 'Put 0 if you do not get it yet. Your bank statement or yearly DWP letter shows this.',
  },
  {
    id: 'otherPensionIncome',
    type: 'money',
    text: 'How much do you get from other pensions?',
    hint: 'Workplace or private pensions, before tax. Put 0 if none.',
  },
  {
    id: 'earnings',
    type: 'money',
    text: 'How much do you earn from work?',
    hint: 'After tax and National Insurance. Put 0 if you do not work.',
  },
  {
    id: 'otherIncome',
    type: 'money',
    text: 'Do you have any other regular income?',
    hint: 'For example rent from a lodger or an annuity. Do not include savings interest or disability benefits. Put 0 if none.',
  },
  {
    id: 'savings',
    type: 'number',
    text: 'Roughly how much do you have in savings and investments?',
    hint: 'Include bank and building society accounts, ISAs, shares and Premium Bonds. Do NOT include the home you live in.',
    prefix: '£',
  },
  {
    id: 'housing',
    type: 'choice',
    text: 'Which best describes your home?',
    options: [
      { value: 'ownOutright', label: 'I own it outright' },
      { value: 'mortgage', label: 'I own it with a mortgage' },
      { value: 'rent', label: 'I rent it (council, housing association or private)' },
      { value: 'family', label: 'I live with family or friends and do not pay rent' },
      { value: 'careHome', label: 'I live in a care home' },
    ],
  },
  {
    id: 'livesAlone',
    type: 'choice',
    text: 'Are you the only adult (aged 18 or over) living in your home?',
    hint: 'This can mean money off your Council Tax and a higher Pension Credit award.',
    options: yesNo,
    showIf: (a) => !isCouple(a),
  },
  {
    id: 'paysCouncilTax',
    type: 'choice',
    text: 'Are you responsible for paying Council Tax (or rates in Northern Ireland)?',
    options: yesNoNotSure,
    showIf: (a) => a.housing !== 'careHome' && a.housing !== 'family',
  },
  {
    id: 'needsCare',
    type: 'choice',
    text: 'Because of an illness, disability or getting older, do you need help or supervision with everyday things?',
    hint: 'For example washing, dressing, eating, taking medicines, going to the toilet, or someone keeping an eye on you to stay safe. It counts even if nobody is helping you yet.',
    options: yesNo,
  },
  {
    id: 'careTime',
    type: 'choice',
    text: 'When do you need this help?',
    options: [
      { value: 'day', label: 'During the day' },
      { value: 'night', label: 'During the night' },
      { value: 'both', label: 'Both day and night' },
    ],
    showIf: (a) => a.needsCare === 'yes',
  },
  {
    id: 'careSixMonths',
    type: 'choice',
    text: 'Have you needed this help for 6 months or more?',
    options: yesNo,
    showIf: (a) => a.needsCare === 'yes',
  },
  {
    id: 'terminalIllness',
    type: 'choice',
    text: 'Has a doctor or nurse said you may have 12 months or less to live?',
    hint: 'If so, claims are fast-tracked and paid at the highest rate. You can skip this question.',
    options: [...yesNo, { value: 'skip', label: 'I would rather not say' }],
    showIf: (a) => a.needsCare === 'yes',
  },
  {
    id: 'someoneGetsCarersForYou',
    type: 'choice',
    text: "Does anyone get Carer's Allowance for looking after you?",
    hint: 'This affects an extra amount of Pension Credit.',
    options: yesNoNotSure,
    showIf: (a) => a.needsCare === 'yes' || (a.currentBenefits || []).some((b) => ['attendanceAllowance', 'pip', 'dla', 'padp'].includes(b)),
  },
  {
    id: 'mobilityDifficulty',
    type: 'choice',
    text: 'Do you find walking very difficult, or have a condition that makes travel hard?',
    hint: 'This helps us check if you could get a Blue Badge for parking.',
    options: yesNo,
  },
  {
    id: 'isCarer',
    type: 'choice',
    text: 'Do you look after someone for 35 hours a week or more?',
    hint: 'They must get a disability benefit such as Attendance Allowance, PIP (daily living) or DLA (middle or highest care).',
    options: yesNo,
  },
  {
    id: 'carerEarnings',
    type: 'money',
    text: 'How much do you earn from work, after tax?',
    hint: "Carer's Allowance has an earnings limit. Put 0 if you do not work.",
    showIf: (a) => a.isCarer === 'yes',
  },
  {
    id: 'taxableIncomeOver35k',
    type: 'choice',
    text: 'Is your taxable income more than £35,000 a year?',
    hint: 'Above this, the Winter Fuel Payment is taken back through your tax. Most pensioners say No.',
    options: yesNoNotSure,
  },
];

export const questionText = (q, answers) => (typeof q.text === 'function' ? q.text(answers) : q.text);

/** The questions that apply given the answers so far, in order. */
export function visibleQuestions(answers) {
  return QUESTIONS.filter((q) => !q.showIf || q.showIf(answers));
}
