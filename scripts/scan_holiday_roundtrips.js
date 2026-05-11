#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const API = 'https://m.ctrip.com/restapi/soa2/15380/bjjson/FlightIntlAndInlandLowestPriceSearch';

const DEFAULT_ORIGINS = [
  ['SHA', 'Shanghai'],
  ['YIW', 'Yiwu'],
  ['HGH', 'Hangzhou'],
  ['NKG', 'Nanjing'],
  ['NGB', 'Ningbo'],
  ['WUX', 'Wuxi'],
  ['CZX', 'Changzhou'],
  ['NTG', 'Nantong'],
  ['YTY', 'Yangzhou-Taizhou'],
  ['WNZ', 'Wenzhou'],
  ['HYN', 'Taizhou'],
  ['HSN', 'Zhoushan'],
  ['JUZ', 'Quzhou'],
  ['YNZ', 'Yancheng'],
  ['XUZ', 'Xuzhou'],
  ['LYG', 'Lianyungang'],
].map(([code, name]) => ({ code, name }));

const DEFAULT_PERIODS = [
  { id: '2026-national-day', name: '2026 National Day', depStart: '2026-09-29', depEnd: '2026-10-04' },
  { id: '2027-spring-festival', name: '2027 Spring Festival', depStart: '2027-02-03', depEnd: '2027-02-09' },
];

const DEFAULT_SPLIT_HUBS = [
  ['TYO', 'Tokyo'],
  ['OSA', 'Osaka'],
  ['SEL', 'Seoul'],
  ['PUS', 'Busan'],
  ['FUK', 'Fukuoka'],
  ['NGO', 'Nagoya'],
].map(([code, name]) => ({ code, name }));

const DEFAULT_BASE_ORIGIN = { code: 'SHA', name: 'Shanghai' };

const NEARBY_ORIGIN_GROUPS = {
  SHA: DEFAULT_ORIGINS,
  HGH: DEFAULT_ORIGINS,
  NKG: DEFAULT_ORIGINS,
  YIW: DEFAULT_ORIGINS,
  BJS: [
    ['BJS', 'Beijing'],
    ['PEK', 'Beijing Capital'],
    ['PKX', 'Beijing Daxing'],
    ['TSN', 'Tianjin'],
    ['SJW', 'Shijiazhuang'],
    ['TYN', 'Taiyuan'],
  ],
  PEK: null,
  PKX: null,
  CAN: [
    ['CAN', 'Guangzhou'],
    ['SZX', 'Shenzhen'],
    ['HKG', 'Hong Kong'],
    ['MFM', 'Macau'],
    ['ZUH', 'Zhuhai'],
    ['HUZ', 'Huizhou'],
  ],
  SZX: null,
  HKG: null,
  MFM: null,
  CTU: [
    ['CTU', 'Chengdu Shuangliu'],
    ['TFU', 'Chengdu Tianfu'],
    ['CKG', 'Chongqing'],
    ['KMG', 'Kunming'],
  ],
  TFU: null,
  CKG: null,
  WUH: [
    ['WUH', 'Wuhan'],
    ['CSX', 'Changsha'],
    ['CGO', 'Zhengzhou'],
    ['KHN', 'Nanchang'],
  ],
  XMN: [
    ['XMN', 'Xiamen'],
    ['FOC', 'Fuzhou'],
    ['JJN', 'Quanzhou'],
    ['WUS', 'Wuyishan'],
  ],
  FOC: null,
  XIY: [
    ['XIY', 'Xi An'],
    ['LHW', 'Lanzhou'],
    ['TYN', 'Taiyuan'],
    ['CGO', 'Zhengzhou'],
  ],
  TAO: [
    ['TAO', 'Qingdao'],
    ['TNA', 'Jinan'],
    ['YNT', 'Yantai'],
    ['WEH', 'Weihai'],
  ],
  DLC: [
    ['DLC', 'Dalian'],
    ['SHE', 'Shenyang'],
    ['YNT', 'Yantai'],
  ],
  SHE: [
    ['SHE', 'Shenyang'],
    ['DLC', 'Dalian'],
    ['CGQ', 'Changchun'],
    ['HRB', 'Harbin'],
  ],
};

