"""The demo's scenarios: short stories a visitor plays on the demo house (demo/scenario.js).

A scenario is {id, title, summary, view, time, start, steps}: the view's path, for the 3D view
the instant its sky shows (a fixed November date with the Tallinn offset, so the sun is the same
for every visitor), the states it starts from as overrides of demo_states(), and its steps. A
step is {at, caption?, automation?} with one action: set [entity, state], service
[domain, service, entity or entities, data], time (an ISO instant for the 3D view's sky) or car
"arrive". A step that carries `automation` plays what that real automation in config/packages/
does, under its alias; tests/dashboard/test_dashboard_scenarios.py holds every such step to the
automation's own actions and triggers. Everything else a scenario tells is the people's or the
devices' doing and carries no alias. Entities are demo ids only.

house3d-build.py --demo writes demo_scenarios() as scenarios.json and demo_scenarios_en() as
scenarios.en.json, its English from dashboard_demo_en (ADR-003). Stdlib only and no I/O.
"""

import copy

import dashboard_demo as dd

DATE = "2026-11-14"
# older than the 3D view's 15-minute motion glow, so no room glows before the story
QUIET_AGO = 30
HOUSE_LIGHTS = ("light.test_living", "light.test_bedroom")

ALARM = "alarm_control_panel.test_alarm"
CARPORT = "binary_sensor.test_carport_motion"
HALL = "binary_sensor.test_hall_motion"
LIVING = "binary_sensor.test_living_motion"
BEDROOM = "binary_sensor.test_bedroom_motion"
BATH = "binary_sensor.test_bath_motion"
FRONT_DOOR = "binary_sensor.test_front_door"
TERRACE_DOOR = "binary_sensor.test_terrace_door"
SIREN = "binary_sensor.demo_siren"
SMOKE_HALL = "binary_sensor.test_smoke_hall"
SMOKE_GROUP = "binary_sensor.demo_smoke_group"
LIVING_LIGHT, BEDROOM_LIGHT = HOUSE_LIGHTS
ROOF = "cover.test_pergola"
RAIN = "sensor.demo_rain_now"
RAIN_NOTICE = "input_datetime.demo_rain_notice"
PERGOLA_LIGHT = "light.test_pergola"
TONE = "input_select.demo_light_tone"
TONES_LR = ["select.demo_tone_right", "select.demo_tone_left"]
# the sunset automation reads the evening tone and the level from these helpers
EVENING = dd.CATALOGUE["input_select.pergola_ohtune_toon"]["state"]
LEVEL = int(dd.CATALOGUE["input_number.pergola_valguse_heledus"]["state"])
DAYTIME = dd.TONES[2]

RAIN_CLOSES = "Pergola: vihm sulgeb katuse"
LIGHTS_AT_SUNSET = "Pergola: valgustus loojangul"
ALARM_TRIGGERED = "Valve: häire"
FIRE = "Valve: tulekahju"


def at(hhmm):
    return f"{DATE}T{hhmm}:00+02:00"


def step(t, caption=None, automation=None, **action):
    s = {"at": t, **action}
    if caption:
        s["caption"] = caption
    if automation:
        s["automation"] = automation
    return s


def put(t, entity, state, caption=None, automation=None):
    return step(t, caption, automation, set=[entity, state])


def call(t, domain, service, entity, data=None, caption=None, automation=None):
    return step(t, caption, automation, service=[domain, service, entity, data or {}])


