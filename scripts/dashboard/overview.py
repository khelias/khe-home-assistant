"""Assemble the house's Overview dashboard from its view modules (ADR-007, ADR-012)."""

import copy

from . import entities as E
from .climate import pergola, soojuspump, ventilatsioon
from .energia import energia
from .kodu import kodu
from .media import teler
from .security import cam_view, camera_positions, cameras, valve
from .settings import (
    house3d_view,
    kaamerad_seaded,
    komfovent_seaded,
    pergola_seaded,
    soojuspump_seaded,
    susteem,
)


def overview(house, people, model):
    """The house's Overview: A3 views first (`kodu`, `energia`, `soojuspump`, `ventilatsioon`,
    `pergola`, `valve`, `kaamerad`, `teler`), then Süsteem, the settings and camera subviews, and
    the 3D view (`maja-3d`) last when a model is given. A fresh copy every call."""
    h = E.House(house, people)
    cam_pos = camera_positions(model)
    views = [
        kodu(h, model),
        energia(),
        soojuspump(),
        ventilatsioon(),
        pergola(),
        valve(model),
        cameras(h),
        teler(h),
        susteem(h),
        komfovent_seaded,
        soojuspump_seaded,
        pergola_seaded,
        kaamerad_seaded(h),
        *[cam_view(h, s, n, cam_pos) for s, n in h.cams],
        *([house3d_view(h, model)] if model is not None else []),
    ]
    config = copy.deepcopy({"title": "Kodu", "views": views})
    for v in config["views"]:
        if v.get("badges"):
            v["header"] = {"badges_wrap": "scroll"}
    return config
