// The icons the demo draws: every mdi: name the generated dashboard uses, the ones Home
// Assistant picks for a tile without an icon (by domain, device class and state, as its
// frontend does), and the page's own. Drawn by hand as 24x24 line icons: the page's CSP allows
// no icon font. No DOM and no imports, so the tests load it in Node.

const P = {
  // the dashboard's own mdi: names
  'arrow-down': '<path d="M12 4v16M6 14l6 6 6-6"/>',
  'arrow-up': '<path d="M12 20V4M6 10l6-6 6 6"/>',
  'awning-outline': '<path d="M3 5h18v3l-1.5 5h-15L3 8z"/><path d="M3 8h18M7.5 8l-1 5M12 8v5M16.5 8l1 5M5 13v6M19 13v6"/>',
  cctv: '<path d="M3 7.5 15 4l2 6-12 3.5z"/><path d="M15.5 9.5 19 12M8 13v5H4M4 15.5v5"/><circle cx="7" cy="9" r=".6"/>',
  'dots-horizontal': '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4c-1.5-3.8.4-6.4 2.6-6.4 2.4 0 2.8 3.6-1.2 6.8M13.6 12c3.8-1.5 6.4.4 6.4 2.6 0 2.4-3.6 2.8-6.8-1.2M12 13.6c1.5 3.8-.4 6.4-2.6 6.4-2.4 0-2.8-3.6 1.2-6.8M10.4 12c-3.8 1.5-6.4-.4-6.4-2.6 0-2.4 3.6-2.8 6.8 1.2"/>',
  'fan-plus': '<circle cx="10" cy="12" r="1.4"/><path d="M10 10.6c-1.3-3.3.3-5.6 2.3-5.6 2 0 2.4 3.1-1 5.9M11.4 12c3.3-1.3 5.6.3 5.6 2.3 0 2-3.1 2.4-5.9-1M10 13.4c1.3 3.3-.3 5.6-2.3 5.6-2 0-2.4-3.1 1-5.9M8.6 12c-3.3 1.3-5.6-.3-5.6-2.3 0-2 3.1-2.4 5.9 1"/><path d="M19 3v5M16.5 5.5h5"/>',
  'gesture-tap-button': '<rect x="3" y="4" width="18" height="8" rx="2"/><path d="M11 9v8.5l-1.6-1.4a1.2 1.2 0 0 0-1.7 1.7L10.5 21h7l1-4.5-4.5-1.5V9a1.5 1.5 0 0 0-3 0z"/>',
  'heat-pump': '<rect x="3" y="5" width="18" height="14" rx="1.5"/><circle cx="10" cy="12" r="4.5"/><path d="M10 9.5v5M7.5 12h5M17 8.5v7"/>',
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
  'home-assistant': '<path d="M12 3 3 11h2.5v9.5h13V11H21z"/><circle cx="12" cy="10.5" r="1.4"/><circle cx="9" cy="14.5" r="1.1"/><circle cx="15" cy="13.5" r="1.1"/><path d="M12 11.9V20.5M9.9 15.3 12 17.5M14.1 14.4 12 16"/>',
  'hot-tub': '<circle cx="7" cy="5" r="1.6"/><path d="M3 12h18v4.5a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5zM5.5 12V9.5a1.5 1.5 0 0 1 3 0V12M12 3.5c-1 1.5 1 2.5 0 4M15.5 3.5c-1 1.5 1 2.5 0 4M19 3.5c-1 1.5 1 2.5 0 4"/>',
  'lightning-bolt': '<path d="M13 2 5 13.5h6L10 22l9-12h-6.2z"/>',
  'meter-electric': '<rect x="4" y="3" width="16" height="18" rx="2"/><rect x="7" y="6" width="10" height="5" rx="1"/><path d="m12.5 13-2 3.5h3l-2 3.5"/>',
  'movie-open-play': '<rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="m3 8 16.5-4.5.6 2.4M7.5 6.9l2.5 1.1M12.5 5.5 15 6.6"/><path d="m10 11.5 4.5 2.5-4.5 2.5z"/>',
  'play-box-multiple': '<rect x="7" y="3" width="14" height="14" rx="1.5"/><path d="M3 7v12.5A1.5 1.5 0 0 0 4.5 21H17"/><path d="m12 7 4 3-4 3z"/>',
  power: '<path d="M12 3v8"/><path d="M6.3 7.2a8 8 0 1 0 11.4 0"/>',
  'remote-tv': '<rect x="2.5" y="4" width="13" height="9" rx="1.2"/><path d="M6.5 16h5"/><rect x="17" y="8" width="4.5" height="13" rx="1.5"/><path d="M19.25 11v.5M19.25 14.5v.5M19.25 17.5v.5"/>',
  'shield-home': '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m8.5 12.5 3.5-3 3.5 3M9.5 11.7V16h5v-4.3"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  stove: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 8h16M7.5 5.5h.01M11 5.5h.01"/><rect x="7" y="11" width="10" height="7" rx="1"/>',
  television: '<rect x="2.5" y="5" width="19" height="12.5" rx="1.5"/><path d="M8 21h8M12 17.5V21"/>',
  'television-classic': '<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="m8 3 4 4 4-4"/><rect x="5" y="9.5" width="10.5" height="8" rx="1"/><path d="M18.5 11v.5M18.5 14v.5"/>',
  'television-play': '<rect x="2.5" y="5" width="19" height="12.5" rx="1.5"/><path d="M8 21h8M12 17.5V21"/><path d="m10 8.5 4.5 2.75-4.5 2.75z"/>',
  tune: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  'washing-machine': '<rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M4 7h16M7 4.8h.01M10 4.8h.01"/><circle cx="12" cy="14" r="4.5"/><path d="M8.5 14.5c1.2-1 2.3.9 3.5 0s2.3-1 3.5 0"/>',
  'water-boiler': '<rect x="5.5" y="2.5" width="13" height="16" rx="3"/><path d="M8.5 18.5V21M15.5 18.5V21M12 7.5c-1.5 2-2.3 3.2-2.3 4.2a2.3 2.3 0 0 0 4.6 0c0-1-.8-2.2-2.3-4.2z"/>',
  'weather-night': '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  'floor-plan': '<path d="M3 3h18v18H3zM3 12h7M14 12h7M10 3v5M10 12v9M14 12v4"/>',
  'account-switch': '<circle cx="8" cy="7" r="3"/><path d="M2.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><path d="M15 7.5h6l-2-2M21 12.5h-6l2 2"/>',
  'cellphone-play': '<rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="m10.5 9 4 3-4 3zM11 18.5h2"/>',

  // what HA picks for an entity without an icon
  thermometer: '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 10v7"/>',
  'water-percent': '<path d="M12 3.5C8.5 8 6.5 11 6.5 14a5.5 5.5 0 0 0 11 0c0-3-2-6-5.5-10.5z"/><path d="m9.5 17 5-5M10 12.5h.01M14 16.5h.01"/>',
  flash: '<path d="M7 2v11h3v9l7-12h-4l4-8z"/>',
  battery: '<rect x="7" y="4" width="10" height="17" rx="1.5"/><path d="M10 2.5h4M9.5 12h5M9.5 15h5M9.5 18h5"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.8"/><path d="M5.5 9v.01M18.5 15v.01"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.01"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m7.5 12.5 3 3 6-6.5"/>',
  'door-closed': '<path d="M5 21V3.5h14V21M3 21h18"/><path d="M15.5 12h.01"/>',
  'door-open': '<path d="M3 21h18M5 21V3.5h14V21"/><path d="M5 3.5 13 6v16.5L5 21"/><path d="M10.5 13h.01"/>',
  'motion-sensor': '<circle cx="12" cy="4.5" r="1.8"/><path d="m9 21 2-6 2.5 2v4M7 12l2.5-4h4l2.5 3.5 2.5.5M13.5 8l-1.5 6.5"/>',
  'motion-sensor-off': '<circle cx="12" cy="4.5" r="1.8"/><path d="m9 21 2-6 2.5 2v4M7 12l2.5-4h4l2.5 3.5 2.5.5M13.5 8l-1.5 6.5M3 3l18 18"/>',
  'smoke-detector': '<path d="M3 8h18M5 8v2.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><circle cx="12" cy="10.2" r=".8"/><path d="M8 16c1 1-1 2 0 3M12 16c1 1-1 2 0 3M16 16c1 1-1 2 0 3"/>',
  'check-network': '<path d="M3 9.5a13 13 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0"/><path d="m9 16.5 2 2 4-4"/>',
  'close-network': '<path d="M3 9.5a13 13 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0"/><path d="m9.5 15 5 5M14.5 15l-5 5"/>',
  'shield-check': '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  'shield-alert': '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="M12 8v5M12 16v.01"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  'bell-ring': '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0M3 8.5a8 8 0 0 1 2.5-4.5M21 8.5a8 8 0 0 0-2.5-4.5"/>',
  'toggle-switch': '<rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="16.5" cy="12" r="2.8"/>',
  'toggle-switch-off': '<rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="7.5" cy="12" r="2.8"/>',
  'ray-vertex': '<path d="M2.5 12h6M15.5 12h6"/><circle cx="12" cy="12" r="3"/>',
  'format-list-bulleted': '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".9"/><circle cx="4.5" cy="12" r=".9"/><circle cx="4.5" cy="18" r=".9"/>',
  'calendar-clock': '<path d="M11 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5h13a1.5 1.5 0 0 1 1.5 1.5V10M3.5 9.5h16M8 3v4M15 3v4"/><circle cx="17" cy="17" r="4"/><path d="M17 15v2l1.4 1.2"/>',
  'clock-outline': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'window-shutter': '<path d="M3 4h18M4.5 4v16M19.5 4v16M4.5 8h15M4.5 12h15M4.5 16h15"/>',
  'window-shutter-open': '<path d="M3 4h18M4.5 4v16M19.5 4v16M4.5 8h15"/>',
  lightbulb: '<path d="M9 18h6M10 21h4M8.5 14.5a6 6 0 1 1 7 0c-.8.7-1.2 1.6-1.2 2.5H9.7c0-.9-.4-1.8-1.2-2.5z"/>',
  'lightbulb-outline': '<path d="M9 18h6M10 21h4M8.5 14.5a6 6 0 1 1 7 0c-.8.7-1.2 1.6-1.2 2.5H9.7c0-.9-.4-1.8-1.2-2.5z"/><path d="M12 7v3"/>',
  'television-off': '<rect x="2.5" y="5" width="19" height="12.5" rx="1.5"/><path d="M8 21h8M12 17.5V21M3 3l18 18"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',
  'account-arrow-right': '<circle cx="10" cy="8" r="4"/><path d="M3 20.5c0-4 3.1-6.5 7-6.5 1.4 0 2.6.3 3.7.8M16 17.5h6M19.5 15l2.5 2.5-2.5 2.5"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="1.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5z"/>',
  'package-up': '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/><path d="M16 3.5v-2M14.8 2.7 16 1.5l1.2 1.2"/>',
  package: '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10M8 5l8 4"/>',
  'weather-cloudy': '<path d="M7 18.5h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.7A3.2 3.2 0 0 0 7 18.5z"/>',
  'weather-partly-cloudy': '<path d="M9 18.5h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.5A2.8 2.8 0 0 0 9 18.5z"/><path d="M8.2 9.5A3.5 3.5 0 1 0 4 13M6.5 2.5v1.5M2 7h1.5M3.3 3.8l1 1"/>',
  'weather-rainy': '<path d="M7 15h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.7A3.2 3.2 0 0 0 7 15z"/><path d="m8.5 18-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>',
  'weather-pouring': '<path d="M7 13h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.7A3.2 3.2 0 0 0 7 13z"/><path d="m8 16-2 5M12 16l-2 5M16 16l-2 5"/>',
  'shield-lock': '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><rect x="9" y="11" width="6" height="4.5" rx=".8"/><path d="M10.2 11V9.8a1.8 1.8 0 0 1 3.6 0V11"/>',
  'shield-moon': '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="M14.5 14.2A3.5 3.5 0 0 1 11 9a3.5 3.5 0 1 0 3.5 5.2z"/>',
  'shield-off': '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6zM3 3l18 18"/>',
  'bell-alert': '<path d="M6 16V11a6 6 0 0 1 9-5.2M18 11v5l1.5 2h-15"/><path d="M10 20.5a2 2 0 0 0 4 0M20 3v4M20 9.5v.01"/>',
  'button-pointer': '<rect x="3" y="5" width="18" height="9" rx="2"/><path d="m12 11 1.5 10 2.2-3.5 3.8 1.2z"/>',
  'fan-off': '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4c-1.5-3.8.4-6.4 2.6-6.4 2.4 0 2.8 3.6-1.2 6.8M12 13.6c1.5 3.8-.4 6.4-2.6 6.4-2.4 0-2.8-3.6 1.2-6.8M3 3l18 18"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18 6l1.5-1.5"/>',
  'sine-wave': '<path d="M2.5 12c2.5-8 5-8 7 0s4.5 8 7 0 3.5-5 5-3"/>',
  'cellphone-wireless': '<rect x="6.5" y="5" width="9" height="16.5" rx="1.8"/><path d="M10 18.5h2M17.5 7a3.5 3.5 0 0 1 0 5M19.5 4.5a7 7 0 0 1 0 10"/>',
  'weather-sunny': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M5 19l1.8-1.8M17.2 6.8 19 5"/>',
  'alarm-light': '<path d="M6 18v-5a6 6 0 0 1 12 0v5M4 18h16v3H4zM12 3v2M4 6l1.5 1.5M20 6l-1.5 1.5"/>',
  car: '<path d="M5 16.5h14v-4l-2-4.5H7l-2 4.5z"/><path d="M5 12.5h14"/><circle cx="8" cy="16.5" r="1.8"/><circle cx="16" cy="16.5" r="1.8"/>',
  pulse: '<path d="M2.5 12h4l2.5-6 4 12 2.5-6h6"/>',

  // the page's own
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  'arrow-left': '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'chevron-up': '<path d="m6 15 6-6 6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M6 12h12M12 6v12"/>',
  minus: '<path d="M6 12h12"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 16.5v.01"/>'
};

