// Language tables (ET/EN, ADR-012), SVG stroke icons and plain text/number helpers.
// Loaded by cards/khe-cards.js with ?v=; zero imports (house3d/scene/ rule).

const SHIELD = '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/>';

const ICONS = {
  flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  shield: SHIELD,
  'shield-check': `${SHIELD}<path d="M9 12l2 2 4-4"/>`,
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 2 3-1 5M14 12c4 0 7 1 7 4 0 2-3 2-5-1M12 14c0 4-1 7-4 7-2 0-2-3 1-5M10 12c-4 0-7-1-7-4 0-2 3-2 5 1"/>',
  pergola: '<path d="M3 9h18M5 9v12M19 9v12M3 5h18"/><path d="M7 13h10M7 17h10"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  thermometer: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.8 0 5 2.2 5 5"/>',
  alert: '<path d="M12 4L2.5 20h19z"/><path d="M12 10v4M12 17.5v.01"/>',
  person: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"/>',
  roof: '<path d="M3 9h18M5 9v11M19 9v11M3 9l2-4h14l2 4M8 9v3M12 9v3M16 9v3"/>',
  vent: '<path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12h15.5a2.5 2.5 0 1 1-2.5 2.5M3 16h7"/>',
  power: '<path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  waves: '<path d="M7 4c-2 3 2 5 0 8s2 5 0 8M12 4c-2 3 2 5 0 8s2 5 0 8M17 4c-2 3 2 5 0 8s2 5 0 8"/>',
  supply: '<path d="M4 12h12M12 8l4 4-4 4M20 5v14"/>',
  extract: '<path d="M8 12h12M16 8l4 4-4 4M4 5v14"/>',
  wash: '<path d="M5 3h14v18H5zM5 7h14M12 15m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0"/>',
  sauna: '<path d="M4 20h16M6 15h12v5H6zM9 4c-1 2 1 3 0 5M12 4c-1 2 1 3 0 5M15 4c-1 2 1 3 0 5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  home: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  tune: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  remote: '<rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="8" r="2"/><path d="M10 14h4M10 17h4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  rain: '<path d="M7 16a4 4 0 0 1-.9-7.9A5 5 0 0 1 16 7h.5a3.5 3.5 0 0 1 .5 7M9 19v2M13 18v2M17 17v2"/>',
  sunset: '<path d="M12 3v2M5.6 5.6 7 7M3 12h2M17 7l1.4-1.4M19 12h2M8 12a4 4 0 0 1 8 0M3 16h18M7 20h10"/>'
};

const NO_VALUE = new Set(['unavailable', 'unknown', '']);

