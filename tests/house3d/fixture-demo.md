# House 3D demo house

A made-up house for the public demo at khe.ee/ha/ (khe-home-assistant's `house3d-build.py
--demo`), drawn to look good rather than to test the engine: the engine's tests run on
`fixture-model.md` and `fixture-twostorey.md`. Nothing here describes a real place: the names
are invented, the device entity ids start with `test_` and are the test house's, so the demo's
dashboard and scenarios read both, and the georeference points nowhere. Every device, car,
future item and surroundings coordinate has three decimals ending in an odd digit, so the
privacy scan cannot match numbers in the vendored three.js.

A one-storey timber house with a 28-degree gable roof, 16.4 x 10.4 m, on a 34 x 28 m lot, the
street on its north side and +x east. Its look is mid-grey vertical boards with a light plinth
and casings round dark frames, a dark standing-seam roof over a light fascia. The front door
opens from a porch recessed into the street side, on two posts under the roof, into the hall;
the kitchen and living room take the east end, with glass doors south to the terrace under the
pergola and east to the terrace's wing. A corridor runs west from the hall to the bedroom, the
WC, the utility room, the children's room, the study, the bathroom and the sauna; the bathroom
opens onto the terrace too. The carport stands on braced posts against the west gable, under a
flat roof of its own, with a door into the utility room, and the car reaches it from the street
through the sliding drive gate. The heat pump's outdoor unit stands by the west gable behind it.
The future items are 20 PV panels on the roof's south face, a charger in the carport, a battery
in the utility room behind it, a small greenhouse in the west garden and a hot tub east of the
terrace; only the first three have facts. For winter, icicles hang along both eaves and the
carport's edge, and a Christmas tree stands in the living room.

This file has a `devices` key, so the privacy scan flags it: scan the engine with the real
model, never this file.

```json house3d:geometry
{
 "units": "m",
 "axes": "x along the street (east), z away from the street (south), y up",
 "georef": { "crs": "EPSG:3301", "origin_E": 135797.137, "origin_N": 197531.371, "x_axis_bearing_deg": 90, "fit_rms_m": 0.05 },
 "ceiling": 2.7,
 "levels": [0],
 "look": {
  "surfaces": {
   "cladding": "#8c9093",
   "roof": { "color": "#3b3d40", "roughness": 0.65, "metalness": 0.15 },
   "frame": "#2f3235",
   "trim": "#b0b2b4",
   "base": "#aeb0b2",
   "interior": "#ecebe6",
   "floor": "#c8a477",
   "tile": "#6e6a64",
   "deck": "#6d5f53",
   "paving": "#b8b3aa",
   "fence": "#3c4044",
   "kitchen": "#d6d4ce",
   "kitchenTop": "#4d4640"
  },
  "cladding": { "pattern": "boards", "angle_deg": 90, "board": 0.18, "groove": 0.08 },
  "roof": { "pattern": "seam" },
  "trims": { "openings": true, "corners": true, "base": { "height": 0.35 }, "fascia": true }
 },
 "roofs": {
  "main": { "kind": "gable", "ridge": "x", "rects": [[-0.7, -0.7, 16.7, 10.7]], "eave_y": 2.9, "pitch_deg": 28, "thick": 0.25 }
 },
 "walls": [
  { "a": [0, 0], "b": [7.6, 0], "t": 0.4, "top": "main", "openings": [
   { "kind": "window", "c": 1.1, "w": 0.6, "h": 0.9, "sill": 1.3 },
   { "kind": "window", "c": 2.6, "w": 0.6, "h": 0.9, "sill": 1.3 },
   { "kind": "window", "c": 5.3, "w": 1.2, "h": 1.3, "sill": 0.9 }
  ] },
  { "a": [7.6, 0], "b": [7.6, 1.2], "t": 0.4, "top": "main" },
  { "a": [7.6, 1.2], "b": [9.8, 1.2], "t": 0.4, "top": "main", "openings": [
   { "kind": "door", "c": 1.1, "w": 1.0, "h": 2.1, "glass": 0.25 }
  ] },
  { "a": [9.8, 1.2], "b": [9.8, 0], "t": 0.4, "top": "main" },
  { "a": [9.8, 0], "b": [16, 0], "t": 0.4, "top": "main", "openings": [
   { "kind": "window", "c": 2.6, "w": 1.2, "h": 1.3, "sill": 0.9 },
   { "kind": "window", "c": 4.8, "w": 1.2, "h": 1.3, "sill": 0.9 }
  ] },
  { "a": [16, 0], "b": [16, 10], "t": 0.4, "top": "main", "openings": [
   { "kind": "window", "c": 2.5, "w": 1.2, "h": 1.3, "sill": 0.9 },
   { "kind": "window", "c": 5.3, "w": 2.0, "h": 2.3, "sill": 0 },
   { "kind": "glassdoor", "c": 8.0, "w": 2.2, "h": 2.3 }
  ] },
  { "a": [16, 10], "b": [0, 10], "t": 0.4, "top": "main", "openings": [
   { "kind": "window", "c": 1.8, "w": 2.0, "h": 2.3, "sill": 0 },
   { "kind": "glassdoor", "c": 4.3, "w": 2.4, "h": 2.3 },
   { "kind": "glassdoor", "c": 6.5, "w": 0.9, "h": 2.1 },
   { "kind": "window", "c": 8.3, "w": 0.6, "h": 0.9, "sill": 1.3 },
   { "kind": "window", "c": 11.0, "w": 1.2, "h": 1.3, "sill": 0.9 },
   { "kind": "window", "c": 14.2, "w": 1.2, "h": 1.3, "sill": 0.9 }
  ] },
  { "a": [0, 10], "b": [0, 0], "t": 0.4, "top": "main", "openings": [
   { "kind": "window", "c": 2.2, "w": 1.2, "h": 1.3, "sill": 0.9 },
   { "kind": "window", "c": 5.15, "w": 0.6, "h": 0.9, "sill": 1.3 },
   { "kind": "door", "c": 7.8, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [10.2, 1.2], "b": [10.2, 4.2], "t": 0.15, "top": 2.7 },
  { "a": [10.2, 5.5], "b": [10.2, 9.8], "t": 0.15, "top": 2.7 },
  { "a": [2.0, 0.2], "b": [2.0, 4.2], "t": 0.15, "top": 2.7 },
  { "a": [3.2, 0.2], "b": [3.2, 4.2], "t": 0.15, "top": 2.7 },
  { "a": [7.4, 1.4], "b": [7.4, 4.2], "t": 0.15, "top": 2.7 },
  { "a": [2.0, 2.8], "b": [3.2, 2.8], "t": 0.15, "top": 2.7, "openings": [
   { "kind": "door", "c": 0.6, "w": 0.8, "h": 2.1 }
  ] },
  { "a": [0.2, 4.2], "b": [2.0, 4.2], "t": 0.15, "top": 2.7, "openings": [
   { "kind": "door", "c": 0.9, "w": 0.8, "h": 2.1 }
  ] },
  { "a": [3.2, 4.2], "b": [7.4, 4.2], "t": 0.15, "top": 2.7, "openings": [
   { "kind": "door", "c": 3.4, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [0.2, 5.5], "b": [10.2, 5.5], "t": 0.15, "top": 2.7, "openings": [
   { "kind": "door", "c": 2.3, "w": 0.9, "h": 2.1 },
   { "kind": "door", "c": 4.3, "w": 0.9, "h": 2.1 },
   { "kind": "door", "c": 7.4, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [3.4, 5.5], "b": [3.4, 9.8], "t": 0.15, "top": 2.7 },
  { "a": [6.6, 5.5], "b": [6.6, 9.8], "t": 0.15, "top": 2.7 },
  { "a": [6.6, 7.6], "b": [8.8, 7.6], "t": 0.15, "top": 2.7, "openings": [
   { "kind": "glassdoor", "c": 1.6, "w": 0.8, "h": 2.1 }
  ] },
  { "a": [8.8, 7.6], "b": [8.8, 9.8], "t": 0.15, "top": 2.7 }
 ],
 "furniture": [
  { "what": "kitchen tall units", "kind": "tall_units", "rect": [10.3, 0.2, 11.5, 0.82], "y": [0, 2.2], "along": "x", "fronts": [["door", 0.6], ["oven", 0.6]] },
  { "what": "kitchen north base units", "kind": "base_units", "rect": [11.5, 0.2, 15.1, 0.82], "y": [0, 0.9], "along": "x", "fronts": [["drawers", 0.9], ["door", 0.9], ["drawers", 0.9], ["door", 0.9]] },
  { "what": "kitchen north splashback", "kind": "splashback", "rect": [11.5, 0.2, 15.1, 0.22], "y": [0.9, 1.0] },
  { "what": "kitchen west base units", "kind": "base_units", "rect": [10.3, 0.85, 10.92, 3.85], "y": [0, 0.9], "along": "z", "fronts": [["drawers", 0.9], ["drawers", 0.9], ["door", 0.6], ["door", 0.6]] },
  { "what": "kitchen west splashback", "kind": "splashback", "rect": [10.3, 0.85, 10.32, 3.85], "y": [0.9, 1.45] },
  { "what": "kitchen wall units north", "kind": "wall_units", "rect": [10.3, 0.9, 10.66, 1.9], "y": [1.45, 2.2], "along": "z", "fronts": [["door", 0.5], ["door", 0.5]] },
  { "what": "kitchen wall units south", "kind": "wall_units", "rect": [10.3, 2.7, 10.66, 3.8], "y": [1.45, 2.2], "along": "z", "fronts": [["glass", 0.55], ["glass", 0.55]] },
  { "what": "kitchen hood", "kind": "hood", "rect": [10.3, 2.0, 10.82, 2.6], "y": [1.45, 2.4] },
  { "what": "kitchen island", "kind": "counter", "rect": [12.2, 2.1, 14.6, 3.0], "y": [0, 0.9] },
  { "what": "dining table", "kind": "table", "rect": [12.5, 4.4, 14.7, 5.4], "y": [0, 0.75] },
  { "what": "dining chair 1", "kind": "chair", "rect": [12.7, 3.85, 13.15, 4.3], "y": [0, 0.85], "back": ["z0"] },
  { "what": "dining chair 2", "kind": "chair", "rect": [13.38, 3.85, 13.83, 4.3], "y": [0, 0.85], "back": ["z0"] },
  { "what": "dining chair 3", "kind": "chair", "rect": [14.05, 3.85, 14.5, 4.3], "y": [0, 0.85], "back": ["z0"] },
  { "what": "dining chair 4", "kind": "chair", "rect": [12.7, 5.5, 13.15, 5.95], "y": [0, 0.85], "back": ["z1"] },
  { "what": "dining chair 5", "kind": "chair", "rect": [13.38, 5.5, 13.83, 5.95], "y": [0, 0.85], "back": ["z1"] },
  { "what": "dining chair 6", "kind": "chair", "rect": [14.05, 5.5, 14.5, 5.95], "y": [0, 0.85], "back": ["z1"] },
  { "what": "living sofa main", "kind": "sofa", "rect": [13.4, 6.9, 14.35, 9.2], "y": [0, 0.82], "back": ["x1"], "arm": ["z0"] },
  { "what": "living sofa chaise", "kind": "sofa", "rect": [12.3, 8.3, 13.4, 9.2], "y": [0, 0.82], "back": ["z1"], "arm": ["x0"] },
  { "what": "living rug", "kind": "rug", "rect": [11.5, 6.8, 14.1, 9.1], "y": [0.02, 0.035] },
  { "what": "coffee table", "kind": "table", "rect": [12.0, 7.2, 13.0, 7.9], "y": [0.38, 0.42] },
  { "what": "tv bench", "kind": "cabinet", "rect": [10.3, 7.2, 10.75, 8.9], "y": [0, 0.48] },
  { "what": "tv", "kind": "tv", "rect": [10.32, 7.4, 10.38, 8.7], "y": [0.65, 1.4] },
  { "what": "living plant", "kind": "plant", "rect": [15.1, 6.0, 15.65, 6.55], "y": [0, 1.35] },
  { "what": "living picture", "kind": "picture", "rect": [10.29, 5.7, 10.34, 6.8], "y": [1.2, 2.0], "art": 3 },
  { "what": "master bed", "kind": "bed", "rect": [3.35, 1.3, 5.35, 3.1], "y": [0, 0.55] },
  { "what": "master headboard", "kind": "headboard", "rect": [3.28, 1.25, 3.35, 3.15], "y": [0, 1.1] },
  { "what": "master nightstand north", "kind": "cabinet", "rect": [3.3, 0.75, 3.75, 1.2], "y": [0, 0.5] },
  { "what": "master nightstand south", "kind": "cabinet", "rect": [3.3, 3.2, 3.75, 3.65], "y": [0, 0.5] },
  { "what": "master wardrobe", "kind": "wardrobe", "rect": [6.72, 1.5, 7.32, 3.7], "y": [0, 2.2] },
  { "what": "master rug", "kind": "rug", "rect": [3.9, 1.1, 6.1, 3.3], "y": [0.02, 0.035] },
  { "what": "master picture", "kind": "picture", "rect": [4.2, 4.07, 5.4, 4.12], "y": [1.3, 2.0], "art": 1 },
  { "what": "child's bed", "kind": "bed", "rect": [0.3, 5.68, 1.25, 7.68], "y": [0, 0.5] },
  { "what": "child's headboard", "kind": "headboard", "rect": [0.3, 5.6, 1.25, 5.68], "y": [0, 1.0] },
  { "what": "child's desk", "kind": "desk", "rect": [1.4, 9.1, 2.8, 9.75], "y": [0, 0.75] },
  { "what": "child's chair", "kind": "office_chair", "rect": [1.8, 8.45, 2.35, 9.0], "y": [0, 1.0], "back": ["z0"] },
  { "what": "child's wardrobe", "kind": "wardrobe", "rect": [2.7, 6.7, 3.3, 8.3], "y": [0, 2.1] },
  { "what": "study daybed", "kind": "sofa", "rect": [5.55, 5.68, 6.45, 7.68], "y": [0, 0.8], "back": ["x1"] },
  { "what": "study desk", "kind": "desk", "rect": [4.1, 9.1, 5.5, 9.75], "y": [0, 0.75] },
  { "what": "study chair", "kind": "office_chair", "rect": [4.5, 8.45, 5.05, 9.0], "y": [0, 1.0], "back": ["z0"] },
  { "what": "study wardrobe", "kind": "wardrobe", "rect": [3.5, 6.7, 4.1, 8.3], "y": [0, 2.1] },
  { "what": "bathroom vanity", "kind": "vanity", "rect": [9.6, 5.8, 10.1, 7.2], "y": [0.35, 1.0], "along": "z", "fronts": [["drawers", 0.7], ["drawers", 0.7]], "basins": 2 },
  { "what": "bathroom mirror", "kind": "mirror", "rect": [10.07, 5.85, 10.12, 7.15], "y": [1.1, 2.0] },
  { "what": "bathroom toilet", "kind": "toilet", "rect": [8.4, 5.6, 8.8, 6.18], "y": [0.2, 1.1] },
  { "what": "bathroom washer", "kind": "washer", "rect": [6.7, 6.5, 7.3, 7.1], "y": [0, 0.85] },
  { "what": "sauna upper bench", "kind": "bench", "rect": [6.7, 7.75, 7.35, 9.7], "y": [0, 0.9] },
  { "what": "sauna lower bench", "kind": "bench", "rect": [7.35, 7.75, 7.75, 9.7], "y": [0, 0.45] },
  { "what": "sauna stove", "kind": "stove", "rect": [8.2, 9.1, 8.65, 9.55], "y": [0, 0.95] },
  { "what": "wc toilet", "kind": "toilet", "rect": [2.25, 0.22, 2.65, 0.8], "y": [0.2, 1.1] },
  { "what": "wc vanity", "kind": "vanity", "rect": [2.75, 1.3, 3.12, 1.85], "y": [0.45, 0.9], "along": "z", "fronts": [["blank", 0.55]], "basins": 1 },
  { "what": "hall wardrobe", "kind": "wardrobe", "rect": [7.5, 1.5, 8.1, 3.7], "y": [0, 2.2] },
  { "what": "hall bench", "kind": "bench", "rect": [9.65, 1.8, 10.1, 3.2], "y": [0, 0.45] },
  { "what": "heat pump indoor unit", "kind": "appliance", "rect": [1.42, 0.3, 1.9, 0.95], "y": [0, 1.55] },
  { "what": "ventilation unit", "kind": "appliance", "rect": [1.25, 1.1, 1.9, 1.7], "y": [1.1, 1.9] },
  { "what": "utility counter", "kind": "counter", "rect": [1.3, 2.9, 1.9, 4.0], "y": [0, 0.9] }
 ],
 "site": {
  "lot": [[-7, -9], [27, -9], [27, 19], [-7, 19]],
  "bar_fences": [[[-7, -9], [-4.2, -9]], [[0.4, -9], [27, -9]]],
  "gates": [
   { "name": "drive", "a": [-4.2, -9], "b": [0.4, -9], "kind": "sliding", "slide": "b", "height": 1.4 }
  ],
  "fences": [[[-7, -9], [-7, 19]], [[27, -9], [27, 19]], [[-7, 19], [27, 19]]],
  "hedges": [[[-6.3, -8.3], [-6.3, 18.3]], [[26.3, -8.3], [26.3, 18.3]], [[-6.3, 18.3], [26.3, 18.3]]],
  "paving": [
   [-4.2, -9.0, 0.4, -0.4],
   [-4.0, -0.4, -0.2, 6.2],
   [0.4, -1.4, 10.2, -0.2]
  ],
  "garage_roof": { "rects": [[-3.8, -0.4, -0.2, 6.2]], "y": [2.45, 2.75], "rim": 0.06, "bands": 3 },
  "posts": [
   { "at": [-3.65, -0.25], "top": 2.45, "braces": [[1, 0], [0, 1]] },
   { "at": [-3.65, 6.05], "top": 2.45, "braces": [[1, 0], [0, -1]] },
   { "at": [7.72, -0.32], "top": 3.07 },
   { "at": [9.68, -0.32], "top": 3.07 }
  ],
  "steps": [
   { "rect": [7.3, -1.0, 10.1, -0.2], "height": 0.07 },
   { "rect": [7.5, -0.6, 9.9, 1.0], "height": 0.14 },
   { "rect": [-0.9, 1.6, -0.2, 2.8], "height": 0.07 },
   { "rect": [-0.55, 1.75, -0.2, 2.65], "height": 0.14 }
  ],
  "decks": [
   [[8.4, 10.2], [16.2, 10.2], [16.2, 6.2], [18.6, 6.2], [18.6, 14.0], [8.4, 14.0]]
  ],
  "outdoor_units": [{ "what": "heat pump", "rect": [-0.85, 8.7, -0.25, 9.7], "y": [0, 0.8] }],
  "pergola": { "rect": [10.4, 10.2, 15.8, 13.6], "height": 2.65, "modules": 2 },
  "planters": [
   { "rect": [10.6, -1.1, 11.2, -0.5], "y": [0, 0.45], "plant": "thuja" },
   { "rect": [8.5, 13.4, 10.1, 13.9], "y": [0, 0.45], "plant": "low" },
   { "rect": [17.9, 6.4, 18.5, 8.2], "y": [0, 0.45], "plant": "low", "finish": "cladding" }
  ],
  "trees": [
   { "id": "t1", "kind": "birch", "pos": [-4.5, 14.5], "height": 11, "crown": 4.5 },
   { "id": "t2", "kind": "maple", "pos": [23.0, 15.0], "height": 8.5, "crown": 5.0 },
   { "id": "t3", "kind": "apple", "pos": [4.5, 15.5], "height": 4.2, "crown": 3.2 },
   { "id": "t4", "kind": "apple", "pos": [15.5, 16.5], "height": 4.0, "crown": 3.0 },
   { "id": "t5", "kind": "birch", "pos": [22.5, -4.5], "height": 10, "crown": 4.2 }
  ],
  "lights": [
   { "pos": [-2.0, 2.42, 2.9], "kind": "ceiling" },
   { "pos": [8.7, 3.35, 0.3], "kind": "ceiling" },
   { "pos": [10.3, 2.1, 10.22], "kind": "wall", "face": [0, 1] },
   { "pos": [15.7, 2.1, 10.22], "kind": "wall", "face": [0, 1] },
   { "pos": [16.22, 2.1, 6.7], "kind": "wall", "face": [1, 0] }
  ],
  "festive": {
   "icicles": [
    { "path": [[-0.7, 2.88, -0.72], [16.7, 2.88, -0.72]], "drop": 0.4 },
    { "path": [[-0.2, 2.42, -0.42], [-3.82, 2.42, -0.42], [-3.82, 2.42, 6.22]], "drop": 0.35 },
    { "path": [[8.4, 2.88, 10.72], [16.7, 2.88, 10.72]], "drop": 0.4 }
   ],
   "planters": true,
   "christmas_trees": [
    { "pos": [14.9, 8.8], "height": 2.1, "base": 1.15 }
   ]
  }
 }
}
```

```json house3d:rooms
{
 "rooms": [
  { "id": "r1", "no": "01", "name": "Köök-elutuba", "rects": [[10.2, 0.2, 15.8, 9.8]] },
  { "id": "r2", "no": "02", "name": "Magamistuba", "rects": [[3.2, 0.2, 7.4, 4.2]] },
  { "id": "r3", "no": "03", "name": "Esik", "rects": [[7.4, 1.2, 10.2, 4.2]], "floor": "tile" },
  { "id": "r4", "no": "04", "name": "Pesuruum", "rects": [[6.6, 5.5, 10.2, 7.6], [8.8, 7.6, 10.2, 9.8]], "floor": "tile" },
  { "id": "r5", "no": "05", "name": "Lastetuba", "rects": [[0.2, 5.5, 3.4, 9.8]] },
  { "id": "r6", "no": "06", "name": "Tehnoruum", "rects": [[0.2, 0.2, 2.0, 4.2]], "floor": "tile" },
  { "id": "r7", "no": "07", "name": "Töötuba", "rects": [[3.4, 5.5, 6.6, 9.8]] },
  { "id": "r8", "no": "08", "name": "Koridor", "rects": [[0.2, 4.2, 10.2, 5.5], [2.0, 2.8, 3.2, 4.2]] },
  { "id": "r9", "no": "09", "name": "WC", "rects": [[2.0, 0.2, 3.2, 2.8]], "floor": "tile" },
  { "id": "r10", "no": "10", "name": "Saun", "rects": [[6.6, 7.6, 8.8, 9.8]], "floor": "tile" },
  { "id": "carport", "no": "11", "name": "Varjualune", "rects": [[-3.65, -0.25, -0.2, 6.05]], "floor": "paving" }
 ]
}
```

```json house3d:private
{
 "room_names": { "r1": "Pere köök-elutuba", "r2": "Suur magamistuba" },
 "devices": [
  {"entity": "light.test_living", "name": "Elutoa lamp", "type": "light", "room": "r1", "pos": [12.913, 2.513, 7.513]},
  {"entity": "light.test_bedroom", "name": "Magamistoa lamp", "type": "light", "room": "r2", "pos": [5.313, 2.513, 2.213]},
  {"entity": "light.test_pergola", "name": "Pergola LED", "type": "light", "room": "oues", "pos": [13.113, 2.583, 11.913], "role": "pergola-light"},
  {"entity": "sensor.test_living_temp", "name": "Elutoa temperatuur", "type": "sensor", "room": "r1", "pos": [15.713, 1.513, 4.113]},
  {"entity": "sensor.test_bedroom_temp", "name": "Magamistoa temperatuur", "type": "sensor", "room": "r2", "pos": [3.313, 1.513, 3.913]},
  {"entity": "sensor.test_outdoor_temp", "name": "Õuetemperatuur", "type": "sensor", "room": "oues", "pos": [14.113, 1.713, -0.313]},
  {"entity": "binary_sensor.test_front_door", "name": "Välisuks", "type": "door", "room": "r3", "pos": [8.713, 1.117, 1.413]},
  {"entity": "binary_sensor.test_terrace_door", "name": "Terrassi uks", "type": "door", "room": "r1", "pos": [11.713, 1.117, 9.613]},
  {"entity": "binary_sensor.test_hall_motion", "name": "Esiku liikumisandur", "type": "motion", "room": "r3", "pos": [10.013, 2.517, 1.413]},
  {"entity": "binary_sensor.test_carport_motion", "name": "Varjualuse liikumisandur", "type": "motion", "room": "carport", "pos": [-0.413, 2.317, 0.013]},
  {"entity": "binary_sensor.test_kitchen_motion", "name": "Köögi andur", "type": "motion", "room": "r1", "pos": [15.613, 2.517, 0.413]},
  {"entity": "binary_sensor.test_living_motion", "name": "Elutoa andur", "type": "motion", "room": "r1", "pos": [15.613, 2.517, 9.613]},
  {"entity": "binary_sensor.test_bedroom_motion", "name": "Magamistoa andur", "type": "motion", "room": "r2", "pos": [7.213, 2.517, 4.013]},
  {"entity": "binary_sensor.test_bath_motion", "name": "Pesuruumi andur", "type": "motion", "room": "r4", "pos": [10.013, 2.517, 9.613]},
  {"entity": "binary_sensor.test_terrace_motion", "name": "Terrassi andur", "type": "motion", "room": "oues", "pos": [10.713, 2.513, 10.413]},
  {"entity": "binary_sensor.test_porch_motion", "name": "Veranda andur", "type": "motion", "room": "oues", "pos": [9.613, 2.913, 0.313]},
  {"entity": "binary_sensor.test_smoke_hall", "name": "Esiku suitsuandur", "type": "smoke", "room": "r3", "pos": [8.513, 2.613, 3.213]},
  {"entity": "binary_sensor.test_smoke_living", "name": "Elutoa suitsuandur", "type": "smoke", "room": "r1", "pos": [13.013, 2.613, 4.913]},
  {"entity": "cover.test_pergola", "name": "Lamellkatus", "type": "cover", "room": "oues", "pos": [15.613, 2.763, 13.413]},
  {"entity": "fan.test_ventilation", "name": "Ventilatsioon", "type": "vent", "room": "r6", "pos": [1.613, 2.117, 1.413]},
  {"entity": "climate.test_heat_pump", "name": "Soojuspump", "type": "heatpump", "room": "oues", "pos": [-0.553, 0.917, 9.213]},
  {"entity": "climate.test_floor_heating", "name": "Põrandaküte", "type": "climate", "room": "r6", "pos": [0.413, 0.513, 1.213]},
  {"entity": "water_heater.test_boiler", "name": "Boiler", "type": "climate", "room": "r6", "pos": [0.513, 1.513, 3.913]},
  {"entity": "alarm_control_panel.test_alarm", "name": "Valvesüsteem", "type": "alarm", "room": "r3", "pos": [10.113, 1.513, 1.513]},
  {"entity": "camera.test_drive", "name": "Väravakaamera", "type": "camera", "room": "oues", "pos": [-0.313, 2.413, -0.313], "look": [-0.181, -0.983]},
  {"entity": "camera.test_garden", "name": "Aiakaamera", "type": "camera", "room": "oues", "pos": [-0.313, 2.613, 10.313], "look": [0.875, 0.485]}
 ],
 "car": {
  "entity": "device_tracker.test_car",
  "name": "Testauto",
  "room": "carport",
  "path": [[-1.913, -14.137], [-1.913, -7.137], [-1.913, 2.913]],
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
   {"id": "pv", "kind": "pv", "name": "Päikesejaam", "roof": "main", "pos": [8.013, 7.513], "size": [8.7, 4.5], "rot": 0, "kwp": 8.8, "panels": 20, "facts": ["8,8 kWp, 20 paneeli katuse lõunaküljel", "Aastas umbes 8 500 kWh", "Hind paigaldatuna umbes 9 000 €", "Tasuvusaeg umbes 10 aastat"]},
   {"id": "charger", "kind": "charger", "name": "Laadimispunkt", "pos": [-0.613, 4.513], "rot": 270, "facts": ["11 kW, kolm faasi", "Koormuse juhtimine peakaitsme järgi"]},
   {"id": "battery", "kind": "battery", "name": "Akusalvesti", "pos": [0.351, 3.413], "rot": 90, "facts": ["12 kWh, seinale kinnitatud", "Hind umbes 6 000 €"]},
   {"id": "greenhouse", "kind": "greenhouse", "name": "Väike kasvuhoone", "pos": [0.513, 15.513], "size": [2, 3], "rot": 0, "facts": []},
   {"id": "tub", "kind": "tub", "name": "Puuküttega kümblustünn", "pos": [20.913, 10.013], "size": [2, 2], "rot": 270, "facts": []}
  ]
 }
}
```

```json house3d:showcase
{
 "showcase": {
  "title": "Näidismaja",
  "intro": "Väljamõeldud ühekorruseline viilkatusega puitmaja Home Assistanti demo jaoks.",
  "rooms": {
   "r1": { "text": "Avatud köök saarega, söögiala ja maast laeni klaasid terrassile.", "photos": [] },
   "r4": { "text": "Pesuruum kahe kraanikausiga ja uksega terrassile, saun kõrval.", "photos": [] },
   "carport": { "text": "Lamekatusega autovarjualune maja lääneotsas, uks tehnoruumi.", "photos": [] }
  },
  "features": [
   { "id": "terrace", "name": "Terrass ja pergola", "icon": "info", "pos": [13.2, 0.4, 12.2], "text": "Lõuna- ja idaküljel elutuba ümbritsev puitterrass, elutoa ees pergola all." },
   { "id": "porch", "name": "Veranda", "icon": "info", "pos": [8.7, 1.5, 0.4], "text": "Sissepääs on majja süvistatud veranda taga, katuse all kahe posti vahel." }
  ]
 }
}
```

```json house3d:surroundings
{
 "surroundings": {
  "source": "Demo house, not ETAK, 2026-01-01",
  "buildings": [
   { "outline": [[33.137, -1.313], [44.317, -1.313], [44.317, 9.137], [33.137, 9.137]], "height": 6.3 },
   { "outline": [[-23.137, 1.137], [-13.313, 1.137], [-13.313, 10.517], [-23.137, 10.517]], "height": 5.1 },
   { "outline": [[-9.137, -33.317], [2.517, -33.317], [2.517, -23.137], [-9.137, -23.137]], "height": 7.1 },
   { "outline": [[11.313, -32.137], [21.137, -32.137], [21.137, -23.513], [11.313, -23.513]], "height": 4.7 },
   { "outline": [[-3.137, 26.313], [8.517, 26.313], [8.517, 34.137], [-3.137, 34.137]], "height": 5.3 },
   { "outline": [[14.137, 25.137], [23.513, 25.137], [23.513, 33.317], [14.137, 33.317]], "height": 3.9 }
  ],
  "roads": [
   { "outline": [[-40.137, -17.513], [64.137, -17.513], [64.137, -11.531], [-40.137, -11.531]] }
  ]
 }
}
```
