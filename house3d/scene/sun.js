// The sun for the real style: where it stands at a time and place, that direction in the
// model's axes, and how its disc in the sky shows at an altitude. Pure functions; the core loads
// this module like the kit, not as a layer.
const D2R = Math.PI / 180;
// L-EST97 is a Lambert conformal projection with its central meridian at 24 E; true north turns
// from grid north by the cone constant, this many degrees per degree of longitude from there
const CONVERGENCE = 0.854;
const CENTRAL_MERIDIAN = 24;

const sin = d => Math.sin(d * D2R), cos = d => Math.cos(d * D2R), tan = d => Math.tan(d * D2R);
const mod = (a, n) => ((a % n) + n) % n;
const clamp01 = v => Math.min(1, Math.max(0, v));

/**
 * sunPosition(date, lat, lon) -> { altitude, azimuth } in degrees, azimuth clockwise from true
 * north. NOAA's solar position equations (the General Solar Position spreadsheet), without
 * atmospheric refraction.
 */
export function sunPosition(date, lat, lon) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + sin(2 * M) * (0.019993 - 0.000101 * T) + sin(3 * M) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * sin(omega);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * cos(omega);
  const decl = Math.asin(sin(eps) * sin(lambda)) / D2R;
  const y = tan(eps / 2) ** 2;
  const eqTime = 4 / D2R * (y * sin(2 * L0) - 2 * e * sin(M) + 4 * e * y * sin(M) * cos(2 * L0) - 0.5 * y * y * sin(4 * L0) - 1.25 * e * e * sin(2 * M));
  const minutes = mod(date.getTime() / 60000, 1440);
  const solar = mod(minutes + eqTime + 4 * lon, 1440);
  const hour = solar / 4 - 180;
  const cz = Math.min(1, Math.max(-1, sin(lat) * sin(decl) + cos(lat) * cos(decl) * cos(hour)));
  const zenith = Math.acos(cz) / D2R;
  const sz = sin(zenith);
  let azimuth;
  if (Math.abs(sz) < 1e-9) azimuth = 180;
  else {
    const a = Math.acos(Math.min(1, Math.max(-1, (sin(lat) * cz - sin(decl)) / (cos(lat) * sz)))) / D2R;
    azimuth = hour > 0 ? mod(a + 180, 360) : mod(540 - a, 360);
  }
  return { altitude: 90 - zenith, azimuth };
}

/** gridBearing(trueAzimuth, lon) -> the same direction as an L-EST97 grid azimuth. */
export function gridBearing(trueAzimuth, lon) {
  return trueAzimuth - CONVERGENCE * (lon - CENTRAL_MERIDIAN);
}

/**
 * sunDirection(altitude, gridAzimuth, bearing) -> [x, y, z], the unit vector towards the sun in
 * the model's axes, where bearing is the grid azimuth of the model's +x axis.
 */
export function sunDirection(altitude, gridAzimuth, bearing) {
  const a = gridAzimuth - bearing, h = cos(altitude);
  return [cos(a) * h, sin(altitude), sin(a) * h];
}

/**
 * sunGlow(altitude) -> { visible, opacity, warm }: the sun's disc in the sky shows from 1 degree
 * under the horizon, fades in up to 2 degrees above it, and is fully warm below 3 degrees, white
 * above 12.
 */
export function sunGlow(altitude) {
  return { visible: altitude > -1, opacity: clamp01((altitude + 1) / 3), warm: clamp01((12 - altitude) / 9) };
}

