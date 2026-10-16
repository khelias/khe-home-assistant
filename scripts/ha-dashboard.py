#!/usr/bin/env python3
"""Generate and save the Home Assistant Overview dashboard for the house.

The dashboard is storage-mode config in HA's .storage (backed up nightly by
backup.sh); this script is its source of truth. The config itself is built by
dashboard_config.build(); this script reads its private inputs, builds and
saves. Edit there, run here, and HA picks the new config up live.

Usage:  ha-dashboard.py            (saves to the "lovelace" Overview)
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
import house3d_model

HA = "192.168.0.11:8123"
URL = "lovelace"  # the Overview, a dashboard entry since the 2026.9 migration


# This repo is public, so nothing that identifies the house or the family is hard-coded here.
# Two untracked local files carry that, and every consumer in dashboard_config degrades to
# "leave the card out" when they are missing:
#   ~/.config/khe/ha-house.json   {"cams": [[slug, label], ...], "phone": "sensor.<device>",
#                                  "nvr_app_url": "<scheme>://", "updates": [["update.<x>", "<name>"]],
#                                  "tv_profiles": [[<picker position>, "<name>"], ...]}  (Google TV)
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


def local_config():
    """The real dashboard: build() with the local house files and the model."""
    return dashboard_config.build(
        _local("ha-house.json", {}), _local("ha-people.json", []), house3d_card_model()
    )


async def main(config):
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

        r = await call(type="lovelace/config/save", url_path=URL, config=config)
        print("save:", "ok" if r.get("success") else r.get("error"))
        r = await call(type="lovelace/config", url_path=URL)
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
    asyncio.run(main(local_config()))