SCENARIOS = [
    {
        "id": "koju",
        "title": "Koju jõudmine",
        "summary": "Auto jõuab õhtul koju ja inimene läheb majja.",
        "view": "maja-3d",
        "time": at("18:30"),
        "start": {ALARM: {"state": "armed_away"}},
        "steps": [
            step(2, "Auto jõuab koju, värav avaneb ja sulgub auto järel.", car="arrive"),
            put(9, CARPORT, "on", "Varjualuse liikumisandur näeb inimest."),
            put(12, FRONT_DOOR, "on", "Välisuks avaneb."),
            put(13, CARPORT, "off"),
            put(14, HALL, "on", "Eeskojas on liikumine."),
            call(17, "alarm_control_panel", "alarm_disarm", ALARM, caption="Valve võetakse maha."),
            put(20, FRONT_DOOR, "off", "Välisuks sulgub."),
            put(22, HALL, "off"),
            put(23, LIVING, "on", "Köök-elutoas on liikumine."),
            call(
                26,
                "light",
                "turn_on",
                LIVING_LIGHT,
                {"brightness_pct": 80},
                "Elutoa lamp süttib: selle lülitab sisse inimene, mitte automaatika.",
            ),
            put(30, LIVING, "off"),
            step(31, "Liikumisandurite rada näitab, kust inimene läbi läks."),
        ],
    },
    {
        "id": "hommik",
        "title": "Hommik",
        "summary": "Inimene ärkab ja liigub magamistoast kööki.",
        "view": "maja-3d",
        "time": at("06:45"),
        "start": {},
        "steps": [
            put(2, BEDROOM, "on", "Magamistoas on liikumine."),
            call(
                5,
                "light",
                "turn_on",
                BEDROOM_LIGHT,
                {"brightness_pct": 40},
                "Magamistoa lamp süttib: selle lülitab sisse inimene.",
            ),
            put(9, BEDROOM, "off"),
            put(9.5, BATH, "on", "Vannitoas on liikumine."),
            put(15, BATH, "off"),
            put(15.5, HALL, "on", "Eeskojas on liikumine."),
            put(19, HALL, "off"),
            put(19.5, LIVING, "on", "Köök-elutoas on liikumine."),
            call(
                22, "light", "turn_on", LIVING_LIGHT, {"brightness_pct": 80}, "Elutoa lamp süttib."
            ),
            call(26, "light", "turn_off", BEDROOM_LIGHT, caption="Magamistoa lamp kustutatakse."),
            put(29, LIVING, "off"),
            step(30, "Rada näitab hommikust teekonda magamistoast kööki."),
        ],
    },
    {
        "id": "sissetung",
        "title": "Öine sissetung",
        "summary": "Öösel, kui valve on peal, avaneb terrassi uks.",
        "view": "maja-3d",
        "time": at("02:30"),
        "start": {ALARM: {"state": "armed_away"}},
        "steps": [
            put(2, TERRACE_DOOR, "on", "Valve on peal ja terrassi uks avaneb."),
            put(5, LIVING, "on", "Köök-elutoas on liikumine."),
            put(8, ALARM, "triggered", "Valvepaneel läheb häiresse."),
            put(9, SIREN, "on", "Välissireen hakkab tööle."),
            step(
                12,
                "Telefonidesse tuleb kriitiline teavitus, kus on kirjas avatud uksed ja aktiivsed andurid.",
                ALARM_TRIGGERED,
            ),
            call(20, "alarm_control_panel", "alarm_disarm", ALARM, caption="Valve võetakse maha."),
            put(21, SIREN, "off", "Sireen vaikib."),
        ],
    },
    {
        "id": "tulekahju",
        "title": "Tulekahju",
        "summary": "Õhtul tunneb eeskoja suitsuandur suitsu.",
        "view": "maja-3d",
        "time": at("21:00"),
        "start": {},
        "steps": [
            put(2, SMOKE_HALL, "on", "Eeskoja suitsuandur tunneb suitsu."),
            put(4, SMOKE_GROUP, "on", "Suitsuandurite tsoon läheb valvepaneelis tööle."),
            step(
                7,
                "Telefonidesse tuleb kriitiline teavitus koos maja ja garaaži valve olekuga.",
                FIRE,
            ),
            put(13, HALL, "on", "Keegi läheb eeskotta vaatama."),
            put(19, SMOKE_HALL, "off", "Suitsu enam pole ja andurid on jälle korras."),
            put(19.5, SMOKE_GROUP, "off"),
            put(23, HALL, "off"),
        ],
    },
    {
        "id": "vihm",
        "title": "Vihm",
        "summary": "Pergola on lahti, kui hakkab sadama.",
        "view": "pergola",
        "time": None,
        "start": {ROOF: {"state": "open"}, RAIN: {"state": "0.0"}},
        "steps": [
            step(2, "Pergola on lahti ja katuse automaatika on sees."),
            put(5, RAIN, "1.2", "Hakkab sadama, 1,2 mm tunnis."),
            call(7, "cover", "close_cover", ROOF, caption="Katus sulgub.", automation=RAIN_CLOSES),
            step(10, "Telefoni tuleb teavitus, et sajab ja katus suleti.", RAIN_CLOSES),
            call(
                12,
                "input_datetime",
                "set_datetime",
                RAIN_NOTICE,
                {"datetime": f"{DATE} 14:20:00"},
                "Teavituse aeg jääb meelde, et järgmine tuleks alles vaikuse järel.",
                RAIN_CLOSES,
            ),
        ],
    },
    {
        "id": "loojang",
        "title": "Loojang",
        "summary": "Pool tundi enne loojangut süttivad pergola tuled õhtuse tooniga.",
        "view": "maja-3d",
        "time": at("14:55"),
        "start": {
            TONE: {"state": DAYTIME},
            **{e: {"state": DAYTIME} for e in TONES_LR},
            PERGOLA_LIGHT: {"state": "off"},
        },
        "steps": [
            step(
                1, "Kell on 14.55, päike loojub kell 15.54. Pergola tuled on külma valge tooniga."
            ),
            step(5, "Kell on 15.10.", time=at("15:10")),
            step(9, "Kell on 15.25, loojanguni on vähem kui pool tundi.", time=at("15:25")),
            call(
                12,
                "select",
                "select_option",
                TONES_LR,
                {"option": EVENING},
                "Tuled saavad õhtuse tooni.",
                LIGHTS_AT_SUNSET,
            ),
            call(
                12.5,
                "input_select",
                "select_option",
                TONE,
                {"option": EVENING},
                automation=LIGHTS_AT_SUNSET,
            ),
            call(
                14,
                "light",
                "turn_on",
                PERGOLA_LIGHT,
                {"brightness_pct": LEVEL},
                "Pergola tuled süttivad seatud heledusega.",
                LIGHTS_AT_SUNSET,
            ),
            step(18, "Kell on 15.40.", time=at("15:40")),
            step(22, "Kell on 15.54, päike loojub.", time=at("15:54")),
            step(26, "Kell on 16.10, taevas tumeneb ja pergola tuled paistavad.", time=at("16:10")),
        ],
    },
]


