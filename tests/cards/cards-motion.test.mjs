// Tests of A3 Valve (ADR-015): state history, house plan, trail and motion card helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cards as V, cards as A3, st, TZ, fixture } from './cards-harness.mjs';

const PLAN = fixture('plan.json');
const T0 = Date.parse('2026-11-13T16:24:00+02:00');
const min = n => T0 - n * 60e3;
const sec = t => t / 1000;

test('Valve: one history message for every entity over 24 h, minimal and without attributes', () => {
  const m = V.stateHistoryRequest(['binary_sensor.a', 'binary_sensor.b'], T0);
  assert.deepEqual(m, {
    type: 'history/history_during_period', start_time: new Date(T0 - 24 * 3600e3).toISOString(), end_time: new Date(T0).toISOString(),
    entity_ids: ['binary_sensor.a', 'binary_sensor.b'], minimal_response: true, no_attributes: true
  });
});

test('Valve: only off-to-on changes count; the first row is the state at the start, not an event', () => {
  const resp = {
    'binary_sensor.a': [{ s: 'on', lu: sec(min(600)) }, { s: 'off', lu: sec(min(500)) }, { s: 'on', lu: sec(min(400)) }, { s: 'off', lu: sec(min(399)) }],
    'binary_sensor.b': [{ s: 'off', lu: sec(min(600)) }, { s: 'unavailable', lu: sec(min(300)) }, { s: 'on', lu: sec(min(299)) }, { s: 'off', lu: sec(min(200)) }, { s: 'on', lu: sec(min(100)) }]
  };
  assert.deepEqual(V.onTimes(resp, ['binary_sensor.a', 'binary_sensor.b', 'binary_sensor.c']), {
    'binary_sensor.a': [min(400)], 'binary_sensor.b': [min(100)], 'binary_sensor.c': []
  });
});

test("Valve: 24 hourly counts in HA's zone, the last the hour now; a half-hour zone starts its hours at :30", () => {
  const now = Date.parse('2026-11-13T16:24:00Z');
  const t = [Date.parse('2026-11-13T16:01:00Z'), Date.parse('2026-11-13T15:59:00Z'), Date.parse('2026-11-12T16:30:00Z'), Date.parse('2026-11-12T16:59:00Z'), now + 60e3];
  const utc = V.hourlyCounts(t, now, 'UTC');
  assert.equal(utc.length, 24);
  assert.deepEqual([utc[23], utc[22], utc[0]], [1, 1, 0]);
  assert.equal(utc.reduce((a, v) => a + v, 0), 2, 'yesterday 16:xx is out, a moment after now is out');
  // Kolkata is UTC+5:30: its hour now began at 15:30 UTC, so 15:59 and 16:01 share the last bin
  const ist = V.hourlyCounts(t, now, 'Asia/Kolkata');
  assert.equal(ist[23], 2);
  assert.equal(ist[0], 2, '16:30 and 16:59 yesterday UTC are 22:00 and 22:29 IST, the first of the 24 hours');
  assert.deepEqual(V.binHours(now, 'Asia/Kolkata').slice(-2), ['20', '21']);
});

test('Valve: a history card reloads on connect only after five minutes, and redraws by the minute', () => {
  assert.equal(V.historyStale({ now: T0 - 4 * 60e3, res: {} }, T0), false);
  assert.equal(V.historyStale({ now: T0 - 6 * 60e3, res: {} }, T0), true);
  assert.equal(V.historyStale({ error: true }, T0), false, 'an error waits for its own retry');
  assert.equal(V.historyStale(null, T0), false);
  assert.equal(V.minuteKeyOf(T0 + 59e3), V.minuteKeyOf(T0));
  assert.notEqual(V.minuteKeyOf(T0 + 60e3), V.minuteKeyOf(T0));
});

