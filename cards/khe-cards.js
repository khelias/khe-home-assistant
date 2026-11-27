// Home Assistant cards of the redesigned views (ADR-002, ADR-005): khe-summary-card,
// khe-price-card, khe-tile-card and, for Kodu A3, khe-chips-card, khe-heading-card and
// khe-status-card, with `style: a3` drawing glass boxes and a tap opening a history sheet;
// Energia's month, days and split cards (ADR-008), a days card's long-range sheet (ADR-013),
// Soojuspump's reading card (ADR-011), Pergola's forecast card (ADR-014) and Valve's motion card
// with the cells-only reading card, both on state history (ADR-015), Kaamerad's stills (ADR-016)
// and Teler's now and watch-time cards with a stacked days series (ADR-017).
// No build step and no CDN: this entry point loads ./parts/*.js with ?v=${KHE_CARDS_VERSION} and
// retry, wires the custom elements and re-exports the pure helpers for Node tests and the demo.
// Bump KHE_CARDS_VERSION on every change under cards/, and the same ?v= on the Lovelace
// resource URL: HA's /local and the phone app cache aggressively.
export const KHE_CARDS_VERSION = 31;

const CORE_PARTS = ['i18n', 'core', 'sheet', 'base'];
const LEAF_PARTS = ['front', 'tile', 'energy', 'reading', 'forecast', 'motion', 'media'];
const ALL_PARTS = [...CORE_PARTS, ...LEAF_PARTS];

async function importRetry(urlFor, { tries = 2, delay = 1500 } = {}) {
  let err;
  for (let n = 0; n < tries; n++) {
    if (n) await new Promise(r => setTimeout(r, delay));
    const url = urlFor(n);
    try {
      return await import(url);
    } catch (e) {
      err = e;
      console.error(`khe-cards: loading ${url} failed: ${(e && e.message) || e}`, e);
    }
  }
  throw err;
}

const partUrl = (name, retry) => `./parts/${name}.js?v=${KHE_CARDS_VERSION}${retry ? `&r=${retry}` : ''}`;

// Fetch every module in one parallel burst, then wire core -> sheet -> base -> leaves.
// A failed core module stops registration; a failed leaf logs an error and drops only its own cards.
const settled = await Promise.allSettled(ALL_PARTS.map(name => importRetry(n => partUrl(name, n))));
const loaded = Object.fromEntries(ALL_PARTS.map((name, i) => [name, settled[i]]));

for (const name of CORE_PARTS) {
  if (loaded[name].status === 'rejected') throw loaded[name].reason;
}

const i18n = loaded.i18n.value.default();
const core = loaded.core.value.default(i18n);
const sheet = loaded.sheet.value.default({ ...i18n, ...core });
const base = loaded.base.value.default({ ...i18n, ...core, ...sheet });
const ctx = { ...i18n, ...core, ...sheet, ...base };

const leaves = {};
const elements = [];
for (const name of LEAF_PARTS) {
  const res = loaded[name];
  if (res.status === 'rejected') {
    console.error(`khe-cards: skipping ${name} cards after load failure`, res.reason);
    leaves[name] = { exports: {}, elements: [] };
    continue;
  }
  const mod = res.value.default(ctx);
  leaves[name] = mod;
  elements.push(...mod.elements);
}

if (typeof customElements !== 'undefined') {
  window.customCards = window.customCards || [];
  for (const [tag, cls, name, description] of elements) {
    if (customElements.get(tag)) continue;
    customElements.define(tag, cls);
    window.customCards.push({ type: tag, name, description });
  }
}

export const {
  words, sensorWords, LANGUAGES, joinEt, formatNumber, stateWord, splitValue
} = i18n;

export const {
  palette, a3Palette, actionDetail, tileAction, modeAction, priceLevel, priceBars, levelTone, parseEt, zoneParts, dayStart, monthSpan, dayStarts, inLastMonth, dayName, hourSpan, whenLabel, nearest, lastMonthName, whenText, shortWhen, agoText, dailyRequest, hourlyRequest, dataCutoff, dailySeries, dayStats, stateHistoryRequest, onTimes, mergeTimes, liveOn, historyStale, minuteKeyOf, hourlyCounts, binHours, stateIs, statusLine, cellSheet, countCell, cellValue, cellTone, cellsClass, cellNote, durText, colText, todayHours
} = core;

export const {
  RANGES, historyRequest, seriesFrom, countSeries, lineStats, stepStats, barStats, barRect, chartPaths, axisLabel, axisLabels, DAYS_RANGES, daysRange, daysSheetRequest, slotSeries, usageSheet, daysSheet, daysRequests
} = sheet;

export const {
  sentence, securityText, peopleText, chips, statusItems
} = leaves.front.exports;

export const {
  tileActive, tileState, tileWatched, tileDay, tileSheet, buttonOn, brightnessPct, pctAt, sliderAction, tileA3Markup
} = leaves.tile.exports;

export const {
  monthPace, lastMonthValue, splitRows, withOverlay, daysTop, dayRatio, ratioHeadline, dayPoint, dayCells, stackPoints, stackStats, stackLabel, stackAria
} = leaves.energy.exports;

export const {
  lineRequest, lineSeries, lineRange, lineAxis, stepText, stepNote, stepValue, stepWrite, meterRow, readingWatched, readingA3Markup
} = leaves.reading.exports;

export const {
  forecastRequest, wetCondition, forecastHours, forecastSummary, hourAt, forecastNote, forecastPaths, forecastPoint, forecastA3Markup
} = leaves.forecast.exports;

export const {
  motionRows, motionHeadline, rowLast, sharedEdge, planGraph, shortestPath, trailRooms, trailRuns, catmullRom, growRect, wallSpans, houseRects, planSvg, motionA3Markup
} = leaves.motion.exports;

export const {
  cameraUrl, cameraSlot, cameraThumbs, todaySessions, tvNow, usageToday, sessionRows
} = leaves.media.exports;
