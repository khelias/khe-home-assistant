# House 3D test fixture

A made-up house in the shape of the real model (khe-meta `house/house-model.md`), for
`tests/house3d/` and the public demo at khe.ee/ha/ (`house3d-build.py --demo`). Nothing
here describes a real place: the names are invented, the device entity ids start with `test_`,
and the georeference points nowhere. Every device, car, future item and surroundings coordinate
has three decimals ending in an odd digit, so the fixture's own privacy scan cannot match numbers
in the vendored three.js.

A one-storey courtyard house on a 42 x 34 m lot, the street on its west side and +x about
north. Three wings stand round a courtyard open to the south, each under a shed roof falling
south, towards the courtyard: the north wing is the tallest, and the street and garden wings
step down from it. The front door, clad like the walls, opens from the corner where the street
wing stands out past the north wing; the hall leads along the street wing to the children's
room and the study, and along the north wing's glazed gallery to the bathroom, the bedroom and
the kitchen, which opens into the living room in the garden wing. A glazed side door leads from
the carport into the utility room, which holds the boiler, the ventilation and the floor
heating. The carport stands against the north wing's street end, closed by two panel walls, and
the car reaches it through the sliding drive gate; the second garage roof is the canopy over the
front door. A path runs from the front step past the street wing into the courtyard, where the
deck is. The play area and the fruit trees are in the south garden. The future items are 20 PV
panels in a strip along the north wing's roof, a charger in the carport, a battery in the
utility room behind it, a small greenhouse off the garden wing's south-east corner and a hot tub
in the courtyard's mouth, its step towards the deck; only the first three have facts. The
engine tests count the outer walls and their corners, the street wall's openings and the site's
planters, steps and paving, so change those together with the tests.

This file has a `devices` key, so the privacy scan flags it: scan the engine with the real
model, never this file.

