# Road Clash — Architecture

A guide to how the game is put together and, more importantly, **how to extend it
safely**. The guiding principle: clean seams where behaviour changes (networking,
game modes, seasons, UI), a cohesive core where it doesn't (the tuned
simulation + renderer).

---

## 1. Big picture

```
                 ┌─────────────────────────────────────────────┐
   index.html ── │  main.ts  (boot + fixed-ish rAF game loop)   │
                 └───────────────┬─────────────────────────────┘
                                 │ owns one Session, drives the loop
              ┌──────────────────┼───────────────────────────────┐
              ▼                  ▼                                ▼
       ui/ (DOM menu,     session/ (Strategy)              engine/ (sim + render)
        input wiring)   SoloSession │ MultiplayerSession    track·physics·render·
                                    │                        sprites·audio·seasons·
                                    ▼                        particles·hud
                              net/ (Transport DIP)
                          Transport ⟵ TrysteroTransport
                          protocol (validate) · snapshot (interp)
                                    │
                              core/ (shared everything)
                       state·types·constants·settings·math·rng·view·errors
```

Data lives in **one mutable `world`** (`core/state.ts`). Engine systems read and
write it; the loop orchestrates; sessions layer networking on top. This keeps the
original single-file game's fast shared-state model while giving every concern its
own module.

---

## 2. The frame loop (`main.ts`)

Each animation frame, when racing:

```
session.beforeSim(worldT)   // interpolate remote riders into "now"
physics.update(dt)          // simulate local player + AI; collisions; laps
session.afterSim(dt, worldT)// publish my snapshot; relay hit events
render…                     // background → road → player → particles → weather → HUD
```

When not racing (menu / finished / paused) the sim is skipped; the world still
renders (the menu has a live scrolling backdrop). The **entire loop body is
wrapped in try/catch** → any exception shows the friendly error screen
(`core/errors.ts`) instead of freezing.

Timing: variable `dt` clamped to 50 ms. Local input is applied immediately
(client-side prediction), so controls feel instant regardless of network latency.

---

## 3. The four seams (where to extend)

### a) `Transport` — how bytes move (Dependency Inversion)
`net/transport.ts` defines the interface; `net/trysteroTransport.ts` implements it
over serverless WebRTC. **Sessions never import Trystero.** To add a WebSocket/TURN
relay for players behind strict NATs:
1. Write `net/relayTransport.ts implements Transport`.
2. Construct it instead of `TrysteroTransport` in `main.ts`.
Nothing else changes.

### b) `Session` — solo vs online (Strategy)
`session/session.ts` is the base (+ shared `prepareRace`). `SoloSession` fills the
grid with AI; `MultiplayerSession` wires the transport, runs the lobby, and
swaps AI slots for interpolated remote players. The loop calls the same hooks on
either — they're interchangeable (Liskov). A new mode (time-trial, co-op vs cops)
is a new `Session` subclass.

### c) `Season` — world reskin + handling (data-driven, Open/Closed)
`engine/seasons.ts` is a list of plain config objects (palette, weather, grip).
**Add a 4th season by appending one object** — render, physics, and track read it
without code changes. Rainy's `gripMult: 0.6` is the slippery-handling hook.

### d) Riders — AI and humans are interchangeable
`core/types.ts` `Rider` has a `controller: 'ai' | 'remote'`. The renderer and
collision code treat all riders identically; only `physics.update` branches
(`'remote'` riders are driven by interpolated snapshots, not AI). A human player
and a bot are the same shape end to end.

---

## 4. Multiplayer model

- **Authority:** each peer owns its own bike and simulates it locally. Remote bikes
  are *not* simulated — they're reconstructed from snapshots.
- **Snapshots:** `net/snapshot.ts`. Local bike → `RiderSnapshot` at ~20 Hz on the
  `st` channel. Remotes are rendered at `now − INTERP_DELAY` (120 ms) by
  interpolating the two bracketing samples (z interpolates along the shortest arc
  to handle the looped track).
- **Determinism:** the host broadcasts `seed + season + laps + diff`; every peer
  builds an identical track via the seeded `core/rng.ts`. (Traffic is seeded too.)
