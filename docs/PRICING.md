# Weedtip pricing & monetization model

_Last reset: July 13, 2026. Prices live in the database (`plans`,
`ad_products`, `ad_regions.exclusive_price_*`) and `lib/placement-pricing.ts`;
this doc is the rationale._

## The one-sentence strategy

**Everything a dispensary needs to sell is free forever with 0% commission;
paid products are visibility, priced at roughly 10–20% of what Weedmaps and
Leafly charge.**

## Who pays whom

- **Shoppers never pay Weedtip.** Pickup orders are paid at the store;
  delivery orders are paid to the dispensary's delivery partner. There is no
  card checkout anywhere in the consumer flow.
- **Dispensaries and brands pay Weedtip** for plans and visibility. Billing is
  currently sales-led: self-serve "buys" create pending requests
  (`/admin/billing` console + email to sales), the team invoices, then
  activates. The PaymentCloud gateway integration will automate this without
  changing the model.

## Competitive anchor (researched July 2026)

| | Weedmaps | Leafly | **Weedtip** |
|---|---|---|---|
| Listing w/ menu + orders | ~$300–1,500/mo | ~$600/mo+ | **$0, forever** |
| Order commission | varies / iframe fees | varies | **0%, always** |
| SaaS tier | — | up to $4,000/mo w/ boosts | **$99/mo (Growth)** |
| Premium visibility, hot market | $10,000+/mo | $750–10,000/mo | **$149–499/mo** |

Sources: [TechPOS on Weedmaps costs](https://techpos.com/is-weedmaps-worth-it-for-dispensaries/),
[CannaPlanners Weedmaps vs Leafly](https://cannaplanners.com/learn/weedmaps-vs-leafly),
[iSenseLogic pricing survey](https://isenselogic.com/how-much-does-leafly-weedmaps-charge/).

## Plans (per location, monthly)

| Plan | Price | What it buys |
|---|---|---|
| **Free** | $0 forever | Full listing + menu + photos, unlimited pickup & delivery orders, 0% commission, deals & promo codes, reviews, basic analytics |
| **Growth** | **$99/mo** launch (list $199) | Everything in Free + advanced analytics & demand insights, no competitor cross-promo on your page, POS register included, embeddable menu, verified badge, priority support, CSV exports |

The old Plus ($49) / Premium ($149) pair is retired: Premium's "priority
ranking" collided with region ad slots (two things called Featured), and the
$99 POS add-on is now simply included in Growth.

## Region ad inventory (monthly, scarce: 1 + 3 + 10 per region)

542 sellable regions nationwide, tiered A+/A/B+/B by shopper demand & supply
density. Launch pricing ≈ 30% of list; list is still far below competitors.

| Slot | A+ | A | B+ | B |
|---|---|---|---|---|
| Premium (10/region) | $149 → $499 | $119 → $399 | $89 → $299 | $89 → $299 |
| Featured (3/region) | $450 → $1,500 | $300 → $1,000 | $225 → $750 | $225 → $750 |
| Exclusive (1/region, negotiated) | $1,500–5,000 | $1,050–3,500 | $600–2,000 | $600–2,000 |

(launch → list, per month. "Standard" = the free listing; never sold.)

## One-time placements (self-serve, 1–90 days)

`price = base/day × reach × days` — base: promoted deal/product $10,
featured $15, promoted brand $20, homepage spotlight $40; reach: city ×1,
state ×3, nationwide ×8. Example: 30-day city featured = $450 one-time.

## Brand products

- Promoted brand placement (Brands directory): from $20/day × reach.
- Featured-brand auction per state: floor set per market
  (`brand_ad_regions.featured_rate_cents`), 2-month terms, top bids win.

## Why this wins

1. **Supply acquisition:** "free forever + 0% commission" is a no-brainer
   against a $600/mo Weedmaps invoice — and supply density is what makes the
   marketplace worth advertising on.
2. **Scarcity, not auctions,** for dispensary visibility: fixed inventory per
   region sells urgency honestly and keeps pricing predictable (auctions are
   what operators hate about the incumbents).
3. **Launch → list glidepath:** prices ratchet toward list per region as
   occupancy proves demand (recommendation engine on /admin/ad-regions), so we
   never have to reprice across the board.