```json house3d:geometry
{
 "units": "m",
 "axes": "x along the street (about north), z away from the street (about east), y up",
 "georef": { "crs": "EPSG:3301", "origin_E": 135797.137, "origin_N": 197531.371, "x_axis_bearing_deg": 354, "fit_rms_m": 0.05 },
 "ceiling": 2.7,
 "roofs": {
  "wingN": { "pitch_deg": 7, "high_x": 37.3, "high_y": 5, "falls": "west", "outline": [[31, 3.7], [37.3, 3.7], [37.3, 22.3], [31, 22.3], [31, 16], [30.7, 16], [30.7, 8], [31, 8]], "thick": 0.3 },
  "wingW": { "slope": 0.06, "high_x": 31.3, "high_y": 3.8, "falls": "west", "outline": [[21.7, 1.7], [31.3, 1.7], [31.3, 3.7], [31, 3.7], [31, 8], [30.7, 8], [30.7, 8.3], [21.7, 8.3]], "thick": 0.3 },
  "wingE": { "slope": 0.07, "high_x": 31, "high_y": 3.9, "falls": "west", "outline": [[23.7, 15.7], [30.7, 15.7], [30.7, 16], [31, 16], [31, 22.3], [23.7, 22.3]], "thick": 0.3 }
 },
 "roof_steps": [
  { "a": [31, 4], "b": [31, 8], "top": "wingN", "bot": "wingW" },
  { "a": [31, 16], "b": [31, 22], "top": "wingN", "bot": "wingE" }
 ],
 "walls": [
  { "a": [31, 4], "b": [37, 4], "t": 0.4, "top": "wingN", "openings": [
   { "kind": "window", "c": 5.4, "w": 0.6, "h": 0.6, "sill": 1.5 },
   { "kind": "glassdoor", "c": 4, "w": 0.9, "h": 2.1 },
   { "kind": "door", "c": 1.3, "w": 1, "h": 2.1, "finish": "cladding" }
  ] },
  { "a": [37, 4], "b": [37, 22], "t": 0.4, "top": "wingN", "openings": [
   { "kind": "window", "c": 4.9, "w": 0.6, "h": 0.6, "sill": 1.5 },
   { "kind": "window", "c": 9.2, "w": 1.6, "h": 1.3, "sill": 0.8 },
   { "kind": "window", "c": 15.2, "w": 2, "h": 1, "sill": 1.1 }
  ] },
  { "a": [37, 22], "b": [31, 22], "t": 0.4, "top": "wingN", "openings": [
   { "kind": "window", "c": 3, "w": 1.6, "h": 1.3, "sill": 0.9 }
  ] },
  { "a": [31, 22], "b": [24, 22], "t": 0.4, "top": "wingE", "openings": [
   { "kind": "window", "c": 3.5, "w": 2.4, "h": 1.4, "sill": 0.6 }
  ] },
  { "a": [24, 22], "b": [24, 16], "t": 0.4, "top": "wingE", "openings": [
   { "kind": "window", "c": 3, "w": 2.2, "h": 2.3, "sill": 0 }
  ] },
  { "a": [24, 16], "b": [31, 16], "t": 0.4, "top": "wingE", "openings": [
   { "kind": "glassdoor", "c": 2.6, "w": 2.4, "h": 2.3 },
   { "kind": "window", "c": 5.4, "w": 1.6, "h": 2.3, "sill": 0 }
  ] },
  { "a": [31, 16], "b": [31, 8], "t": 0.4, "top": "wingN", "openings": [
   { "kind": "window", "c": 1.6, "w": 1.8, "h": 2.3, "sill": 0 },
   { "kind": "glassdoor", "c": 4, "w": 1.8, "h": 2.3 },
   { "kind": "window", "c": 6.4, "w": 1.8, "h": 2.3, "sill": 0 }
  ] },
  { "a": [31, 8], "b": [22, 8], "t": 0.4, "top": "wingW", "openings": [
   { "kind": "window", "c": 2, "w": 1.2, "h": 1.4, "sill": 0.8 },
   { "kind": "window", "c": 5.5, "w": 1.2, "h": 1.4, "sill": 0.8 }
  ] },
  { "a": [22, 8], "b": [22, 2], "t": 0.4, "top": "wingW", "openings": [
   { "kind": "window", "c": 3.6, "w": 1.6, "h": 1.4, "sill": 0.7 }
  ] },
  { "a": [22, 2], "b": [31, 2], "t": 0.4, "top": "wingW", "openings": [
   { "kind": "window", "c": 2.2, "w": 1.2, "h": 1.3, "sill": 0.8 },
   { "kind": "window", "c": 6.4, "w": 1.6, "h": 1.3, "sill": 0.8 }
  ] },
  { "a": [31, 2], "b": [31, 4], "t": 0.4, "top": "wingW" },
  { "a": [33.2, 7.4], "b": [33.2, 16], "t": 0.15, "top": 2.7, "openings": [
   { "kind": "door", "c": 1.5, "w": 0.8, "h": 2.1 },
   { "kind": "door", "c": 5.2, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [33.2, 4.2], "b": [33.2, 7.4], "t": 0.15, "top": 2.7, "openings": [
   { "kind": "door", "c": 1.6, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [33.2, 7.4], "b": [36.8, 7.4], "t": 0.15, "top": 2.7 },
  { "a": [33.2, 10.4], "b": [36.8, 10.4], "t": 0.15, "top": 2.7 },
  { "a": [33.2, 16], "b": [36.8, 16], "t": 0.15, "top": 2.7 },
  { "a": [31, 4.2], "b": [31, 8], "t": 0.15, "top": 2.7, "openings": [
   { "kind": "door", "c": 3, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [22.2, 6.6], "b": [31, 6.6], "t": 0.15, "top": 2.7, "openings": [
   { "kind": "door", "c": 2.2, "w": 0.9, "h": 2.1 },
   { "kind": "door", "c": 6.2, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [26.6, 2.2], "b": [26.6, 6.6], "t": 0.15, "top": 2.7 },
  { "a": [37.3, 3.8], "b": [37.3, -2.8], "t": 0.04, "top": 2.5, "finish": "panel" },
  { "a": [33.4, -2.8], "b": [33.4, -0.6], "t": 0.04, "top": 2.5, "finish": "panel" }
 ],
 "furniture": [
  { "what": "kitchen counter", "kind": "counter", "rect": [36.15, 16.4, 36.75, 21.6], "y": [0, 0.9] },
  { "what": "kitchen island", "kind": "counter", "rect": [33.8, 17.6, 34.8, 20], "y": [0, 0.9] },
  { "what": "dining table", "kind": "table", "circle": [32.2, 19.2, 0.6], "y": [0, 0.75] },
  { "what": "sofa", "kind": "sofa", "rect": [27.2, 20.7, 30, 21.6], "y": [0, 0.8] },
  { "what": "bed", "kind": "bed", "rect": [34.9, 12, 36.7, 14], "y": [0, 0.5] },
  { "what": "child's bed", "kind": "bed", "rect": [22.4, 2.4, 24.4, 3.3], "y": [0, 0.45] },
  { "what": "desk", "kind": "desk", "rect": [29.6, 2.35, 30.75, 3], "y": [0, 0.75] },
  { "what": "wardrobe", "kind": "wardrobe", "rect": [31.25, 5, 31.85, 6.4], "y": [0, 2.1] },
  { "what": "bench", "rect": [31.3, 13.6, 31.75, 15.4], "y": [0, 0.45] }
 ],
 "site": {
  "lot": [[0, -6], [42, -6], [42, 28], [0, 28]],
  "hedges": [[[0, 28], [42, 28]]],
  "fences": [[[0, -6], [0, 28]], [[42, -6], [42, 28]]],
  "bar_fences": [[[0, -6], [33.2, -6]], [[37.4, -6], [42, -6]]],
  "gates": [
   { "name": "drive", "a": [37.4, -6], "b": [33.2, -6], "kind": "sliding", "slide": "b", "height": 1.4 }
  ],
  "decks": [[[24.4, 8.2], [30.8, 8.2], [30.8, 15.8], [24.4, 15.8]]],
  "paving": [
   [[37.4, -6], [31.6, -6], [31.6, 2.2], [33.2, 2.2], [33.2, -2.8], [37.4, -2.8]],
   [[31.6, 0.6], [20.4, 0.6], [20.4, 10.4], [24.4, 10.4], [24.4, 9.4], [21.4, 9.4], [21.4, 1.6], [31.6, 1.6]]
  ],
  "porch": [31.4, 2.6, 33.2, 3.8],
  "garage_roof": { "rects": [[33.3, -3, 37.4, 3.7], [31.3, 2.4, 33.3, 3.7]], "y": [2.5, 2.7] },
  "pergola": { "rect": [28.2, 8.4, 30.6, 15.6], "height": 2.6, "modules": 2 },
  "outdoor_units": [{ "what": "heat pump", "rect": [37.4, 8, 38, 9], "y": [0, 0.8] }],
  "sandpit": { "rect": [12, 4, 13.6, 5.6], "height": 0.25 },
  "swing": { "rect": [10, 2, 10.2, 5.4], "height": 2.2, "slide": [8, 5.8] },
  "trampoline": { "rect": [4, 14, 7.6, 17.6], "height": 0.9 },
  "planters": [
   { "rect": [30.9, -0.6, 31.5, 0], "y": [0, 0.45], "plant": "thuja" },
   { "rect": [24.5, 11.2, 25.1, 13.4], "y": [0, 0.6], "plant": "low", "finish": "cladding" },
   { "rect": [18.6, 23.4, 20.6, 24.6], "y": [0, 0.4], "plant": "low" }
  ],
  "steps": [{ "rect": [31.8, 2.2, 32.8, 2.6], "height": 0.115 }],
  "lights": [
   { "pos": [35.6, 2.45, -1.6], "kind": "ceiling" },
   { "pos": [30.8, 2.1, 10.8], "kind": "wall", "face": [-1, 0] }
  ],
  "trees": [
   { "id": "t1", "kind": "maple", "pos": [6.5, -2.5], "height": 8, "crown": 5 },
   { "id": "t2", "kind": "birch", "pos": [2.5, 25.5], "height": 13, "crown": 5 },
   { "id": "t3", "kind": "birch", "pos": [2, -3], "height": 11, "crown": 4.5 },
   { "id": "t4", "kind": "apple", "pos": [13.5, 17.5], "height": 4.5, "crown": 3.5 },
   { "id": "t5", "kind": "apple", "pos": [10, 21.5], "height": 4, "crown": 3 },
   { "id": "t6", "kind": "maple", "pos": [40, 25.5], "height": 7, "crown": 4.5 }
  ]
 }
}
```

