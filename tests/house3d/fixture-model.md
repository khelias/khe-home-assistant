# House 3D test fixture

A made-up house in the shape of the real model (khe-meta `house/house-model.md`), for
`tests/house3d/` and the public demo at khe.ee/house3d/ (`house3d-build.py --demo`). Nothing
here describes a real place: the names are invented, the device entity ids start with `test_`,
and the georeference points nowhere. Every device, car and surroundings coordinate has three
decimals ending in an odd digit, so the fixture's own privacy scan cannot match numbers in the
vendored three.js.

A one-storey house of 10 x 8 m: a kitchen-living room on the west side with a glass door to the
front garden and a floor window to the back deck, the hall, bathroom and bedroom on the east
side, and a carport beside it that the car reaches through the sliding drive gate. The play area
is in the back garden. The engine tests count the outer walls, the street wall's openings and the
site's planters, steps and paving, so change those together with the tests.

This file has a `devices` key, so the privacy scan flags it: scan the engine with the real
model, never this file.

```json house3d:geometry
{
 "units": "m",
 "axes": "x east along the street, z away from the street, y up",
 "georef": { "crs": "EPSG:3301", "origin_E": 135797.137, "origin_N": 197531.371, "x_axis_bearing_deg": 30, "fit_rms_m": 0.05 },
 "ceiling": 2.6,
 "roofs": {
  "roofN": { "pitch_deg": 6, "high_x": 2, "high_y": 4.6, "falls": "east", "outline": [[1.7, 6], [12.3, 6], [12.3, 10.3], [1.7, 10.3]], "thick": 0.3 },
  "roofS": { "slope": 0.1, "high_x": 2, "high_y": 4.0, "falls": "east", "outline": [[1.7, 1.7], [12.3, 1.7], [12.3, 6], [1.7, 6]], "thick": 0.3 }
 },
 "roof_steps": [
  { "a": [2, 6], "b": [12, 6], "top": "roofN", "bot": "roofS" }
 ],
 "walls": [
  { "a": [2, 2], "b": [12, 2], "t": 0.4, "top": "roofS", "openings": [
   { "kind": "window", "c": 1.7, "w": 1.2, "h": 1.2, "sill": 0.9 },
   { "kind": "glassdoor", "c": 3.9, "w": 1.8, "h": 2.2 },
   { "kind": "door", "c": 6.3, "w": 1, "h": 2.1 }
  ] },
  { "a": [12, 2], "b": [12, 6], "t": 0.4, "top": "roofS", "openings": [
   { "kind": "window", "c": 1.6, "w": 0.6, "h": 0.6, "sill": 1.4 }
  ] },
  { "a": [12, 6], "b": [12, 10], "t": 0.4, "top": "roofN", "openings": [
   { "kind": "window", "c": 2, "w": 1, "h": 1.2, "sill": 0.9 }
  ] },
  { "a": [12, 10], "b": [2, 10], "t": 0.4, "top": "roofN", "openings": [
   { "kind": "window", "c": 7.3, "w": 2, "h": 2.2, "sill": 0 },
   { "kind": "window", "c": 2.4, "w": 1.6, "h": 1.3, "sill": 0.8 }
  ] },
  { "a": [2, 10], "b": [2, 6], "t": 0.4, "top": "roofN", "openings": [
   { "kind": "window", "c": 2, "w": 1.2, "h": 1.2, "sill": 0.9 }
  ] },
  { "a": [2, 6], "b": [2, 2], "t": 0.4, "top": "roofS", "openings": [
   { "kind": "window", "c": 2.4, "w": 1.4, "h": 1, "sill": 1 }
  ] },
  { "a": [7, 2.2], "b": [7, 9.8], "t": 0.15, "top": 2.6, "openings": [
   { "kind": "door", "c": 1.6, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [7, 5], "b": [11.8, 5], "t": 0.15, "top": 2.6, "openings": [
   { "kind": "door", "c": 1.2, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [9.6, 2.2], "b": [9.6, 5], "t": 0.15, "top": 2.6, "openings": [
   { "kind": "door", "c": 1.8, "w": 0.8, "h": 2.1 }
  ] }
 ],
 "furniture": [
  { "what": "kitchen counter", "rect": [2.2, 2.4, 2.8, 5.4], "y": [0, 0.9] },
  { "what": "dining table", "circle": [4.6, 4.6, 0.6], "y": [0, 0.75] },
  { "what": "sofa", "rect": [3.2, 7.1, 5.6, 8], "y": [0, 0.8] },
  { "what": "bed", "rect": [9, 7.8, 10.8, 9.8], "y": [0, 0.5] },
  { "what": "wardrobe", "rect": [7.1, 5.1, 8.9, 5.7], "y": [0, 2.1] },
  { "what": "bench", "rect": [7.1, 2.3, 7.5, 3.4], "y": [0, 0.45] }
 ],
 "site": {
  "lot": [[0, -6], [22, -6], [22, 20], [0, 20]],
  "hedges": [[[0, 20], [22, 20]]],
  "fences": [[[22, -6], [22, 20]], [[0, -6], [0, 20]]],
  "bar_fences": [[[0, -6], [13.5, -6]], [[17.5, -6], [22, -6]]],
  "gates": [
   { "name": "drive", "a": [13.5, -6], "b": [17.5, -6], "kind": "sliding", "slide": "a", "height": 1.5 }
  ],
  "decks": [[[2, 10.3], [8, 10.3], [8, 13.5], [2, 13.5]]],
  "paving": [[[12.8, -6], [17.2, -6], [17.2, 1], [12.8, 1], [12.8, 1.7], [9.5, 1.7], [9.5, 0.5], [12.8, 0.5]]],
  "porch": [7.5, 0.9, 9.1, 1.8],
  "garage_roof": { "rects": [[12.8, 0.8, 17.2, 7.2], [12.8, 7.2, 17.2, 9.4]], "y": [2.6, 2.8] },
  "pergola": { "rect": [2.3, 10.3, 6.7, 13.3], "height": 2.6, "modules": 2 },
  "outdoor_units": [{ "what": "heat pump", "rect": [1, 6.6, 1.6, 7.6], "y": [0, 0.8] }],
  "sandpit": { "rect": [6.5, 15.5, 8, 17], "height": 0.25 },
  "swing": { "rect": [10, 14, 10.2, 17], "height": 2.2, "slide": [12, 17.4] },
  "trampoline": { "rect": [16.6, 13.8, 20.2, 17.4], "height": 0.9 },
  "planters": [
   { "rect": [6.6, 0.9, 7.2, 1.5], "y": [0, 0.45], "plant": "thuja" },
   { "rect": [8.3, 10.6, 9.8, 11.2], "y": [0, 0.6], "plant": "low", "finish": "cladding" }
  ],
  "steps": [{ "rect": [9.1, 1, 9.5, 1.7], "height": 0.115 }],
  "trees": [
   { "id": "t1", "kind": "apple", "pos": [3.5, -3], "height": 4, "crown": 3 },
   { "id": "t2", "kind": "birch", "pos": [20.5, 19], "height": 12, "crown": 5 },
   { "id": "t3", "kind": "birch", "pos": [1.6, 18.2], "height": 10, "crown": 4.5 },
   { "id": "t4", "kind": "maple", "pos": [19.5, 11], "height": 6, "crown": 4 },
   { "id": "t5", "kind": "apple", "pos": [3.8, 16.6], "height": 4.5, "crown": 3.5 }
  ]
 }
}
```

