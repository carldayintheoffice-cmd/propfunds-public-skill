# MQL5 EA Build, Compile & Deploy

Translating a validated edge into an MT5 Expert Advisor, safely, on a machine
that may already host other live EAs.

## Design checklist

- **Session gating on true UTC.** Use `TimeGMT()`, not the raw broker server
  hour, for any time-of-day logic (see the clock section in SKILL.md).
- **Risk-based lot sizing** from the stop distance — never fixed lots if the
  account size or price can vary.
- **Survival guards:**
  - *Spread filter* — skip entries when the spread is abnormally wide (thin
    liquidity, news, session edges).
  - *Weekend force-flat* — close anything that must not carry the weekend gap
    before the market's weekly close.
  - *Master enable switch* — a boolean input that gates all order-sending, so a
    human has a one-click kill without removing the EA.
  - *One-position / one-entry-per-window* — prevent stacking or rapid re-entry.
- **Distinct magic number** per strategy/seat so positions are attributable and
  the EA only ever touches its own trades (filter by symbol **and** magic).
- **Logging** — print the resolved config on `OnInit` (symbol, risk, window,
  switches, magic) so the Experts log proves what actually loaded.

## Risk-based lot sizing (sketch)

```mql5
double CalcLots(double slPriceDistance, double riskPct)
{
   double bal      = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskMoney = bal * riskPct / 100.0;
   double tickVal  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize <= 0 || tickVal <= 0 || slPriceDistance <= 0) return 0;

   double lossPerLot = (slPriceDistance / tickSize) * tickVal;
   double lots       = riskMoney / lossPerLot;

   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minV = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxV = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   if(step > 0) lots = MathFloor(lots / step) * step;
   if(lots < minV) lots = minV;   // note: min lot may exceed target risk — log it
   if(lots > maxV) lots = maxV;
   return lots;
}
```

If the broker's minimum lot forces risk above target, **log a warning** — the
account is then taking more than the intended risk and the operator must know.

## Compile headless and require a clean log

```
metaeditor64.exe /compile:"<full\path\to\EA.mq5>" /log:"<full\path\to\log>"
```

- The compiler writes the `.ex5` next to the source and a UTF-16 log.
- **Require `0 errors, 0 warnings`.** Read the log; do not trust the exit code
  alone (MetaEditor's exit code is not a reliable pass/fail signal).

## Deploy without disrupting the terminal

- Place the compiled `.ex5` in the terminal's `MQL5/Experts` folder. A running
  terminal detects new experts and lists them in Navigator (a refresh may be
  needed).
- **Never restart a terminal that hosts other live EAs**, and **never close a
  trading terminal** — trading sessions and other bots are session-dependent and
  will be disrupted.
- Attaching the EA to a chart is a GUI action and is the **human's go-live
  keystroke**. It cannot (and should not) be automated by restarting the
  terminal.

## Verify after attach

Read the **Experts log** and confirm the EA initialised with the exact expected
parameters — symbol, risk %, session window, guard switches, magic, and that
trading is enabled. If the printed config does not match intent, stop and fix
before the next session boundary.

## Gotchas

- **Terminal ↔ account mapping** is easy to reverse when multiple installs
  coexist; pin the terminal path and keep an account-login guard.
- **Algo Trading must be ON** (global toggle + per-EA "Allow Algo Trading") for
  `OrderSend` to work; dry runs can pass without it.
- Confirm the **host OS clock is accurate and NTP-synced** before trusting
  `TimeGMT()` — a physical box with the time service stopped will drift.
