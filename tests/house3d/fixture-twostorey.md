# House 3D test fixture: two storeys and the wing roofs

A made-up house for the roof kinds and the storeys (`scripts/house3d_model.py`): nothing here
describes a real place. An L of two storeys under a hip roof of two wings, the long wing along
the street (+x) and the short one running back from its west end; a one-storey porch on the long
wing's east end under a flat roof, so the upper storey stands back from it; and a garage against
the porch's east wall under a gable roof with its ridge running back from the street (z), its
door in the street gable. The upper storey has two rooms with a wall between them.

```json house3d:geometry
{
 "units": "m",
 "axes": "x along the street, z away from the street, y up",
 "ceiling": 2.6,
 "levels": [0, 3],
 "roofs": {
  "main": { "kind": "hip", "rects": [[-0.5, -0.5, 12.5, 8.5], [-0.5, -0.5, 6.5, 14.5]], "eave_y": 5.4, "pitch_deg": 22, "thick": 0.25 },
  "porch": { "kind": "flat", "rects": [[12, -0.4, 15.4, 8.4]], "y": 3.3, "thick": 0.25 },
  "garage": { "kind": "gable", "rects": [[14.7, 0.6, 21.3, 8.4]], "ridge": "z", "eave_y": 2.5, "pitch_deg": 30, "thick": 0.2 }
 },
 "walls": [
  { "a": [0, 0], "b": [12, 0], "t": 0.4, "top": 3, "openings": [
   { "kind": "window", "c": 2.5, "w": 1.6, "h": 1.3, "sill": 0.8 },
   { "kind": "window", "c": 8, "w": 2.4, "h": 1.3, "sill": 0.8 }
  ] },
  { "a": [12, 0], "b": [15, 0], "t": 0.4, "top": "porch", "openings": [
   { "kind": "door", "c": 1.5, "w": 1, "h": 2.1, "finish": "cladding" }
  ] },
  { "a": [15, 0], "b": [15, 8], "t": 0.4, "top": "porch", "openings": [
   { "kind": "door", "c": 4.5, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [15, 8], "b": [12, 8], "t": 0.4, "top": "porch" },
  { "a": [12, 8], "b": [6, 8], "t": 0.4, "top": 3, "openings": [
   { "kind": "glassdoor", "c": 3, "w": 1.8, "h": 2.1 }
  ] },
  { "a": [6, 8], "b": [6, 14], "t": 0.4, "top": 3, "openings": [
   { "kind": "window", "c": 3, "w": 1.6, "h": 1.3, "sill": 0.8 }
  ] },
  { "a": [6, 14], "b": [0, 14], "t": 0.4, "top": 3 },
  { "a": [0, 14], "b": [0, 0], "t": 0.4, "top": 3, "openings": [
   { "kind": "window", "c": 4, "w": 1.6, "h": 1.3, "sill": 0.8 }
  ] },
  { "a": [12, 0], "b": [12, 8], "t": 0.4, "top": 3, "openings": [
   { "kind": "door", "c": 4, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [0, 0], "b": [12, 0], "t": 0.4, "top": "main", "level": 1, "openings": [
   { "kind": "window", "c": 2.5, "w": 1.2, "h": 1.2, "sill": 0.9 },
   { "kind": "window", "c": 8, "w": 1.2, "h": 1.2, "sill": 0.9 }
  ] },
  { "a": [12, 0], "b": [12, 8], "t": 0.4, "top": "main", "level": 1, "openings": [
   { "kind": "window", "c": 4, "w": 1, "h": 1.2, "sill": 0.9 }
  ] },
  { "a": [12, 8], "b": [6, 8], "t": 0.4, "top": "main", "level": 1 },
  { "a": [6, 8], "b": [6, 14], "t": 0.4, "top": "main", "level": 1 },
  { "a": [6, 14], "b": [0, 14], "t": 0.4, "top": "main", "level": 1, "openings": [
   { "kind": "window", "c": 3, "w": 1.2, "h": 1.2, "sill": 0.9 }
  ] },
  { "a": [0, 14], "b": [0, 0], "t": 0.4, "top": "main", "level": 1, "openings": [
   { "kind": "window", "c": 11, "w": 1, "h": 1.2, "sill": 0.9 }
  ] },
  { "a": [0, 8], "b": [6, 8], "t": 0.15, "top": 5.6, "level": 1, "openings": [
   { "kind": "door", "c": 3, "w": 0.9, "h": 2.1 }
  ] },
  { "a": [15, 1], "b": [21, 1], "t": 0.4, "top": "garage", "openings": [
   { "kind": "door", "c": 3, "w": 2.6, "h": 2.1, "finish": "cladding" }
  ] },
  { "a": [21, 1], "b": [21, 8], "t": 0.4, "top": "garage" },
  { "a": [21, 8], "b": [15, 8], "t": 0.4, "top": "garage" }
 ],
 "furniture": [
  { "rect": [1, 1, 3.2, 2], "y": [0, 0.8], "kind": "sofa", "back": ["z0"] },
  { "rect": [8, 3, 10, 4], "y": [0, 0.75], "kind": "table" }
 ],
 "site": {
  "lot": [[-8, -8], [30, -8], [30, 24], [-8, 24]],
  "paving": [[15.5, -4, 20.5, 0.5]]
 }
}
```

```json house3d:rooms
{
 "rooms": [
  { "id": "living", "name": "Elutuba", "rects": [[0, 0, 12, 8], [0, 8, 6, 14]] },
  { "id": "porch", "name": "Tuulekoda", "rects": [[12, 0, 15, 8]], "floor": "tile" },
  { "id": "garage", "name": "Garaaž", "rects": [[15, 1, 21, 8]], "floor": "tile" },
  { "id": "bed", "name": "Magamistuba", "rects": [[0, 0, 12, 8]], "level": 1 },
  { "id": "kids", "name": "Lastetuba", "rects": [[0, 8, 6, 14]], "level": 1 }
 ]
}
```

```json house3d:private
{
 "devices": []
}
```

```json house3d:showcase
{
 "showcase": {
  "title": "Kahekordne testmaja",
  "intro": "Väljamõeldud kahekordne maja katuseliikide testimiseks.",
  "rooms": {},
  "features": []
 }
}
```
