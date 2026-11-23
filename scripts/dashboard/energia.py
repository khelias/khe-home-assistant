"""Energia view in A3's look (ADR-007, ADR-008, ADR-013)."""

from . import entities as E
from .primitives import BACKGROUND, card, heading, section


def energia():
    """Energia: the month, the days, who used what and the price."""
    return {
        "title": "Energia",
        "path": "energia",
        "icon": "mdi:lightning-bolt",
        "type": "sections",
        "max_columns": 2,
        "background": BACKGROUND,
        "sections": [
            section(
                [
                    card(
                        "month-card",
                        title="Energia",
                        month=E.MONTH,
                        last_month=E.LAST_MONTH,
                        today=E.TODAY,
                        yesterday=E.YESTERDAY,
                        consumption=E.CONSUMPTION,
                        usage_history={
                            "entity": E.CONSUMPTION,
                            "cost": E.COST,
                            "source": "statistics",
                            "type": "change",
                        },
                        grid_options={"columns": "full"},
                    ),
                    heading("Päevad", "/energy"),
                    card(
                        "days-card",
                        days=31,
                        cutoff=E.CONSUMPTION,
                        series=[
                            {
                                "name": "kWh",
                                "statistic": E.CONSUMPTION,
                                "type": "change",
                                "unit": "kWh",
                                "decimals": 1,
                                "color": "indigo",
                                "caption": "kWh päevas keskmiselt",
                                "aria": "Tarbimine päevade kaupa",
                                "title": "Maja elekter",
                                "more": E.TODAY,
                                "today": {"entity": E.TODAY},
                            },
                            {
                                "name": "Eurod",
                                "statistic": E.COST,
                                "type": "change",
                                "unit": "€",
                                "decimals": 2,
                                "color": "teal",
                                "caption": "€ päevas keskmiselt, ilma kuutasudeta",
                                "aria": "Kulu päevade kaupa",
                                "title": "Maja elektrikulu",
                                "more": E.TODAY,
                                "today": {"entity": E.TODAY, "attribute": "kulu"},
                            },
                        ],
                        grid_options={"columns": "full"},
                    ),
                ]
            ),
            section(
                [
                    heading("Kes võtab sel kuul"),
                    card(
                        "split-card",
                        total=E.MONTH,
                        fresh=E.STALE,
                        parts=[
                            {
                                "entity": E.BOILER_MONTH,
                                "name": "Boiler",
                                "icon": "flame",
                                "color": "orange",
                                "last": "month",
                                "view": "/lovelace/soojuspump",
                            },
                            {
                                "entity": E.VENT_MONTH,
                                "name": "Ventilatsioon",
                                "icon": "vent",
                                "color": "blue",
                                "last": "last_period",
                                "view": "/lovelace/ventilatsioon",
                            },
                            {
                                "entity": E.HEATER_MONTH,
                                "name": "Järelküte",
                                "icon": "thermometer",
                                "color": "red",
                                "last": "last_period",
                                "hide_zero": True,
                                "view": "/lovelace/ventilatsioon",
                            },
                        ],
                        grid_options={"columns": "full"},
                    ),
                    heading("Hind 30 päeva"),
                    card(
                        "days-card",
                        days=30,
                        series=[
                            {
                                "name": "Hind",
                                "statistic": E.PRICE_STAT,
                                "type": "mean",
                                "peak": True,
                                "scale": 100,
                                "decimals": 1,
                                "bands": list(E.PRICE_BANDS),
                                "unit": "senti/kWh",
                                "caption": "senti/kWh keskmiselt, kõigi tasudega",
                                "aria": "Elektri hinna päeva keskmine ja kalleim tund",
                                "title": "Elektri hind",
                                "more": E.PRICE_LEVEL,
                            }
                        ],
                        grid_options={"columns": "full"},
                    ),
                ]
            ),
        ],
    }