// realLight(): the real style's look, tuned by eye on renders of 12 November and 21 June. Each
// sky is [zenith, horizon]; the sky and hemisphere colours are blended in linear light
const SKY = { day: ['#3d84d6', '#b9d3ea'], dusk: ['#3f5f96', '#f1b98a'], night: ['#03050c', '#141c33'] };
const DUSK_ALT = 8, TWILIGHT = 6, SUN_FULL = 3, WARM_ALT = 22;
const SUN = 4;
// the low sun's warm white, for its light and its disc
export const LOW_SUN = '#ffcf9e';
// the moon is not the real one: it shines from the home view's side ([-x, -z], high), so the walls
// the camera sees read at night, and it casts the shadows the sun does by day
const MOON = { dir: [-0.6, 0.8, -0.35], color: '#d3dcff', intensity: 2 };
// by day a soft warm light from the home view's side, without shadows: in winter the sun lights
// the house from behind, and the front the camera sees would get only the even sky light
const FILL = { dir: [-0.55, 0.55, -0.65], color: '#fff4e6', intensity: 1.2 };
const HEMI = { day: ['#c9dcf2', '#8c8670'], night: ['#9aa5c2', '#2e3138'], dayI: 0.7, highI: 0.4, duskI: 0.4, nightI: 0.5 };
// the environment (the sky as an image) is half desaturated; the hemisphere fills in beside it,
// at ENV_HEMI of its strength by day and all of it at night
const ENV = { day: 0.6, night: 0.6, desat: 0.5, ground: 0.5 }, ENV_HEMI = 0.45;

const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = hex => [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const grey = (c, t) => { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return mix(c, [l, l, l], t); };
const SKY_LIN = Object.fromEntries(Object.entries(SKY).map(([k, v]) => [k, v.map(rgb)]));
const HEMI_LIN = { day: HEMI.day.map(rgb), night: HEMI.night.map(rgb) };
const LOW_SUN_LIN = rgb(LOW_SUN), MOON_LIN = rgb(MOON.color), FILL_LIN = rgb(FILL.color);

/**
 * realLight(altitude) -> the real style's light at a sun altitude in degrees, colours as linear
 * [r, g, b]: { zenith, horizon } the sky (day above 8 degrees, dusk to the horizon, night 6
 * degrees under it), key { intensity, color, dir } the one shadow-casting light (the sun with
 * dir null while it is up, else the moon with its dir; 0 at the horizon, where they swap),
 * fill { intensity, color, dir } the day's shadowless light from the home view's side, hemi { intensity, sky, ground }, env { intensity, zenith, horizon, ground } and night, 0 by
 * day to 1 from the horizon down.
 */
export function realLight(alt) {
  // dark ramps the sky and the moon in over twilight, 0 at the horizon to 1 at 6 degrees under it;
  // night, which the rooms' glow follows, ramps through dusk, 0 at 8 degrees to 1 at the horizon
  const dark = clamp01(-alt / TWILIGHT), up = clamp01(alt / SUN_FULL);
  const [from, to, t] = alt >= DUSK_ALT ? ['day', 'day', 0] : alt >= 0 ? ['dusk', 'day', alt / DUSK_ALT] : ['dusk', 'night', dark];
  const [zenith, horizon] = SKY_LIN[from].map((c, i) => mix(c, SKY_LIN[to][i], t));
  const key = alt > 0
    ? { intensity: SUN * up, color: mix([1, 1, 1], LOW_SUN_LIN, clamp01(1 - alt / WARM_ALT)), dir: null }
    : { intensity: MOON.intensity * dark, color: MOON_LIN, dir: MOON.dir };
  const hemiI = alt > 0
    ? HEMI.dayI + HEMI.highI * clamp01(alt / 25) + HEMI.duskI * (1 - clamp01(alt / DUSK_ALT))
    : HEMI.nightI + (HEMI.dayI - HEMI.nightI) * (1 - dark);
  const hemi = {
    intensity: hemiI * (1 - (1 - ENV_HEMI) * (1 - dark)),
    sky: mix(HEMI_LIN.day[0], HEMI_LIN.night[0], dark),
    ground: mix(HEMI_LIN.day[1], HEMI_LIN.night[1], dark)
  };
  const env = { intensity: ENV.night + (ENV.day - ENV.night) * up, zenith: grey(zenith, ENV.desat), horizon: grey(horizon, ENV.desat), ground: hemi.ground.map(v => v * ENV.ground) };
  const night = alt >= DUSK_ALT ? 0 : alt <= 0 ? 1 : 1 - alt / DUSK_ALT;
  const fill = { intensity: FILL.intensity * up, color: FILL_LIN, dir: FILL.dir };
  return { zenith, horizon, key, fill, hemi, env, night };
}
