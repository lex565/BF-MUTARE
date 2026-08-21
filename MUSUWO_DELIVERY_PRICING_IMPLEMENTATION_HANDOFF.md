# Musuwo delivery pricing — implementation handoff

Status: **Approved for pilot implementation**  
Pricing version: `mutare-pilot-v1`  
Primary market: Mutare, Zimbabwe  
Applies to: Musuwo web, mobile, checkout APIs, order records and administration  
Source decision: Musuwo performs deliveries internally; there is no rider payout model in V1.

This document is the source of truth for Claude Code when implementing delivery
pricing in `apps/muroora` and `apps/muroora-mobile`. The server must calculate
and validate every fee. Web and mobile must never independently calculate an
authoritative charge.

## 1. Approved standard tariff

Use merchant-to-customer **road-network distance**, not straight-line distance.

| Road distance | Customer delivery fee |
|---|---:|
| `0 < km <= 2` | US$2.00 |
| `2 < km <= 5` | US$3.00 |
| `5 < km <= 10` | US$4.00 |
| `10 < km <= 15` | US$6.00 |
| `km > 15` | No standard delivery; manual quote required |

The fee currency is USD. A ZiG amount may be displayed and accepted only when
the backend has a current, controlled conversion rate and records the rate used.
Do not add VAT unless Musuwo is VAT registered and the production tax
configuration explicitly enables it.

## 2. Approved additional charges

| Situation | Charge |
|---|---:|
| First 10 minutes of waiting | Included |
| Each started additional 10-minute waiting block | US$1.00 |
| Customer-caused second attempt | Full standard delivery fee again |
| Return to merchant | 75% of original standard delivery fee |
| Heavy or oversized order | US$2.00 |
| Terrain/elevation | No surcharge in pilot V1 |
| Free delivery | Forbidden unless an explicit funded promotion/merchant subsidy covers it |

Round monetary calculations to integer cents. For the 75% return charge, round
half up to the nearest cent.

## 3. Serviceability rules

Standard delivery is available only when all conditions are true:

1. The merchant has delivery enabled.
2. Merchant and customer coordinates are valid.
3. A valid road-network route exists.
4. Road distance is greater than zero and no more than 15 km.
5. The address is inside the enabled Mutare delivery operating area.

Return one of these stable reason codes:

- `WITHIN_RANGE`
- `TOO_FAR`
- `NO_NETWORK_ROUTE`
- `INVALID_LOCATION`
- `BUSINESS_NOT_DELIVERING`
- `OUTSIDE_SERVICE_AREA`
- `MANUAL_QUOTE_REQUIRED`

Never silently replace a missing road route with straight-line distance.
`NO_NETWORK_ROUTE`, `OUTSIDE_SERVICE_AREA` and distances over 15 km must block
standard checkout and offer manual location confirmation/contact instead.

## 4. Authoritative quote algorithm

```text
validate merchant and delivery coordinates
calculate route using the configured road-network routing service
if no valid route: reject standard quote with NO_NETWORK_ROUTE
if road_distance_km > 15: reject standard quote with MANUAL_QUOTE_REQUIRED

if road_distance_km <= 2:       standard_fee_cents = 200
else if road_distance_km <= 5:  standard_fee_cents = 300
else if road_distance_km <= 10: standard_fee_cents = 400
else:                           standard_fee_cents = 600

oversize_cents = 200 when explicitly marked heavy/oversized, otherwise 0
promotion_subsidy_cents = validated funded subsidy, capped at subtotal
subtotal_cents = standard_fee_cents + oversize_cents
customer_delivery_fee_cents = subtotal_cents - promotion_subsidy_cents

return a signed/opaque quote ID with an expiry time
```

Waiting, redelivery and return charges happen after initial checkout and must be
recorded as separate order charge entries with an actor, reason and timestamp.

## 5. Required quote API contract

Suggested endpoint: `POST /api/delivery/quote`

Request:

```json
{
  "businessId": "uuid",
  "deliveryLatitude": -18.9707,
  "deliveryLongitude": 32.6709,
  "isHeavyOrOversized": false,
  "currency": "USD"
}
```

Successful response:

```json
{
  "quoteId": "opaque-server-generated-id",
  "pricingVersion": "mutare-pilot-v1",
  "serviceable": true,
  "serviceabilityReason": "WITHIN_RANGE",
  "roadDistanceKm": 7.28,
  "estimatedTravelTimeMinutes": 15,
  "standardFeeCents": 400,
  "oversizeFeeCents": 0,
  "promotionSubsidyCents": 0,
  "customerDeliveryFeeCents": 400,
  "currency": "USD",
  "expiresAt": "ISO-8601 timestamp"
}
```

