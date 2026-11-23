// Valve motion and house-plan trail card: MotionCard (ADR-015).
// Loaded by cards/khe-cards.js with ?v=; zero imports.

export default function init({ esc, stateOf, words, num, a3Palette, a3Color, PRICE_A3_CSS, HOUR, DAY, tzOf, shortWhen, agoText, hourlyCounts, binHours, barRect, LoadingCard, cap, clockAt, joinEt, localZone } = {}) {
  // The rows: [{ entity, name, times, on, last }], `last` the moment of the last motion (now while
  // on), null without one in 24 hours
  function motionRows(conf, states, on, now) {
    return (conf.groups || []).flatMap(g => g.rooms.map(r => {
      const times = (on && on[r.entity]) || [], live = stateOf(states, r.entity) === 'on';
      return { entity: r.entity, name: r.name, group: g.name, times, on: live, last: live ? now : times.length ? times[times.length - 1] : null };
    }));
  }

  // motion this recent counts as now: a PIR's on state lasts seconds, and several people keep
  // several rooms firing in turn
  const NOW_WINDOW = 120e3;

  // The headline: { tone, label, big, note }. While a partition is pending or triggered (bad), the
  // room that fired last before it changed; while there is motion now, its rooms in the card's own
  // order (stable while people move), two by name and the rest counted; else the last motion and
  // how long ago; quiet without any in 24 hours.
  function motionHeadline(rows, states, alarms, now, lang = 'et', tz = localZone()) {
    const w = words(lang);
    const alarm = (alarms || []).find(a => ['triggered', 'pending'].includes(stateOf(states, a.entity)));
    if (alarm) {
      const st = states[alarm.entity], since = Date.parse(st.last_changed) + 1000;
      let best = null;
      for (const r of rows) for (const t of r.times) if (t <= since && (!best || t > best.t)) best = { t, name: r.name, entity: r.entity };
      const label = st.state === 'triggered' ? w.alarmIn(alarm.name) : w.pendingIn(alarm.name);
      return { tone: 'bad', label, big: best ? best.name : cap(w.notKnown), note: best ? w.firedAt(clockAt(best.t, tz)) : w.firedUnknown, entity: best ? best.entity : null };
    }
    const live = [...new Set(rows.filter(r => r.on || (r.last !== null && now - r.last <= NOW_WINDOW)).map(r => r.name))];
    if (live.length) return { tone: 'live', label: w.motionNow, big: live.length > 2 ? w.andMore(live.slice(0, 2).join(', '), live.length - 2) : joinEt(live, lang), note: '' };
    const last = rows.filter(r => r.last !== null).sort((a, b) => b.last - a.last)[0];
    if (last) return { tone: 'last', label: w.lastMotion(agoText(last.last, now, lang, tz)), big: last.name, note: '' };
    return { tone: 'quiet', label: w.noMotion, big: w.quiet, note: '' };
  }

  // a row's last time: 'praegu' while on, the time, or 'üle 24 h'
  const rowLast = (r, now, lang = 'et', tz = localZone()) => (r.on ? words(lang).nowRow : r.last === null ? words(lang).over24h : shortWhen(r.last, now, lang, tz));

  // The plan slice the generator passes (ADR-015): { rooms: [{ id, name, rects: [[x0, z0, x1, z1]] }],
  // walls: [{ a: [x, z], b: [x, z], t, doors: [[c, w]] }], pirs: [{ entity, room }] }, in metres.
  // The route graph: a node at each rect's centre; rects of one room that touch, and two rooms'
  // rects that share an edge with no wall along a stretch of it (an open passage), joined through
  // the middle of that stretch; a door joined to the rects on both sides through a point just off
  // its wall each way.
  const EPS = 0.02, GAP = 0.4, OPEN = 0.6, STEP = 0.1;

  const centreOf = r => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];

  const inRect = (p, r) => p[0] >= r[0] - EPS && p[0] <= r[2] + EPS && p[1] >= r[1] - EPS && p[1] <= r[3] + EPS;

  const area = r => (r[2] - r[0]) * (r[3] - r[1]);

  // where two rects meet along x (axis 0) or z (1): { axis, at, lo, hi, gap }, gap up to a wall's width
  function sharedEdge(A, B) {
    for (const axis of [0, 1]) {
      const o = 1 - axis, lo = Math.max(A[o], B[o]), hi = Math.min(A[o + 2], B[o + 2]);
      if (hi - lo <= EPS) continue;
      for (const [P, Q] of [[A, B], [B, A]]) {
        const gap = Q[axis] - P[axis + 2];
        if (gap >= -EPS && gap <= GAP) return { axis, at: P[axis + 2] + gap / 2, lo, hi, gap: Math.max(0, gap) };
      }
    }
    return null;
  }

  // whether a wall stands at point p of a shared edge
  const walled = (p, walls, gap) => walls.some(w => {
    const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], len = Math.hypot(dx, dz) || 1;
    const u = ((p[0] - w.a[0]) * dx + (p[1] - w.a[1]) * dz) / len;
    if (u < -EPS || u > len + EPS) return false;
    return Math.abs((p[0] - w.a[0]) * dz - (p[1] - w.a[1]) * dx) / len <= (w.t || 0) / 2 + gap / 2 + 0.05;
  });

  // the middle of the longest stretch of a shared edge with no wall, null when shorter than OPEN
  function openStretch(e, walls) {
    let best = null, run = null;
    for (let v = e.lo + STEP / 2; v < e.hi; v += STEP) {
      const p = e.axis === 0 ? [e.at, v] : [v, e.at];
      if (walled(p, walls, e.gap)) { run = null; continue; }
      if (!run) run = [v, v];
      run[1] = v;
      if (!best || run[1] - run[0] > best[1] - best[0]) best = [...run];
    }
    if (!best || best[1] - best[0] + STEP < OPEN) return null;
    const m = (best[0] + best[1]) / 2;
    return e.axis === 0 ? [e.at, m] : [m, e.at];
  }

  // the graph of a plan object, built once: the plan is the card's config
  const GRAPHS = new WeakMap();

  const graphOf = plan => { if (!GRAPHS.has(plan)) GRAPHS.set(plan, planGraph(plan)); return GRAPHS.get(plan); };

  function planGraph(plan) {
    const nodes = [], adj = [];
    const add = p => { nodes.push(p); adj.push([]); return nodes.length - 1; };
    const link = (i, j) => { const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]); adj[i].push([j, d]); adj[j].push([i, d]); };
    const rects = [];
    for (const room of plan.rooms || []) for (const r of room.rects) rects.push({ room: room.id, r, node: add(centreOf(r)) });
    const walls = plan.walls || [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const A = rects[i], B = rects[j], e = sharedEdge(A.r, B.r);
        if (!e) continue;
        const mid = A.room === B.room ? (e.axis === 0 ? [e.at, (e.lo + e.hi) / 2] : [(e.lo + e.hi) / 2, e.at]) : openStretch(e, walls);
        if (!mid) continue;
        const m = add(mid);
        link(A.node, m); link(m, B.node);
      }
    }
    for (const w of walls) {
      const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
      for (const [c] of w.doors || []) {
        const p = [w.a[0] + ux * c, w.a[1] + uz * c], off = (w.t || 0) / 2 + 0.15, door = add(p);
        for (const s of [1, -1]) {
          const q = [p[0] - uz * off * s, p[1] + ux * off * s], hit = rects.find(x => inRect(q, x.r));
          if (!hit) continue;
          const qi = add(q);
          link(door, qi); link(qi, hit.node);
        }
      }
    }
    // a room's anchor: its largest rect's centre
    const anchor = {};
    for (const x of rects) if (!anchor[x.room] || area(x.r) > area(rects.find(y => y.node === anchor[x.room]).r)) anchor[x.room] = x.node;
    return { nodes, adj, rects, anchor };
  }

  // the shortest path between two nodes as their points, null when none reaches
  function shortestPath(g, from, to) {
    const n = g.nodes.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
    dist[from] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === to) break;
      done[u] = true;
      for (const [v, d] of g.adj[u]) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; }
    }
    if (dist[to] === Infinity) return null;
    const path = [];
    for (let v = to; v >= 0; v = prev[v]) path.unshift(g.nodes[v]);
    return path;
  }

  // The trail: the rooms with motion in the last `minutes`, each once by its last motion, the last
  // five; a PIR not in the plan stays out, two PIRs in one room light it together. rows' `last`
  // is the PIR's last motion and `times` its motions. Returns [{ room, t, times }], oldest first.
  function trailRooms(plan, rows, now, minutes = 15, most = 5) {
    const roomOf = new Map((plan.pirs || []).map(p => [p.entity, p.room])), last = new Map(), times = new Map();
    for (const r of rows) {
      const room = roomOf.get(r.entity);
      if (!room || r.last === null || r.last < now - minutes * 60e3) continue;
      if (!last.has(room) || r.last > last.get(room)) last.set(room, r.last);
      times.set(room, [...(times.get(room) || []), ...(r.times || []), r.last]);
    }
    return [...last].map(([room, t]) => ({ room, t, times: times.get(room) })).sort((a, b) => a.t - b.t).slice(-most);
  }

  // one person's walk from a room to the next: the next room fired soon after the first one's last
  // motion (or just before it, as two PIRs overlap at a door)
  const STEP_AFTER = 120e3, STEP_BEFORE = 30e3;

  // The trail's runs of points. Two consecutive rooms are one person's walk, joined by the shortest
  // path between their anchors, only when that path crosses no third room with a PIR (which would
  // have fired on the way) and the next room fired within two minutes of the first one's last
  // motion; anything else, or no path at all, starts a run of its own: several people are several
  // short trails, not one line through the house.
  function trailRuns(g, rooms, sensed = null) {
    const runs = [];
    let run = null;
    const crosses = (path, a, b) => sensed && path.some(p => g.rects.some(x => x.room !== a && x.room !== b && sensed.has(x.room) && p[0] > x.r[0] + EPS && p[0] < x.r[2] - EPS && p[1] > x.r[1] + EPS && p[1] < x.r[3] - EPS));
    const soon = (prev, x) => !x.times || x.times.some(t => t >= prev.t - STEP_BEFORE && t <= prev.t + STEP_AFTER);
    rooms.forEach((x, i) => {
      const a = g.anchor[x.room];
      if (a === undefined) return;
      if (!run || i === 0) { run = [g.nodes[a]]; runs.push(run); return; }
      const prev = rooms[i - 1], from = g.anchor[prev.room], path = from === undefined ? null : shortestPath(g, from, a);
      if (path && !crosses(path, prev.room, x.room) && soon(prev, x)) run.push(...path.slice(1));
      else { run = [g.nodes[a]]; runs.push(run); }
    });
    return runs;
  }

  // a Catmull-Rom curve through points as SVG cubic Béziers; a lone point is a dot
  function catmullRom(pts) {
    const f = v => v.toFixed(1);
    if (pts.length < 2) return pts.length ? `M${f(pts[0][0])} ${f(pts[0][1])}h0.01` : '';
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d;
  }

  const HALF_WALL = 0.35;

  // A room rect grown on each side halfway to the nearest rect across the wall (at most half an outer
  // wall): the room to its walls' middle, so a tinted room meets its walls whatever their thickness.
  function growRect(r, others) {
    const over = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > EPS;
    const side = (dist) => others.reduce((g, o) => { const d = dist(o); return d === null || d < -EPS ? g : Math.min(g, Math.max(0, d) / 2); }, HALF_WALL);
    return [
      r[0] - side(o => (over(r[1], r[3], o[1], o[3]) && o[2] <= r[0] + EPS ? r[0] - o[2] : null)),
      r[1] - side(o => (over(r[0], r[2], o[0], o[2]) && o[3] <= r[1] + EPS ? r[1] - o[3] : null)),
      r[2] + side(o => (over(r[1], r[3], o[1], o[3]) && o[0] >= r[2] - EPS ? o[0] - r[2] : null)),
      r[3] + side(o => (over(r[0], r[2], o[0], o[2]) && o[1] >= r[3] - EPS ? o[1] - r[3] : null))
    ];
  }

  // A wall's centre line in pieces between its door openings, [[a, b], ...] in metres; null for a
  // wall well outside the box.
  function wallSpans(wl, box) {
    const len = Math.hypot(wl.b[0] - wl.a[0], wl.b[1] - wl.a[1]), [x0, z0, x1, z1] = box;
    if (!len || Math.max(wl.a[0], wl.b[0]) < x0 - 1 || Math.min(wl.a[0], wl.b[0]) > x1 + 1 || Math.max(wl.a[1], wl.b[1]) < z0 - 1 || Math.min(wl.a[1], wl.b[1]) > z1 + 1) return null;
    const ux = (wl.b[0] - wl.a[0]) / len, uz = (wl.b[1] - wl.a[1]) / len, at = d => [wl.a[0] + ux * d, wl.a[1] + uz * d];
    const spans = [];
    let from = 0;
    for (const [c, w] of [...(wl.doors || [])].sort((a, b) => a[0] - b[0])) {
      if (c - w / 2 > from + EPS) spans.push([from, c - w / 2]);
      from = Math.max(from, c + w / 2);
    }
    if (len > from + EPS) spans.push([from, len]);
    return spans.map(([a, b]) => [at(a), at(b)]);
  }

  // The house's floor for the plan: each room rect near the sensed ones (not the outbuildings) grown
  // by half an outer wall, so it runs under every wall; clipped to the plan's box.
  function houseRects(plan, box) {
    const [x0, z0, x1, z1] = box, near = 1;
    return (plan.rooms || []).flatMap(r => r.rects)
      .filter(r => r[2] > x0 - near && r[0] < x1 + near && r[3] > z0 - near && r[1] < z1 + near)
      .map(r => [Math.max(x0, r[0] - HALF_WALL), Math.max(z0, r[1] - HALF_WALL), Math.min(x1, r[2] + HALF_WALL), Math.min(z1, r[3] + HALF_WALL)])
      .filter(r => r[2] > r[0] && r[3] > r[1]);
  }

  const TEAL = '#30b0c7', PW = 330, PH = 360;

  // The plan's SVG, drawn as a soft floor plan: the house's floor, every room with motion in the last
  // `minutes` tinted to its walls' middle by how recent it was, a pulsing dot in each room with motion
  // now, the walls as round-ended lines with the door openings cut out, the last five minutes' walk
  // when there was only one, and the sensed rooms' names, lifted over their dots.
  // { svg, aria }; '' without a plan or a sensed room.
  function planSvg(plan, rows, now, pal, lang = 'et', minutes = 15) {
    const w = words(lang);
    const sensed = new Set((plan && plan.pirs || []).map(p => p.room));
    const rooms = ((plan && plan.rooms) || []).filter(r => sensed.has(r.id));
    if (!rooms.length) return { svg: '', aria: '' };
    const all = rooms.flatMap(r => r.rects);
    // the box takes in the plates grown by up to half a wall, and the footprint around them
    const bx0 = Math.min(...all.map(r => r[0])) - HALF_WALL, bz0 = Math.min(...all.map(r => r[1])) - HALF_WALL, bx1 = Math.max(...all.map(r => r[2])) + HALF_WALL, bz1 = Math.max(...all.map(r => r[3])) + HALF_WALL;
    const K = Math.min(PW / (bx1 - bx0), PH / (bz1 - bz0)), pad = 4;
    const X = x => pad + (x - bx0) * K, Z = z => pad + (z - bz0) * K, vw = (bx1 - bx0) * K + 2 * pad, vh = (bz1 - bz0) * K + 2 * pad;
    const g = graphOf(plan), roomOf = new Map(plan.pirs.map(p => [p.entity, p.room]));
    // each sensed room's last motion (now while a PIR is on) within the window
    const lastOf = new Map();
    for (const r of rows) {
      const room = roomOf.get(r.entity), t = r.on ? now : r.last;
      if (room && t !== null && t >= now - minutes * 60e3 && (!lastOf.has(room) || t > lastOf.get(room))) lastOf.set(room, t);
    }
    const fresh = id => lastOf.has(id) && now - lastOf.get(id) <= NOW_WINDOW;
    // a walk is drawn only while the house is quiet enough to read one: everything in the last five
    // minutes is one walk of two rooms or more (one person); with more people the rooms say it
    const recent = trailRooms(plan, rows, now, 5), walks = trailRuns(g, recent, sensed);
    const walk = walks.length === 1 && recent.length > 1 ? walks[0] : null;
    // the A3 palette's own greys: the floor in the segmented controls' fill, the walls as soft lines
    const ink = pal.dark ? '235,235,245' : '60,60,67';
    const c = { floor: pal.seg, outer: `rgba(${ink},0.42)`, inner: `rgba(${ink},${pal.dark ? 0.2 : 0.24})` };
    // a room's tint: strong for motion now, fading to faint at the window's end
    const tintOf = id => (fresh(id) ? 0.42 : 0.3 - 0.22 * Math.min(1, (now - lastOf.get(id)) / (minutes * 60e3)));
    const f = v => v.toFixed(1), box = [bx0, bz0, bx1, bz1];
    const P = p => [X(p[0]), Z(p[1])];
    const rectD = r => `M${f(X(r[0]))} ${f(Z(r[1]))}H${f(X(r[2]))}V${f(Z(r[3]))}H${f(X(r[0]))}Z`;
    const floor = houseRects(plan, box).map(rectD).join('');
    const allRects = (plan.rooms || []).flatMap(r => r.rects);
    const tints = rooms.filter(room => lastOf.has(room.id)).map(room =>
      `<path d="${room.rects.map(r => rectD(growRect(r, allRects.filter(o => o !== r)))).join('')}" fill="rgba(48,176,199,${tintOf(room.id).toFixed(2)})"/>`).join('');
    const walls = { outer: '', inner: '' };
    for (const wl of plan.walls || []) {
      for (const [a, b] of wallSpans(wl, box) || []) walls[(wl.t || 0) > 0.3 ? 'outer' : 'inner'] += `M${P(a).map(f).join(' ')}L${P(b).map(f).join(' ')}`;
    }
    const line = (d, color, width) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const plates = `${tints}${line(walls.inner, c.inner, 2)}${line(walls.outer, c.outer, 5)}`;
    let curve = '';
    if (walk) {
      const pts = walk.map(P), [s, e] = [pts[0], pts[pts.length - 1]];
      curve = `<defs><linearGradient id="walk" gradientUnits="userSpaceOnUse" x1="${f(s[0])}" y1="${f(s[1])}" x2="${f(e[0])}" y2="${f(e[1])}"><stop offset="0" stop-color="${TEAL}" stop-opacity="0.15"/><stop offset="1" stop-color="${TEAL}"/></linearGradient></defs><path d="${catmullRom(pts)}" fill="none" stroke="url(#walk)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    // a dot where there is motion now, pulsing; a walk's rooms before its end get small dots
    const anchorOf = id => P(g.nodes[g.anchor[id]]);
    const dots = rooms.filter(room => fresh(room.id)).map(room => { const [x, y] = anchorOf(room.id); return `<circle class="ring" cx="${f(x)}" cy="${f(y)}" r="6" fill="none" stroke="${TEAL}" stroke-width="2"/><circle cx="${f(x)}" cy="${f(y)}" r="6" fill="${pal.dark ? '#1c1c1e' : '#fff'}" stroke="${TEAL}" stroke-width="3"/>`; }).join('');
    const steps = walk ? recent.filter(x => !fresh(x.room)).map(x => { const [px, py] = anchorOf(x.room); return `<circle cx="${f(px)}" cy="${f(py)}" r="4" fill="${TEAL}" fill-opacity="0.6"/>`; }).join('') : '';
    curve += `${steps}${dots}`;
    const marked = id => fresh(id) || (walk && recent.some(x => x.room === id));
    const labels = rooms.map(room => {
      const [x, y] = anchorOf(room.id), lit = lastOf.has(room.id);
      return `<text x="${f(x)}" y="${f(y - (marked(room.id) ? 14 : 0))}" text-anchor="middle" dominant-baseline="middle" font-size="11.5" font-weight="${fresh(room.id) ? 700 : 600}" fill="${lit ? pal.text : pal.sub}">${esc(room.name)}</text>`;
    }).join('');
    const names = rooms.filter(room => lastOf.has(room.id)).sort((a, b) => lastOf.get(b.id) - lastOf.get(a.id)).map(room => room.name);
    const aria = w.planAria(joinEt(names, lang));
    return { svg: `<svg class="plan" viewBox="0 0 ${f(vw)} ${f(vh)}" role="img" aria-label="${esc(aria)}"><path d="${floor}" fill="${c.floor}"/>${plates}${curve}${labels}</svg>`, aria };
  }

  const MOTION_CSS = `${PRICE_A3_CSS}
  .main{padding:16px;box-sizing:border-box}
  .msg{display:flex;align-items:center;justify-content:center;min-height:88px;font-size:14px;color:var(--sub)}
  .hd .big{align-items:center;gap:9px}
  .hd .l,.hd .big{min-width:0}
  .hd .big .n{font-size:26px;line-height:1.12;letter-spacing:-0.022em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .hd.bad .lab,.hd.bad .n{color:var(--high)}
  .dotlive{flex:none;width:10px;height:10px;border-radius:5px;background:${TEAL};animation:pulse 1.8s ease-out infinite}
  svg.plan{display:block;width:100%;height:auto;max-height:420px}
  .ring{transform-box:fill-box;transform-origin:center;animation:ring 2s ease-out infinite}
  .grp{margin:8px 0 2px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--sub)}
  .rows{display:flex;flex-direction:column;gap:2px}
  .mr,.mx{display:grid;grid-template-columns:108px minmax(0,1fr) 58px;align-items:center;gap:8px}
  .mr{min-height:32px;width:100%}
  .mr .nm{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mr .st{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:1.5px;height:18px}
  .mr .st i{border-radius:2px;background:var(--track)}
  .mr .lt{font-size:13px;font-weight:600;text-align:right;color:var(--sub)}
  .mr .lt.now{color:${TEAL}}
  .mr.bad .nm,.mr.bad .lt{color:var(--high)}
  .mx{font-size:11px;font-weight:600;color:var(--sub)}
  .mx .h{display:flex;justify-content:space-between}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(48,176,199,0.55)}70%{box-shadow:0 0 0 7px rgba(48,176,199,0)}100%{box-shadow:0 0 0 0 rgba(48,176,199,0)}}
  @keyframes ring{0%{transform:scale(1);opacity:0.7}100%{transform:scale(2.8);opacity:0}}
  @media (prefers-reduced-motion: reduce){.dotlive,.ring{animation:none}.ring{opacity:0}}
  `;

  // a row's 24 cells: teal, stronger with more motion in the hour
  const cellsOf = counts => counts.map(v => `<i${v ? ` style="background:${TEAL};opacity:${Math.min(1, 0.28 + v / 70).toFixed(2)}"` : ''}></i>`).join('');

  // Valve's motion (ADR-015): the headline, the plan with the trail of the last `minutes`, and a row
  // per room with its 24 hourly counts and its last time, which opens the PIR's history sheet.
  // Config: { plan, groups: [{ name, rooms: [{ entity, name }] }], alarms: [{ entity, name }], minutes,
  // part }; part 'plan' draws the headline and the plan, 'rows' the rows, neither all of it.
  class MotionCard extends LoadingCard {
    static css = MOTION_CSS;
    _check(c) { if (!(c.groups || []).length) throw new Error('khe-motion-card: groups is required'); }
    _historyIds() { return (this._config.groups || []).flatMap(g => g.rooms.map(r => r.entity)); }
    _watched() { return [...this._historyIds(), ...(this._config.alarms || []).map(a => a.entity)]; }
    _html(states, pal) { return motionA3(this, states, pal, this._onTimes(), Date.now()); }
  }

  function motionA3(card, states, pal, on, now) {
    const c = card._config, w = card._w, L = card._lang, tz = tzOf(card._hass);
    card._actions = new Map();
    card._sheets = new Map();
    if (!on && !(card._data && card._data.error)) return `<div class="glass main"><span class="msg">${w.loading}</span></div>`;
    const rows = motionRows(c, states, on || {}, now);
    const head = on ? motionHeadline(rows, states, c.alarms, now, L, tz) : { tone: 'last', label: w.dataFailed, big: '', note: '' };
    const hot = head.entity;
    const top = `<span class="hd${head.tone === 'bad' ? ' bad' : ''}"><span class="l"><span class="lab">${esc(head.label)}</span><span class="big">${head.tone === 'live' ? '<span class="dotlive" aria-hidden="true"></span>' : ''}<span class="n">${esc(head.big)}</span></span>${head.note ? `<span class="sub">${esc(head.note)}</span>` : ''}</span></span>`;
    const plan = c.plan && on ? planSvg(c.plan, rows, now, pal, L, c.minutes || 15).svg : '';
    let i = 0;
    const groups = (c.groups || []).map(g => {
      const list = rows.filter(r => r.group === g.name).map(r => {
        const k = `r${i++}`, last = on ? rowLast(r, now, L, tz) : '–';
        card._sheets.set(k, { title: r.name, entity: r.entity, more: r.entity, decimals: 0, unit: w.timesUnit, color: 'teal', text: st => (st[r.entity] && st[r.entity].state === 'on' ? w.motionOn : w.motionOff), history: { entity: r.entity, source: 'history', counts: true } });
        return `<button type="button" class="mr press${hot && hot === r.entity ? ' bad' : ''}" data-k="${k}" aria-label="${esc(w.motionRow(r.name, last))}"><span class="nm">${esc(r.name)}</span><span class="st" aria-hidden="true">${cellsOf(on ? hourlyCounts(r.times, now, tz) : new Array(24).fill(0))}</span><span class="lt num${r.on ? ' now' : ''}">${esc(last)}</span></button>`;
      }).join('');
      return `<span class="grp">${esc(g.name)}</span>${list}`;
    }).join('');
    const hours = binHours(now, tz), axis = `<span class="mx" aria-hidden="true"><span></span><span class="h">${[0, 6, 12, 18].map(k => `<span>${hours[k]}</span>`).join('')}<span>${w.now}</span></span><span></span></span>`;
    const rowsPart = `<span class="rows">${groups}</span>${axis}`;
    return `<div class="glass main">${c.part === 'rows' ? rowsPart : c.part === 'plan' ? `${top}${plan}` : `${top}${plan}${rowsPart}`}</div>`;
  }

  // the motion card's markup for a config, states and on-times, without an element (the tests')
  function motionA3Markup(conf, states, on, now, lang = 'et', hass = {}) {
    const card = { _config: conf, _lang: lang, _w: words(lang), _hass: { states, ...hass }, _data: on ? {} : null };
    return { html: motionA3(card, states, a3Palette(false), on, now), sheets: card._sheets };
  }

  return {
    exports: { motionRows, motionHeadline, rowLast, sharedEdge, planGraph, shortestPath, trailRooms, trailRuns, catmullRom, growRect, wallSpans, houseRects, planSvg, motionA3Markup },
    elements: [
    ["khe-motion-card", MotionCard, "KHE motion", "Where there was motion: a trail through the house plan and each room by the hour (A3)."],
  ]
  };
}
