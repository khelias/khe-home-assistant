# khe-home-assistant

The Home Assistant configuration of one house, public as a
reference: YAML packages for the heat pump, ventilation, alarm, pergola,
energy prices and the TV, a generator for the dashboard, small tools for HA's
API, and a 3D view of the house that shows the devices in place.

## What is not here

Nothing that identifies the house or the family: device ids, local keys,
addresses, room and family names and the house model live in private
storage. HA's `.storage` (users, tokens, integration credentials) and the
recorder stay on the server. The container that runs HA, its image and its
backup are in [khe-homelab](https://github.com/khelias/khe-homelab).

## How it deploys

A push to `main` that changes the configuration or the 3D view runs a
workflow on the homelab's own runner. It validates the configuration with
`check_config` inside the running HA image, then copies it into HA's config
volume. It never restarts HA: a reload or a restart through the API makes
the new configuration live.

## Checks

```bash
bash scripts/check.sh
```

## More

- [AGENTS.md](AGENTS.md) - layout, commands, rules and how HA is operated
- [docs/operational-notes.md](docs/operational-notes.md) - integration quirks
  and the 3D view
- [ROADMAP.md](ROADMAP.md) - where the house automation is going
- [khe-architecture](https://github.com/khelias/khe-architecture) - the
  estate this repo belongs to

## License

[MIT](LICENSE)
