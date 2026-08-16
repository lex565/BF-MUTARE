# 09 — Rider earnings

Earnings are an append-only ledger in integer minor currency units. A delivery
earning is optional and is configured when staff creates the delivery; there
is no hard-coded fare formula.

The earning is credited only after verified delivery completion (or a written,
authorized proof exception). The delivery ID and a unique idempotency key stop
double credits. The model supports future bonuses, adjustments, payouts, and
reversals without pretending that an unchosen payout provider already exists.

Payout initiation and provider selection remain owner decisions. The current
mobile balance is prototype data and is not a stored-value wallet.