Unserviceable response:

```json
{
  "pricingVersion": "mutare-pilot-v1",
  "serviceable": false,
  "serviceabilityReason": "NO_NETWORK_ROUTE",
  "roadDistanceKm": null,
  "customerDeliveryFeeCents": null,
  "currency": "USD",
  "manualReviewAvailable": true
}
```

Checkout must submit `quoteId`; the server must revalidate expiry, merchant,
customer, basket and fee before creating the order. Never trust fee or distance
values posted by a client.

## 6. Order data that must be persisted

Persist these values on the order or immutable delivery-pricing snapshot:

- `delivery_pricing_version`
- `delivery_quote_id`
- `delivery_serviceability_reason`
- merchant latitude/longitude used for the quote
- customer latitude/longitude used for the quote
- `delivery_road_distance_m`
- `delivery_estimated_time_seconds`
- `delivery_standard_fee_cents`
- `delivery_oversize_fee_cents`
- `delivery_promotion_subsidy_cents`
- `delivery_customer_fee_cents`
- `delivery_currency`
- ZiG conversion rate and rate timestamp, when applicable
- routing provider/data version
- quote creation and expiry timestamps

Post-checkout adjustments must use an append-only charge/audit table containing
order ID, charge type, amount, currency, reason, actor and timestamps. Supported
types in V1: `WAITING`, `REDELIVERY`, `RETURN_TO_MERCHANT`, `MANUAL_ADJUSTMENT`.

Do not call delivery revenue profit. The company still bears fuel, maintenance,
vehicle depreciation, employee time, failed deliveries and administration.

## 7. Web and mobile user experience

Both clients must use the same server quote and states.

Before location is supplied:

> Delivery starts at US$2. Add your delivery location to calculate the final fee.

After a successful quote:

> Delivery: US$4.00 · 7.3 km by road · approximately 15 minutes

General explanation:

> Your delivery fee is calculated from the merchant to your delivery location using road distance. Standard delivery is available up to 15 km.

No route:

> We could not confirm a road route to this location. Check your map pin or request manual delivery confirmation.

Over 15 km:

> This location is outside standard delivery range. Contact Musuwo for a manual delivery quote.

The UI must show the final fee before the customer confirms payment. Web and
mobile must have equivalent loading, success, expired-quote, invalid-location,
unserviceable and retry states.

## 8. Administration requirements

Admin users need to see:

- quoted road distance and estimated time
- applied tariff band and pricing version
- base, surcharge, subsidy and final customer fee separately
- serviceability reason
- route/location-review status
- post-checkout charge history
- whether a price was automatic or manually approved

Pricing constants must live in backend-controlled configuration. Do not scatter
`2`, `3`, `4`, `6` or the distance thresholds across React/React Native code.
Changing a tariff must create a new version; existing orders retain their
original immutable pricing snapshot.

## 9. Implementation order for Claude Code

1. Audit existing delivery, checkout, order, money and location schemas/services.
2. Add the versioned backend tariff and pure pricing tests.
3. Add road-route quote provider abstraction and serviceability reason codes.
4. Add the quote endpoint with validation, expiry and server authority.
5. Persist immutable quote details during order creation.
6. Add web checkout/location/fee states.
7. Add equivalent Expo mobile states using the same API contract.
8. Add admin visibility and append-only adjustment records.
9. Add analytics for quoted, serviceable, rejected, completed and failed orders.
10. Run repository-specific web/mobile checks and document environment variables.

## 10. Required automated tests

- Exactly 2.000 km costs 200 cents.
- 2.001 km costs 300 cents.
- Exactly 5.000 km costs 300 cents.
- 5.001 km costs 400 cents.
- Exactly 10.000 km costs 400 cents.
- 10.001 km costs 600 cents.
- Exactly 15.000 km costs 600 cents.
- 15.001 km returns `MANUAL_QUOTE_REQUIRED` and no standard fee.
- Missing route returns `NO_NETWORK_ROUTE`, never a straight-line quote.
- Heavy order adds 200 cents once.
- Funded subsidy cannot reduce the customer fee below zero.
- Return charge is 75% of the original standard fee with correct rounding.
- Each started waiting block after the included 10 minutes adds 100 cents.
- Expired/tampered quote is rejected at checkout.
- Web and mobile display the backend fee and never recompute it locally.
- Existing orders retain their original pricing after a tariff-version change.

## 11. Pilot measurement requirements

For every real delivery, capture total vehicle distance—not only the loaded
merchant-to-customer leg—fuel expense, pickup wait, delivery duration, failed
attempts, returns and manual adjustments. Review the tariff after the first 100
completed real deliveries. The GIS simulation supports the band structure but
does not prove profitability.