export const GENERIC = 'help';
export const ICON_NAMES = Object.keys(P);
export const hasIcon = name => Object.hasOwn(P, String(name).replace(/^mdi:/, ''));

export function svg(name, cls = '') {
  const k = String(name || '').replace(/^mdi:/, '');
  return `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k] || P[GENERIC]}</svg>`;
}

const ON_OFF = {
  door: ['door-closed', 'door-open'], garage_door: ['door-closed', 'door-open'], opening: ['door-closed', 'door-open'],
  motion: ['motion-sensor-off', 'motion-sensor'], occupancy: ['motion-sensor-off', 'motion-sensor'],
  problem: ['check-circle', 'alert-circle'], smoke: ['smoke-detector', 'smoke-detector'],
  connectivity: ['close-network', 'check-network'], tamper: ['shield-check', 'shield-alert'],
  sound: ['bell', 'bell-ring'], safety: ['shield-check', 'shield-alert'], battery: ['battery', 'battery']
};
const SENSOR = {
  temperature: 'thermometer', humidity: 'water-percent', energy: 'lightning-bolt', power: 'flash', battery: 'battery',
  monetary: 'cash', voltage: 'sine-wave', duration: 'timer', precipitation: 'weather-pouring',
  precipitation_intensity: 'weather-rainy', timestamp: 'clock-outline'
};
const ALARM = { disarmed: 'shield-off', armed_home: 'shield-home', armed_away: 'shield-lock', armed_night: 'shield-moon', triggered: 'bell-alert', arming: 'shield-lock', pending: 'shield-lock' };
export const WEATHER = { cloudy: 'weather-cloudy', partlycloudy: 'weather-partly-cloudy', rainy: 'weather-rainy', pouring: 'weather-pouring', night: 'weather-night', 'clear-night': 'weather-night', sunny: 'weather-sunny' };