- **Combat:** discrete `hit` events on the reliable `ev` channel; the victim applies
  them. AI riders are simulated independently per peer (ambient, not synced) — a
  deliberate v1 tradeoff; humans are authoritative + synced.
- **Lobby:** `hello` handshake builds the roster; host's `start` launches everyone.

### Known limitations / upgrade paths
| Limitation | Upgrade path |
|------------|--------------|
| AI riders desync between peers | Make AI host-authoritative; broadcast them as pseudo-remotes |
| Strict/symmetric NAT can't connect (no TURN) | Add a `RelayTransport` behind the `Transport` interface |
| Late join mid-race waits for next race | Send a roster+seed snapshot to newcomers and spawn them live |
| No host migration if host leaves | Elect a new host from the peer list |

---

## 5. Trust boundaries & robustness

- **Network input is untrusted.** `net/protocol.ts#parseMessage` validates and
  range-clamps *every* inbound message (no `NaN`, no teleports, bounded strings,
  hex-only colours). The transport drops anything that fails and never lets a
  handler throw escape the WebRTC callback.
- **localStorage is untrusted.** `core/settings.ts#sanitize` clamps all indices on
  load (guards corrupted/legacy values).
- **Rendered strings are escaped** (`ui/menu.ts`), colours are hex-validated before
  hitting CSS (anti-injection).
- **Global safety net:** `core/errors.ts` + the loop try/catch + an inline
  pre-boot fallback in `index.html` mean a crash becomes a Reload prompt, never a
  raw stack trace or blank page.

---

## 6. Module reference

| Module | Responsibility |
|--------|----------------|
| `core/state` | The single mutable `world` + `input` singletons |
| `core/types` | All shared contracts (Rider, Segment, NetMessage, Season, …) |
| `core/constants` | Tuning, weapon/colour/rider tables, geometry |
| `core/settings` | Persisted settings (+ sanitize), difficulty accessor |
| `core/rng` | Seedable PRNG (multiplayer track parity) |
| `core/math` | Pure helpers (clamp/lerp/easing/format) — unit-testable |
| `core/view` | The canvas + 2D ctx (+ `roundRect` polyfill) |
| `core/errors` | Global error handlers + friendly error screen |
| `engine/track` | Seeded track build + segment/z queries |
| `engine/physics` | The whole simulation step |
| `engine/render` | Background, road, entities, player, weather, effects |
| `engine/sprites` | Bike + car vector art |
| `engine/audio` | Procedural engine/wind/siren/sfx + pause ambient pad |
| `engine/seasons` | Season config list |
| `engine/particles` | Screen-space particle pool |
| `engine/hud` | In-race HUD, touch buttons, resume countdown |
| `entities/riders` | AI + remote rider factories |
| `entities/traffic` | Seeded traffic factory |
| `net/transport` | Transport interface |
| `net/trysteroTransport` | WebRTC P2P implementation |
| `net/protocol` | Inbound message validation/clamping |
| `net/snapshot` | Snapshot capture + interpolation buffer |
| `session/*` | Race lifecycle: base + solo + multiplayer |
| `ui/input` | Keyboard + touch wiring |
| `ui/menu` | DOM overlay: all screens + keyboard navigation |

---

## 7. Quick recipes

- **New weapon:** add to `WEAPONS` in `core/constants.ts` + a `WeaponKey` in
  `core/types.ts`; draw it in `engine/sprites.ts#drawBike`.
- **New season:** append one object to `SEASONS` in `engine/seasons.ts`.
- **New track:** edit `buildTrack` in `engine/track.ts` (sequence of `addRoad`).
- **New game mode:** subclass `Session`; construct it in `main.ts`.
- **New transport:** implement `Transport`; swap the constructor in `main.ts`.
- **Tune handling/difficulty:** `core/constants.ts` (`DIFFS`, grip, speeds).

## 8. Invariants worth preserving

- The renderer must work for any `Rider` regardless of `controller`.
- `world.trackLength` is identical across peers for a given seed — never derive
  positions from anything unseeded in multiplayer.
- Nothing inbound from the network or storage is used before passing through
  `parseMessage` / `sanitize`.
- The loop never throws to the browser — keep new work inside the try/catch.
