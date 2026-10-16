// The dashboard's charts as SVG, drawn from the made-up series in series.json: HA's
// statistics-graph and history-graph, the apexcharts-card subset the generator uses (columns
// and step lines, a colour threshold, the now marker) and weather-forecast's hourly row. Each
// takes the card's config, the series, the time and the width to draw at, and returns markup.
// No DOM and no eval, so the CSP holds and the tests load it in Node.
import { svg, WEATHER } from './icons.js?v=__DEMO_VERSION__';

const esc = s => String(s).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const PALETTE = ['#4269d0', '#efb118', '#ff725c', '#6cc5b0', '#3ca951', '#ff8ab7', '#a463f2', '#97bbf5'];
const HOUR = 3600e3, DAY = 24 * HOUR;
const fmt = d => new Intl.NumberFormat('et-EE', { minimumFractionDigits: d, maximumFractionDigits: d });
const hhmm = new Intl.DateTimeFormat('et-EE', { hour: '2-digit', minute: '2-digit' });
const dayMonth = new Intl.DateTimeFormat('et-EE', { day: 'numeric', month: 'short' });
const monthYear = new Intl.DateTimeFormat('et-EE', { month: 'short', year: '2-digit' });
const weekday = new Intl.DateTimeFormat('et-EE', { weekday: 'short' });

const midnight = now => new Date(now.getFullYear(), now.getMonth(), now.getDate());

// a series' points as [time ms, value] from its step and offsets
export function points(s, now) {
  if (!s || !s.points) return [];
  const day0 = midnight(now);
  return s.points.map(([o, v]) => {
    let t;
    if (s.step === 'hour') t = now.getTime() + o * HOUR;
    else if (s.step === 'hour_of_today') t = day0.getTime() + o * HOUR;
    else if (s.step === 'month') t = new Date(now.getFullYear(), now.getMonth() + o, 1).getTime();
    else t = new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() + o).getTime();
    return [t, v];
  });
}

// round axis ticks: 0..max in 3-5 steps of 1, 2 or 5 times a power of ten
function ticks(lo, hi) {
  if (hi <= lo) hi = lo + 1;
  const raw = (hi - lo) / 4, p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
  const out = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(Number(v.toFixed(6)));
  if (out[out.length - 1] < hi) out.push(Number((out[out.length - 1] + step).toFixed(6)));
  return { out, step, dec: Math.max(0, -Math.floor(Math.log10(step) + 1e-9)) };
}

// the frame: a value axis on the left, grid lines, time labels underneath
function frame(width, height, yTicks, xLabels, left) {
  const top = 8, bottom = height - 22, right = width - 8;
  const y = v => bottom - ((v - yTicks.out[0]) / (yTicks.out[yTicks.out.length - 1] - yTicks.out[0])) * (bottom - top);
  const f = fmt(yTicks.dec);
  let m = '';
  for (const v of yTicks.out) m += `<line class="grid" x1="${left}" x2="${right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="ylab" x="${left - 6}" y="${(y(v) + 4).toFixed(1)}">${f.format(v)}</text>`;
  for (const [x, text] of xLabels) m += `<text class="xlab" x="${x.toFixed(1)}" y="${height - 6}">${esc(text)}</text>`;
  return { top, bottom, right, y, markup: m };
}

const legend = items => `<div class="legend">${items.map(([name, color]) => `<span><i style="background:${color}"></i>${esc(name)}</span>`).join('')}</div>`;
const svgOpen = (w, h, label) => `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">`;

// x labels at most every `every` px: the first point of each new label text
function xLabels(times, x, label, every = 56) {
  const out = [];
  let last = -Infinity, prev = null;
  for (const t of times) {
    const text = label(t);
    if (text === prev) continue;
    prev = text;
    if (x(t) - last < every) continue;
    out.push([x(t), text]);
    last = x(t);
  }
  return out;
}

