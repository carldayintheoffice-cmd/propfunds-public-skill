# ClaimRight (working name)

Helps people in the UK, starting with pensioners, find and claim every benefit
they are entitled to, and **nothing they are not**.

Answer simple questions in plain English. ClaimRight tells you what you may be
entitled to, roughly how much, why, and exactly how to claim (online link, free
phone number, what to have ready).

> Status: **foundation / prototype.** Not ready for the public. See
> [docs/ROADMAP.md](docs/ROADMAP.md).

## Principles

1. **Honest.** Only show help the rules say you can get. When we cannot be sure,
   say "you may qualify - check", never "you will get". A test enforces that a
   high income and high savings never give a "you should claim" result.
2. **Explainable.** Every result shows how it was worked out.
3. **Private.** The check runs entirely on the user's device. No accounts, no
   tracking, nothing sent to a server.
4. **Built for older people.** Large text, one question per screen, plain
   words, works with screen readers, zoom and poor signal, printable results
   to take to an adviser or a family member.
5. **Never pretends to be the government.** Every claim is made through the
   official route (GOV.UK, DWP, Social Security Scotland, nidirect, councils).
   We never ask for passwords, bank details or Government Gateway logins.
6. **Sourced and current.** Every rate carries its official source. A watcher
   checks GOV.UK every week and flags pages that have changed.

## What it checks today (2026/27 rates)

| Benefit / help | England | Wales | Scotland | NI |
| --- | :-: | :-: | :-: | :-: |
| State Pension (age, claiming, NI record) | ✓ | ✓ | ✓ | ✓ |
| Pension Credit (Guarantee + Savings Credit, extra amounts) | ✓ | ✓ | ✓ | ✓ |
| Attendance Allowance / Pension Age Disability Payment | ✓ | ✓ | ✓ | ✓ |
| Carer's Allowance / Carer Support Payment (incl. underlying entitlement) | ✓ | ✓ | ✓ | ✓ |
| Housing Benefit, Support for Mortgage Interest | ✓ | ✓ | ✓ | ✓ |
| Council Tax Reduction, single person discount / NI rates help, Lone Pensioner Allowance | ✓ | ✓ | ✓ | ✓ |
| Winter Fuel Payment / Pension Age Winter Heating Payment, Cold Weather Payment, Warm Home Discount | ✓ | ✓ | ✓ | ✓ |
| Free TV licence (75+ on Pension Credit), NHS costs, bus pass, Blue Badge | ✓ | ✓ | ✓ | ✓ |
| Universal Credit pointer for mixed-age couples | ✓ | ✓ | ✓ | ✓ |

It also spots the chains people miss, e.g. an Attendance Allowance award that
then unlocks Pension Credit, which then unlocks Housing Benefit, Council Tax
Reduction, Cold Weather Payments, Warm Home Discount and a free TV licence.

## How it is built

```
uk-benefits-helper/
├── rules/                 <- the brain: pure JavaScript, no dependencies
│   ├── rates-2026-27.js   <- every rate, with source URL and verified flag
│   ├── questions.js       <- the question flow (plain English, conditional)
│   ├── derive.js          <- ages, State Pension age, weekly amounts
│   ├── benefits.js        <- one conservative rule per benefit
│   ├── engine.js          <- assess(answers) -> report
│   └── pricing.js         <- "Do it for me" fee (draft)
├── web/                   <- website + installable phone app (PWA)
├── tools/
│   ├── govuk-watch.js     <- checks GOV.UK Content API for rule changes
│   ├── govuk-sources.json <- the GOV.UK pages we depend on
│   └── serve.js           <- local dev server
├── tests/                 <- node --test
└── docs/
    ├── ROADMAP.md
    └── FEE-TERMS-DRAFT.md <- paid service terms, for solicitor review
```

The same `rules/` code will power every front end: the website, the iPhone and
Android apps, and later an adviser / family-helper view. One set of rules means
one set of tests and one place to update when the government changes something.

## Run it

Needs Node.js 20 or newer. No install step.

```bash
cd uk-benefits-helper
npm test              # run the rules tests
npm start             # open http://localhost:8080
npm run watch-govuk   # check GOV.UK for changes to the pages we rely on
```

On a phone, open the site and choose "Add to Home Screen" to install it as an app.

## About "scanning the government websites"

We do not scrape GOV.UK HTML. GOV.UK publishes a free, official
[Content API](https://content-api.publishing.service.gov.uk/) that returns every
page as structured data. `tools/govuk-watch.js` uses it to detect when a page
our rules depend on changes, and a weekly GitHub Action fails (and emails the
owner) when that happens, so a person reviews the change and updates the rules.

Rules are written and reviewed by people, from official guidance and
legislation. They are not generated automatically from web pages: a mistake
there would tell vulnerable people the wrong thing.

There is no public API for *submitting* benefit claims, so ClaimRight guides
people to the official claim route rather than claiming on their behalf.

## "Do it for me" service (draft)

After the free check, people who could gain money can ask us to make the
claim for them. No win, no fee: the fee is one month of the new money awarded
(capped), charged once after the award letter arrives. The sign-up page always
tells people the same help is available free. It is a preview only for now and
sends nothing. See [docs/FEE-TERMS-DRAFT.md](docs/FEE-TERMS-DRAFT.md).
