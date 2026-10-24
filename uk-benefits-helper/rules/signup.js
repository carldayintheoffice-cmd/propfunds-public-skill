// "Do it for me" sign-up: field checks and the record we send to the team.
// Shared by the web page (to show errors) and the server (never trust the
// browser), so both always agree.

export const CALL_TIMES = { morning: 'Morning (9am to 12pm)', afternoon: 'Afternoon (12pm to 5pm)', evening: 'Early evening (5pm to 7pm)' };

const text = (v) => (typeof v === 'string' ? v.trim() : '');

const CHECKS = {
  forWhom: (v) => (['me', 'someoneElse'].includes(v) ? '' : 'Choose who the claim is for'),
  claimantName: (v) => (text(v).length > 1 && text(v).length <= 100 ? '' : 'Enter the full name of the person claiming'),
  helperName: (v, d) => (d.forWhom !== 'someoneElse' || (text(v).length > 1 && text(v).length <= 100) ? '' : 'Enter your name'),
  helperRelationship: (v, d) => (d.forWhom !== 'someoneElse' || (text(v) && text(v).length <= 60) ? '' : 'Tell us how you know them'),
  phone: (v) => (/^\+?[\d\s()-]{10,16}$/.test(text(v)) && text(v).replace(/\D/g, '').length >= 10 ? '' : 'Enter a phone number, for example 07700 900123'),
  email: (v) => (!text(v) || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(v)) && text(v).length <= 200) ? '' : 'Enter an email address like name@example.com, or leave it empty'),
  postcode: (v) => (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(text(v)) ? '' : 'Enter a postcode, for example SW1A 1AA'),
  callTime: (v) => (v in CALL_TIMES ? '' : 'Choose the best time to call'),
  freeHelpUnderstood: (v) => (v === true ? '' : 'Tick to show you understand free help is available'),
  termsAgreed: (v) => (v === true ? '' : 'Tick to agree to the fee terms'),
  contactAgreed: (v) => (v === true ? '' : 'Tick to let us contact you about the claim'),
};

/** Returns { fieldId: message } for every problem; empty object when valid. */
export function validateSignup(d) {
  const errors = {};
  for (const [id, check] of Object.entries(CHECKS)) {
    const msg = check(d[id], d);
    if (msg) errors[id] = msg;
  }
  return errors;
}

/**
 * The record sent to the team: contact details, consents, and a SUMMARY of
 * the check (benefit names, status and estimates). The raw answers - health,
 * income and savings - stay on the person's device.
 */
export function buildSignupRecord(d, report, quote) {
  const someoneElse = d.forWhom === 'someoneElse';
  return {
    contact: {
      forWhom: d.forWhom,
      claimantName: text(d.claimantName),
      helperName: someoneElse ? text(d.helperName) : '',
      helperRelationship: someoneElse ? text(d.helperRelationship) : '',
      phone: text(d.phone),
      email: text(d.email),
      postcode: text(d.postcode).toUpperCase(),
      callTime: d.callTime,
    },
    consents: {
      freeHelpUnderstood: d.freeHelpUnderstood === true,
      termsAgreed: d.termsAgreed === true,
      contactAgreed: d.contactAgreed === true,
    },
    check: report
      ? {
        taxYear: report.taxYear,
        toClaim: report.results
          .filter((r) => r.status === 'likely' || r.status === 'possible')
          .map((r) => ({ id: r.id, name: r.name, status: r.status, weekly: r.weekly ?? null })),
        estimateMonthly: quote?.monthly ?? 0,
        quotedFee: quote?.fee ?? null,
      }
      : null,
  };
}

/** Clean an incoming record (server side): keep only known fields. */
export function sanitizeRecord(body) {
  const c = body?.contact ?? {};
  const flat = { ...c, ...(body?.consents ?? {}) };
  const errors = validateSignup(flat);
  if (Object.keys(errors).length) return { errors };
  const record = buildSignupRecord(flat, null, null);
  const chk = body?.check;
  if (chk && Array.isArray(chk.toClaim)) {
    record.check = {
      taxYear: text(chk.taxYear).slice(0, 10),
      toClaim: chk.toClaim.slice(0, 30).map((r) => ({
        id: text(r?.id).slice(0, 40),
        name: text(r?.name).slice(0, 100),
        status: ['likely', 'possible'].includes(r?.status) ? r.status : 'possible',
        weekly: Number.isFinite(r?.weekly) ? Math.max(0, Math.min(r.weekly, 2000)) : null,
      })),
      estimateMonthly: Number.isFinite(chk.estimateMonthly) ? Math.max(0, Math.min(chk.estimateMonthly, 20000)) : 0,
      quotedFee: Number.isFinite(chk.quotedFee) ? chk.quotedFee : null,
    };
  }
  return { record };
}
