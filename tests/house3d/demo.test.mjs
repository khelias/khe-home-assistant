// Tests of the demo dashboard on what the demo ships: dashboard.json, states.json and
// series.json of a house3d-build.py --demo run (the real generator's views on made-up data),
// rendered by demo/cards.js, demo/charts.js and demo/icons.js on demo/sim.js.
// Run from the repo root: node --test tests/house3d/demo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const mod = f => import(new URL(`demo/${f}`, `file://${ROOT}`));
const { CARD_TYPES, FEATURE_TYPES, ACTIONS, visible, actionFor, runAction, markdown, gridSize, columnsFor, formatState } = await mod('cards.js');
const { CHARTS, points } = await mod('charts.js');
const { hasIcon, iconFor, GENERIC } = await mod('icons.js');
const { createSim } = await mod('sim.js');
const { tileAction, modeAction } = await import(new URL('cards/khe-cards.js', `file://${ROOT}`));

const out = mkdtempSync(join(tmpdir(), 'house3d-demo-'));
let model, dashboard, data, series, built;
try {
  execFileSync('python3', ['-I', join(ROOT, 'scripts/house3d-build.py'), '--demo', out], { stdio: ['ignore', 'ignore', 'inherit'] });
  const read = f => JSON.parse(readFileSync(join(out, f), 'utf8'));
  [model, dashboard, data, series] = ['model.json', 'dashboard.json', 'states.json', 'series.json'].map(read);
  built = { files: readdirSync(out), demoJs: readFileSync(join(out, 'demo.js'), 'utf8') };
} finally {
  rmSync(out, { recursive: true, force: true });
}

// every object with a type, nested cards, features and badges included
function typed(o, found = []) {
  if (Array.isArray(o)) o.forEach(x => typed(x, found));
  else if (o && typeof o === 'object') {
    if (typeof o.type === 'string') found.push(o);
    Object.values(o).forEach(x => typed(x, found));
  }
  return found;
}
const all = typed(dashboard.views);
const cardsOf = types => all.filter(c => types.includes(c.type));
const actions = all.flatMap(c => [c.tap_action, c.icon_tap_action]).filter(Boolean);
const noTimers = { schedule: () => 0, cancel: () => {} };

test('the shipped data: the real views, 3D first, on the fixture model', () => {
  assert.ok(model.devices.length > 0 && model.car && model.car.entity);
  assert.deepEqual(dashboard.views.slice(0, 2).map(v => v.path), ['maja-3d', 'kodu']);
  assert.deepEqual(dashboard.views[0].cards, [{ type: 'custom:house3d-card' }]);
  for (const p of ['energia', 'soojuspump', 'ventilatsioon', 'pergola', 'valve', 'kaamerad', 'teler']) assert.ok(dashboard.views.some(v => v.path === p), p);
  assert.ok(dashboard.views.some(v => v.subview && v.path.startsWith('kaamera-')));
});

test('every card type and tile feature in the dashboard has a renderer', () => {
  // views, sections, badges, entities rows, tile features and apexcharts series carry a type too
  const notCards = new Set(['panel', 'sections', 'grid', 'entity', 'section', 'column', 'line', ...FEATURE_TYPES]);
  const cardTypes = new Set(all.filter(c => !notCards.has(c.type)).map(c => c.type));
  assert.deepEqual([...cardTypes].filter(t => !CARD_TYPES.includes(t)), []);
  const feats = new Set(all.filter(c => c.type === 'tile').flatMap(c => (c.features || []).map(f => f.type)));
  assert.deepEqual([...feats].filter(t => !FEATURE_TYPES.includes(t)), []);
  for (const t of ['statistics-graph', 'history-graph', 'custom:apexcharts-card', 'weather-forecast']) assert.ok(CHARTS[t], t);
  assert.deepEqual([...new Set(actions.map(a => a.action))].filter(a => !ACTIONS.includes(a)), []);
});

test('every mdi icon is drawn and no tile falls back to the generic icon', () => {
  const text = JSON.stringify(dashboard);
  for (const [, name] of text.matchAll(/mdi:([a-z0-9-]+)/g)) assert.ok(hasIcon(name), name);
  for (const c of all.filter(c => c.type === 'tile' || c.type === 'entity')) {
    const name = iconFor(c, c.entity, data.states[c.entity]);
    assert.notEqual(name, GENERIC, c.entity);
    assert.ok(hasIcon(name), `${c.entity}: ${name}`);
  }
  for (const c of cardsOf(['entities'])) for (const r of c.entities.filter(r => r.entity)) assert.notEqual(iconFor(r, r.entity, data.states[r.entity]), GENERIC, r.entity);
});

