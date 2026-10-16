// The demo dashboard's config, shaped like a Lovelace dashboard: a 3D panel view, then sections
// views built from the model by device type and room. It names no entity and no device, touches
// no DOM and imports nothing, so the tests load it in Node. demo/cards.js renders it.

const domainOf = entity => entity.split('.')[0];
const OUTDOOR = 'oues';
const TOGGLES = new Set(['light', 'switch', 'fan', 'input_boolean', 'cover']);

// device types per view, in the order their tiles show
const HOME_TYPES = ['light', 'plug', 'cover', 'sensor'];
const SENSOR_TYPES = ['door', 'motion', 'smoke'];

export function tile(entity) {
  const card = { type: 'tile', entity, vertical: true, tap_action: { action: 'more-info' } };
  card.icon_tap_action = { action: TOGGLES.has(domainOf(entity)) ? 'toggle' : 'more-info' };
  return card;
}

// n tiles into rows of 2-4, as even as possible: 5 is 3+2, 7 is 4+3; a single tile stays alone
export function chunk(tiles) {
  const rows = Math.ceil(tiles.length / 4), out = [];
  for (let r = 0, i = 0; r < rows; r++) {
    const n = Math.ceil((tiles.length - i) / (rows - r));
    out.push(tiles.slice(i, i + n));
    i += n;
  }
  return out;
}

const stack = row => ({ type: 'horizontal-stack', cards: row });
const heading = text => ({ type: 'heading', heading: text });

// parts of tiles into rows: a part of two or more gets rows of its own, single tiles share
// theirs, and a last lone tile joins the row before it
export function rowsOf(parts) {
  const rows = parts.filter(p => p.length >= 2).flatMap(chunk);
  const singles = parts.filter(p => p.length === 1).flat();
  if (singles.length !== 1 || !rows.length) return [...rows, ...(singles.length ? chunk(singles) : [])];
  return [...rows.slice(0, -1), ...chunk([...rows[rows.length - 1], singles[0]])];
}

// groups [{ title, parts }] into sections: a group of two or more tiles is its own section,
// groups of one share a section under `shared`, and a last lone tile joins the section before
// it rather than stand alone in a row
export function tileSections(groups, shared) {
  const size = g => g.parts.flat().length;
  const own = groups.filter(g => size(g) >= 2).map(g => ({ title: g.title, parts: [...g.parts] }));
  const pool = groups.filter(g => size(g) === 1).flatMap(g => g.parts.filter(p => p.length));
  if (pool.length === 1 && own.length) own[own.length - 1].parts.push(pool[0]);
  else if (pool.length) own.push({ title: shared, parts: [pool.flat()] });
  return own.map(g => ({ type: 'grid', cards: [heading(g.title), ...rowsOf(g.parts).map(stack)] }));
}

const byType = (devices, types) => types.flatMap(t => devices.filter(d => d.type === t));

export function buildViews(model) {
  const all = model.devices || [];
  const rooms = model.rooms || [];
  const car = model.car && model.car.entity ? model.car : null;
  const ofDomain = (...ds) => all.filter(d => ds.includes(domainOf(d.entity)));
  const tiles = list => list.map(d => tile(d.entity));

  // Kodu: what is used daily, room by room; the yard last
  const alarm = ofDomain('alarm_control_panel');
  const doors = all.filter(d => d.type === 'door');
  const homeBadges = [
    ...alarm.map(d => ({ type: 'entity', entity: d.entity })),
    ...(car ? [{ type: 'entity', entity: car.entity }] : []),
    ...doors.map(d => ({ type: 'entity', entity: d.entity, visibility: [{ condition: 'state', entity: d.entity, state: 'on' }] }))
  ];
  const placed = new Set([...rooms.map(r => r.id), OUTDOOR]);
  const homeDevices = byType(all, HOME_TYPES).filter(d => placed.has(d.room));
  const roomGroups = [...rooms.map(r => r.id), OUTDOOR].map(id => ({
    title: id === OUTDOOR ? 'Õu' : rooms.find(r => r.id === id).name,
    parts: [tiles(homeDevices.filter(d => d.room === id))]
  }));

  // Kliima: heating as thermostats, then the hot water and the air, then the temperatures
  const heating = ofDomain('climate');
  const air = ofDomain('water_heater', 'fan');
  // Valve: the alarm panel, the sensors by type, the cameras
  const sensors = byType(all, SENSOR_TYPES);
  const cameras = ofDomain('camera');
  const securitySections = [
    ...(alarm.length ? [{ type: 'grid', cards: [heading('Valvestus'), ...alarm.map(d => ({ type: 'alarm-panel', entity: d.entity, states: ['arm_home', 'arm_away'] }))] }] : []),
    ...tileSections([{ title: 'Andurid', parts: SENSOR_TYPES.map(t => tiles(sensors.filter(d => d.type === t))) }], 'Andurid'),
    ...(cameras.length ? [{ type: 'grid', cards: [heading('Kaamerad'), ...cameras.map(d => ({ type: 'picture-entity', entity: d.entity, camera_view: 'auto' }))] }] : [])
  ];

  // devices no view above shows still get a tile on Kliima, so a new device type is never lost;
  // they share its tile sections so that a single one does not stand alone
  const shown = new Set([...homeDevices, ...heating, ...air, ...ofDomain('sensor'), ...alarm, ...sensors, ...cameras].map(d => d.entity));
  const rest = all.filter(d => !shown.has(d.entity));
  const climateSections = [];
  if (heating.length) climateSections.push({ type: 'grid', cards: [heading('Küte'), ...heating.map(d => ({ type: 'thermostat', entity: d.entity }))] });
  climateSections.push(...tileSections([
    { title: 'Vesi ja õhk', parts: [tiles(air)] },
    { title: 'Temperatuurid', parts: [tiles(ofDomain('sensor'))] },
    { title: 'Muud seadmed', parts: [tiles(rest)] }
  ], 'Muud seadmed'));

  return [
    { title: '3D', path: '3d', icon: 'cube', type: 'panel', cards: [{ type: 'custom:house3d-card' }] },
    { title: 'Kodu', path: 'kodu', icon: 'home', type: 'sections', max_columns: 2, badges: homeBadges, sections: tileSections(roomGroups, 'Muud ruumid') },
    { title: 'Kliima', path: 'kliima', icon: 'thermostat', type: 'sections', max_columns: 2, badges: [], sections: climateSections },
    { title: 'Valve', path: 'valve', icon: 'shield', type: 'sections', max_columns: 2, badges: [], sections: securitySections }
  ].filter(v => v.type === 'panel' || v.sections.length);
}
