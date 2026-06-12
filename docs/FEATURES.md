# Road Clash — Feature List

A complete inventory of what's in the game today, plus what's intentionally
deferred. (Architecture and extension recipes live in
[ARCHITECTURE.md](ARCHITECTURE.md); deploy/git in [GIT-SETUP.md](GIT-SETUP.md).)

---

## 🏍️ Core racing

- Pseudo-3D, Road Rash-style racer rendered on a single HTML5 canvas.
- Curving, climbing/dropping track with crests, hairpins, and a top-speed downhill straight.
- **Drafting / slipstream** — tuck behind a vehicle for a speed boost.
- **Slope physics** — climbs bleed speed, descents give it back.
- **Lateral grip model** — leaning, centrifugal slide on curves, recoverable wobble.
- Configurable **laps** (2 / 3 / 5) and **difficulty** (Easy / Normal / Hard).
- Lap timer, best-lap tracking, and live race position.

## 🥊 Combat

- Punch rivals (`A` / `Space`) to knock them down.
- **Weapon pickups** — snatch a **Club** (more damage) or **Chain** (more reach) off a rival mid-fight.
- Side-swipes, rear-ends, and head-ons with distinct physics + damage.
- Knockdowns raise your **Heat**.

## 🚓 Cops & Heat

- Build enough Heat and the **police** give chase (siren + flashing lights).
- The cop attacks and pursues with rubber-banding speed.
- Crash while the cop is close → **BUSTED** (time penalty).
- Knock the cop down to buy yourself room.

## 🚗 Traffic

- **Two-way** civilian traffic — cars and vans.
- Oncoming vehicles are lethal; rear-ending at speed wipes you out.
- AI rivals actively dodge traffic too.

## 🌦️ Seasons & weather

- **Three seasonal maps**, each fully reskinning sky, road, grass, foliage, and ridges:
  - **Summer** — sunset palette, palms, full grip.
  - **Winter** — snow-covered ground, drifting snowfall, mildly slippery.
  - **Rainy** — dark wet asphalt, falling rain, **noticeably slippery handling**.
- Season changes both the look **and** the grip physics.

## 🎮 Game modes

- **Solo** — race a full grid of 7 AI rivals.
- **Multiplayer** — peer-to-peer over the internet (see below).

## 🌐 Multiplayer

- **Create a room** → get a short code **and a shareable link**.
- **Join** with a code, or open a shared `?room=` link to auto-fill it.
- Serverless **P2P over WebRTC** (Trystero / Nostr discovery) — nothing to host.
- **Humans fill rider slots; AI backfills** the rest, so the pack is always full.
- Client-side prediction for your own bike (instant control) + interpolation of remote riders (~120 ms) for smoothness.
- Host-synced **track seed + season + laps**, so everyone races the identical course.
- Combat relayed between players.

## ⏸️ Pause (solo)

- **Esc** pauses with a menu: **Continue** or **Abandon → Home**.
- Resuming runs a **3 · 2 · 1** countdown.
- Pause swaps the engine roar for a **subtle ambient pad**.
- **Auto-pauses** if you switch tabs mid-race.
- (Online races can't pause — it would desync — so Esc is ignored there by design.)

## 🎛️ Controls & input

- **Keyboard:** `↑↓←→` ride · `A`/`Space` fight · `Esc` pause · `M` mute.
- **Touch:** hold a screen half to steer · on-screen Brake + Punch buttons · auto-throttle.
- **Full keyboard navigation of all menus** — arrows/Tab move, Enter/Space activate, ←/→ adjust settings, Esc goes back, with a visible focus ring.

## 🖥️ UI & menus

- DOM overlay menus over the live, scrolling game backdrop.
- Screens: Title · Multiplayer (create/join) · Lobby (player list, copy-link) · Settings · **How to Play** · Pause · Race Over (standings).
- Settings persist in `localStorage`.
- Bike colour, throttle mode (auto/always-on/manual), traffic density, police on/off.

## 🔊 Audio

- Fully **procedural** (no audio files): synth engine that responds to speed, wind, Doppler-ish siren, and impact/punch/crash SFX.
- Subtle ambient pad on pause.
- Global mute (`M`), respected everywhere.

## 🛡️ Robustness & safety

- **Friendly error screen** with a Reload button — users never see a raw crash or blank page.
- Global error handlers + a try/catch around the whole game loop + an inline pre-boot fallback.
- **All untrusted input validated**: every network message from a peer is parsed and range-clamped (no NaN/teleport/injection); `localStorage` settings sanitized on load.
- Rendered text escaped; player colours hex-validated (anti-injection).

## ⚙️ Tech & platform

- **TypeScript + Vite + Canvas 2D + WebRTC.** No frameworks, no rendering libs.
- **~30 KB gzipped** total bundle (including multiplayer) — instant load.
- **Cross-browser**: Chrome, Firefox, Safari, Edge + mobile (with a `roundRect` polyfill and `-webkit-` fallbacks for older Safari).
- Responsive canvas scaling; works on desktop and touch devices.
- Deployable to Cloudflare Pages; `git push` → live.

---

## 🗺️ Deferred / planned (not yet built)

These are intentional v1 cuts with clear upgrade paths (see ARCHITECTURE.md §4):

- TURN/relay fallback transport for players behind strict NATs.
- Host-authoritative AI so bots are identical across all peers.
- Live mid-race join (currently late joiners wait for the next race).
- Host migration if the host leaves.
- Persistent leaderboards / profiles.