test('every perform-action runs through the simulation and changes its target', () => {
  const performs = actions.filter(a => a.action === 'perform-action');
  assert.ok(performs.length > 10);
  for (const a of performs) {
    const sim = createSim(data, noTimers);
    const [domain, service] = a.perform_action.split('.');
    const target = (a.target || {}).entity_id || `script.${service}`;
    // an option or mode the entity is already in would change nothing: start it from another
    const want = (a.data || {}).option ?? (a.data || {}).operation_mode;
    if (want !== undefined && sim.states[target].state === want) {
      const other = (sim.states[target].attributes.options || sim.states[target].attributes.operation_list).find(o => o !== want);
      sim.set(target, other);
    }
    // a stop acts on a moving cover only
    if (service === 'stop_cover') sim.set(target, 'opening');
    const before = sim.states[target];
    sim.callService(domain, service, a.data || {}, a.target || {});
    const after = sim.states[target];
    assert.ok(after && after !== before, a.perform_action);
    assert.ok(!before || after.state !== before.state || JSON.stringify(after.attributes) !== JSON.stringify(before.attributes), `${a.perform_action} ${target}`);
  }
});

test('the simulation: toggles, mirrors and unknown services', () => {
  const sim = createSim(data, noTimers);
  const sw = Object.keys(sim.states).find(e => e.startsWith('switch.') && sim.states[e].state === 'off');
  sim.toggle(sw);
  assert.equal(sim.states[sw].state, 'on');
  for (const [target, m] of Object.entries(data.mirrors)) {
    const other = Object.keys(m.map).find(k => k !== sim.states[m.from].state);
    sim.set(m.from, other);
    assert.equal(sim.states[target].state, m.map[other], target);
  }
  assert.throws(() => sim.callService('light', 'explode', {}, { entity_id: sw }));
  const sel = Object.keys(sim.states).find(e => e.startsWith('select.'));
  assert.throws(() => sim.callService('select', 'select_option', { option: 'nonsense' }, { entity_id: sel }));
  const cover = Object.keys(sim.states).find(e => e.startsWith('cover.') && sim.states[e].state === 'closed');
  const still = sim.states[cover];
  sim.callService('cover', 'stop_cover', {}, { entity_id: cover });
  assert.equal(sim.states[cover], still, 'a stop leaves a cover at rest alone');
  const num = Object.keys(sim.states).find(e => e.startsWith('number.'));
  sim.callService('number', 'set_value', { value: 1e6 }, { entity_id: num });
  assert.equal(Number(sim.states[num].state), sim.states[num].attributes.max);
});

test('visibility: state and state_not single and listed, numeric_state, or, and', () => {
  const st = { 'sensor.a': { state: 'OK' }, 'sensor.n': { state: '12.5' }, 'binary_sensor.b': { state: 'on' }, 'sensor.e': { state: '' } };
  const s = (entity, k, v) => ({ condition: 'state', entity, [k]: v });
  assert.ok(visible([s('sensor.a', 'state', 'OK')], st));
  assert.ok(!visible([s('sensor.a', 'state', 'NOK')], st));
  assert.ok(visible([s('sensor.a', 'state', ['x', 'OK'])], st));
  assert.ok(!visible([s('sensor.a', 'state_not', 'OK')], st));
  assert.ok(!visible([s('sensor.a', 'state_not', ['OK', 'y'])], st));
  assert.ok(visible([s('sensor.a', 'state_not', ['x', 'y'])], st));
  assert.ok(visible([s('sensor.e', 'state', '')], st));
  assert.ok(visible([s('sensor.missing', 'state', ['unavailable', 'unknown'])], st));
  const n = (above, below) => ({ condition: 'numeric_state', entity: 'sensor.n', above, below });
  assert.ok(visible([n(10)], st));
  assert.ok(!visible([n(undefined, 10)], st));
  assert.ok(visible([n(12, 13)], st));
  assert.ok(!visible([{ condition: 'numeric_state', entity: 'sensor.a', above: 0 }], st));
  assert.ok(visible([{ condition: 'or', conditions: [s('sensor.a', 'state', 'x'), s('binary_sensor.b', 'state', 'on')] }], st));
  assert.ok(!visible([{ condition: 'or', conditions: [s('sensor.a', 'state', 'x'), s('binary_sensor.b', 'state', 'off')] }], st));
  assert.ok(!visible([{ condition: 'and', conditions: [s('sensor.a', 'state', 'OK'), s('binary_sensor.b', 'state', 'off')] }], st));
  assert.ok(visible([{ condition: 'and', conditions: [s('sensor.a', 'state', 'OK'), n(12)] }], st));
  assert.ok(visible(undefined, st));
});

