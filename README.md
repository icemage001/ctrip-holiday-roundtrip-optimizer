# Ctrip Holiday Roundtrip Optimizer

Codex skill for finding cheaper Ctrip holiday round-trip flights from a user-specified base city, nearby airports, and optional international split-ticket hubs.

## Install

```bash
npx skills add icemage001/gitskills
```

## What It Does

- Expands any user-specified base city to nearby candidate airports when available.
- Searches flexible 4-7 day holiday return windows.
- Compares nearby-origin options against the base-city fare before recommending them.
- Supports long-haul Europe searches with optional split-ticket hubs such as Tokyo, Osaka, Seoul, Busan, Fukuoka, and Nagoya.
- Records Ctrip low-price calendar limitations and asks for result-page verification before booking.

## Example

```bash
node scripts/scan_holiday_roundtrips.js \
  --dest CDG \
  --base-origin SHA \
  --origin auto \
  --split-hubs default \
  --period 2026-national-day=2026-09-29:2026-10-04 \
  --out output/ctrip-paris-results.json
```
