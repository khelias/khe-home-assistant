# ADR-016: A3 cards draw camera stills from camera_proxy

- **Status:** Accepted (2026-11-13)
- **Related:** extends [ADR-002](002-own-dashboard-cards.md) (the repo's own cards) and [ADR-005](005-a3-glass-cards-history-sheet.md) (A3's glass look); [ADR-012](012-the-demo-is-the-houses-overview.md) (the demo carries no house data)

## Context

Kaamerad is the sixth view to move into A3's look (ADR-007 decision 3). The
approved mockup draws one camera large with the others as thumbnails under
it; a tap on a thumbnail makes it the large one, a tap on the large one
opens the camera's live view. The stock view drew the substreams with
`picture-glance` cards.

khe-cards drew no image so far. Each camera entity's state carries an
`entity_picture`, `/api/camera_proxy/<entity>?token=…`, whose token HA
rotates about every five minutes, writing a new state object each time
(measured on the house on 2026-11-13). A card's redraw replaces its whole
markup on any new watched state object, which would reload every image and
flash it.

## Decision

1. **The cameras card reads each camera's current `entity_picture`** from
   `hass` at the moment it loads a still, adds a time parameter so no cache
   answers, and a `width` for a thumbnail. It depends on the proxy's token
   and its rotation as HA's own image element does.
2. **It polls on its own timers**: the large still every 10 s, the
   thumbnails every 30 s, only while the card is on the page and the tab
   visible; becoming visible or connected loads every still at once. No
   timer runs while no camera has a picture.
3. **Its DOM is built once and its images kept.** A redraw comes only with
   a camera's state or the theme, not with a new state object, and updates
   the texts, the order and the classes. Each still loads into its own
   `Image` and replaces the shown one only after it loaded, so a failed load
   keeps the last good still, dimmed with when it was loaded.
4. **No camera image reaches the repo or the demo.** The demo's cameras have
   no `entity_picture` and draw a placeholder.

## Alternatives considered

- **Embedding `picture-glance` or HA's image element.** No control over the
  look or the swap, and HA's elements are not a public API for a card.
- **`auth/sign_path` URLs.** A WebSocket round trip per still and an expiry
  to manage, for what the state already carries.
- **MJPEG (`camera_proxy_stream`).** One open stream per camera on a phone,
  for a page that needs a still.
- **The advanced camera card in a section.** It opens live streams; the
  live view stays its job, one tap away.

## Consequences

- A change to how HA builds or rotates `entity_picture` blanks the stills
  and leaves the names and the system cells; the HA bump check in
  `docs/operational-notes.md` opens Kaamerad and watches the stills refresh
  across a token rotation.
- Each open Kaamerad tab asks the NVR's substreams through HA for one
  large still every 10 s and the others every 30 s.
- Camera motion is not on the page: it fires about every 30 s, rain or not.
  A "what happened at night" needs the cameras' smart detection first.