test('Valve: live off-to-on changes merge with the history, once to the second', () => {
  const off = { state: 'off', last_changed: new Date(min(5)).toISOString() };
  const on = { state: 'on', last_changed: new Date(min(2)).toISOString() };
  assert.deepEqual(V.liveOn(null, { 'binary_sensor.a': on }, ['binary_sensor.a']), {}, 'the first states seen are no change');
  assert.deepEqual(V.liveOn({ 'binary_sensor.a': off }, { 'binary_sensor.a': on }, ['binary_sensor.a']), { 'binary_sensor.a': min(2) });
  assert.deepEqual(V.liveOn({ 'binary_sensor.a': on }, { 'binary_sensor.a': { ...on, state: 'off' } }, ['binary_sensor.a']), {});
  assert.deepEqual(V.liveOn({ 'binary_sensor.a': on }, { 'binary_sensor.a': on }, ['binary_sensor.a']), {});
  assert.deepEqual(V.mergeTimes([min(30), min(2) + 120], [min(2), min(1)]), [min(30), min(2), min(1)], 'the same second once');
});

const fixtureGraph = () => V.planGraph(PLAN);
const inside = (p, r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];
const rectsOf = id => PLAN.rooms.find(r => r.id === id).rects;

test('Valve: the plan slice carries rooms, walls with doors and the placed PIRs, no devices', () => {
  assert.deepEqual(Object.keys(PLAN).sort(), ['pirs', 'rooms', 'walls']);
  assert.ok(PLAN.walls.some(w => w.doors.length));
  assert.ok(!PLAN.pirs.some(p => p.entity === 'binary_sensor.demo_room_a_motion'), 'a PIR the model does not place is not in it');
});

test('Valve: an open passage joins two rooms with no wall between them', () => {
  const g = fixtureGraph();
  // the hall opens into the gallery and the gallery into the kitchen and living room, no door in either
  const p = V.shortestPath(g, g.anchor.r3, g.anchor.r1);
  assert.ok(p, 'hall to kitchen');
  assert.ok(p.some(q => rectsOf('r8').some(r => inside(q, r))), 'through the gallery');
  assert.equal(V.sharedEdge([0, 0, 2, 2], [2.1, 1, 4, 4]).axis, 0);
  assert.equal(V.sharedEdge([0, 0, 2, 2], [3, 0, 4, 2]), null, 'too far apart');
});

test('Valve: an L-shaped hall is walked through its rects, and a door joins the rooms on both sides', () => {
  const g = fixtureGraph();
  const p = V.shortestPath(g, g.anchor.r5, g.anchor.r4);
  assert.ok(p, "children's room to bathroom");
  for (const r of rectsOf('r3')) assert.ok(p.some(q => inside(q, r)), `through ${r}`);
  assert.ok(V.shortestPath(g, g.anchor.carport, g.anchor.r3), 'carport through the utility room');
});

test('Valve: a room with no way to the next is a gap in the trail, not a reason to drop it', () => {
  const closed = { ...PLAN, walls: PLAN.walls.map(w => ({ ...w, doors: w.doors.filter(([c]) => !(w.a[0] === 31 && w.a[1] === 4 && c === 4)) })) };
  const g = V.planGraph(closed);
  assert.equal(V.shortestPath(g, g.anchor.carport, g.anchor.r3), null);
  const runs = V.trailRuns(g, [{ room: 'carport', t: min(10) }, { room: 'r3', t: min(5) }, { room: 'r1', t: min(1) }]);
  assert.equal(runs.length, 2);
  assert.equal(runs[0].length, 1);
  assert.ok(runs[1].length > 2);
  assert.match(V.catmullRom(runs[0]), /^M[\d.]+ [\d.]+h0\.01$/);
  assert.equal((V.catmullRom(runs[1]).match(/C/g) || []).length, runs[1].length - 1);
});

test('Valve: two rooms are one walk only when they are next to each other and the second fired soon after the first', () => {
  const g = fixtureGraph(), sensed = new Set(PLAN.pirs.map(p => p.room));
  const at = (room, t, times = [t]) => ({ room, t, times });
  const walk = V.trailRuns(g, [at('r1', min(5)), at('r3', min(4))], sensed);
  assert.equal(walk.length, 1, 'kitchen to hall a minute later: one person');
  assert.equal(V.trailRuns(g, [at('r1', min(9)), at('r3', min(1))], sensed).length, 2, 'the hall fired eight minutes after the kitchen: two people');
  assert.equal(V.trailRuns(g, [at('r1', min(9)), at('r3', min(1), [min(8), min(1)])], sensed).length, 1, 'the hall fired a minute after the kitchen, and again since');
  assert.equal(V.trailRuns(g, [at('r1', min(3)), at('r5', min(2))], sensed).length, 2, "kitchen to the children's room crosses the hall, which did not fire: two people");
  assert.equal(V.trailRuns(g, [at('r1', min(3)), at('r5', min(2))]).length, 1, 'without the sensed rooms a path alone joins them');
});

