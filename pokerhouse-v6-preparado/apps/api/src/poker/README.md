# Texas Hold'em server engine

The engine is an in-memory, server-authoritative first implementation:
- 2–9 seated players; server-side cryptographic shuffle and private hole cards.
- Dealer, small blind, big blind, preflop/flop/turn/river.
- Fold/check/call/bet/raise/all-in, turn ownership, minimum raise tracking.
- 5-card best-hand evaluation from 5–7 cards, including wheel straight.
- Showdown and side-pot splitting across total hand contributions, with deterministic odd-chip distribution by seat order.
- Public state hides deck and opponents' hole cards until showdown.
- Socket.IO events: `table:join`, `table:action`, `table:request-state`; outputs `table:state`, `table:turn`, `table:hand-complete`, `table:error`.

Known MVP limitations:
- Live table state is memory-only; server restart loses hands and seats.
- Stack reservation/debit/refund is not yet atomically reconciled with persisted wallets.
- No disconnect/reconnect grace period, timeout auto-action, spectators, rake, tournament blind schedule, or full table lifecycle.
- The first version of table joining currently treats table buy-in as a seat stack; do not expose as production.
- Unit and integration tests plus independent rules review are still required.
