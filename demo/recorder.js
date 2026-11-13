// The demo's recorder (ADR-012): HA's statistics and history, and the weather forecast (ADR-014),
// answered from the profiles in
// recorder.json (scripts/dashboard_demo.py demo_recorder()), relative to the moment asked, in the
// zone the demo sets, and the states that depend on the date computed from the same profiles, so a
// month total equals its days on any day. No DOM; the time-zone helpers are khe-cards.js's,
// passed in, so the tests run it in Node with the cards' own.

const HOUR = 3600e3, FIVE = 300e3, TAU = 2 * Math.PI;
const round = (v, d) => Number(v.toFixed(d));

// spec: recorder.json; tz: { zoneParts, dayStart, lastMonthName } from khe-cards.js
export function createRecorder(spec, { zoneParts, dayStart, lastMonthName }) {
  const zone = spec.zone, profiles = spec.profiles || {};
  // the hour of day of a moment; a whole hour's is remembered, as a month's sums ask for the
  // same hours again
  const hours = new Map();
  const hourOf = t => {
    if (t % HOUR) { const p = zoneParts(t, zone); return p.h + p.min / 60; }
    if (!hours.has(t)) { const p = zoneParts(t, zone); hours.set(t, p.h); }
    return hours.get(t);
  };

  const daily = (t, peak) => Math.cos((TAU * (hourOf(t) - peak)) / 24);
  // a slow drift over days and a small fixed ripple, the same on every load
  const drift = t => Math.sin((TAU * t) / (5.3 * 24 * HOUR));
  const ripple = t => Math.sin(t / (7.1 * HOUR)) * Math.cos(t / (2.3 * HOUR));
  // a counter's days differ: colder days, a weekend
  const vary = t => 1 + 0.18 * drift(t) + 0.1 * Math.sin(Math.floor(t / (24 * HOUR)) * 2.3);

  function price(p, t) {
    const h = hourOf(t);
    const bump = (at, w) => Math.exp(-(((h - at) / w) ** 2));
    return Math.max(0.02, p.base + p.morning * bump(8, 1.5) + p.evening * bump(18.5, 2) - p.night * bump(3, 2.5) + p.drift * drift(t) + 0.01 * ripple(t));
  }
  // mm in the hour of t: each shower's amount within its hours, less on some days and none on others
  const rain = (p, t) => {
    const h = hourOf(t), s = (p.showers || []).find(([a, b]) => h >= a && h < b);
    return s ? Math.max(0, s[2] * (0.4 + drift(hourStart(t)))) : 0;
  };
  // a value at t, or a counter's kWh in the hour starting at t
  function at(id, t) {
    const p = profiles[id];
    if (!p) return null;
    if (p.kind === 'rain') return rain(p, t);
    // the next hours' sum of another profile
    if (p.kind === 'ahead') { let s = 0; for (let k = 1; k <= p.hours; k++) s += at(p.of, hourStart(t) + k * HOUR); return s; }
    if (p.kind === 'wave') return p.level + p.amp * daily(t, p.peak) + p.drift * drift(t) + 0.15 * p.amp * ripple(t);
    if (p.kind === 'counter') return Math.max(0, (p.base + p.amp * daily(t, p.peak)) * vary(t) + 0.2 * p.base * ripple(t));
    if (p.kind === 'cost') return at(p.of, t) * price(profiles[p.price], t);
    if (p.kind === 'price') return price(p, t);
    return null;
  }
  const hourStart = t => Math.floor(t / HOUR) * HOUR;
  // a counter's kWh from a to b over the hours compiled by now (HA compiles an hour once it ends)
  function sum(id, a, b, now) {
    let s = 0;
    for (let t = hourStart(a); t < Math.min(b, hourStart(now)); t += HOUR) s += at(id, t);
    return s;
  }
  const dayOf = t => { const p = zoneParts(t, zone); return dayStart(p.y, p.m, p.d, zone); };
  const nextDay = t => { const p = zoneParts(t, zone); return dayStart(p.y, p.m, p.d + 1, zone); };
  const monthOf = (t, k = 0) => { const p = zoneParts(t, zone); return dayStart(p.y, p.m + k, 1, zone); };

  // the periods from start to now: [from, to) aligned as HA aligns them
  function periods(period, start, end) {
    const out = [];
    if (period === 'day') for (let a = dayOf(start); a < end; a = nextDay(a)) out.push([a, nextDay(a)]);
    else if (period === 'month') for (let a = monthOf(start); a < end; a = monthOf(a, 1)) out.push([a, monthOf(a, 1)]);
    else {
      const len = period === 'hour' ? HOUR : FIVE;
      for (let a = Math.floor(start / len) * len; a < end; a += len) out.push([a, a + len]);
    }
    return out;
  }
  function statistics(msg, now) {
    const start = Date.parse(msg.start_time), end = Math.min(msg.end_time ? Date.parse(msg.end_time) : now, now);
    const out = {};
    for (const id of msg.statistic_ids || []) {
      const p = profiles[id];
      if (!p || p.kind === 'duty') continue;
      const counter = p.kind === 'counter' || p.kind === 'cost';
      const rows = [];
      for (const [a, b] of periods(msg.period, start, end)) {
        const r = { start: a, end: b };
        if (counter) {
          // an hour not yet compiled has no row; a day sums the hours compiled so far
          if (a >= hourStart(now)) continue;
          r.change = round(sum(id, a, b, now), 3);
        } else {
          // a day's or a month's mean is over its hours
          const step = msg.period === 'day' || msg.period === 'month' ? HOUR : FIVE;
          const vals = [];
          for (let t = a; t < Math.min(b, now); t += step) vals.push(at(id, t));
          if (!vals.length) continue;
          r.mean = round(vals.reduce((x, v) => x + v, 0) / vals.length, 3);
          r.min = round(Math.min(...vals), 3);
          r.max = round(Math.max(...vals), 3);
        }
        rows.push(r);
      }
      if (rows.length) out[id] = rows;
    }
    return out;
  }
  // a PIR's or a door's rows (ADR-015): off at the start, short on-events by its hours of the day
  // (how many in an hour varies by the hour, the same on every load), none in the quiet minutes
  // before its last change, which is its catalogue state `ago` minutes back
  const frac = x => { const v = Math.sin(x * 12.9898) * 43758.5453; return v - Math.floor(v); };
  function pulses(p, start, end, now) {
    const last = now - p.ago * 60e3, stop = now - Math.max(p.ago, p.quiet || 0) * 60e3 - 60e3;
    const rows = [{ s: 'off', lu: start / 1000 }], add = (t, s) => { if (t > start && t <= end) rows.push({ s, lu: t / 1000 }); };
    for (let h = Math.floor(start / HOUR) * HOUR; h < stop; h += HOUR) {
      const at = hourOf(h), rate = ((p.hours || []).find(([a, b]) => at >= a && at < b) || [0, 0, 0])[2];
      const n = Math.round(rate * (0.4 + 1.2 * frac(h / HOUR + p.seed * 7.3)));
      for (let k = 0; k < n; k++) {
        const t = h + ((k + 0.2 + 0.6 * frac(h / HOUR + k + p.seed)) / n) * HOUR;
        if (t + 45e3 < stop) { add(t, 'on'); add(t + 45e3, 'off'); }
      }
    }
    if (p.state === 'on') add(last, 'on');
    else { add(last - 40e3, 'on'); add(last, 'off'); }
    return rows;
  }
  function history(msg, now) {
    const start = Date.parse(msg.start_time), end = Math.min(msg.end_time ? Date.parse(msg.end_time) : now, now);
    const out = {};
    for (const id of msg.entity_ids || []) {
      const p = profiles[id];
      if (!p) continue;
      const rows = [];
      if (p.kind === 'wave') {
        for (let t = Math.ceil(start / FIVE) * FIVE; t <= end; t += FIVE) rows.push({ s: at(id, t).toFixed(p.decimals), lu: t / 1000 });
      } else if (p.kind === 'pulses') {
        rows.push(...pulses(p, start, end, now));
      } else if (p.kind === 'duty') {
        const on = t => p.on.some(([a, b]) => hourOf(t) >= a && hourOf(t) < b);
        let last = null;
        for (let t = Math.floor(start / HOUR) * HOUR; t <= end; t += HOUR) {
          const s = p.states[on(t) ? 1 : 0];
          if (s !== last) rows.push({ s, lu: Math.max(t, start) / 1000 });
          last = s;
        }
      }
      if (rows.length) out[id] = rows;
    }
    return out;
  }

  // the weather entity's hourly forecast from the hour now, as weather.get_forecasts answers it
  // (ADR-014): the rain and outdoor profiles' hours, rain or snow while it rains
  const condition = (mm, temp, t) => (mm > 0 ? (temp <= 0 ? 'snowy' : 'rainy') : ripple(t) > 0 ? 'cloudy' : 'partlycloudy');
  function forecast(now, hours = spec.weather.hours) {
    const w = spec.weather, rows = [];
    for (let i = 0, t = hourStart(now); i < hours; i++, t += HOUR) {
      const mm = round(at(w.rain, t), 1), temp = round(at(w.temperature, t), 1);
      rows.push({ datetime: new Date(t).toISOString(), temperature: temp, precipitation: mm, condition: condition(mm, temp, t) });
    }
    return rows;
  }
  const forecastCall = msg => msg.type === 'call_service' && msg.domain === 'weather' && msg.service === 'get_forecasts' && msg.return_response
    && spec.weather && [(msg.target || {}).entity_id].flat().includes(spec.weather.entity);

  // HA's WebSocket answer to one message, as a Promise
  function callWS(msg, now = Date.now()) {
    if (msg.type === 'recorder/statistics_during_period') return Promise.resolve(statistics(msg, now));
    if (msg.type === 'history/history_during_period') return Promise.resolve(history(msg, now));
    if (forecastCall(msg)) return Promise.resolve({ context: null, response: { [spec.weather.entity]: { forecast: forecast(now) } } });
    return Promise.reject(new Error(`unknown command ${msg.type}`));
  }

  // { entity: { state, attributes } } of the states that follow the date, in the language's
  // decimal mark: measurements now, counters since their start, the house's totals with their
  // cost and price, last month's values, today's and tomorrow's prices and the level now.
  // levels: [[upper bound in €/kWh or null, word], ...] and hinnang: { below, near, above }, the
  // level's sentence by the price now against the day's average, from the states file.
  function dated(now = Date.now(), { comma = true, levels = [], hinnang = {} } = {}) {
    const n = (v, d) => (comma ? v.toFixed(d).replace('.', ',') : v.toFixed(d));
    const out = {};
    const m0 = monthOf(now), m1 = monthOf(now, -1), d0 = dayOf(now), d1 = dayOf(d0 - 1);
    for (const [id, p] of Object.entries(profiles)) {
      if (!id.includes('.')) continue;
      // a measurement's state is its last five-minute reading, where its history ends
      if (p.kind === 'wave') out[id] = { state: at(id, Math.floor(now / FIVE) * FIVE).toFixed(p.decimals) };
      if (p.kind === 'rain' || p.kind === 'ahead') out[id] = { state: at(id, now).toFixed(1) };

      if (p.kind === 'counter' && p.state) {
        const attributes = {};
        if (p.last) {
          const last = round(sum(id, m1, m0, now), 1);
          if (p.last === 'month') {
            // Daikin names this year's months and last year's as Last <Month>
            const name = lastMonthName(now, zone, 'en-US');
            attributes[zoneParts(now, zone).m === 1 ? `Last ${name}` : name] = String(last);
          } else attributes[p.last] = String(last);
        }
        out[id] = { state: sum(id, p.state === 'day' ? d0 : m0, now, now).toFixed(1), attributes };
      }
    }
    const h = spec.house;
    if (h) {
      const total = (a, b, withPrice) => {
        const kwh = sum(h.consumption, a, b, now), cost = sum(h.cost, a, b, now);
        const attributes = { kulu: `${n(cost, 2)} €` };
        // the house's template writes the average price in cents
        if (withPrice) attributes.hind = `${n(kwh ? (cost / kwh) * 100 : 0, 1)} c/kWh`;

        return { state: kwh.toFixed(1), attributes };
      };
      out[h.today] = total(d0, now);
      out[h.yesterday] = total(d1, d0);
      out[h.month] = total(m0, now, true);
      out[h.last_month] = total(m1, m0, true);
    }
    const f = spec.forecast;
    if (f) {
      const pr = profiles[f.price], prices = [];
      for (let t = d0; t < nextDay(nextDay(d0)); t += HOUR) prices.push({ s: t / 1000, t: round(price(pr, t), 4) });
      out[f.entity] = { state: String(prices.filter(x => x.s * 1000 >= hourStart(now)).length), attributes: { prices } };
      const p = price(pr, hourStart(now));
      const word = (levels.find(([upper]) => upper === null || p < upper) || [null, ''])[1];
      const today = prices.slice(0, prices.findIndex(x => x.s * 1000 >= nextDay(d0)));
      const ratio = p / (today.reduce((a, x) => a + x.t, 0) / today.length);
      const attributes = { arvel: round(p * 100, 1), senti: round(Math.max(0, p - f.fees) * 100, 1) };
      const said = hinnang[ratio < 0.95 ? 'below' : ratio > 1.05 ? 'above' : 'near'];
      if (said) attributes.hinnang = said;
      out[f.level] = { state: word, attributes };

    }
    // the weather entity's condition and temperature now, the forecast's first hour
    if (spec.weather) {
      const [h] = forecast(now, 1);
      out[spec.weather.entity] = { state: h.condition, attributes: { temperature: h.temperature } };
    }
    // each rule's last run: the last time the clock read its hour and minute
    for (const [id, [hr, min]] of Object.entries(spec.rules || {})) {
      const p = zoneParts(now, zone);
      // the hour read on the zone's clock, also on a day an hour longer or shorter
      const clock = d => { const t = dayStart(p.y, p.m, d, zone) + hr * HOUR + min * 60e3; return t - (((zoneParts(t, zone).h - hr + 36) % 24) - 12) * HOUR; };
      let t = clock(p.d);
      if (t > now) t = clock(p.d - 1);
      out[id] = { state: 'on', attributes: { last_triggered: new Date(t).toISOString() } };
    }
    return out;
  }

  return { callWS, dated };
}
