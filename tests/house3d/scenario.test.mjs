// Tests of the demo's scenario player (demo/scenario.js) on what the demo ships: scenarios.json
// and states.json of a house3d-build.py --demo run, and their English, played on demo/sim.js with
// a clock the test moves by hand.
// Run from the repo root: node --test tests/house3d/scenario.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const { createSim } = await import(new URL('demo/sim.js', `file://${ROOT}`));
const { play, targets } = await import(new URL('demo/scenario.js', `file://${ROOT}`));
const { sunPosition } = await import(new URL('house3d/scene/sun.js', `file://${ROOT}`));

const out = mkdtempSync(join(tmpdir(), 'house3d-scenario-'));
let model, built;
try {
  execFileSync('python3', ['-I', join(ROOT, 'scripts/house3d-build.py'), '--demo', out], { stdio: ['ignore', 'ignore', 'inherit'] });
  const read = f => JSON.parse(readFileSync(join(out, f), 'utf8'));
  model = read('model.json');
  built = {
    et: { scenarios: read('scenarios.json'), data: read('states.json') },
    en: { scenarios: read('scenarios.en.json'), data: read('states.en.json') }
  };
} finally {
  rmSync(out, { recursive: true, force: true });
}
const car = model.car.entity;
// the place the demo page gives the card's sun (demo.js, hass().config)
const [, LAT, LON] = /latitude: ([\d.]+), longitude: ([\d.]+)/.exec(readFileSync(join(ROOT, 'demo/demo.js'), 'utf8')).map(Number);

// a clock moved by hand: run(ms) fires what falls due, in time order
function clock(start = Date.parse('2026-11-14T12:00:00Z')) {
  let t = 0, seq = 0, queue = [];
  return {
    now: () => new Date(start + t),
    schedule: (fn, ms) => { const id = { fn, at: t + ms, seq: seq++ }; queue.push(id); return id; },
    cancel: id => { queue = queue.filter(x => x !== id); },
    run(ms) {
      const end = t + ms;
      for (;;) {
        const due = queue.filter(x => x.at <= end).sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
        if (!due) break;
        queue = queue.filter(x => x !== due);
        t = due.at;
        due.fn();
      }
      t = end;
    }
  };
}

const setup = (data = built.et.data) => {
  const c = clock();
  return { c, sim: createSim(data, c) };
};
const scenario = (steps, extra = {}) => ({ id: 'x', start: {}, steps, ...extra });
const light = () => Object.keys(built.et.data.states).find(e => e.startsWith('light.'));

test('steps land in order on their seconds, then the end', () => {
  const { c, sim } = setup();
  const e = light(), seen = [];
  play(scenario([{ at: 1, caption: 'a', set: [e, 'on', {}] }, { at: 2, caption: 'b', set: [e, 'off', {}] }]), sim, {
    ...c, onStep: st => seen.push([st.caption, sim.states[e].state]), onEnd: () => seen.push('end')
  });
  c.run(999);
  assert.deepEqual(seen, []);
  c.run(1);
  assert.deepEqual(seen, [['a', 'on']]);
  c.run(1000);
  assert.deepEqual(seen, [['a', 'on'], ['b', 'off'], 'end']);
});

test('the start resets the sim with its overrides', () => {
  const { c, sim } = setup();
  const e = light();
  sim.set(e, 'on');
  play(scenario([{ at: 1, caption: 'x' }], { start: { [e]: { state: 'off', ago: 30 } } }), sim, c);
  assert.equal(sim.states[e].state, 'off');
  assert.equal(c.now() - new Date(sim.states[e].last_changed), 30 * 60000);
});

test('stop() leaves the later steps unapplied', () => {
  const { c, sim } = setup();
  const e = light(), ended = [];
  const stop = play(scenario([{ at: 1, set: [e, 'on', {}] }, { at: 5, set: [e, 'off', {}] }], { start: { [e]: { state: 'off' } } }), sim, { ...c, onEnd: () => ended.push(1) });
  c.run(2000);
  stop();
  c.run(10000);
  assert.equal(sim.states[e].state, 'on');
  assert.deepEqual(ended, []);
});

test('two plays give two different arrivals', () => {
  const { c, sim } = setup();
  const s = scenario([{ at: 1, car: 'arrive' }]);
  play(s, sim, { ...c, car });
  c.run(1000);
  const first = sim.states[car];
  assert.equal(first.state, 'home');
  c.run(5000);
  play(s, sim, { ...c, car });
  assert.equal(sim.states[car].state, 'not_home', 'the start puts the car away again');
  c.run(1000);
  assert.equal(sim.states[car].state, 'home');
  assert.notEqual(sim.states[car].attributes.arrived_at, first.attributes.arrived_at);
});

test('an unknown service or entity throws before any state changes', () => {
  const { c, sim } = setup();
  const e = light(), before = sim.states;
  assert.throws(() => play(scenario([{ at: 1, service: ['light', 'explode', e, {}] }], { start: { [e]: { state: 'on' } } }), sim, c), /no service light.explode/);
  assert.throws(() => play(scenario([{ at: 1, set: ['light.nowhere', 'on', {}] }]), sim, c), /no entity light.nowhere/);
  assert.throws(() => play(scenario([{ at: 1, car: 'arrive' }]), sim, c), /no entity null/);
  assert.equal(sim.states, before);
});

for (const lang of ['et', 'en']) {
  test(`every built scenario plays to its end (${lang})`, () => {
    const { scenarios, data } = built[lang];
    assert.equal(scenarios.length, 6);
    for (const s of scenarios) {
      const { c, sim } = setup(data);
      let ended = false, times = 0;
      play(s, sim, { ...c, car, onEnd: () => { ended = true; }, onTime: d => { assert.ok(!isNaN(d)); times++; } });
      c.run(s.steps.at(-1).at * 1000 + 5000);
      assert.ok(ended, s.id);
      assert.equal(times, s.steps.filter(st => st.time).length, s.id);
      const called = new Set(s.steps.filter(st => st.service).flatMap(targets));
      for (const st of s.steps.filter(st => st.set && !called.has(st.set[0]))) {
        const last = s.steps.filter(x => x.set && x.set[0] === st.set[0]).at(-1);
        assert.equal(sim.states[st.set[0]].state, last.set[1], `${s.id}: ${st.set[0]}`);
      }
    }
  });
}

test('the sky: dark for the evening and night stories, the sunset light inside its half hour', () => {
  const alt = t => sunPosition(new Date(t), LAT, LON).altitude;
  const byId = Object.fromEntries(built.et.scenarios.map(s => [s.id, s]));
  for (const id of ['koju', 'hommik', 'sissetung', 'tulekahju']) assert.ok(alt(byId[id].time) < 0, id);
  const sunset = byId.loojang;
  assert.ok(alt(sunset.time) > 0, 'the sunset story starts in daylight');
  let set = new Date(sunset.time);
  while (alt(set) > 0) set = new Date(set.getTime() + 60000);
  let sky = sunset.time;
  for (const st of sunset.steps) {
    if (st.time) sky = st.time;
    if (st.automation && st.service && st.service[0] === 'light') {
      const before = (set - new Date(sky)) / 60000;
      assert.ok(before >= 0 && before <= 30, `the light comes on ${before} min before sunset`);
    }
  }
  assert.ok(alt(sunset.steps.filter(st => st.time).at(-1).time) < 0, 'the story ends after sunset');
});
