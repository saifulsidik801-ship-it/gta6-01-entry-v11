# AZURA BAY — City of Glass and Gold

[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/saifulsidik801-ship-it/gta6-01-entry-v11/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/saifulsidik801-ship-it/gta6-01-entry-v11/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

Drive the Golden Strand of **Azura Bay** — a sun-drowned coastal city of
glass towers, neon night markets and palm boulevards. Steal cars, outrun the
Azura PD in high-speed pursuits, build your wanted level, run missions for
the crew, and turn your ride into solid gold at Azura Customs.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

- **W A S D / arrows** — drive / walk
- **Space** — handbrake / drift
- **E** — enter / exit car
- **Shift** — sprint on foot
- **M** — missions, **P** — pause, **C** — camera

## Features

- A drivable open city: beach boulevard, night market, marina, customs garage
- Traffic, pedestrians, police pursuits with a 5-star wanted system
- Helicopter air unit, missions with a story, crew cards and a full GTA-style HUD
- Minimap, health / armour, money, radio, day-to-dusk lighting
- Saves progress locally; runs fully offline as plain static files

## Tech

Three.js (vendored under `game/vendor/`), plain ES modules, no build step.
Screenshots in `screenshots/` are real renders of this game's own code.

## License

SPDX-License-Identifier: MIT
