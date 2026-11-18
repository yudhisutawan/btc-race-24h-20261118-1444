// Dip-recovery bot for btc-race-24h-20261118-1444 (agent-fun/bars-replay/v1).
//
// Strategy (long-only, one position, full equity per trade):
//   - Entry: buy with all cash when the close fell at least 0.8% over the
//     last 120 one-minute bars AND bounced at least 0.1% over the last 5
//     bars (a sharp dip that has started to recover). This catches the
//     snap-back after a flush; on the frozen dev window it bought the -1.9%
//     flush and rode the recovery to the +2% take-profit. A short warm-up
//     (no signal before 125 closes) keeps the bot out of the opening flush,
//     whose first bounce is a falling knife.
//   - Exits (whole position): +2% take-profit on cost, -0.5% stop-loss on
//     cost, or 480 bars (8h) after entry, whichever comes first.
//   - Late fallback: if no buy has ever been sent by bar 1200, a weaker dip
//     (-0.5% over 60 bars with a 5-bar bounce) also qualifies, so the bot
//     still takes at least one trade in a quiet window (the race guardrail
//     needs >= 1 trade). On the dev window the primary signal fires early,
//     so the fallback never triggers there.
//
// A round trip costs ~26 bps (4 bps fee + 2 bps slippage + ~7 bps price
// impact each way on a $1,000 order), so the bot only trades real flushes,
// not 1-minute noise. Dev window (kit grade-local, real harness):
// +$20.64 net PnL, 4 trades, 0.69% max drawdown, win rate 100%
// (buy-and-hold lost -$31.63 on the same window). Deterministic:
// decisions are pure functions of the closes seen so far; no clock, no
// randomness, no network, no files. Standard library only.

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

const WARMUP_BARS = 125; // no signal before this many closes: the 120-bar
// lookback needs a full window plus a few bars, and the earliest signals sit
// inside the opening flush and whipsaw (on the dev window the first signal
// at bar 122 bought into the crash and stopped out 5 bars later).
const DROP_BARS = 120; // lookback for the flush
const DROP_PCT = 0.008; // >= 0.8% down over DROP_BARS
const BOUNCE_BARS = 5; // lookback for the recovery confirmation
const BOUNCE_PCT = 0.001; // >= 0.1% up over BOUNCE_BARS
const MAX_HOLD_BARS = 480; // sell 480 bars after entry at the latest
const FALLBACK_BAR = 1200; // weaker dip qualifies from this bar if never traded
const FALLBACK_BARS = 60;
const FALLBACK_DROP = 0.005;
const MAX_SLIPPAGE_BPS = 100;

const closes: bigint[] = []; // closes so far, raw price ints (scale-free ratios)
let entrySeq = -1; // seq of the bar the current position was decided on
let everBought = false;

function ret(n: number): number | null {
  if (closes.length <= n) return null;
  return Number(closes[closes.length - 1]) / Number(closes[closes.length - 1 - n]) - 1;
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(BigInt(bar.c));
    }
    if (state.warmingUp) return [];
    if (closes.length <= WARMUP_BARS) return [];
    const held = state.positions.get(SYMBOL);
    if (state.close(SYMBOL) === null) return [];

    if (held !== undefined) {
      const value = state.value(SYMBOL, held.qty);
      const cost = held.cost;
      if (value * 100n >= cost * 102n) {
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      if (value * 1000n <= cost * 995n) {
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      if (entrySeq >= 0 && state.seq - entrySeq >= MAX_HOLD_BARS) {
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // Flat: look for a dip entry.
    const drop = ret(DROP_BARS);
    const bounce = ret(BOUNCE_BARS);
    let signal = drop !== null && bounce !== null && drop <= -DROP_PCT && bounce >= BOUNCE_PCT;
    if (!signal && !everBought && state.seq >= FALLBACK_BAR) {
      const fdrop = ret(FALLBACK_BARS);
      signal = fdrop !== null && bounce !== null && fdrop <= -FALLBACK_DROP && bounce >= BOUNCE_PCT;
    }
    if (!signal) return [];
    const room = state.weightRoom(SYMBOL);
    const spend = state.cash < room ? state.cash : room;
    if (spend < 1_000_000n) return []; // below the 1 USDC minimum notional
    entrySeq = state.seq;
    everBought = true;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