// The cards' own words, one table per language, chosen by the card's `language` config and never
// by the HA profile (ADR-012): a household member with an English profile still reads Estonian.
// Every Estonian letter in this file stays inside ET and ET_SENSOR; a test holds the line.
const ET = {
  locale: 'et-EE', and: 'ja',
  words: {
    on: 'sees', off: 'väljas', open: 'lahti', closed: 'kinni', opening: 'avaneb', closing: 'sulgub', playing: 'mängib',
    paused: 'pausil', idle: 'ootel', standby: 'ootel', buffering: 'laeb', home: 'kodus', not_home: 'eemal', disarmed: 'valveta',
    arming: 'valvestub', pending: 'sisenemisviivitus', triggered: 'häire', heat: 'küte', eco: 'säästlik',
    performance: 'kiirsoojendus', unknown: 'teadmata', unavailable: 'pole saadaval'
  },
  armed: 'valves', notKnown: 'pole teada', away: 'eemal', home: 'kodus',
  alarmOn: l => `Valve on häires: ${l}.`, attention: l => `Vajab tähelepanu: ${l}.`, allOk: 'Kõik on korras.',
  priceNow: w => ` Elekter on praegu ${w}.`,
  security: { triggered: 'häires', pending: 'sisenemisviivitus', arming: 'valvestub', armed: 'valves' },
  allDisarmed: 'kõik valveta', peopleHome: l => `${l} kodus`, nobodyHome: 'keegi pole kodus',
  electricity: 'Elekter', securityLabel: 'Turvalisus', climate: 'Kliima', people: 'Inimesed', centShort: 's',
  cents: 'senti/kWh', priceUnknown: 'Hind pole teada', energyLink: 'Energia ›', noForecast: 'Hinnaprognoosi pole',
  today: 'täna', tomorrow: 'homme', yesterday: 'eile', now: 'nüüd', hourPrices: both => `Tunnihinnad, täna${both ? ' ja homme' : ''}`,
  hourPrice: both => `Tunnihind täna${both ? ' ja homme' : ''}`, mode: n => `${n}: režiim`, brightness: n => `${n}: heledus`,
  ranges: { '24h': '24 h', '7d': '7 päeva', '30d': '30 päeva', '90d': '90 päeva', '12m': '12 kuud' }, range: 'Ajavahemik',
  close: 'Sulge', more: 'Rohkem', systemPage: 'Süsteemi leht', loading: 'Laen…', historyFailed: 'Ajalugu ei saanud lugeda',
  dataFailed: 'Andmeid ei saanud lugeda', noData: 'Selle aja kohta andmeid pole', noDataShort: 'Andmeid pole',
  history: n => `${n}, ajalugu`, lowest: 'Madalaim', mean: 'Keskmine', highest: 'Kõrgeim', cheapest: 'Odavaim', dearest: 'Kalleim',
  stateNow: 'Praegu', times: 'Kordi', total: 'Kokku', cost: 'Kulu', peakHour: 'Suurim tund', peakDay: 'Suurim päev',
  outdoors: 'Õues', outside: v => `${v}° õues`, homeTitle: 'Kodu', system: 'Süsteem', update: l => `Uuendus: ${l}`,
  priceTitle: 'Elekter, kõigi tasudega', exchange: v => `börsil ${v} senti`, priceAria: 'Elektri hind, ajalugu',
  use: 'Tarbimine', useAria: 'Tarbimine, ajalugu',
  weekdays: ['pühapäev', 'esmaspäev', 'teisipäev', 'kolmapäev', 'neljapäev', 'reede', 'laupäev'],
  // "in <month>": the inessive is not one suffix for all
  monthsShort: ['jaan', 'veebr', 'märts', 'apr', 'mai', 'juuni', 'juuli', 'aug', 'sept', 'okt', 'nov', 'dets'],
  inMonth: ['jaanuaris', 'veebruaris', 'märtsis', 'aprillis', 'mais', 'juunis', 'juulis', 'augustis', 'septembris', 'oktoobris', 'novembris', 'detsembris'],
  dayMonth: (d, m) => `${d}.${m}`, at: h => `kell ${h}`,
  rest: 'Ülejäänud maja', restNote: 'kõik, mida eraldi ei mõõdeta', late: 'andmed hilinevad', todayLate: 'täna, andmed hilinevad',
  inLast: (m, v) => `${m} ${v} kWh`, splitAria: (n, v) => `${n}, ${v} kWh sel kuul, ajalugu`,
  curve: v => (!v ? 'Küttevesi täpselt kõvera järgi' : `Küttevesi ${Math.abs(v)}° ${v > 0 ? 'soojem' : 'jahedam'} kui kõvera järgi`),
  ofHouse: p => `${p} % majast`, fault: 'Viga', offState: 'Väljas', stateUnknown: 'Seisund pole teada',
  compare: { high: m => `Kallim kui ${m}`, good: m => `Odavam kui ${m}`, mid: m => `Sama hinnaga kui ${m}` },
  thisMonth: 'Sel kuul', costUnknown: 'Kulu pole teada', average: v => `, keskmiselt ${v} senti/kWh`,
  dayOf: (d, n) => `${d} päeva ${n}-st`, pace: v => `Selle tempoga umbes ${v} €`, todayCell: 'Täna', yesterdayCell: 'Eile',
  noFees: 'Eurod ilma kuutasudeta.', monthAria: 'Sel kuul, tarbimise ajalugu', monthDate: (m, d) => `${m}, ${d}. päev`, energy: 'Energia',
  unitSwitch: 'Ühik', dayAvg: 'päeva keskmine', dearestHour: 'kalleim tund', dearestHourAt: v => `kalleim tund ${v}`,
  cheapestDay: 'Odavaim päev', dearestDay: 'Kalleim päev', largest: 'Suurim', smallest: 'Väikseim', todaySoFar: 'Täna seni', dayNotOver: 'päev pole läbi',
  target: t => `Siht ${t}`, notBelow: v => `, mitte alla ${v}°`, rangeNote: (h, a, b) => `${h} tunniga ${a} kuni ${b}`, limit: v => `${v}° piir`,
  ratio: v => `${v} korda`, inLastShort: (m, v) => `${m} ${v}`,
  failed: 'Ei õnnestunud', shiftDown: 'Nihe ühe kraadi võrra alla', shiftUp: 'Nihe ühe kraadi võrra üles',
  perDayAvg: 'päevas keskmiselt', perMonthAvg: 'kuus keskmiselt', smallestDay: 'Väikseim päev', smallestMonth: 'Väikseim kuu',
  largestMonth: 'Suurim kuu', last: 'Viimane', monthNotOver: 'kuu pole läbi', partialMonth: 'osaline kuu', partialDay: 'osaline päev',
  nextHours: n => (n === 1 ? 'Järgmine tund' : `Järgmised ${n} tundi`), dry: 'Kuiv', dryAt: s => `kuiv kell ${s}`, allDry: 'kogu aeg kuiv', noWeather: 'Prognoos pole teada',
  precipKey: 'sademed mm', tempKey: 'temperatuur', rainKey: 'vihm või lumi',
  forecastAria: n => `Tunniprognoos ${n} tundi: sademed tulpadena, temperatuur joonena`,
  motionNow: 'Liikumine praegu', lastMotion: v => `Viimane liikumine ${v}`, minAgo: n => `${n} min tagasi`, quiet: 'Vaikne',
  noMotion: 'Ööpäeva jooksul liikumist pole', motionOn: 'liikumine', motionOff: 'vaikne', timesUnit: 'korda', over24h: 'üle 24 h', nowRow: 'praegu', alarmIn: n => `Häire, ${n}`,
  pendingIn: n => `Sisenemise viivitus, ${n}`, firedAt: t => `andur käivitus kell ${t}`, firedUnknown: 'andur pole teada',
  planAria: l => (l ? `Maja plaan, liikumine viimase veerandtunniga: ${l}` : 'Maja plaan, viimase veerandtunniga liikumist pole'),
  andMore: (a, n) => `${a} ja veel ${n}`,
  motionRow: (n, l) => `${n}, viimati ${l}, ajalugu`,
  camLive: 'Otsepilt', camTap: 'puuduta otsepildiks', camOpen: n => `${n}, ava otsepilt`, camShow: n => `${n}, näita suurelt`,
  camDown: 'Kaamera ei vasta', camLast: t => `Kaamera ei vasta, viimane pilt ${t}`,
  hourShort: 't', tvIsOff: 'Teler on väljas', tvDown: 'Teler ei vasta', since: (d, t) => `${d}, alates ${t}`,
  lastUntil: (a, t) => `viimati ${a}, kuni ${t}`, turnOff: 'Lülita välja', turnOn: 'Lülita sisse', remote: 'Pult',
  switchProfile: 'Vaheta profiili', turnOffAria: 'Lülita teler välja', turnOnAria: 'Lülita teler sisse',
  remoteAria: 'Pult: helitugevus ja taasesitus', profileAria: n => `Vaheta teleri profiilile ${n}`, pinNote: 'PIN tuleb sisestada teleris',
  yesterdayDur: d => `eile ${d}`, notWatched: 'Täna pole veel vaadatud.', perDay: d => `keskmiselt ${d} päevas`,
  weekdaysShort: ['P', 'E', 'T', 'K', 'N', 'R', 'L'], byDay: l => `Päevade kaupa: ${l}`,
  conditions: {
    'clear-night': 'selge', cloudy: 'pilves', exceptional: 'erakordne ilm', fog: 'udu', hail: 'rahe', lightning: 'äike',
    'lightning-rainy': 'äike ja vihm', partlycloudy: 'vahelduv pilvisus', pouring: 'paduvihm', rainy: 'vihm', snowy: 'lumi',
    'snowy-rainy': 'lörts', sunny: 'päikseline', windy: 'tuuline', 'windy-variant': 'tuuline ja pilves'
  }
};