def quiet(model):
    """The start every 3D scenario shares: every motion sensor off for a while, the house's
    lights off."""
    states = dd.demo_states(model)["states"]
    out = {
        e: {"state": "off", "ago": QUIET_AGO}
        for e, s in states.items()
        if s["attributes"].get("device_class") == "motion"
    }
    out.update({e: {"state": "off"} for e in HOUSE_LIGHTS})
    return out


def demo_scenarios(model):
    """SCENARIOS with the quiet start merged under each 3D scenario's own."""
    base = quiet(model)
    out = copy.deepcopy(SCENARIOS)
    for s in out:
        if s["time"]:
            s["start"] = {**copy.deepcopy(base), **s["start"]}
    return out


def _data_en(data):
    return {k: (dd._word(v) if k == "option" else v) for k, v in data.items()}


def demo_scenarios_en(model):
    """demo_scenarios() in English: titles, summaries, captions and aliases, and the state words
    and options in the starts, sets and service data."""
    out = demo_scenarios(model)
    for s in out:
        s["title"], s["summary"] = dd._en(s["title"]), dd._en(s["summary"])
        for o in s["start"].values():
            o["state"] = dd._word(o["state"])
        for st in s["steps"]:
            for k in ("caption", "automation"):
                if k in st:
                    st[k] = dd._en(st[k])
            if "set" in st:
                st["set"][1] = dd._word(st["set"][1])
            if "service" in st:
                st["service"][3] = _data_en(st["service"][3])
    return out