test('every visibility condition in the dashboard evaluates on the starting states', () => {
  for (const c of all.filter(c => c.visibility)) assert.equal(typeof visible(c.visibility, createSim(data, noTimers).states), 'boolean');
  // Kodu's system section shows either the pending updates or "all is well", never both
  const states = createSim(data, noTimers).states;
  const ok = all.find(c => c.type === 'markdown' && c.content === 'Kõik korras.');
  const updates = all.find(c => c.type === 'entities' && c.visibility);
  assert.ok(ok && updates);
  assert.notEqual(visible(ok.visibility, states), visible(updates.visibility, states));
});

test("a nowrite tile's icon tap and body tap change nothing", async () => {
  const nowrite = all.filter(c => c.type === 'tile' && c.tap_action && c.tap_action.action === 'none');
  assert.ok(nowrite.length > 5);
  const calls = [];
  const api = { confirm: async () => true, moreInfo: e => calls.push(['more', e]), toggle: e => calls.push(['toggle', e]), callService: (...a) => calls.push(['call', ...a]), navigate: p => calls.push(['nav', p]), openUrl: u => calls.push(['url', u]) };
  for (const c of nowrite) {
    assert.equal(await runAction(actionFor(c, 'icon'), c.entity, api), false);
    assert.equal(await runAction(actionFor(c, 'tap'), c.entity, api), false);
  }
  assert.deepEqual(calls, []);
});

test('actions: defaults, confirmation, navigate and perform-action', async () => {
  const calls = [];
  let answer = false;
  const api = { confirm: async () => answer, moreInfo: e => calls.push(['more', e]), toggle: e => calls.push(['toggle', e]), callService: (...a) => calls.push(['call', ...a]), navigate: p => calls.push(['nav', p]), openUrl: u => calls.push(['url', u]) };
  assert.deepEqual(actionFor({ type: 'tile', entity: 'light.x' }, 'icon'), { action: 'toggle' });
  assert.deepEqual(actionFor({ type: 'tile', entity: 'sensor.x' }, 'icon'), { action: 'more-info' });
  assert.deepEqual(actionFor({ type: 'tile', entity: 'sensor.x' }), { action: 'more-info' });
  const act = { action: 'perform-action', perform_action: 'cover.open_cover', target: { entity_id: 'cover.x' }, confirmation: { text: 'Kindel?' } };
  assert.equal(await runAction(act, 'cover.x', api), false);
  answer = true;
  assert.equal(await runAction(act, 'cover.x', api), true);
  await runAction({ action: 'navigate', navigation_path: '/lovelace/valve' }, null, api);
  await runAction({ action: 'more-info', entity: 'select.y' }, 'sensor.y', api);
  assert.deepEqual(calls, [['call', 'cover', 'open_cover', {}, { entity_id: 'cover.x' }], ['nav', '/lovelace/valve'], ['more', 'select.y']]);
});

test('grid sizes: tile defaults, vertical, features and grid_options', () => {
  assert.deepEqual(gridSize({ type: 'tile' }), [6, 1]);
  assert.deepEqual(gridSize({ type: 'tile', vertical: true }), [6, 2]);
  assert.deepEqual(gridSize({ type: 'tile', features: [{ type: 'cover-open-close' }] }), [6, 2]);
  assert.deepEqual(gridSize({ type: 'tile', features: [{ type: 'bar-gauge' }], features_position: 'inline' }), [6, 1]);
  assert.deepEqual(gridSize({ type: 'tile', vertical: true, grid_options: { columns: 4, rows: 2 } }), [4, 2]);
  assert.deepEqual(gridSize({ type: 'heading' }), ['full', 'auto']);
  assert.deepEqual(gridSize({ type: 'markdown', grid_options: { columns: 'full' } }), ['full', 'auto']);
  assert.equal(columnsFor(375, 2), 1);
  assert.equal(columnsFor(1200, 2), 2);
  assert.equal(columnsFor(1200, 3), 3);
});