```json house3d:rooms
{
 "rooms": [
  { "id": "r1", "no": "01", "name": "Köök-elutuba", "rects": [[24.2, 16.2, 31, 21.8], [31, 16, 36.8, 21.8]] },
  { "id": "r2", "no": "02", "name": "Magamistuba", "rects": [[33.2, 10.4, 36.8, 16]] },
  { "id": "r3", "no": "03", "name": "Eeskoda", "rects": [[31, 4.2, 33.2, 8], [22.2, 6.6, 31, 7.8]], "floor": "tile" },
  { "id": "r4", "no": "04", "name": "Vannituba", "rects": [[33.2, 7.4, 36.8, 10.4]], "floor": "tile" },
  { "id": "r5", "no": "05", "name": "Lastetuba", "rects": [[22.2, 2.2, 26.6, 6.6]] },
  { "id": "r6", "no": "06", "name": "Majapidamisruum", "rects": [[33.2, 4.2, 36.8, 7.4]], "floor": "tile" },
  { "id": "r7", "no": "07", "name": "Töötuba", "rects": [[26.6, 2.2, 30.8, 6.6]] },
  { "id": "r8", "no": "08", "name": "Galerii", "rects": [[31.2, 8, 33.2, 16]] },
  { "id": "carport", "no": "09", "name": "Varjualune", "rects": [[33.5, -2.8, 37.1, 3.8]], "floor": "paving" }
 ]
}
```