```json house3d:rooms
{
 "rooms": [
  { "id": "r1", "no": "01", "name": "Elutuba", "rects": [[2.2, 2.2, 7, 9.8]] },
  { "id": "r2", "no": "02", "name": "Magamistuba", "rects": [[7, 5, 11.8, 9.8]] },
  { "id": "r3", "no": "03", "name": "Esik", "rects": [[7, 2.2, 9.6, 5]], "floor": "tile" },
  { "id": "r4", "no": "04", "name": "Vannituba", "rects": [[9.6, 2.2, 11.8, 5]], "floor": "tile" },
  { "id": "carport", "no": "05", "name": "Varjualune", "rects": [[13, 1, 17, 7]], "floor": "paving" }
 ]
}
```

```json house3d:private
{
 "room_names": { "r1": "Köök-elutuba", "r2": "Vanemate tuba" },
 "devices": [
  {"entity": "light.test_living", "name": "Elutoa lamp", "type": "light", "room": "r1", "pos": [4.317, 2.313, 7.137]},
  {"entity": "light.test_kitchen", "name": "Köögi valgus", "type": "light", "room": "r1", "pos": [3.513, 2.313, 3.937]},
  {"entity": "light.test_bedroom", "name": "Magamistoa lamp", "type": "light", "room": "r2", "pos": [9.537, 2.313, 7.331]},
  {"entity": "light.test_hall", "name": "Esiku valgus", "type": "light", "room": "r3", "pos": [8.513, 2.313, 3.137]},
  {"entity": "light.test_porch", "name": "Välisvalgus", "type": "light", "room": "oues", "pos": [8.313, 2.311, 1.531]},
  {"entity": "light.test_pergola", "name": "Pergola LED", "type": "light", "room": "oues", "pos": [4.517, 2.533, 11.813], "role": "pergola-light"},
  {"entity": "sensor.test_living_temp", "name": "Elutoa temperatuur", "type": "sensor", "room": "r1", "pos": [6.737, 1.513, 8.117]},
  {"entity": "sensor.test_bedroom_temp", "name": "Magamistoa temperatuur", "type": "sensor", "room": "r2", "pos": [11.513, 1.513, 6.137]},
  {"entity": "sensor.test_outdoor_temp", "name": "Välistemperatuur", "type": "sensor", "room": "oues", "pos": [1.513, 1.713, 3.117]},
  {"entity": "binary_sensor.test_front_door", "name": "Välisuks", "type": "door", "room": "r3", "pos": [8.317, 1.117, 2.313]},
  {"entity": "binary_sensor.test_terrace_door", "name": "Terrassi uks", "type": "door", "room": "r1", "pos": [4.713, 1.117, 9.713]},
  {"entity": "binary_sensor.test_hall_motion", "name": "Esiku liikumisandur", "type": "motion", "room": "r3", "pos": [9.317, 2.317, 4.713]},
  {"entity": "binary_sensor.test_carport_motion", "name": "Varjualuse liikumisandur", "type": "motion", "room": "carport", "pos": [16.913, 2.317, 6.917]},
  {"entity": "binary_sensor.test_smoke_hall", "name": "Esiku suitsuandur", "type": "smoke", "room": "r3", "pos": [8.137, 2.513, 3.913]},
  {"entity": "binary_sensor.test_smoke_living", "name": "Elutoa suitsuandur", "type": "smoke", "room": "r1", "pos": [5.137, 2.513, 5.913]},
  {"entity": "switch.test_coffee", "name": "Kohvimasin", "type": "plug", "room": "r1", "pos": [2.513, 1.117, 5.113]},
  {"entity": "switch.test_tv", "name": "Teler", "type": "plug", "room": "r1", "pos": [6.813, 1.113, 6.513]},
  {"entity": "cover.test_pergola", "name": "Pergola katus", "type": "cover", "room": "oues", "pos": [2.913, 2.713, 12.913]},
  {"entity": "cover.test_bedroom_blind", "name": "Magamistoa ruloo", "type": "cover", "room": "r2", "pos": [11.713, 2.113, 8.117]},
  {"entity": "fan.test_ventilation", "name": "Ventilatsioon", "type": "vent", "room": "r4", "pos": [10.713, 2.517, 4.313]},
  {"entity": "climate.test_heat_pump", "name": "Soojuspump", "type": "heatpump", "room": "oues", "pos": [1.313, 0.917, 7.113]},
  {"entity": "climate.test_floor_heating", "name": "Põrandaküte", "type": "climate", "room": "r4", "pos": [11.513, 0.513, 2.713]},
  {"entity": "water_heater.test_boiler", "name": "Boiler", "type": "climate", "room": "r4", "pos": [10.113, 1.513, 2.513]},
  {"entity": "alarm_control_panel.test_alarm", "name": "Valvesüsteem", "type": "alarm", "room": "r3", "pos": [7.313, 1.513, 4.713]},
  {"entity": "camera.test_drive", "name": "Väravakaamera", "type": "camera", "room": "oues", "pos": [12.937, 2.537, 0.913], "look": [0.349, -0.937]},
  {"entity": "camera.test_garden", "name": "Aiakaamera", "type": "camera", "room": "oues", "pos": [11.937, 2.537, 10.513], "look": [-0.143, 0.991]}
 ],
 "car": {
  "entity": "device_tracker.test_car",
  "name": "Testauto",
  "room": "carport",
  "path": [[15.137, -9.137], [15.137, -1.137], [15.137, 3.937]],
  "profile": {
   "length": 4.5, "width": 1.8, "height": 1.5,
   "side": [[-2.197, 0.311], [2.193, 0.311], [2.193, 0.791], [1.137, 0.913], [0.317, 1.393], [-1.337, 1.393], [-2.137, 0.951]],
   "glass": [[0.177, 0.953], [-1.313, 0.953], [-1.313, 1.337], [0.177, 1.337]],
   "wheels": { "r": 0.331, "x": [-1.397, 1.393], "track": 1.537 },
   "lights": {
    "front": [[[2.193, 0.713, -0.717], [2.193, 0.713, -0.371]], [[2.193, 0.713, 0.371], [2.193, 0.713, 0.717]]],
    "rear": [[[-2.197, 0.911, -0.717], [-2.197, 0.911, -0.371]], [[-2.197, 0.911, 0.371], [-2.197, 0.911, 0.717]]]
   }
  }
 }
}
```

