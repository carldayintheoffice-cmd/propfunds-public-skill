# Roadmap

## Before any public release (must do)

- [ ] **Verify every rate marked `verified: false`** in `rules/rates-2026-27.js`
      against the DWP "Benefit and pension rates 2026 to 2027" publication
      (Carer's Allowance rate and earnings limit, basic State Pension, Winter
      Fuel Payment amounts).
- [ ] **Welfare rights review** of every rule and every sentence of wording by a
      qualified adviser (e.g. partner with Age UK, Independent Age, a council
      welfare rights team or Citizens Advice).
- [ ] Run `npm run watch-govuk -- --accept` after that review to record the baseline.
- [ ] Accessibility audit to WCAG 2.2 AA, and testing with older users
      (including screen reader, magnifier and low-vision users).
- [ ] Privacy notice, terms, and a clear "not a government service" statement
      (done in the UI; needs legal review).
- [ ] Choose a final name and check trademarks; register the domain.

## "Do it for me" paid service

- [x] Draft sign-up page (preview only, sends nothing) and draft fee terms.
- [ ] Owner decisions: fee cap, what counts towards the fee (docs/FEE-TERMS-DRAFT.md).
- [ ] Solicitor review of terms and regulatory position; ICO registration; privacy notice; DPIA.
- [ ] Back end: secure storage of sign-ups (UK hosting, encrypted), staff call-back queue.
- [ ] Case tracker: signed up -> called -> claim sent -> decision -> fee due -> paid / waived.
- [ ] E-signature for the customer agreement.
- [ ] Payment link after award (card or Direct Debit, e.g. Stripe or GoCardless).
- [ ] Staff training on vulnerable customers, scams awareness, and honest claims.

## Phase 1 - pension age, done well

- [ ] Savings Credit exact calculation (needs 2026/27 threshold).
- [ ] Housing Benefit and Council Tax Reduction estimates (rent, council tax band, local scheme).
- [ ] Pension Credit housing costs: service charges, ground rent, mortgage interest.
- [ ] Care home residents: separate flow.
- [ ] Scotland and Northern Ireland watchers (mygov.scot, nidirect).
- [ ] Welsh language version.
- [ ] "Help someone else" mode for family members and carers.
- [ ] Downloadable / printable claim pack per benefit (what to have ready, what to write).
- [ ] Attendance Allowance form helper: prompts that help people describe their needs fully and truthfully.

## Phase 2 - native apps

- [ ] iOS and Android apps (React Native / Expo) reusing `rules/` unchanged.
- [ ] Larger-text and voice-read-aloud options; "read this to me".
- [ ] Reminders: re-check when circumstances change or rates change each April.

## Phase 3 - everyone, not just pensioners

- [ ] Working-age benefits: Universal Credit, PIP / Adult Disability Payment, Carer's Allowance, Child Benefit, etc.
- [ ] Adviser dashboard for charities (with consent and proper data protection).

## Open questions for the project owner

- What is "Jev"? If it is a tool, library or service you have used on other
  projects, share its link or repo and we will plug it in.
- Should this live in its own repository? It currently sits in
  `propfunds-public-skill`, which is about trading skills.
- Who will be the welfare rights partner who signs off the rules?
