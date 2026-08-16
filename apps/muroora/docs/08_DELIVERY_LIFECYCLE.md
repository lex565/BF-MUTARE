# 08 — Delivery and custody lifecycle

An order must be `READY_FOR_PICKUP` before staff can create a delivery. Admin
then offers it to an active, verified, available rider whose vehicle and
merchandise exposure are eligible.

Normal custody flow:

`SHOP_CUSTODY → RIDER_ASSIGNED → HANDOVER_STARTED → IN_RIDER_CUSTODY → DELIVERY_CONFIRMED → CUSTODY_CLOSED`

Shop staff starts handover only after the rider accepts and arrives. The
assigned rider separately confirms collection. Exposure increases at that
second confirmation—not at assignment or when staff presses the first button.
A cancelled handover therefore leaves exposure unchanged.

Delivery completion requires a six-digit recipient OTP. OTPs are generated
with cryptographic randomness, stored only as salted scrypt digests, expire in
ten minutes, allow five attempts, and throttle repeat attempts. Failed attempts
are committed to an append-only ledger. The rider API can verify a code but
cannot issue or retrieve one.

A verified OTP atomically closes delivery and custody, reduces merchandise
exposure exactly once, credits an earning exactly once, and records order,
custody, exposure, and audit events. Admin exceptions and returned-goods
reconciliation require a written reason.

No notification provider has been selected. `issueDeliveryOtpForNotification`
is server-only and must be connected to an approved recipient notification
adapter before a real delivery relies on OTP. No paid service was introduced.
