---
name: prop-fund-methodology
description: >-
  Rigorous, survival-first methodology for validating, building, and deploying
  algorithmic trading strategies for proprietary-firm challenges (FTMO,
  Darwinex, The5ers, FundingRock, MyForexFunds-style evaluations). Use this
  whenever the user is working on prop-firm trading: evaluating a strategy or
  "edge", backtesting, running robustness/out-of-sample checks, building or
  deploying an MQL5/MT5 Expert Advisor, mapping broker server time, sizing risk
  against prop drawdown limits, setting up trade monitors/watchdogs, or
  reasoning about FTMO vs Darwinex risk rules — even if they never say the word
  "skill" and even if they only mention one piece (a backtest result, a Pine or
  MQL5 snippet, a "should I go live" question). Bias toward invoking it: prop
  accounts die from undisciplined process, and this skill is the process.
---

# Prop-Fund Trading

A discipline for turning trading ideas into prop-firm-ready systems **without
blowing the account or fooling yourself**. Prop challenges are not won by
finding profit — they are lost by dying on a drawdown limit or by trusting an
edge that was never real. Everything below serves those two failure modes.

## Prime directive: survival first, honesty always

Before any recommendation, ask: *does this help pass the challenge while keeping
the account alive?* A strategy that makes money but occasionally breaches the
daily or max-loss limit is a losing strategy for a prop challenge.

Pair that with an unbroken evidence standard:

- **Source-of-truth before assertion.** Read the actual code, logs, backtest
  numbers, or live account state before stating how something behaves. Memory
  and intuition go stale; the file does not.
- **Honest, no-hype assessments.** Real numbers, real ranges, real risks up
  front. If a result looks too good, say so and go find out why. Eye-popping
  backtests are usually overfit until proven otherwise.
- **Reproducible over anecdotal.** Prefer a script or a re-runnable backtest to
  a claim.

## The leash: who pulls the trigger

Building and verifying is one job; going live is another. Keep them separate.

- Claude **builds, backtests, compiles, deploys files, and monitors**. Claude
  may also **disable or pull a trade protectively** (safety always allowed).
- A **human runs the final go-live keystroke** — attaching an EA to a live
  chart, flipping the master switch, sending the first real order. Nothing
  reaches real money without explicit human sign-off.
- **Propose before any risky change.** New strategy, new risk parameter, new
  live order → describe it and get agreement first.
- Back up any live file before editing it.

This is not bureaucracy — it is the circuit breaker that stops an automated loop
from cascading a mistake into a blown account.

## The core loop

```
edge idea → validate (robustness battery) → risk-fit → deploy to a PROVING
account → forward-demo with monitoring → human review → (only then) live
```

Never skip from "backtest looks good" to "live." The proving-account
forward-demo is where a backtested edge meets real fills, real spreads, and real
weekend gaps. That is the step that catches what backtests cannot.

## 1. Validate the edge — the robustness battery

A single great backtest means almost nothing; it is one draw from a noisy
process and often the survivor of an unstated parameter search. Trust grows only
as an edge survives *independent* stress tests. Read
`references/robustness-battery.md` for the full battery, but the essentials:

1. **Out-of-sample split.** Cut the history in half (or thirds). Does the edge
   hold in the recent, unseen half — or was it front-loaded in one regime?
2. **Cost stress.** Re-run with harsher commission and slippage than the venue
   quotes. Edges built on tiny stops die here.
3. **Adjacent-parameter / placebo test.** Nudge the key parameter (entry hour,
   threshold, lookback) and an obvious control (a different day, a neighbouring
   level). A real edge degrades *smoothly* around its peak; a lone spiking cell
   with dead neighbours is overfit noise.
4. **Instrument generalization.** Run the same rule on related instruments. An
   edge that generalizes across a family (e.g. a session effect across several
   correlated pairs) is far more likely structural than one that lives on a
   single symbol.
5. **Filter / regime checks.** Test the filters you *think* help — sometimes a
   "sensible" trend filter destroys the edge, which itself is information.

Report the whole battery as a scoreboard, and update your prior out loud as
evidence comes in. An edge that clears five independent checks has earned
attention; one that fails the OOS split has not, no matter how pretty the
headline.

Even a validated edge carries an **honest expectation of regression**: a
cherry-picked best case will underperform its backtest live. Bank the
neighbourhood-average behaviour, not the peak.

## 2. Fit the risk to the prop firm — they are not the same

Sizing and risk rules depend entirely on the firm's scoring model. Getting this
wrong is a common, fatal category error. See
`references/prop-firm-risk.md` for details; the headline distinction:

- **Hard-limit firms (FTMO-style).** A fixed **max-loss floor** (often 10% of
  initial) and a **daily-loss floor** (often 5% of the day's start balance)
  that, if touched *intraday on equity*, auto-liquidate you. Here **survival is
  everything**: cap correlated exposure, avoid overnight/weekend gap risk near
  the floor, and treat the daily limit as a hard wall, not a target. Absolute
  drawdown is the enemy.
- **VaR-normalized firms (Darwinex-style).** The platform **renormalizes each
  strategy to a target VaR**, so absolute lot size is abstracted away and the
  score rewards **risk *stability* and consistency**, de-correlation, and a
  clean drawdown profile. Here, **consistent per-trade risk** matters more than
  minimizing dollars, and correlation shows up as damaged consistency scores
  rather than account death.

**Correlation is the silent killer in both.** Running the "same bet" across
several correlated instruments is not diversification — it is one position at
multiplied size that all loses together on a bad day. Cap *aggregate* exposure
to a theme; do not multiply it.

## 3. Map the broker clock before any time-based logic

Time-based strategies fail silently when "the clock" is ambiguous. There are
three different clocks and they must be reconciled:

- **Data/UTC clock** — where the edge is *defined* (backtest data is usually
  UTC or exchange-local).
- **Broker server clock** — what an EA's `TimeCurrent()` reads. MT5 forex
  servers commonly run **EET/EEST (UTC+2 winter, UTC+3 summer)**. Verify by
  reading a live tick timestamp vs true UTC; do not assume.
- **Host OS clock** — the machine the bot runs on. Confirm it is accurate and
  actively NTP-synced (a physical box with the time service stopped will drift).

**Rule:** gate entries on **true UTC** (`TimeGMT()` in MQL5), never on the raw
broker server hour. Broker DST and the underlying market's DST flip on different
dates, so a server-hour gate misfires for a week or two each autumn. `TimeGMT()`
sidesteps it — but only if the host OS clock is correct, so verify that too.

## 4. Build, compile, and deploy the EA

When translating a validated edge into an MQL5 Expert Advisor:

- Gate on `TimeGMT()` for any session logic (see above).
- **Risk-based lot sizing** from the stop distance, not fixed lots — compute
  from `SYMBOL_TRADE_TICK_VALUE`/`SYMBOL_TRADE_TICK_SIZE`, normalize to
  `SYMBOL_VOLUME_STEP`, clamp to min/max.
- Include survival guards: a **spread filter** (skip thin/wide conditions), a
  **weekend force-flat** for anything that must not carry the weekend gap, a
  **master enable switch** input as a kill-switch, and a **one-position/one-
  entry-per-window** guard so it cannot stack.
- **Compile headless** with `metaeditor64.exe /compile:"<file.mq5>" /log:"<log>"`
  and read the log — require **0 errors, 0 warnings** before deploying.
- **Deploy without disruption.** Drop the compiled `.ex5` into the terminal's
  `MQL5/Experts` folder; a running terminal picks it up. **Never restart a
  terminal that hosts other live EAs**, and never close a trading terminal — you
  will disturb everything else running there.
- The human attaches it to the chart (the go-live keystroke). Then verify from
  the **Experts log** that it initialised with the exact expected parameters.

See `references/ea-deployment.md` for the checklist and a lot-sizing snippet.

## 5. Monitor with a read-only watchdog

A deployed forward-demo you cannot see is a liability. Stand up a lightweight,
**read-only** monitor that polls the terminal's journal/log for the EA's fills
and pushes a notification (text and/or voice) on every **entry, close, and
protective/force-flat event**. Principles:

- **Read-only, always.** A monitor observes; it never places, modifies, or
  cancels. That invariant is what makes it safe to run unattended.
- **Dedupe by deal/order id** and persist a small state file so you alert once
  per event, not every poll.
- **Calibrate the alarm to the stakes** — a $5 test account does not warrant
  sirens; a challenge account near a limit does.
- Keep secrets (bot tokens, chat ids, credentials) in a local config/secret
  file referenced by the script, **never** hard-coded into anything that might
  be shared or committed.

## Environment gotchas (verify, do not assume)

- **Terminal ↔ account mapping** is easy to get backwards when several MT5
  installs coexist; pin the terminal path explicitly and keep an account-login
  guard so an EA/script never acts on the wrong account.
- **Algo Trading must be enabled** (globally and per-EA) for orders to send; a
  dry run can pass without it and mask the problem.
- Verify the **host clock is synced** before trusting `TimeGMT()`.
- Read the **actual logs/state** before asserting how the live system behaves.

## The mindset

Be the skeptical, rigorous partner who wants the edge to be real but assumes it
is not until it survives scrutiny — and who treats a live account as something
to protect first and profit from second. The goal is durable, review-gated
systems, not the next exciting backtest.