// the icon name HA's frontend shows for an entity with no icon set
export function entityIcon(entity, st) {
  const d = entity.split('.')[0];
  const s = st ? st.state : 'off', a = (st && st.attributes) || {};
  const on = s === 'on';
  switch (d) {
    case 'binary_sensor': {
      const pair = ON_OFF[a.device_class];
      return pair ? pair[on ? 1 : 0] : 'check-circle';
    }
    case 'sensor': return SENSOR[a.device_class] || (a.unit_of_measurement === '%' ? 'water-percent' : 'eye');
    case 'light': return on ? 'lightbulb' : 'lightbulb-outline';
    case 'switch': return on ? 'toggle-switch' : 'toggle-switch-off';
    case 'input_boolean': return on ? 'toggle-switch' : 'toggle-switch-off';
    case 'fan': return on ? 'fan' : 'fan-off';
    case 'cover': return a.device_class === 'awning' ? 'awning-outline' : s === 'closed' ? 'window-shutter' : 'window-shutter-open';
    case 'number': case 'input_number': return 'ray-vertex';
    case 'select': case 'input_select': return 'format-list-bulleted';
    case 'input_datetime': return a.has_date ? 'calendar-clock' : 'clock-outline';
    case 'media_player': return s === 'off' ? 'television-off' : 'television';
    case 'person': return s === 'home' ? 'account' : 'account-arrow-right';
    case 'device_tracker': return 'car';
    case 'camera': return 'video';
    case 'update': return on ? 'package-up' : 'package';
    case 'water_heater': return 'water-boiler';
    case 'climate': return 'thermometer';
    case 'weather': return WEATHER[s] || 'weather-cloudy';
    case 'alarm_control_panel': return ALARM[s] || 'shield-home';
    case 'button': return 'button-pointer';
    case 'script': return 'pulse';
    default: return GENERIC;
  }
}

// the icon a card shows: its own, else the entity's default
export const iconFor = (conf, entity, st) => (conf && conf.icon ? conf.icon.replace(/^mdi:/, '') : entity ? entityIcon(entity, st) : GENERIC);