export function statisticsGraph(conf, series, now, width = 400) {
  const days = conf.days_to_show || 7, height = 180, stack = conf.chart_type === 'bar-stack';
  const ents = conf.entities.map((e, i) => ({ name: e.name || e.entity, color: PALETTE[i % PALETTE.length], pts: points(series[e.entity], now).slice(-days) }));
  const times = [...new Set(ents.flatMap(e => e.pts.map(p => p[0])))].sort((a, b) => a - b);
  if (!times.length) return '<p class="nodata">Andmed puuduvad</p>';
  const sums = times.map(t => ents.reduce((s, e) => s + (stack ? ((e.pts.find(p => p[0] === t) || [0, 0])[1]) : 0), 0));
  const max = stack ? Math.max(...sums) : Math.max(...ents.flatMap(e => e.pts.map(p => p[1])));
  const yt = ticks(0, max * 1.05), left = 40;
  const slot = (width - left - 8) / times.length;
  const x = t => left + slot * (times.indexOf(t) + 0.5);
  const fr = frame(width, height, yt, xLabels(times, x, t => dayMonth.format(t), 52), left);
  let bars = '';
  times.forEach((t, i) => {
    let base = 0;
    const w = stack ? slot * 0.7 : (slot * 0.8) / ents.length;
    ents.forEach((e, k) => {
      const v = (e.pts.find(p => p[0] === t) || [0, 0])[1];
      if (!v) return;
      const x0 = stack ? x(t) - w / 2 : left + slot * i + slot * 0.1 + w * k;
      const y1 = fr.y(base + v), y0 = fr.y(base);
      bars += `<rect x="${x0.toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(1, w - 1).toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" rx="2" fill="${e.color}"><title>${esc(e.name)}: ${fmt(1).format(v)}</title></rect>`;
      if (stack) base += v;
    });
  });
  return `${svgOpen(width, height, conf.entities.map(e => e.name).join(', '))}${fr.markup}${bars}</svg>${conf.hide_legend ? '' : legend(ents.map(e => [e.name, e.color]))}`;
}

export function historyGraph(conf, series, now, width = 400, nameOf = e => e) {
  const hours = conf.hours_to_show || 24, height = 180, from = now.getTime() - hours * HOUR;
  const ents = conf.entities.map((e, i) => ({ name: e.name || nameOf(e.entity), color: PALETTE[i % PALETTE.length], pts: points(series[e.entity], now).filter(p => p[0] >= from) }));
  const all = ents.flatMap(e => e.pts.map(p => p[1]));
  if (!all.length) return '<p class="nodata">Andmed puuduvad</p>';
  const yt = ticks(Math.min(...all) - 0.5, Math.max(...all) + 0.5), left = 36;
  const x = t => left + ((t - from) / (now.getTime() - from)) * (width - left - 8);
  const marks = [];
  for (let t = Math.ceil(from / (6 * HOUR)) * 6 * HOUR; t <= now.getTime(); t += 6 * HOUR) marks.push(t);
  const fr = frame(width, height, yt, xLabels(marks, x, t => hhmm.format(t), 44), left);
  const lines = ents.map(e => `<polyline fill="none" stroke="${e.color}" stroke-width="2" stroke-linejoin="round" points="${e.pts.map(p => `${x(p[0]).toFixed(1)},${fr.y(p[1]).toFixed(1)}`).join(' ')}"/>`).join('');
  return `${svgOpen(width, height, ents.map(e => e.name).join(', '))}${fr.markup}${lines}</svg>${legend(ents.map(e => [e.name, e.color]))}`;
}

const spanMs = s => {
  const m = /^(\d+)([hd])$/.exec(s || '1d');
  return m ? Number(m[1]) * (m[2] === 'h' ? HOUR : DAY) : DAY;
};
const thresholdColor = (v, list) => (list || []).reduce((c, t) => (v >= t.value ? t.color : c), (list && list[0] && list[0].color) || PALETTE[0]);

