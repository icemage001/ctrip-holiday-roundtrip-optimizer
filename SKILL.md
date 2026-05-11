---
name: ctrip-holiday-roundtrip-optimizer
description: Find cheap Ctrip holiday round-trip flights from any user-specified base city by expanding to nearby airports, flexible 4-7 day return windows, and cheaper alternatives versus the base-city fare. Also support long-haul Europe searches from the base city or nearby origins, with optional split-ticket routing via nearby international hubs such as Japan or Korea. Use when the user asks to search Ctrip flights for holidays, flexible round trips, nearby airports, international self-transfer hubs, or price-optimized departures.
---

# Ctrip Holiday Roundtrip Optimizer

Use this skill to compare flexible holiday round trips on Ctrip when the user names a base city and can depart from that city, nearby airports, or for long-haul trips from those origins via international self-transfer hubs.

## Core Workflow

1. Normalize the request:
   - Determine destination city code, usually `HKG` for Hong Kong.
   - Convert holiday wording into concrete date windows.
   - Use 4-7 days as the default return interval when the user allows it.
   - Treat the user's named origin as `--base-origin`; use `SHA` only when the user does not specify a base city.

2. Expand candidate origins:
   - Use `--origin auto` or omit `--origin` to expand from the base city using the bundled nearby-airport map.
   - The map includes common China clusters such as Yangtze River Delta, Beijing/Tianjin, Greater Bay Area, Chengdu/Chongqing, Wuhan/Changsha/Zhengzhou, Xiamen/Fuzhou, Xi'an/Lanzhou, Shandong, and Northeast China.
   - If the base city is not covered by the map, the script falls back to the base city only. In that case, discover nearby airports from Ctrip, airport geography, or user constraints, then pass them explicitly with `--origin AAA,BBB,CCC`.
   - Include additional cities returned by Ctrip adjacent-airport recommendations when they are plausibly reachable.
   - Do not recommend a non-base-city origin unless it is materially cheaper after the user accounts for ground transfer time and cost.
   - For long-haul routes to Europe, compare all acceptable nearby origins directly to the destination first. A nearby domestic origin may be better than the base city even without an international self-transfer.
   - Also consider split-ticket hubs in nearby countries when the user allows it. Default hubs: `TYO`, `OSA`, `SEL`, `PUS`, `FUK`, `NGO`; if city codes return no prices, try concrete airport or alternate city codes such as `NRT`, `HND`, `KIX`, `ICN`, `GMP`.
   - Treat split-ticket routes as higher-friction than nearby domestic departures because they may require separate bookings, self-transfer, baggage recheck, immigration entry rules, and overnight stays.

3. Query Ctrip:
   - Prefer the bundled script `scripts/scan_holiday_roundtrips.js` for low-price calendar scans.
   - Parse Ctrip `/Date(...+0800)/` timestamps as local dates; do not slice UTC dates directly.
   - Use Playwright page rendering to verify the top candidates before presenting them as recommendations.
   - Record the query timestamp and note that prices are live and can change.

4. Rank results:
   - Build every outbound date plus return date with 4-7 day interval.
   - Sum the outbound and return Ctrip low-price calendar values.
   - Mark non-base-city origins as worth considering only when they beat `--base-origin` by the configured absolute and percentage thresholds.
   - For long-haul split-ticket routes, compare `origin -> hub -> destination` plus `destination -> hub -> origin` against the same-date base-origin direct/one-ticket baseline. Prefer requiring a much larger absolute savings after estimated hotels, baggage, and local transfer costs.
   - Present the base-city baseline separately from cheaper nearby-origin alternatives.

5. Communicate limitations:
   - Low-price calendar values are not held fares and may not equal final checkout prices.
   - The final answer should distinguish low-price-calendar screening values from visible Ctrip result-page prices.
   - If exact flight numbers or baggage rules matter, open the Ctrip result page for the final candidate dates and verify manually.
   - For future public holidays whose official break arrangement is not published, state the exact assumed date window.

## Bundled Script

Run from any workspace with Node.js available:

```bash
node <skill-dir>/scripts/scan_holiday_roundtrips.js --out output/ctrip-holiday-results.json
```

Useful options:

```bash
node scripts/scan_holiday_roundtrips.js \
  --dest HKG \
  --base-origin SHA \
  --origin auto \
  --period 2026-national-day=2026-09-29:2026-10-04 \
  --period 2027-spring-festival=2027-02-03:2027-02-09 \
  --min-save 800 \
  --min-save-rate 0.25 \
  --out output/ctrip-holiday-results.json
```

Long-haul split-ticket example:

```bash
node scripts/scan_holiday_roundtrips.js \
  --dest LON \
  --base-origin SHA \
  --origin auto \
  --split-hubs default \
  --split-layovers 0,1 \
  --period 2026-national-day=2026-09-29:2026-10-04 \
  --min-save 1500 \
  --min-save-rate 0.30 \
  --out output/ctrip-europe-split-results.json
```

Use `--split-hubs default` for Tokyo, Osaka, Seoul, Busan, Fukuoka, and Nagoya. Override with explicit city or airport codes when the user names preferred hubs.

The output JSON contains:

- `topByPeriod`: cheapest combinations overall.
- `worthConsideringByPeriod`: non-base-city routes that pass the savings threshold plus base-city baseline rows.
- `ranked`: all computed combinations.
- `splitRanked`: all `origin -> hub -> destination -> hub -> origin` split-ticket combinations when `--split-hubs` is used.
- `splitWorthConsideringByPeriod`: split-ticket combinations that pass the savings threshold.
- `byOrigin`: raw outbound and return low-price calendars by origin.

## Holiday Date Guidance

For Chinese holidays, use concrete dates in the answer. If official holiday schedules are uncertain, say so and scan a practical travel window:

- National Day: usually scan September 29 through October 4 as outbound dates, with returns 4-7 days later.
- Spring Festival: scan roughly three days before through three days after Lunar New Year Day, with returns 4-7 days later.

When the user asks for "as many combinations as possible", widen the outbound window before adding distant airports. Nearby airports with high transfer friction should still meet the "much cheaper" threshold.