```json house3d:private
{
 "room_names": { "r1": "Pere köök-elutuba", "r2": "Suur magamistuba" },
 "devices": [
  {"entity": "light.test_living", "name": "Elutoa lamp", "type": "light", "room": "r1", "pos": [27.513, 2.513, 19.017]},
  {"entity": "light.test_bedroom", "name": "Magamistoa lamp", "type": "light", "room": "r2", "pos": [35.013, 2.513, 13.213]},
  {"entity": "light.test_pergola", "name": "Pergola LED", "type": "light", "room": "oues", "pos": [29.413, 2.533, 12.017], "role": "pergola-light"},
  {"entity": "sensor.test_living_temp", "name": "Elutoa temperatuur", "type": "sensor", "room": "r1", "pos": [24.413, 1.513, 16.413]},
  {"entity": "sensor.test_bedroom_temp", "name": "Magamistoa temperatuur", "type": "sensor", "room": "r2", "pos": [36.613, 1.513, 14.613]},
  {"entity": "sensor.test_outdoor_temp", "name": "Õuetemperatuur", "type": "sensor", "room": "oues", "pos": [37.313, 1.713, 17.017]},
  {"entity": "binary_sensor.test_front_door", "name": "Välisuks", "type": "door", "room": "r3", "pos": [32.713, 1.117, 4.313]},
  {"entity": "binary_sensor.test_terrace_door", "name": "Terrassi uks", "type": "door", "room": "r1", "pos": [26.613, 1.117, 16.313]},
  {"entity": "binary_sensor.test_hall_motion", "name": "Eeskoja liikumisandur", "type": "motion", "room": "r3", "pos": [33.013, 2.517, 4.413]},
  {"entity": "binary_sensor.test_carport_motion", "name": "Varjualuse liikumisandur", "type": "motion", "room": "carport", "pos": [36.913, 2.317, -2.613]},
  {"entity": "binary_sensor.test_kitchen_motion", "name": "Köögi andur", "type": "motion", "room": "r1", "pos": [36.613, 2.517, 21.613]},
  {"entity": "binary_sensor.test_living_motion", "name": "Elutoa andur", "type": "motion", "room": "r1", "pos": [24.413, 2.517, 21.613]},
  {"entity": "binary_sensor.test_bedroom_motion", "name": "Magamistoa andur", "type": "motion", "room": "r2", "pos": [33.413, 2.517, 15.813]},
  {"entity": "binary_sensor.test_bath_motion", "name": "Vannitoa andur", "type": "motion", "room": "r4", "pos": [36.613, 2.517, 7.613]},
  {"entity": "binary_sensor.test_terrace_motion", "name": "Terrassi andur", "type": "motion", "room": "oues", "pos": [30.613, 2.513, 15.613]},
  {"entity": "binary_sensor.test_porch_motion", "name": "Varikatuse andur", "type": "motion", "room": "oues", "pos": [31.513, 2.411, 2.713]},
  {"entity": "binary_sensor.test_smoke_hall", "name": "Eeskoja suitsuandur", "type": "smoke", "room": "r3", "pos": [32.213, 2.613, 6.013]},
  {"entity": "binary_sensor.test_smoke_living", "name": "Elutoa suitsuandur", "type": "smoke", "room": "r1", "pos": [33.813, 2.613, 18.913]},
  {"entity": "cover.test_pergola", "name": "Lamellkatus", "type": "cover", "room": "oues", "pos": [28.413, 2.713, 15.413]},
  {"entity": "fan.test_ventilation", "name": "Ventilatsioon", "type": "vent", "room": "r6", "pos": [35.013, 2.517, 6.913]},
  {"entity": "climate.test_heat_pump", "name": "Soojuspump", "type": "heatpump", "room": "oues", "pos": [37.713, 0.917, 8.513]},
  {"entity": "climate.test_floor_heating", "name": "Põrandaküte", "type": "climate", "room": "r6", "pos": [33.413, 0.513, 6.913]},
  {"entity": "water_heater.test_boiler", "name": "Boiler", "type": "climate", "room": "r6", "pos": [36.513, 1.513, 6.813]},
  {"entity": "alarm_control_panel.test_alarm", "name": "Valvesüsteem", "type": "alarm", "room": "r3", "pos": [31.413, 1.513, 4.413]},
  {"entity": "camera.test_drive", "name": "Väravakaamera", "type": "camera", "room": "oues", "pos": [33.513, 2.413, -2.713], "look": [0.243, -0.971]},
  {"entity": "camera.test_garden", "name": "Aiakaamera", "type": "camera", "room": "oues", "pos": [21.713, 2.613, 1.913], "look": [-0.819, 0.573]}
 ],
 "car": {
  "entity": "device_tracker.test_car",
  "name": "Testauto",
  "room": "carport",
  "path": [[35.213, -11.137], [35.213, -4.137], [35.213, 0.713]],
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
 },
 "future": {
  "as_of": "2026-01-15",
  "items": [
   {"id": "pv", "kind": "pv", "name": "Päikesejaam", "roof": "wingN", "pos": [34.013, 13.013], "size": [3.5, 11.5], "rot": 0, "kwp": 8.8, "panels": 20, "facts": ["8,8 kWp, 20 paneeli põhjatiiva lõuna poole kalduval katusel", "Aastas umbes 8 000 kWh", "Hind paigaldatuna umbes 9 000 €", "Tasuvusaeg umbes 10 aastat"]},
   {"id": "charger", "kind": "charger", "name": "Laadimispunkt", "pos": [36.413, 3.613], "rot": 0, "facts": ["11 kW, kolm faasi", "Koormuse juhtimine peakaitsme järgi"]},
   {"id": "battery", "kind": "battery", "name": "Akusalvesti", "pos": [36.213, 4.371], "rot": 180, "facts": ["12 kWh, seinale kinnitatud", "Hind umbes 6 000 €"]},
   {"id": "greenhouse", "kind": "greenhouse", "name": "Väike kasvuhoone", "pos": [22.513, 24.513], "size": [2, 3], "rot": 0, "facts": []},
   {"id": "tub", "kind": "tub", "name": "Puuküttega kümblustünn", "pos": [22.913, 14.013], "size": [2, 2], "rot": 90, "facts": []}
  ]
 }
}
```

