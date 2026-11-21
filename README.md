# solmar-city

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/AzilHigh212/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/AzilHigh212/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar City is a complete open-world crime game in the spirit of GTA, built as a 2D
top-down canvas game with no external libraries and no network requests. You are **Mara
Solis**, a courier driver in the sun-soaked coastal city of Solmar, taking jobs from the
fixer **Dario**: a first fare, a package run past armed guards, a police chase through
the hills, and one big score at the Solmar National Bank.

**What's in the city**

- **Explore on foot and by car** — a 3600×2600 city with five districts (Marina Bay, Old
  Town, Downtown, Harbor, Hillside), a beach, parks and 100+ buildings.
- **Traffic and pedestrians** — cars follow the roads and turn at intersections;
  pedestrians walk the sidewalks and cross the streets.
- **Steal and drive** — press E next to any car to take it. Traffic cars, parked cars and
  the Palm Taxi at the stand are all yours if you are fast enough. The PD notices.
- **Wanted level** — 0 to 5 stars. Police interceptors chase you, ram you and pull you
  out of the car when they catch you. Get **BUSTED** and pay a fine; get **WASTED** and
  lose cash at the hospital. Lose the heat to cool off.
- **Missions and story** — four jobs with dialogue, objectives and cash rewards:
  1. *First Fare* ($150) — pick up the fare at Marina Pier, drop them at the Grand
     Solmar Hotel.
  2. *Harbor Pickup* ($300) — grab the package at the Harbor Warehouse while the crew
     watching it opens fire.
  3. *Heat in the Hills* ($400) — three stars on you: reach the Hillside Lookout and
     lose the heat.
  4. *The Solmar Score* ($1,000) — crack the bank vault and make the getaway to the
     Safehouse.
- **Combat** — pistol (12-round magazine, R to reload) and melee (F). Gangsters guard
  the warehouse and the bank; cash drops when they go down.
- **HUD and minimap** — cash, health, ammo, wanted stars, current objective and a live
  minimap of the whole city.
- **Save** — progress saves automatically (P to pause and save); C on the title screen
  continues, including the mission you were on.
- **Sound** — everything is synthesised in WebAudio (engine hum, sirens, gunshots,
  jingles). No audio files.
- **Start screen, pause and game-over screens** — with the controls listed and the next
  job briefed before you start.

**Controls**

- WASD / arrows — walk and drive (S brakes, then reverses)
- E — get in / out / steal a car
- Mouse — aim · Click — shoot · R — reload · F — melee
- Shift — run · M — start the next job · P / Esc — pause
- Enter — confirm / advance dialogue · C — continue a saved game

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. The game plays offline — no network
request, no build step, no install. `node shots.mjs` re-captures the four screenshots in
`screenshots/` (title, driving, police chase, mission) from the game's own staged scenes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=krnrqrk6&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