const EN = {
  locale: 'en-GB', and: 'and',
  words: {
    on: 'on', off: 'off', open: 'open', closed: 'closed', opening: 'opening', closing: 'closing', playing: 'playing',
    paused: 'paused', idle: 'idle', standby: 'standby', buffering: 'buffering', home: 'home', not_home: 'away', disarmed: 'disarmed',
    arming: 'arming', pending: 'entry delay', triggered: 'alarm', heat: 'heating', eco: 'eco',
    performance: 'boost', unknown: 'unknown', unavailable: 'unavailable'
  },
  armed: 'armed', notKnown: 'not known', away: 'away', home: 'home',
  alarmOn: l => `Alarm triggered: ${l}.`, attention: l => `Needs attention: ${l}.`, allOk: 'All is well.',
  priceNow: w => ` Electricity is ${w} right now.`,
  security: { triggered: 'alarm triggered', pending: 'entry delay', arming: 'arming', armed: 'armed' },
  allDisarmed: 'all disarmed', peopleHome: l => `${l} home`, nobodyHome: 'nobody home',
  electricity: 'Electricity', securityLabel: 'Security', climate: 'Climate', people: 'People', centShort: 'c',
  cents: 'cents/kWh', priceUnknown: 'Price not known', energyLink: 'Energy ›', noForecast: 'No price forecast',
  today: 'today', tomorrow: 'tomorrow', yesterday: 'yesterday', now: 'now', hourPrices: both => `Hourly prices, today${both ? ' and tomorrow' : ''}`,
  hourPrice: both => `Hourly price today${both ? ' and tomorrow' : ''}`, mode: n => `${n}: mode`, brightness: n => `${n}: brightness`,
  ranges: { '24h': '24 h', '7d': '7 days', '30d': '30 days', '90d': '90 days', '12m': '12 months' }, range: 'Time range',
  close: 'Close', more: 'More', systemPage: 'System page', loading: 'Loading…', historyFailed: 'Could not read the history',
  dataFailed: 'Could not read the data', noData: 'No data for this period', noDataShort: 'No data',
  history: n => `${n}, history`, lowest: 'Lowest', mean: 'Average', highest: 'Highest', cheapest: 'Cheapest', dearest: 'Dearest',
  stateNow: 'Now', times: 'Times', total: 'Total', cost: 'Cost', peakHour: 'Largest hour', peakDay: 'Largest day',
  outdoors: 'Outdoors', outside: v => `${v}° outside`, homeTitle: 'Home', system: 'System', update: l => `Update: ${l}`,
  priceTitle: 'Electricity, all fees included', exchange: v => `${v} cents on the exchange`, priceAria: 'Electricity price, history',
  use: 'Use', useAria: 'Use, history',
  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  inMonth: ['in January', 'in February', 'in March', 'in April', 'in May', 'in June', 'in July', 'in August', 'in September', 'in October', 'in November', 'in December'],
  dayMonth: (d, m) => `${d}/${m}`, at: h => `at ${h}`,
  rest: 'Rest of the house', restNote: 'everything not metered on its own', late: 'data delayed', todayLate: 'today, data delayed',
  inLast: (m, v) => `${v} kWh ${m}`, splitAria: (n, v) => `${n}, ${v} kWh this month, history`,
  curve: v => (!v ? 'Heating water right on the curve' : `Heating water ${Math.abs(v)}° ${v > 0 ? 'warmer' : 'cooler'} than the curve`),
  ofHouse: p => `${p} % of the house`, fault: 'Fault', offState: 'Off', stateUnknown: 'State not known',
  compare: { high: m => `Dearer than ${m}`, good: m => `Cheaper than ${m}`, mid: m => `Same price as ${m}` },
  thisMonth: 'This month', costUnknown: 'Cost not known', average: v => `, on average ${v} cents/kWh`,
  dayOf: (d, n) => `Day ${d} of ${n}`, pace: v => `At this pace about ${v} €`, todayCell: 'Today', yesterdayCell: 'Yesterday',
  noFees: 'Euros without monthly fees.', monthAria: 'This month, use history', monthDate: (m, d) => `${m}, day ${d}`, energy: 'Energy',
  unitSwitch: 'Unit', dayAvg: 'day average', dearestHour: 'dearest hour', dearestHourAt: v => `dearest hour ${v}`,
  cheapestDay: 'Cheapest day', dearestDay: 'Dearest day', largest: 'Largest', smallest: 'Smallest', todaySoFar: 'Today so far', dayNotOver: 'day not over',
  target: t => `Target ${t}`, notBelow: v => `, not below ${v}°`, rangeNote: (h, a, b) => `${a} to ${b} in ${h} hours`, limit: v => `${v}° limit`,
  ratio: v => `${v} times`, inLastShort: (m, v) => `${v} ${m}`,
  failed: 'Did not work', shiftDown: 'Shift one degree down', shiftUp: 'Shift one degree up',
  perDayAvg: 'a day on average', perMonthAvg: 'a month on average', smallestDay: 'Smallest day', smallestMonth: 'Smallest month',
  largestMonth: 'Largest month', last: 'Last', monthNotOver: 'month not over', partialMonth: 'partial month', partialDay: 'partial day',
  nextHours: n => (n === 1 ? 'Next hour' : `Next ${n} hours`), dry: 'Dry', dryAt: s => `dry ${s}`, allDry: 'dry throughout', noWeather: 'Forecast not known',
  precipKey: 'precipitation mm', tempKey: 'temperature', rainKey: 'rain or snow',
  forecastAria: n => `Hourly forecast, ${n} hours: precipitation as bars, temperature as a line`,
  motionNow: 'Motion now', lastMotion: v => `Last motion ${v}`, minAgo: n => `${n} min ago`, quiet: 'Quiet',
  noMotion: 'No motion in the last day', motionOn: 'motion', motionOff: 'quiet', timesUnit: 'times', over24h: 'over 24 h', nowRow: 'now', alarmIn: n => `Alarm, ${n}`,
  pendingIn: n => `Entry delay, ${n}`, firedAt: t => `sensor fired at ${t}`, firedUnknown: 'sensor not known',
  planAria: l => (l ? `House plan, motion in the last quarter hour: ${l}` : 'House plan, no motion in the last quarter hour'),
  andMore: (a, n) => `${a} and ${n} more`,
  motionRow: (n, l) => `${n}, last ${l}, history`,
  camLive: 'Live', camTap: 'tap for the live view', camOpen: n => `${n}, open the live view`, camShow: n => `${n}, show large`,
  camDown: 'Camera not responding', camLast: t => `Camera not responding, last image ${t}`,
  hourShort: 'h', tvIsOff: 'The TV is off', tvDown: 'The TV is not responding', since: (d, t) => `${d}, since ${t}`,
  lastUntil: (a, t) => `last ${a}, until ${t}`, turnOff: 'Turn off', turnOn: 'Turn on', remote: 'Remote',
  switchProfile: 'Switch profile', turnOffAria: 'Turn the TV off', turnOnAria: 'Turn the TV on',
  remoteAria: 'Remote: volume and playback', profileAria: n => `Switch the TV to the profile ${n}`, pinNote: 'the PIN is entered on the TV',
  yesterdayDur: d => `yesterday ${d}`, notWatched: 'Nothing watched yet today.', perDay: d => `${d} a day on average`,
  weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], byDay: l => `By day: ${l}`,
  conditions: {
    'clear-night': 'clear', cloudy: 'cloudy', exceptional: 'exceptional weather', fog: 'fog', hail: 'hail', lightning: 'thunder',
    'lightning-rainy': 'thunder and rain', partlycloudy: 'partly cloudy', pouring: 'downpour', rainy: 'rain', snowy: 'snow',
    'snowy-rainy': 'sleet', sunny: 'sunny', windy: 'windy', 'windy-variant': 'windy and cloudy'
  }
};