NEARBY_ORIGIN_GROUPS.PEK = NEARBY_ORIGIN_GROUPS.BJS;
NEARBY_ORIGIN_GROUPS.PKX = NEARBY_ORIGIN_GROUPS.BJS;
NEARBY_ORIGIN_GROUPS.SZX = NEARBY_ORIGIN_GROUPS.CAN;
NEARBY_ORIGIN_GROUPS.HKG = NEARBY_ORIGIN_GROUPS.CAN;
NEARBY_ORIGIN_GROUPS.MFM = NEARBY_ORIGIN_GROUPS.CAN;
NEARBY_ORIGIN_GROUPS.TFU = NEARBY_ORIGIN_GROUPS.CTU;
NEARBY_ORIGIN_GROUPS.FOC = NEARBY_ORIGIN_GROUPS.XMN;

function parseArgs(argv) {
  const args = {
    dest: 'HKG',
    origins: null,
    originSource: 'auto',
    periods: DEFAULT_PERIODS,
    minSave: 800,
    minSaveRate: 0.25,
    splitHubs: [],
    baseOrigin: DEFAULT_BASE_ORIGIN,
    splitLayovers: [0, 1],
    out: path.join(process.cwd(), 'ctrip-holiday-roundtrip-results.json'),
  };

  const periods = [];
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith('--')) continue;
    i += 1;
    if (key === '--dest') args.dest = value.toUpperCase();
    else if (key === '--base-origin') args.baseOrigin = { code: value.toUpperCase(), name: value.toUpperCase() };
    else if (key === '--origin' || key === '--origins') {
      if (value.toLowerCase() === 'auto') {
        args.origins = null;
        args.originSource = 'auto';
      } else {
        args.origins = value.split(',').map((code) => ({ code: code.trim().toUpperCase(), name: code.trim().toUpperCase() }));
        args.originSource = 'explicit';
      }
    } else if (key === '--split-hubs') {
      args.splitHubs = value === 'default'
        ? DEFAULT_SPLIT_HUBS
        : value.split(',').map((code) => ({ code: code.trim().toUpperCase(), name: code.trim().toUpperCase() }));
    } else if (key === '--split-layovers') {
      args.splitLayovers = value.split(',').map(Number).filter((n) => Number.isFinite(n) && n >= 0);
    } else if (key === '--period') {
      const [id, range] = value.split('=');
      const [depStart, depEnd] = range.split(':');
      periods.push({ id, name: id, depStart, depEnd });
    } else if (key === '--min-save') args.minSave = Number(value);
    else if (key === '--min-save-rate') args.minSaveRate = Number(value);
    else if (key === '--out') args.out = value;
  }
  if (periods.length) args.periods = periods;
  if (!args.origins) {
    args.origins = nearbyOriginsFor(args.baseOrigin);
    args.originSource = NEARBY_ORIGIN_GROUPS[args.baseOrigin.code] ? 'auto-nearby-map' : 'base-only-unknown-nearby';
  }
  return args;
}

function toOrigins(entries) {
  return entries.map(([code, name]) => ({ code, name }));
}

function nearbyOriginsFor(baseOrigin) {
  const group = NEARBY_ORIGIN_GROUPS[baseOrigin.code];
  if (group) {
    return group.map((origin) => (Array.isArray(origin)
      ? { code: origin[0], name: origin[1] }
      : { ...origin }));
  }
  return [{ ...baseOrigin }];
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function dateRange(start, end) {
  const dates = [];
  let d = start;
  while (d <= end) {
    dates.push(d);
    d = addDays(d, 1);
  }
  return dates;
}

function ctripDate(value) {
  const match = String(value || '').match(/Date\((-?\d+)([+-]\d{4})?\)/);
  if (!match) return null;
  const offset = match[2] || '+0800';
  const sign = offset[0] === '-' ? -1 : 1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(3, 5));
  const shifted = new Date(Number(match[1]) + sign * (hours * 60 + minutes) * 60000);
  return isoDate(shifted);
}

