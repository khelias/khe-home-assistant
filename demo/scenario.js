// Plays one of the demo's scenarios (scenarios.json, scripts/dashboard_scenarios.py) on the
// simulated hass: checks it against the sim first, resets the sim to its start, then applies its
// steps on time. No DOM, so the tests run it in Node.
import { SERVICES } from './sim.js?v=__DEMO_VERSION__';

// the entities a step acts on
export const targets = st => (st.set ? [st.set[0]] : st.service ? [st.service[2]].flat() : []);

// every service the sim knows and every entity it has, else an error before anything changes
function check(scenario, sim, car) {
  const need = (e, where) => { if (!sim.states[e]) throw new Error(`${scenario.id}: no entity ${e} (${where})`); };
  Object.keys(scenario.start).forEach(e => need(e, 'start'));
  for (const st of scenario.steps) {
    if (st.service && !SERVICES.has(`${st.service[0]}.${st.service[1]}`)) throw new Error(`${scenario.id}: no service ${st.service[0]}.${st.service[1]}`);
    targets(st).forEach(e => need(e, `step at ${st.at}`));
    if (st.car) need(car, `step at ${st.at}`);
  }
}

// play(scenario, sim, opts) -> stop(), which cancels the steps still to come. opts: car (the
// model's car entity), schedule/cancel/now as the sim takes them, onStep(step) for each step as it
// lands, onTime(date) for a step that moves the 3D view's sky, onEnd() after the last step.
export function play(scenario, sim, { car = null, schedule = setTimeout, cancel = clearTimeout, now = () => new Date(), onStep = () => {}, onTime = () => {}, onEnd = () => {} } = {}) {
  check(scenario, sim, car);
  sim.reset(scenario.start);
  const apply = st => {
    if (st.set) sim.set(...st.set);
    if (st.service) { const [d, s, e, data] = st.service; sim.callService(d, s, data || {}, { entity_id: e }); }
    if (st.time) onTime(new Date(st.time));
    // a fresh arrival every play, so the 3D view drives the car in again
    if (st.car) { sim.set(car, 'not_home'); sim.set(car, 'home', { arrived_at: now().toISOString() }); }
  };
  const last = scenario.steps.length - 1;
  const timers = scenario.steps.map((st, i) => schedule(() => {
    apply(st);
    onStep(st);
    if (i === last) onEnd();
  }, st.at * 1000));
  return () => timers.forEach(id => cancel(id));
}
