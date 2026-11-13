# ADR-014: A3 reads the weather forecast through `weather.get_forecasts`

- **Status:** Accepted (2026-11-13)
- **Related:** extends [ADR-008](008-a3-page-cards-read-statistics.md) (page cards load their data once an hour) and [ADR-012](012-the-demo-is-the-houses-overview.md) decision 3 (the demo's recorder answers what the cards ask)

## Context

Pergola is the fourth view to move into A3's look (ADR-007 decision 3). The
operator opens it when rain is coming and on a fine day, and the approved
mockup draws the next hours as A3's own chart: precipitation bars, a
temperature line and a mark under each rainy hour. HA's own weather card
draws none of that and does not take A3's look.

A weather entity's forecast attribute was deprecated in HA 2023.9 and
removed in 2024.4; the forecast is read through the `weather.get_forecasts`
service with a response (2023.12), or by subscribing to
`weather/subscribe_forecast`. The house's `weather.forecast_kodu`
answers the service with hourly rows of `datetime`, `temperature`,
`precipitation` and `condition` (measured 2026-11-13).

## Decision

1. **A3's forecast card reads the forecast as a `LoadingCard` request**:
   `{type: "call_service", domain: "weather", service: "get_forecasts",
   service_data: {type: "hourly"}, target: {entity_id}, return_response:
   true}`, loaded with the other cards' requests once per HA-zone hour and
   shared between cards through the same fetch. It reads the rows under
   `response[entity_id].forecast`. An empty or failed answer draws the
   card's cells and says the forecast is not known.
2. **The demo's recorder answers the same message** from a made-up forecast
   that agrees with its own rain and outdoor-temperature profiles, so the
   demo's Pergola view draws the house's card on made-up data (extends
   ADR-012 decision 3's list of answered messages).

## Alternatives considered

- **`weather/subscribe_forecast`.** It pushes each update, but it is a
  second lifecycle beside `LoadingCard` (subscribe on connect, unsubscribe
  on leaving the page) and a subscription the demo would have to fake. The
  forecast changes about once an hour, which the hourly load already
  follows.
- **A template sensor that copies the forecast into an attribute.** A
  second copy of the same data in the recorder, and a template reload
  before the dashboard can show a change to it.

## Consequences

- A frontend change to `call_service` over WebSocket, or a weather
  integration change to `get_forecasts`' response, blanks the chart and
  leaves the cells; the HA bump check in `docs/operational-notes.md` looks at
  Pergola's forecast against a direct `get_forecasts` call.
- The forecast can be up to an hour old on the page, as the statistics the
  other A3 cards read are.