async function fetchCalendar(from, to) {
  const body = {
    departNewCityCode: from,
    arriveNewCityCode: to,
    startDate: isoDate(new Date()),
    grade: 3,
    flag: 1,
    channelName: 'FlightIntlOnline',
    searchType: 2,
    passengerList: [{ passengercount: 1, passengertype: 'Adult' }],
    calendarSelections: [{ selectionType: 8, selectionContent: ['3'] }],
  };

  const response = await fetch(`${API}?v=${Math.random()}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      origin: 'https://flights.ctrip.com',
      referer: `https://flights.ctrip.com/online/list/oneway-${from.toLowerCase()}-${to.toLowerCase()}?depdate=${body.startDate}`,
      'user-agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${from}-${to} HTTP ${response.status}`);
  const json = await response.json();
  const prices = {};
  for (const row of json.priceList || []) {
    const date = ctripDate(row.departDate);
    const price = Number(row.totalPrice || row.price || 0);
    if (!date || !price) continue;
    prices[date] = Math.min(prices[date] || Infinity, price);
  }
  return { route: `${from}-${to}`, ack: json.responseStatus?.Ack || null, prices };
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      try {
        results[current] = await worker(items[current], current);
      } catch (error) {
        results[current] = { error: String(error), item: items[current] };
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

function buildCombos(args, period, origin, outbound, inbound, baselineLookup) {
  const combos = [];
  for (const departDate of dateRange(period.depStart, period.depEnd)) {
    for (let days = 4; days <= 7; days += 1) {
      const returnDate = addDays(departDate, days);
      const outboundPrice = outbound[departDate];
      const returnPrice = inbound[returnDate];
      if (!outboundPrice || !returnPrice) continue;
      const totalPrice = outboundPrice + returnPrice;
      const baseline = origin.code === args.baseOrigin.code
        ? totalPrice
        : baselineLookup[`${period.id}:${departDate}:${returnDate}`] || null;
      combos.push({
        period: period.id,
        origin: origin.code,
        originName: origin.name,
        destination: args.dest,
        departDate,
        returnDate,
        days,
        outboundPrice,
        returnPrice,
        totalPrice,
        comparableShanghaiTotal: baseline,
        savingsVsShanghai: baseline ? baseline - totalPrice : null,
        savingsRateVsShanghai: baseline ? Number(((baseline - totalPrice) / baseline).toFixed(4)) : null,
        alternateWorthConsidering: origin.code === args.baseOrigin.code
          || (baseline && baseline - totalPrice >= args.minSave && totalPrice <= baseline * (1 - args.minSaveRate)),
      });
    }
  }
  return combos;
}

function routeKey(from, to) {
  return `${from}-${to}`;
}

function uniqueRoutes(routes) {
  const seen = new Set();
  return routes.filter((route) => {
    const key = routeKey(route.from, route.to);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSplitCombos(args, period, calendars, baselineLookup) {
  const combos = [];
  if (!args.splitHubs.length) return combos;

  for (const hub of args.splitHubs) {
    for (const origin of args.origins) {
    const outboundPositioning = calendars[routeKey(origin.code, hub.code)] || {};
    const outboundLonghaul = calendars[routeKey(hub.code, args.dest)] || {};
    const returnLonghaul = calendars[routeKey(args.dest, hub.code)] || {};
    const returnPositioning = calendars[routeKey(hub.code, origin.code)] || {};

    for (const departDate of dateRange(period.depStart, period.depEnd)) {
      for (let days = 4; days <= 7; days += 1) {
        const returnDate = addDays(departDate, days);
        const baseline = baselineLookup[`${period.id}:${departDate}:${returnDate}`] || null;
        if (!baseline) continue;

        for (const outboundLayoverDays of args.splitLayovers) {
          for (const returnLayoverDays of args.splitLayovers) {
            const hubToDestDate = addDays(departDate, outboundLayoverDays);
            const hubToShanghaiDate = addDays(returnDate, returnLayoverDays);
            const legs = [
              { from: origin.code, to: hub.code, date: departDate, price: outboundPositioning[departDate] },
              { from: hub.code, to: args.dest, date: hubToDestDate, price: outboundLonghaul[hubToDestDate] },
              { from: args.dest, to: hub.code, date: returnDate, price: returnLonghaul[returnDate] },
              { from: hub.code, to: origin.code, date: hubToShanghaiDate, price: returnPositioning[hubToShanghaiDate] },
            ];
            if (legs.some((leg) => !leg.price)) continue;
            const totalPrice = legs.reduce((sum, leg) => sum + leg.price, 0);
            combos.push({
              period: period.id,
              routeType: 'split-hub',
              hub: hub.code,
              hubName: hub.name,
              origin: origin.code,
              originName: origin.name,
              destination: args.dest,
              departDate,
              returnDate,
              days,
              outboundLayoverDays,
              returnLayoverDays,
              legs,
              totalPrice,
              comparableShanghaiTotal: baseline,
              savingsVsShanghai: baseline - totalPrice,
              savingsRateVsShanghai: Number(((baseline - totalPrice) / baseline).toFixed(4)),
              alternateWorthConsidering: baseline - totalPrice >= args.minSave && totalPrice <= baseline * (1 - args.minSaveRate),
            });
          }
        }
      }
    }
    }
  }

  return combos.sort((a, b) => a.totalPrice - b.totalPrice);
}

async function main() {
  const args = parseArgs(process.argv);
  const directRoutes = args.origins.flatMap((origin) => ([
    { origin, direction: 'outbound', from: origin.code, to: args.dest },
    { origin, direction: 'return', from: args.dest, to: origin.code },
  ]));
  const splitRoutes = args.splitHubs.flatMap((hub) => ([
    ...args.origins.flatMap((origin) => ([
      { origin, direction: 'split-out-positioning', from: origin.code, to: hub.code },
      { origin, direction: 'split-return-positioning', from: hub.code, to: origin.code },
    ])),
    { origin: hub, direction: 'split-out-longhaul', from: hub.code, to: args.dest },
    { origin: hub, direction: 'split-return-longhaul', from: args.dest, to: hub.code },
  ]));
  const tasks = uniqueRoutes([...directRoutes, ...splitRoutes]);

  const routeResults = await mapLimit(tasks, 6, async (task, index) => {
    const result = await fetchCalendar(task.from, task.to);
    console.error(`${index + 1}/${tasks.length} ${task.direction} ${task.from}-${task.to} ${Object.keys(result.prices).length} prices`);
    return { ...task, result };
  });

  const byOrigin = {};
  for (const origin of args.origins) byOrigin[origin.code] = { outbound: {}, return: {} };
  for (const item of routeResults) {
    if (!item || item.error) continue;
    if (item.direction === 'outbound' || item.direction === 'return') {
      byOrigin[item.origin.code][item.direction] = item.result.prices;
    }
  }
  const calendars = {};
  for (const item of routeResults) {
    if (!item || item.error) continue;
    calendars[routeKey(item.from, item.to)] = item.result.prices;
  }

  const baselineLookup = {};
  for (const period of args.periods) {
    for (const departDate of dateRange(period.depStart, period.depEnd)) {
      for (let days = 4; days <= 7; days += 1) {
        const returnDate = addDays(departDate, days);
        const out = byOrigin[args.baseOrigin.code]?.outbound?.[departDate];
        const ret = byOrigin[args.baseOrigin.code]?.return?.[returnDate];
        if (out && ret) baselineLookup[`${period.id}:${departDate}:${returnDate}`] = out + ret;
      }
    }
  }

  const ranked = [];
  for (const period of args.periods) {
    for (const origin of args.origins) {
      ranked.push(...buildCombos(args, period, origin, byOrigin[origin.code].outbound, byOrigin[origin.code].return, baselineLookup));
    }
  }
  ranked.sort((a, b) => a.totalPrice - b.totalPrice);

  const splitRanked = args.periods.flatMap((period) => buildSplitCombos(args, period, calendars, baselineLookup))
    .sort((a, b) => a.totalPrice - b.totalPrice);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'Ctrip FlightIntlAndInlandLowestPriceSearch low-price calendar API',
    notes: [
      'Round-trip totals are outbound plus return low-price calendar values, not held checkout fares.',
      'Prices can change at any time; verify final candidates in Ctrip before booking.',
    ],
    args,
    routeResults,
    byOrigin,
    calendars,
    ranked,
    splitRanked,
    topByPeriod: Object.fromEntries(args.periods.map((period) => [
      period.id,
      ranked.filter((combo) => combo.period === period.id).slice(0, 30),
    ])),
    splitTopByPeriod: Object.fromEntries(args.periods.map((period) => [
      period.id,
      splitRanked.filter((combo) => combo.period === period.id).slice(0, 30),
    ])),
    worthConsideringByPeriod: Object.fromEntries(args.periods.map((period) => [
      period.id,
      ranked.filter((combo) => combo.period === period.id && combo.alternateWorthConsidering).slice(0, 30),
    ])),
    splitWorthConsideringByPeriod: Object.fromEntries(args.periods.map((period) => [
      period.id,
      splitRanked.filter((combo) => combo.period === period.id && combo.alternateWorthConsidering).slice(0, 30),
    ])),
  };

  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(payload, null, 2), 'utf8');
  console.log(path.resolve(args.out));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