// The words the house's sensors write (the price level, the tomorrow line's lead word), as they
// arrive in each language: the house's templates write Estonian, the English demo English.
const ET_SENSOR = {
  tone: { 'väga odav': 'good', odav: 'good', tavaline: 'mid', 'kõrgevõitu': 'mid', kallis: 'high', 'väga kallis': 'high' },
  phrase: { tavaline: 'tavalise hinnaga' }, lead: 'Homme'
};

const EN_SENSOR = {
  tone: { 'very cheap': 'good', cheap: 'good', normal: 'mid', 'fairly high': 'mid', expensive: 'high', 'very expensive': 'high' },
  phrase: { normal: 'at its normal price' }, lead: 'Tomorrow'
};

const LANGS = { et: [ET, ET_SENSOR], en: [EN, EN_SENSOR] };

// a number in the language's format (the Estonian decimal comma), as many decimals as given or as
// the string carries
const NF = new Map();

const TEMPERATURE_ATTRS = new Set(['current_temperature', 'temperature']);

export default function init() {
  const icon = (key, size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key] || ICONS.bolt}</svg>`;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

  const hasValue = st => !!st && !NO_VALUE.has(st.state);

  const stateOf = (states, entity) => (states[entity] || {}).state;

  // the table of a language, Estonian for any other
  const words = lang => (LANGS[lang] || LANGS.et)[0];

  const sensorWords = lang => (LANGS[lang] || LANGS.et)[1];

  const LANGUAGES = Object.keys(LANGS);

  // "a", "a ja b", "a, b ja c", in English "a, b and c"
  function joinEt(list, lang = 'et') {
    if (list.length < 2) return list.join('');
    return `${list.slice(0, -1).join(', ')} ${words(lang).and} ${list[list.length - 1]}`;
  }

  function formatNumber(v, decimals, lang = 'et') {
    const s = String(v ?? ''), n = Number(s);
    if (s.trim() === '' || !Number.isFinite(n)) return null;
    const d = Math.min(2, decimals ?? (s.split('.')[1] || '').length), loc = words(lang).locale, k = `${loc}|${d}`;
    if (!NF.has(k)) NF.set(k, new Intl.NumberFormat(loc, { minimumFractionDigits: d, maximumFractionDigits: d }));
    return NF.get(k).format(n);
  }

  const withUnit = (n, unit) => (unit === '°C' ? `${n}°` : unit ? `${n} ${unit}` : n);

  // the lower-case state words the canvas uses in a tile's second line; HA's formatEntityState
  // capitalises and names each armed mode, where the design wants one "valves"
  function stateWord(st, lang = 'et') {
    const w = words(lang);
    if (!st) return w.words.unavailable;
    const s = st.state;
    if (s.startsWith('armed_')) return w.armed;
    if (Object.hasOwn(w.words, s)) return w.words[s];
    const n = formatNumber(s, undefined, lang);
    return n === null ? s : withUnit(n, (st.attributes || {}).unit_of_measurement);
  }

  function attrText(st, key, lang) {
    const v = st && st.attributes ? st.attributes[key] : undefined;
    if (v === undefined || v === null || v === '') return '';
    const n = typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)) ? formatNumber(v, undefined, lang) : null;
    if (n === null) return String(v);
    return TEMPERATURE_ATTRS.has(key) ? `${n}°` : n;
  }

  const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

  // a compressed history row's moment in ms (minimal_response: `lu`, the first row also `lc`)
  const rowTime = r => Math.round((r.lu ?? r.lc ?? 0) * 1000);

  // a state's number, null without a value
  const numOf = st => (hasValue(st) ? num(st.state) : null);

  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

  const unitOf = st => ((st || {}).attributes || {}).unit_of_measurement || '';

  // a value split for display: { value, unit } with the decimal comma, or the state word; `scale`
  // and `unit` show it in another unit than the entity's (HA states carry no display precision,
  // so `decimals` sets it)
  function splitValue(st, decimals, lang = 'et', { scale = 1, unit } = {}) {
    if (!hasValue(st)) return { value: stateWord(st, lang), unit: '' };
    const v = num(st.state), n = v === null ? null : formatNumber(scale === 1 ? st.state : String(v * scale), decimals, lang);
    if (n === null) return { value: stateWord(st, lang), unit: '' };
    const u = unit ?? unitOf(st);
    return u === '°C' ? { value: `${n}°`, unit: '' } : { value: n, unit: u };
  }

  // a split value as one string, "41 %" or "21,8°"
  const valueText = (st, decimals, lang, opts) => { const r = splitValue(st, decimals, lang, opts); return withUnit(r.value, r.unit); };

  const fmtN = (v, d, lang) => formatNumber(v.toFixed(d), d, lang);

  return { ICONS, icon, esc, NO_VALUE, hasValue, stateOf, words, sensorWords, LANGUAGES, joinEt, formatNumber, withUnit, stateWord, attrText, num, rowTime, numOf, cap, unitOf, splitValue, valueText, fmtN };
}