const row = (entity, last, on = false) => ({ entity, name: entity, times: last === null ? [] : [last], on, last: on ? T0 : last });

test('Valve: the trail is each room once by its last motion, the last five, inside 15 minutes', () => {
  const rows = [
    row('binary_sensor.test_kitchen_motion', min(9)), row('binary_sensor.test_living_motion', min(4)),
    row('binary_sensor.test_hall_motion', min(6)), row('binary_sensor.test_bath_motion', min(15)),
    row('binary_sensor.test_bedroom_motion', min(16)), row('binary_sensor.test_carport_motion', null),
    row('binary_sensor.demo_room_a_motion', min(1))
  ];
  assert.deepEqual(V.trailRooms(PLAN, rows, T0).map(x => x.room), ['r4', 'r3', 'r1'], 'the bedroom is past 15 minutes, the unplaced PIR is out, two PIRs light r1 once');
  assert.deepEqual(V.trailRooms(PLAN, rows, T0, 15, 2).map(x => x.room), ['r3', 'r1']);
  assert.deepEqual(V.trailRooms(PLAN, rows, T0, 20).map(x => x.room), ['r2', 'r4', 'r3', 'r1']);
  const every = { ...PLAN, pirs: PLAN.rooms.map(r => ({ entity: `binary_sensor.${r.id}`, room: r.id })) };
  const busy = PLAN.rooms.map((r, i) => row(`binary_sensor.${r.id}`, min(10 - i)));
  assert.deepEqual(V.trailRooms(every, busy, T0).map(x => x.room), PLAN.rooms.slice(-5).map(r => r.id), 'six rooms or more keep the last five');
});