```json house3d:showcase
{
 "showcase": {
  "title": "Testmaja",
  "intro": "Väljamõeldud maja testide ja demo jaoks.",
  "rooms": { "r1": { "text": "Köök ja elutuba ühes ruumis, klaasuks aeda.", "photos": [] } },
  "features": [
   { "id": "deck", "name": "Terrass", "icon": "info", "pos": [5, 0.3, 12], "text": "Terrass pergola all, maja taga." }
  ]
 }
}
```

```json house3d:surroundings
{
 "surroundings": {
  "source": "Test fixture, not ETAK, 2026-01-01",
  "buildings": [
   { "outline": [[-13.137, 1.137], [-5.137, 1.137], [-5.137, 10.313], [-13.137, 10.313]], "height": 6.3 },
   { "outline": [[27.137, -0.313], [36.137, -0.313], [36.137, 8.731], [27.137, 8.731]], "height": 5.1 },
   { "outline": [[1.137, -25.137], [10.137, -25.137], [10.137, -16.317], [1.137, -16.317]], "height": 7.3 },
   { "outline": [[17.137, -24.313], [25.317, -24.313], [25.317, -17.137], [17.137, -17.137]], "height": 4.9 },
   { "outline": [[3.137, 27.137], [12.337, 27.137], [12.337, 35.137], [3.137, 35.137]], "height": 6.1 }
  ],
  "roads": [
   { "outline": [[-25.137, -11.137], [45.137, -11.137], [45.137, -7.137], [-25.137, -7.137]] }
  ]
 }
}
```