export function apexChart(conf, series, now, width = 400) {
  const height = Math.min(260, ((conf.apex_config || {}).chart || {}).height || 220);
  const span = spanMs(conf.graph_span), day0 = midnight(now).getTime();
  const sp = conf.span || {};
  let from, to;
  if (sp.start === 'day') { from = day0; to = day0 + span; }
  else if (sp.end === 'month') { to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(); from = to - span; }
  else { to = day0 + DAY; from = to - span; }
  const list = conf.series.map((s, i) => ({ ...s, pts: points(series[`${s.entity}|${s.name}`], now).filter(p => p[0] >= from && p[0] < to), color: s.color || PALETTE[i % PALETTE.length] }));
  const all = list.flatMap(s => s.pts.map(p => p[1]));
  if (!all.length) return '<p class="nodata">Andmed puuduvad</p>';
  const y0 = ((conf.yaxis || [])[0] || {}).min ?? Math.min(...all);
  const yt = ticks(y0, Math.max(...all) * 1.05);
  const dec = ((conf.yaxis || [])[0] || {}).decimals;
  if (dec !== undefined) yt.dec = Math.max(yt.dec, Math.min(dec, 2));
  const left = 40;
  const x = t => left + ((t - from) / (to - from)) * (width - left - 8);
  const stepOf = s => (s.pts.length > 1 ? s.pts[1][0] - s.pts[0][0] : DAY);
  const label = span > 400 * DAY ? t => monthYear.format(t) : span > 3 * DAY ? t => dayMonth.format(t) : t => (new Date(t).getHours() === 0 ? weekday.format(t) : hhmm.format(t));
  const marks = list[0].pts.map(p => p[0]).filter(t => span > 3 * DAY || new Date(t).getHours() % 6 === 0);
  const fr = frame(width, height, yt, xLabels(marks, x, label, span > 3 * DAY ? 52 : 40), left);
  let m = '';
  for (const s of list) {
    const step = stepOf(s), w = Math.max(1, (x(from + step) - x(from)) * 0.8);
    if (s.type === 'column') {
      for (const [t, v] of s.pts) {
        const c = conf.experimental && conf.experimental.color_threshold && s.color_threshold ? thresholdColor(v, s.color_threshold) : s.color;
        m += `<rect x="${(x(t + step / 2) - w / 2).toFixed(1)}" y="${fr.y(v).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, fr.y(yt.out[0]) - fr.y(v)).toFixed(1)}" fill="${c}"><title>${esc(s.name)}: ${fmt(3).format(v)}</title></rect>`;
      }
    } else {
      const d = s.pts.map(([t, v], i) => {
        const xa = x(t), xb = x(t + step), yy = fr.y(v).toFixed(1);
        return s.curve === 'stepline' ? `${i ? 'L' : 'M'}${xa.toFixed(1)} ${yy}L${xb.toFixed(1)} ${yy}` : `${i ? 'L' : 'M'}${x(t + step / 2).toFixed(1)} ${yy}`;
      }).join('');
      m += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.stroke_width || 2}"/>`;
    }
  }
  if (conf.now && conf.now.show && now.getTime() >= from && now.getTime() <= to) {
    const xn = x(now.getTime()).toFixed(1);
    m += `<line class="now" x1="${xn}" x2="${xn}" y1="${fr.top}" y2="${fr.bottom}"/><text class="nowlab" x="${xn}" y="${fr.top + 10}">${esc(conf.now.label || '')}</text>`;
  }
  const showLegend = ((conf.apex_config || {}).legend || {}).show;
  const legendColor = s => (s.type === 'column' && s.color_threshold ? thresholdColor(0, s.color_threshold) : s.color);
  return `${svgOpen(width, height, list.map(s => s.name).join(', '))}${fr.markup}${m}</svg>${showLegend ? legend(list.map(s => [s.name, legendColor(s)])) : ''}`;
}

export function weatherForecast(conf, series, now, width = 400) {
  const f = ((series[conf.entity] || {}).forecast || []);
  if (!f.length) return '<p class="nodata">Prognoos puudub</p>';
  const n = Math.max(3, Math.min(f.length, Math.floor(width / 56)));
  const base = new Date(now);
  base.setMinutes(0, 0, 0);
  return `<div class="forecast">${f.slice(0, n).map(i => `<div class="fc">
    <span class="fc-time">${hhmm.format(base.getTime() + i.h * HOUR)}</span>${svg(WEATHER[i.condition] || 'weather-cloudy', 'fc-icon')}
    <span class="fc-temp">${fmt(0).format(i.temperature)}°</span><span class="fc-rain">${i.precipitation ? `${fmt(1).format(i.precipitation)} mm` : ''}</span></div>`).join('')}</div>`;
}

export const CHARTS = { 'statistics-graph': statisticsGraph, 'history-graph': historyGraph, 'custom:apexcharts-card': apexChart, 'weather-forecast': weatherForecast };
