# Prop-Firm Risk Models

Risk sizing is meaningless without knowing how the firm scores you. The two
dominant models demand opposite instincts. Getting this wrong is a fatal
category error.

## Hard-limit firms (FTMO-style evaluations)

Typical rules (confirm the exact numbers for the specific firm/plan):

- **Max-loss floor** — often 10% of the initial balance. A fixed equity floor.
- **Daily-loss floor** — often 5% of the day's *starting* balance, reset at the
  firm's daily boundary (frequently a fixed server time, e.g. ~22:00 UTC).
- Both are usually measured on **equity intraday**, not just closed balance — an
  open position's floating loss can breach the floor and auto-liquidate you even
  if it would have recovered.

Implications:

- **Survival dominates.** You fail these challenges by *dying on a limit*, not
  by failing to profit. Treat the daily floor as a wall, never a target.
- **Cap correlated exposure.** Several positions that are really the same bet
  can breach the floor together on one bad print.
- **Beware gap and event risk near the floor.** Weekend gaps, earnings, and
  scheduled news can jump straight through a stop. Keep buffer.
- **Watch the intraday equity path**, not just the end-of-day balance.
- Size so that a full cluster of simultaneous stops still leaves you comfortably
  inside both floors.

## VaR-normalized firms (Darwinex-style)

The platform runs a **risk manager that rescales every strategy to a target
VaR** (a target risk budget). Consequences:

- **Absolute lot size is abstracted away** at the investor-product level — the
  platform sizes your signals to its target risk regardless of your underlying
  volumes.
- The score rewards **risk stability and consistency**, **de-correlation** from
  the crowd/market, a **clean drawdown profile**, and sufficient track record —
  not raw return and not minimized dollar risk.
- Therefore: **keep per-trade risk consistent** across seats (identical % rather
  than ad-hoc sizing) because consistency itself is scored.
- **Correlation still matters, but differently.** Correlated seats do not
  threaten account death (there is no hard floor); instead they produce
  occasional same-day drawdowns that **damage the consistency/drawdown score
  components**. A cost to manage and watch in the data, not necessarily a
  disqualifier.

## The universal rule: correlation is the silent killer

In both models, running the "same bet" across several correlated instruments is
**not diversification** — it is one directional position at multiplied size that
all wins together and, more importantly, all **loses together**.

- On a hard-limit firm this can breach the floor and end the challenge.
- On a VaR firm it concentrates risk and dents the consistency score.

**Cap aggregate exposure to a theme rather than multiplying it.** If you run a
basket of correlated legs, either split the risk so the *total* equals a single
position's worth, or accept and consciously manage the concentrated bet — and
never treat the legs as independent for sizing.

## Practical sizing checklist

1. Identify the firm's model (hard-limit vs VaR-normalized) and its exact floors
   / boundaries.
2. Choose per-trade risk (a fixed % is usually right; on VaR firms, keep it
   identical across seats for consistency).
3. Map every open/candidate position to its **underlying theme**; sum
   correlated exposure and treat it as one bet.
4. Stress the worst case: all correlated stops hit at once — are you still
   inside every limit?
5. Prefer flattening before weekend/event gaps unless the gap risk is
   deliberately part of the tested edge.
