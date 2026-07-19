# The Robustness Battery

A validated edge is one that has survived several *independent* attempts to
falsify it. Any single backtest — however spectacular — is one draw from a noisy
process and is frequently the best cell of an unstated parameter search. Run the
battery below and report it as a scoreboard. Update your prior out loud as each
result lands.

Guiding attitude: **try to kill the edge.** If it survives honest attempts to
kill it, what remains is worth attention.

## 1. Out-of-sample (OOS) time split

Split the history into halves or thirds. Does the edge hold in the **recent,
unseen** segment, or only in an early one?

- Holds in both → not front-loaded; a point in its favour.
- Strong early, dead recently → likely a regime artifact that has decayed.
- Watch the data-coverage caveat: many data stores start later than requested.
  Confirm how many bars actually evaluated before trusting a window.

## 2. Cost stress

Re-run with commission and slippage **harsher** than the venue quotes (e.g.
double the spread, several ticks of slippage). Edges that depend on very tight
stops or scalp-thin targets evaporate under realistic costs. If profit factor
survives a deliberately punitive cost model, the edge has real margin.

## 3. Adjacent-parameter / placebo test

The single most revealing test for time-of-day, threshold, or lookback edges.

- Nudge the **key parameter** to neighbouring values (hour 19 → also try 17-18
  and 21-22; a level → nearby levels).
- Add a **control** the edge should *not* care about (a different weekday, an
  unrelated symbol).

Interpretation:
- **Smooth degradation around a peak** = a real effect with structure. Good.
- **A lone spiking cell surrounded by flat/negative neighbours** = overfit to
  noise, no matter how clean the OOS looked.
- A neighbour failing for a **structural** reason (e.g. a session close /
  rollover window) is informative, not disqualifying — explain it.

## 4. Instrument generalization

Run the identical rule on related instruments (a currency's crosses, a sector's
names, correlated indices).

- Generalizes across a family → probably a **structural / behavioural** effect
  (a session pattern, a flow, a microstructure quirk). Much stronger evidence.
- Works on exactly one symbol → treat as fragile; it may be a single-series
  coincidence.

**Caution:** generalization across correlated instruments is evidence *for the
edge* but also a **correlation warning** — those instruments are one bet, and
you must not later size them as if they were independent.

## 5. Filter / regime checks

Test the filters you believe should help — a trend filter, a volatility gate, a
regime switch.

- If a "sensible" filter **improves** risk-adjusted results, keep it and
  understand why.
- If it **hurts** (cuts trade count, lowers profit factor, raises drawdown),
  that is real information: the edge may be regime-agnostic, or the filter may
  be removing good trades. Do not add filters on faith.

A frequent finding: the obvious defensive filter makes things worse, which means
the true defence has to come from **sizing and hard caps**, not from a filter.

## Reading the scoreboard

- **Clears OOS + cost + adjacency + generalization** → a genuine candidate.
  Proceed to risk-fit and a monitored forward-demo.
- **Fails the OOS split** → stop; it is probably noise, whatever the headline.
- Always state the **honest live expectation**: a cherry-picked peak regresses
  toward its neighbourhood average in live trading. Size and plan around the
  average case, not the backtested best case.

## What the battery cannot tell you

Backtests do not model weekend gaps well on intrabar data, may understate
thin-liquidity slippage, and cannot prove behaviour in a regime absent from the
sample. When the sample lacks a regime (e.g. no sustained counter-trend era),
say so explicitly and treat that scenario as **untested**, not safe. The only
cure is a monitored forward-demo on a proving account.