```json house3d:showcase
{
 "showcase": {
  "title": "Testmaja",
  "intro": "Väljamõeldud hoovimaja testide ja demo jaoks.",
  "rooms": { "r1": { "text": "Köök põhjatiivas, elutuba aiatiivas, klaasuks hoovi terrassile.", "photos": [] } },
  "features": [
   { "id": "deck", "name": "Terrass", "icon": "info", "pos": [27.5, 0.3, 12], "text": "Terrass lõunasse avatud hoovis, osalt pergola all." }
  ]
 }
}
```

```json house3d:surroundings
{
 "surroundings": {
  "source": "Test fixture, not ETAK, 2026-01-01",
  "buildings": [
   { "outline": [[48.137, 2.313], [59.317, 2.313], [59.317, 13.137], [48.137, 13.137]], "height": 6.3 },
   { "outline": [[-17.137, 4.137], [-6.313, 4.137], [-6.313, 12.517], [-17.137, 12.517]], "height": 5.1 },
   { "outline": [[3.137, -31.317], [14.517, -31.317], [14.517, -21.137], [3.137, -21.137]], "height": 7.1 },
   { "outline": [[25.313, -29.137], [34.137, -29.137], [34.137, -20.513], [25.313, -20.513]], "height": 4.7 },
   { "outline": [[9.137, 35.313], [20.517, 35.313], [20.517, 43.137], [9.137, 43.137]], "height": 5.3 },
   { "outline": [[30.137, 34.137], [38.513, 34.137], [38.513, 42.317], [30.137, 42.317]], "height": 3.9 }
  ],
  "roads": [
   { "outline": [[-30.137, -14.513], [72.137, -14.513], [72.137, -8.531], [-30.137, -8.531]] }
  ]
 }
}
```
