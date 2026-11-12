#!/usr/bin/env python3
"""Generate and save the house's dashboards: the Overview (Kodu) and the trial "Kodu katse".

The dashboard is storage-mode config in HA's .storage (backed up nightly by
backup.sh); this script is its source of truth. The configs are built by
dashboard_config.build() and, for the Bubble Card trial (ADR-004),
dashboard_trial.build(); this script reads their private inputs, builds and
saves. Edit there, run here, and HA picks the new config up live.

Usage:  ha-dashboard.py            (saves Kodu to the "lovelace" Overview)
        ha-dashboard.py --trial    (creates "kodu-katse" if it is missing, saves the trial there)
Needs:  python3 with `websockets`, the HA long-lived token in
        ~/.config/khe/ha-token, optional family list in ~/.config/khe/ha-people.json,
        optional 3D house model (HOUSE3D_MODEL, below).
"""

import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dashboard_config
import dashboard_trial
import house3d_model

HA = "192.168.0.11:8123"
URL = "lovelace"  # the Overview, a dashboard entry since the 2026.9 migration
TRIAL = {
    "url_path": "kodu-katse",
    "title": "Kodu katse",
    "icon": "mdi:home-variant",
    "show_in_sidebar": True,
    "require_admin": False,
}


# This repo is public, so nothing that identifies the house or the family is hard-coded here.
# Two untracked local files carry that, and every consumer in dashboard_config degrades to
# "leave the card out" when they are missing:
#   ~/.config/khe/ha-house.json   {"cams": [[slug, label], ...], "phone": "sensor.<device>",
#                                  "nvr_app_url": "<scheme>://", "updates": [["update.<x>", "<name>"]],
#                                  "tv_profiles": [[<picker position>, "<name>"], ...],  (Google TV)
#                                  "car_entity": "<domain>.<id>"}  (the 3D car's entity when the
#                                  model's car has none; without one the card hides the car)
#   ~/.config/khe/ha-people.json  [[entity_id, label], ...]
#   HOUSE3D_MODEL                 path to khe-meta's house/house-model.md (the 3D view's walls, rooms and
#                                 devices); unset, the khe-meta checkout beside this repo is used
def _local(name, default):
    path = os.path.expanduser("~/.config/khe/" + name)
    return json.load(open(path)) if os.path.exists(path) else default


# The 3D card's model: every layer but the standalone viewer's showcase, with the family's room
# names, so it lives only in HA's .storage. None when there is no model.
def house3d_card_model():
    path = os.environ.get("HOUSE3D_MODEL") or str(
        Path(__file__).resolve().parents[2] / "khe-meta/house/house-model.md"
    )
    if not os.path.exists(path):
        print(
            f"house3d: no model at {path}, the 3D view is left out (saving removes a live one)",
            file=sys.stderr,
        )
        return None
    layers = house3d_model.read_layers(path)
    problems = house3d_model.validate(layers)
    if problems:
        raise SystemExit("house3d model: " + "; ".join(problems))
    return house3d_model.with_room_names(house3d_model.merge(layers, house3d_model.CARD))


# The model's own car entity wins; the house file's only fills a missing one.
def with_car_entity(model, entity):
    car = (model or {}).get("car")
    if not entity or not car or car.get("entity"):
        return model
    if not (isinstance(entity, str) and "." in entity):
        raise SystemExit("ha-house.json: car_entity is not an entity id")
    return {**model, "car": {**car, "entity": entity}}


def local_config():
    """The real dashboard: build() with the local house files and the model."""
    house = _local("ha-house.json", {})
    model = with_car_entity(house3d_card_model(), house.get("car_entity"))
    return dashboard_config.build(house, _local("ha-people.json", []), model)


def trial_config():
    """The trial dashboard: dashboard_trial.build() with the local house files, no 3D model."""
    return dashboard_trial.build(_local("ha-house.json", {}), _local("ha-people.json", []))


async def main(config, url_path, create=None):
    async with websockets.connect(f"ws://{HA}/api/websocket", max_size=2**24) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "auth", "access_token": TOKEN}))
        assert json.loads(await ws.recv())["type"] == "auth_ok"
        mid = [0]

        async def call(**msg):
            mid[0] += 1
            msg["id"] = mid[0]
            await ws.send(json.dumps(msg))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == mid[0]:
                    return r

        if create:
            r = await call(type="lovelace/dashboards/list")
            if not r.get("success"):
                raise SystemExit(f"dashboards/list: {r.get('error')}")
            if url_path not in [d["url_path"] for d in r["result"]]:
                r = await call(type="lovelace/dashboards/create", **create)
                print("create:", "ok" if r.get("success") else r.get("error"))
                if not r.get("success"):
                    raise SystemExit(1)
        r = await call(type="lovelace/config/save", url_path=url_path, config=config)
        print("save:", "ok" if r.get("success") else r.get("error"))
        r = await call(type="lovelace/config", url_path=url_path)
        v = r["result"]["views"]
        print(
            "views:",
            [x["title"] for x in v],
            "| cards:",
            sum(len(c["cards"]) for x in v for c in x.get("sections", [x])),
        )


if __name__ == "__main__":
    import websockets

    TOKEN = Path("~/.config/khe/ha-token").expanduser().read_text().strip()
    if sys.argv[1:] == ["--trial"]:
        asyncio.run(main(trial_config(), TRIAL["url_path"], create=TRIAL))
    elif sys.argv[1:]:
        sys.exit(__doc__)
    else:
        asyncio.run(main(local_config(), URL))