test('markdown renders the sample texts and nothing else as markup', () => {
  for (const c of cardsOf(['markdown'])) {
    const html = markdown(c.content);
    assert.ok(!/<ha-|{{|{%/.test(html), c.content.slice(0, 40));
  }
  assert.match(markdown('<ha-alert alert-type="warning">Kallis</ha-alert>'), /md-alert warning/);
  assert.match(markdown('| A | B |\n|:--|--:|\n| 1 | 2 |'), /<table>.*<td style="text-align:right">2<\/td>/);
  assert.equal(markdown('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
});

test('every chart draws from the series', () => {
  const now = new Date(2026, 9, 16, 14, 30);
  for (const c of cardsOf(Object.keys(CHARTS))) {
    const svg = CHARTS[c.type](c, series, now, 400, e => e);
    assert.ok(!svg.includes('nodata'), c.type);
  }
  const p = points({ step: 'hour_of_today', points: [[0, 1], [25, 2]] }, now);
  assert.equal(new Date(p[1][0]).getDate(), 17);
});

test('state text in Estonian', () => {
  const st = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
  assert.equal(formatState(st('binary_sensor.x', 'on', { device_class: 'door' })), 'Avatud');
  assert.equal(formatState(st('sensor.x', '21.4', { unit_of_measurement: '°C' })), '21,4 °C');
  assert.equal(formatState(st('update.x', 'on')), 'Uuendus saadaval');
  assert.equal(formatState(st('input_datetime.x', '23:00:00', { has_time: true })), '23:00');
});

test('the demo files name no fixture entity or device and hold no devices key', () => {
  const dir = join(ROOT, 'demo');
  const files = readdirSync(dir).filter(f => f.endsWith('.js') || f === 'index.html');
  assert.ok(!files.includes('dashboard.js'));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const strings = [...model.devices.flatMap(d => [d.entity, d.name]), model.car.entity, model.car.name].filter(Boolean);
  const devicesKey = /["']?\bdevices["']?\s*:/;
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    for (const s of strings) assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}_])${esc(s)}(?![\\p{L}\\p{N}_])`, 'u').test(text), `${f}: ${s}`);
    assert.ok(!devicesKey.test(text), `${f}: a devices key`);
  }
});

// nginx caches .js for 30 days, so a demo module imported without ?v= would ship stale
test('every relative import in the demo files carries a version', () => {
  const dir = join(ROOT, 'demo');
  for (const f of readdirSync(dir).filter(f => f.endsWith('.js') || f === 'index.html')) {
    const text = readFileSync(join(dir, f), 'utf8');
    const refs = [...text.matchAll(/(?:from|import\(?|src=)\s*["'](\.{0,2}\/?[\w./-]+\.js[^"']*)["']/g)].map(m => m[1]);
    assert.ok(f !== 'demo.js' || refs.length >= 4, 'demo.js imports found');
    for (const r of refs) assert.match(r, /\?v=__(HOUSE3D|DEMO|KHE_CARDS)_VERSION__$/, `${f}: ${r}`);
  }
  assert.match(readFileSync(join(dir, 'demo.js'), 'utf8'), /\?v=__DEMO_VERSION__`\)/, 'the JSON fetches carry the version');
});

test('the dashboard cards ship with the demo and the page knows their types', () => {
  assert.ok(built.files.includes('khe-cards.js'));
  assert.match(built.demoJs, /khe-cards\.js\?v=\d+'/);
  for (const t of ['custom:khe-summary-card', 'custom:khe-price-card', 'custom:khe-tile-card']) assert.ok(CARD_TYPES.includes(t), t);
});

// The cards hand HA a hass-action; the demo runs its config through runAction as HA's
// handleAction would, so a tile tap and a mode tap must reach the simulation.
test('a tile action and a mode action change the simulated state, the mode after its confirmation', async () => {
  const sim = createSim(data, noTimers);
  const asked = [];
  let answer = true;
  const api = {
    confirm: async text => { asked.push(text); return answer; },
    moreInfo: () => {}, navigate: () => {}, openUrl: () => {},
    toggle: e => sim.toggle(e),
    callService: (d, s, dt, t) => sim.callService(d, s, dt, t)
  };
  const run = detail => runAction(detail.config.tap_action, detail.config.entity, api);

  const lamp = Object.keys(sim.states).find(e => e.startsWith('light.'));
  const before = sim.states[lamp].state;
  assert.equal(await run(tileAction({ entity: lamp, tap_action: { action: 'toggle' } })), true);
  assert.notEqual(sim.states[lamp].state, before);
  assert.deepEqual(asked, []);

  const select = Object.keys(sim.states).find(e => e.startsWith('select.') && (sim.states[e].attributes.options || []).length > 1);
  const current = sim.states[select].state;
  const option = sim.states[select].attributes.options.find(o => o !== current);
  const mode = { name: option, option, confirm: `Režiimile ${option}?` };
  assert.equal(modeAction(select, { ...mode, option: current }, current), null);
  answer = false;
  assert.equal(await run(modeAction(select, mode, current)), false);
  assert.equal(sim.states[select].state, current);
  answer = true;
  assert.equal(await run(modeAction(select, mode, current)), true);
  assert.equal(sim.states[select].state, option);
  assert.deepEqual(asked, [mode.confirm, mode.confirm]);
});