test('Valve: the plan tints every room with motion by how recent, rings the ones now, and draws a walk only for one person', () => {
  const pal = V.a3Palette(false);
  const rows = [row('binary_sensor.test_hall_motion', min(1)), row('binary_sensor.test_kitchen_motion', null, true), row('binary_sensor.test_living_motion', null)];
  const p = V.planSvg(PLAN, rows, T0, pal);
  assert.match(p.svg, /<svg class="plan"/);
  assert.equal((p.svg.match(/fill="rgba\(48,176,199,0\.42\)"\/>/g) || []).length, 2, 'the kitchen on and the hall a minute ago both count as now');
  assert.equal((p.svg.match(/<circle class="ring"/g) || []).length, 2, 'a pulsing dot in each');
  assert.match(p.svg, /stroke="rgba\(60,60,67,0\.42\)" stroke-width="5" stroke-linecap="round"/, 'the outer walls as soft round-ended lines');
  assert.match(p.svg, /stroke="url\(#walk\)"/, 'the hall a minute before the kitchen and nothing else: one walk');
  assert.equal(p.aria, 'Maja plaan, liikumine viimase veerandtunniga: Pere köök-elutuba ja Eeskoda');
  // two people: the kitchen and the children's room, past the hall that did not fire
  const two = V.planSvg(PLAN, [row('binary_sensor.test_kitchen_motion', min(1)), row('binary_sensor.demo_room_a_motion', null, true)], T0, pal);
  assert.doesNotMatch(two.svg, /url\(#walk\)/, 'two rooms that are no walk: no line');
  // an older room fades, no cap of five
  const many = V.planSvg(PLAN, [row('binary_sensor.test_bath_motion', min(12)), row('binary_sensor.test_hall_motion', min(4))], T0, pal);
  assert.match(many.svg, /fill="rgba\(48,176,199,0\.12\)"\/>/, 'twelve minutes ago is faint');
  assert.match(many.svg, /fill="rgba\(48,176,199,0\.24\)"\/>/, 'four minutes ago is stronger');
  assert.doesNotMatch(many.svg, /class="ring"/, 'nothing now');
  assert.deepEqual(V.planSvg(null, rows, T0, pal), { svg: '', aria: '' });
  const quiet = V.planSvg(PLAN, [row('binary_sensor.test_hall_motion', min(60))], T0, pal);
  assert.doesNotMatch(quiet.svg, /url\(#walk|rgba\(48,176,199/);
  assert.match(quiet.aria, /pole$/);
});

const ALARM_CONF = [{ entity: 'alarm_control_panel.maja', name: 'Maja' }, { entity: 'alarm_control_panel.garaaz', name: 'Garaaž' }];
const alarmStates = (maja = 'disarmed', since = min(60), extra = {}) => ({
  'alarm_control_panel.maja': { state: maja, last_changed: new Date(since).toISOString() },
  'alarm_control_panel.garaaz': { state: 'disarmed', last_changed: new Date(min(600)).toISOString() }, ...extra
});

test('Valve: the headline: motion now, the last motion and how long ago, quiet', () => {
  const tz = 'Europe/Tallinn';
  const on = { state: 'on', last_changed: new Date(min(1)).toISOString() };
  const live = [{ ...row('binary_sensor.k', min(1), true), name: 'Köök' }, { ...row('binary_sensor.e', min(3)), name: 'Elutuba' }];
  assert.deepEqual(V.motionHeadline(live, alarmStates('disarmed', min(60), { 'binary_sensor.k': on }), ALARM_CONF, T0, 'et', tz), { tone: 'live', label: 'Liikumine praegu', big: 'Köök', note: '' });
  const past = [{ ...row('binary_sensor.k', min(12)), name: 'Köök' }, { ...row('binary_sensor.e', min(3)), name: 'Elutuba' }];
  assert.deepEqual(V.motionHeadline(past, alarmStates(), ALARM_CONF, T0, 'et', tz), { tone: 'last', label: 'Viimane liikumine 3 min tagasi', big: 'Elutuba', note: '' });
  const old = [{ ...row('binary_sensor.k', min(130)), name: 'Köök' }];
  assert.equal(V.motionHeadline(old, alarmStates(), ALARM_CONF, T0, 'et', tz).label, 'Viimane liikumine täna 14:14');
  assert.equal(V.motionHeadline(old, alarmStates(), ALARM_CONF, T0, 'en', tz).label, 'Last motion today 14:14');
  assert.deepEqual(V.motionHeadline([{ ...row('binary_sensor.k', null), name: 'Köök' }], alarmStates(), ALARM_CONF, T0, 'et', tz), { tone: 'quiet', label: 'Ööpäeva jooksul liikumist pole', big: 'Vaikne', note: '' });
  // several people: the rooms of the last two minutes in the card's order, two by name
  const busy = ['Köök', 'Elutuba', 'Koridor', 'Kontor'].map((name, i) => ({ ...row(`binary_sensor.${i}`, min([1.5, 0.2, 3, 0.5][i])), name }));
  assert.equal(V.motionHeadline(busy, alarmStates(), ALARM_CONF, T0, 'et', tz).big, 'Köök, Elutuba ja veel 1', 'the corridor three minutes ago is not now');
  assert.equal(V.motionHeadline(busy.slice(0, 2), alarmStates(), ALARM_CONF, T0, 'et', tz).big, 'Köök ja Elutuba', 'the order is the card\'s, not the last to fire');
  assert.equal(V.motionHeadline(busy, alarmStates(), ALARM_CONF, T0, 'en', tz).big, 'Köök, Elutuba and 1 more');
});

test('Valve: while a partition is pending or triggered, the room that fired last before it changed', () => {
  const tz = 'Europe/Tallinn';
  const rows = [
    { entity: 'binary_sensor.c', name: 'Koridor', times: [min(20), min(8)], on: false, last: min(8) },
    { entity: 'binary_sensor.k', name: 'Köök', times: [min(7), min(2)], on: false, last: min(2) }
  ];
  // Maja went into alarm 5 minutes ago: the kitchen at 16:17 fired last before it, not at 16:22
  assert.deepEqual(V.motionHeadline(rows, alarmStates('triggered', min(5)), ALARM_CONF, T0, 'et', tz), { tone: 'bad', label: 'Häire, Maja', big: 'Köök', note: 'andur käivitus kell 16:17', entity: 'binary_sensor.k' });
  assert.equal(V.motionHeadline(rows, alarmStates('pending', min(7.5)), ALARM_CONF, T0, 'et', tz).big, 'Koridor');
  assert.equal(V.motionHeadline(rows, alarmStates('pending', min(7.5)), ALARM_CONF, T0, 'en', tz).label, 'Entry delay, Maja');
  assert.deepEqual(V.motionHeadline(rows, alarmStates('triggered', min(30)), ALARM_CONF, T0, 'et', tz), { tone: 'bad', label: 'Häire, Maja', big: 'Pole teada', note: 'andur pole teada', entity: null });
  assert.notEqual(V.motionHeadline(rows, alarmStates('armed_away', min(30)), ALARM_CONF, T0, 'et', tz).tone, 'bad', 'armed alone is no alarm');
});

test("Valve: a row's last time is 'praegu', the time today, the day before or 'üle 24 h'", () => {
  const tz = 'Europe/Tallinn';
  assert.equal(V.rowLast(row('x', null, true), T0, 'et', tz), 'praegu');
  assert.equal(V.rowLast(row('x', min(5)), T0, 'et', tz), '16:19');
  assert.equal(V.rowLast(row('x', min(20 * 60)), T0, 'et', tz), 'eile 20:24');
  assert.equal(V.rowLast(row('x', null), T0, 'et', tz), 'üle 24 h');
  assert.equal(V.rowLast(row('x', null), T0, 'en', tz), 'over 24 h');
});

test('Valve: the motion card draws loading, then the headline, the plan and a row per room that opens its history', () => {
  const conf = { plan: PLAN, groups: [{ name: 'Ühisruumid', rooms: [{ entity: 'binary_sensor.test_hall_motion', name: 'Eeskoda' }] }, { name: 'Toad', rooms: [{ entity: 'binary_sensor.demo_room_a_motion', name: 'Tuba 1' }] }], alarms: ALARM_CONF };
  const states = alarmStates('disarmed', min(60), { 'binary_sensor.test_hall_motion': { state: 'off' }, 'binary_sensor.demo_room_a_motion': { state: 'off' } });
  const hass = { config: { time_zone: 'Europe/Tallinn' } };
  assert.match(V.motionA3Markup(conf, states, null, T0, 'et', hass).html, /Laen…/);
  const m = V.motionA3Markup(conf, states, { 'binary_sensor.test_hall_motion': [min(4)] }, T0, 'et', hass);
  assert.match(m.html, /Viimane liikumine 4 min tagasi/);
  assert.match(m.html, /<svg class="plan"/);
  assert.match(m.html, /aria-label="Eeskoda, viimati 16:20, ajalugu"/);
  assert.match(m.html, /aria-label="Tuba 1, viimati üle 24 h, ajalugu"/);
  assert.deepEqual(m.sheets.get('r0').history, { entity: 'binary_sensor.test_hall_motion', source: 'history', counts: true });
  assert.equal(m.sheets.get('r0').unit, 'korda');
  assert.equal(m.sheets.get('r0').text(states), 'vaikne', 'a motion sensor is quiet, not off');
  assert.equal(m.sheets.get('r0').text({ 'binary_sensor.test_hall_motion': { state: 'on' } }), 'liikumine');
  assert.doesNotMatch(V.motionA3Markup({ ...conf, plan: undefined }, states, {}, T0, 'et', hass).html, /<svg class="plan"/, 'no slice, no plan, the rows stay');
});

test('Valve: the motion card split in two, the plan with its headline and the rows on their own', () => {
  const conf = { plan: PLAN, groups: [{ name: 'Ühisruumid', rooms: [{ entity: 'binary_sensor.test_hall_motion', name: 'Eeskoda' }] }], alarms: ALARM_CONF };
  const states = alarmStates('disarmed', min(60), { 'binary_sensor.test_hall_motion': { state: 'off' } });
  const hass = { config: { time_zone: 'Europe/Tallinn' } }, on = { 'binary_sensor.test_hall_motion': [min(4)] };
  const plan = V.motionA3Markup({ ...conf, part: 'plan' }, states, on, T0, 'et', hass).html;
  const rows = V.motionA3Markup({ ...conf, part: 'rows' }, states, on, T0, 'et', hass).html;
  assert.match(plan, /Viimane liikumine 4 min tagasi/);
  assert.match(plan, /<svg class="plan"/);
  assert.doesNotMatch(plan, /class="mr /);
  assert.doesNotMatch(rows, /<svg|Viimane liikumine/);
  assert.match(rows, /aria-label="Eeskoda, viimati 16:20, ajalugu"/);
});

test('Valve: a motion sheet counts the times a sensor fired, per hour over a day and per day over a week', () => {
  const tz = 'Europe/Tallinn', step = (pairs) => ({ kind: 'step', points: pairs.map(([m, v]) => ({ t: min(m), v })) });
  const day = V.countSeries(step([[30 * 60, false], [125, true], [124, false], [64, true], [63, false], [61, true], [60, null], [59, true], [58, false]]), '24h', T0, tz);
  assert.equal(day.kind, 'bars');
  assert.equal(day.points.length, 24);
  assert.equal(day.points.reduce((a, p) => a + p.v, 0), 3, 'off to on only, an unavailable gap between two on states is none');
  assert.ok(day.points.every((p, i) => !i || p.t - day.points[i - 1].t === 3600e3));
  const week = V.countSeries(step([[9 * 24 * 60, false], [8 * 24 * 60, true], [2 * 24 * 60, false], [2 * 24 * 60 - 1, true]]), '7d', T0, tz);
  assert.equal(week.points.length, 7);
  assert.equal(week.points.reduce((a, p) => a + p.v, 0), 1, 'a firing before the week is out');
});

test('Valve: a wall is drawn as its centre line in pieces between its door openings', () => {
  const box = [0, 0, 10, 10], r = q => q.map(([a, b]) => [a.map(v => +v.toFixed(2)), b.map(v => +v.toFixed(2))]);
  assert.deepEqual(r(V.wallSpans({ a: [0, 0], b: [4, 0], t: 0.2, doors: [] }, box)), [[[0, 0], [4, 0]]]);
  assert.deepEqual(r(V.wallSpans({ a: [0, 0], b: [4, 0], t: 0.2, doors: [[3, 1], [1, 0.8]] }, box)), [[[0, 0], [0.6, 0]], [[1.4, 0], [2.5, 0]], [[3.5, 0], [4, 0]]], 'two openings, in any order, leave three pieces');
  assert.equal(V.wallSpans({ a: [0, 0], b: [4, 0], t: 0.2, doors: [[0.5, 1]] }, box).length, 1, 'an opening at the end leaves one piece');
  assert.equal(V.wallSpans({ a: [20, 20], b: [24, 20], t: 0.2 }, box), null, 'an outbuilding wall is left out');
});

test('Valve: the footprint grows each nearby room by half a wall, so walls and the garage close into one shape', () => {
  const plan = { rooms: [{ id: 'a', rects: [[0, 0, 3, 5]] }, { id: 'b', rects: [[3.6, 0, 8, 5]] }, { id: 'far', rects: [[20, 20, 24, 24]] }] };
  const box = [0, 0, 8, 5];
  const out = V.houseRects(plan, box);
  assert.equal(out.length, 2, 'a room well outside the box is left out');
  assert.ok(out[0][2] >= out[1][0], 'a 0.6 m wall between two rooms closes');
  assert.deepEqual(out[0].slice(0, 2), [0, 0], 'clipped to the box');
  const svg = V.planSvg(PLAN, [], T0, { dark: false, text: '#000', sub: '#666' }).svg;
  assert.ok(svg.startsWith('<svg class="plan"'));
});

test('Valve: the status by state over two partitions, first match wins, faults over all', () => {
  const alarms = ['alarm_control_panel.maja', 'alarm_control_panel.garaaz'];
  const map = [
    { entities: alarms, state: 'triggered', text: 'Häire', tone: 'bad' },
    { entities: alarms, state: 'pending', text: 'Sisenemise viivitus', tone: 'bad' },
    { entities: alarms, state: 'arming', text: 'Valvesse minek', tone: 'info' },
    { entities: alarms, state: 'armed_*', text: 'Valves', tone: 'info' },
    { entities: alarms, state: 'disarmed', text: 'Valvest maas', tone: 'ok' }
  ];
  const conf = { status: { map }, faults: [{ entity: 'binary_sensor.smoke', name: 'Tulekahju' }] };
  const s = (m, g, smoke = 'off') => V.statusLine({ 'alarm_control_panel.maja': st(m), 'alarm_control_panel.garaaz': st(g), 'binary_sensor.smoke': st(smoke) }, conf);
  assert.deepEqual(s('disarmed', 'disarmed'), { tone: 'ok', text: 'Valvest maas' });
  assert.deepEqual(s('disarmed', 'armed_away'), { tone: 'on', text: 'Valves' });
  assert.deepEqual(s('arming', 'armed_night'), { tone: 'on', text: 'Valvesse minek' });
  assert.deepEqual(s('armed_home', 'triggered'), { tone: 'bad', text: 'Häire' });
  assert.deepEqual(s('pending', 'disarmed'), { tone: 'bad', text: 'Sisenemise viivitus' });
  assert.deepEqual(s('unavailable', 'unavailable'), { tone: 'off', text: 'Seisund pole teada' });
  assert.deepEqual(s('disarmed', 'disarmed', 'on'), { tone: 'bad', text: 'Viga' });
  assert.equal(V.stateIs('armed_away', 'armed_*'), true);
  assert.equal(V.stateIs('offline', '!online'), true);
  assert.equal(V.stateIs('online', '!online'), false);
});

test("Valve: an alarm's modes open HA's dialog, the current one marked in its colour, none pressed", () => {
  const conf = {
    entity: 'alarm_control_panel.maja', name: 'Maja', wide: true,
    modes: [
      { name: 'Eemal', option: 'armed_away', tap_action: { action: 'more-info' }, color: 'teal' },
      { name: 'Maas', option: 'disarmed', tap_action: { action: 'more-info' } }
    ]
  };
  const { html, actions } = V.tileA3Markup(conf, { 'alarm_control_panel.maja': st('armed_away') });
  assert.match(html, /data-k="m0" aria-current="true" aria-haspopup="dialog" style="background:#30b0c7;color:#fff">Eemal/);
  assert.match(html, /data-k="m1" aria-haspopup="dialog">Maas/);
  assert.doesNotMatch(html, /aria-pressed/);
  assert.deepEqual(actions.get('m1'), { config: { entity: 'alarm_control_panel.maja', tap_action: { action: 'more-info' } }, action: 'tap' });
  assert.deepEqual(actions.get('m0'), actions.get('m1'), 'the running mode opens the dialog too');
});

test('Valve: a cell says its state in its own words, red by its rules, a note of another entity or its last opening', () => {
  const door = { entity: 'binary_sensor.door', name: 'Peauks', words: { off: 'kinni', on: 'lahti' }, note: { last_on: true, label: 'avati' },
    bad_if: [[{ entity: 'binary_sensor.door', state: 'on' }, { entity: 'alarm_control_panel.maja', state: 'armed_*' }], [{ state: 'on' }, { entity: 'alarm_control_panel.garaaz', state: 'armed_*' }]] };
  const s = (d, m, g = 'disarmed') => ({ 'binary_sensor.door': st(d), 'alarm_control_panel.maja': st(m), 'alarm_control_panel.garaaz': st(g) });
  assert.equal(V.cellValue(door, s('off', 'disarmed')), 'kinni');
  assert.equal(V.cellValue(door, s('on', 'disarmed'), 'et'), 'lahti');
  assert.equal(V.cellTone(door, s('on', 'disarmed')), '', 'open while disarmed');
  assert.equal(V.cellTone(door, s('on', 'armed_home')), 'bad');
  assert.equal(V.cellTone(door, s('on', 'disarmed', 'armed_away')), 'bad', 'the second rule, its entity the cell own');
  assert.equal(V.cellTone(door, s('off', 'armed_home')), '');
  const tz = 'Europe/Tallinn', ctx = t => ({ lastOn: () => t, now: T0, tz });
  assert.equal(V.cellNote(door, {}, 'et', ctx(min(13))), 'avati 16:11');
  assert.equal(V.cellNote(door, {}, 'et', ctx(min(20 * 60))), 'avati eile 20:24');
  assert.equal(V.cellNote(door, {}, 'et', ctx(null)), 'üle 24 h');
  assert.equal(V.cellNote(door, {}, 'et', { lastOn: () => undefined }), '', 'nothing before the history loads');
  const aku = { entity: 'sensor.aku', name: 'Aku', decimals: 1, note: { entity: 'sensor.toide', label: 'toide', decimals: 1 } };
  const volts = { 'sensor.aku': st('13.8', { unit_of_measurement: 'V' }), 'sensor.toide': st('13.1', { unit_of_measurement: 'V' }) };
  assert.equal(V.cellValue(aku, volts), '13,8 V');
  assert.equal(V.cellNote(aku, volts), 'toide 13,1 V');
  assert.equal(V.cellNote(aku, { 'sensor.toide': st('unavailable') }), '');
  const link = { entity: 'binary_sensor.link', words: { on: 'olemas', off: 'katkes' }, good: ['on'], bad_if: [[{ state: 'off' }], [{ entity: 'sensor.raw', state: '!online' }]] };
  assert.equal(V.cellTone(link, { 'binary_sensor.link': st('on'), 'sensor.raw': st('online') }), 'good');
  assert.equal(V.cellTone(link, { 'binary_sensor.link': st('on'), 'sensor.raw': st('offline') }), 'bad');
  assert.equal(V.cellValue({ entity: 'binary_sensor.siren', words: { off: 'korras' } }, { 'binary_sensor.siren': st('unavailable') }), 'pole saadaval');
  const sheet = V.cellSheet(door, s('on', 'disarmed'), 'et');
  assert.equal(sheet.text(s('off', 'disarmed')), 'kinni', 'the sheet says it in the same words');
});

test('Valve: a reading card of cells alone draws no big value, its cells with their last opening, and the note under them', t => {
  // the card reads the clock itself: a fixed afternoon keeps the opening on the same day
  t.mock.timers.enable({ apis: ['Date'], now: T0 });
  const conf = {
    cells: [{ entity: 'binary_sensor.door', name: 'Peauks', words: { off: 'kinni', on: 'lahti' }, note: { last_on: true, label: 'avati' }, bad_if: [[{ state: 'on' }, { entity: 'alarm_control_panel.maja', state: 'armed_*' }]], history: { source: 'history' } },
      { entity: 'sensor.aku', name: 'Aku', decimals: 1 }],
    note: { text: 'Teavitus tuleb tulekahjust.' }
  };
  const states = { 'binary_sensor.door': st('on'), 'alarm_control_panel.maja': st('armed_away'), 'sensor.aku': st('13.8', { unit_of_measurement: 'V' }) };
  const hass = { config: { time_zone: 'Europe/Tallinn' } };
  const loading = V.readingA3Markup(conf, states, null, 'et', hass);
  assert.deepEqual(loading.history, ['binary_sensor.door'], 'only the last_on cell reads history');
  assert.doesNotMatch(loading.html, /class="hd"/);
  assert.match(loading.html, /<span class="v num bad">lahti<\/span><span class="sub"><\/span>/, 'red while open and armed, no note before the load');
  const now = Date.now(), d = { res: { hist: { 'binary_sensor.door': [now - 5 * 60e3] } }, now, tz: 'Europe/Tallinn' };
  const m = V.readingA3Markup(conf, states, d, 'et', hass);
  assert.match(m.html, /<span class="sub">avati 16:19<\/span>/);
  assert.match(m.html, /13,8 V/);
  assert.match(m.html, /<span class="hr"><\/span><span class="sub">Teavitus tuleb tulekahjust\.<\/span><\/div>$/);
  assert.equal(m.sheets.get('c0').text(states), 'lahti');
  assert.match(V.readingA3Markup(conf, states, { res: { hist: { 'binary_sensor.door': [] } }, now }, 'en', hass).html, /over 24 h/);
});

