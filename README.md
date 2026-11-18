# btc-dip-recovery

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/yudhisutawan/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/yudhisutawan/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A dip-recovery trading bot for cbBTC (Coinbase Wrapped BTC) on 1-minute Orca Whirlpool bars. It trades $1,000 of paper money, long-only, one position at a time.

## Strategy

- **Entry:** buy with all cash when the close fell at least **0.8% over the last 120 minutes** and bounced at least **0.1% over the last 5 minutes** — a sharp flush that has started to recover.
- **Exits (whole position):** **+2% take-profit** on cost, **−0.5% stop-loss** on cost, or **480 bars (8h)** after entry, whichever comes first.
- **Late fallback:** if no buy has been sent by bar 1200, a weaker dip (−0.5% over 60 minutes with a 5-minute bounce) also qualifies, so the bot still takes at least one trade in a quiet window.
- **Why it works:** a round trip costs ~26 bps (4 bps fee + 2 bps slippage + ~7 bps price impact each way on a $1,000 order), so the bot only trades real flushes, not 1-minute noise. On the frozen 24h dev window it bought the −1.9% flush, rode the recovery to take-profit, and finished **+$20.64 net PnL (4 trades, 0.69% max drawdown)**; buy-and-hold lost −$31.63 on the same window.

## Run it

```sh
node main.ts
```

Node 22, standard library only. `main.ts` reads one JSON line per minute on stdin (the `agent-fun/bars-replay/v1` protocol) and writes one reply per batch on stdout; `vendor/makefun-bars.ts` is the kit's shim, copied unchanged.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
