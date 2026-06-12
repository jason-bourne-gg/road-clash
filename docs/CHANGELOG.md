# Changelog

All notable changes to Road Clash, newest first. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions are [SemVer](https://semver.org/).

## [2.4.0] — 2026-06-13 · Mobile polish & installable app (PWA)

### Added
- **Installable PWA** — "Add to Home Screen" on phones / "Install" on desktop. Launches **standalone** (no browser chrome), with an app icon and **offline solo play** (the app shell is precached via a service worker; updates auto-apply on new deploys).
- **Rotate-to-landscape prompt** — on a phone held portrait, a clear nudge to rotate (the game is 16:9 landscape).
- **Fullscreen on touch** — a ⛶ FULLSCREEN button on the title screen (the F key is desktop-only).

### Changed
- **Bigger touch buttons** — BRAKE / PUNCH / NITRO sized up and spaced for thumbs (touch UI only; desktop unaffected).
- Added apple/theme meta tags + `viewport-fit=cover` for notch-friendly fullscreen.

[2.4.0]: https://github.com/jason-bourne-gg/road-clash

## [2.3.0] — 2026-06-13 · Voice chat & music

### Added
- **🎙️ In-room voice chat** — talk to the people in your multiplayer room, carried over the same WebRTC connection as the game data (no extra server). Strictly **opt-in**: enable it in the lobby ("🎤 ENABLE VOICE CHAT"), mute/unmute with the lobby button or the **V** key mid-race. Echo cancellation + noise suppression on.
- **🎵 Background music** — a procedural synthwave loop (bass + arp + kick) layered under the engine/SFX during races, with its own **MUSIC** on/off setting (independent of SFX).

[2.3.0]: https://github.com/jason-bourne-gg/road-clash

## [2.2.0] — 2026-06-13 · Gameplay engine pass

### Added
- **Nitro / boost** — a meter that fills as you race (faster while drafting) and on every knockdown. Press **Shift** / **B** (or the on-screen NITRO button) to burst past top speed, with whoosh + flame trail. HUD meter under your health bar.
- **Road pickups** (seeded, respawn each lap): **⚡ Nitro** (fills boost), **❤️ Repair** (heals), **🛡️ Shield** (absorbs the next crash). Drive over to grab them; glowing, bobbing icons on the road.
- **Rider-vs-rider brawls** — AI riders now fight *each other*, not just you. Aggressors and blockers shove neighbouring rivals down for a proper pack melee.
- **AI personalities** — each rival is a **racer** (holds the line, runs faster), **aggressor** (hunts + hits hard), or **blocker** (mirrors you to block).
- **Police show up mid-race** — the cop now arrives on rising heat *or* automatically partway through a race (with a breather after you shake it), so the chase actually happens.
- **Richer audio** — nitro whoosh, pickup chime, shield ping, tyre screech on hard cornering, gear-shift blips climbing through the speed range.

### Changed
- **Knockdowns are juicier** — bigger spark burst + a punch of screen shake.
- **Redesigned bikes & riders** — proper sportbike silhouette (alloy rim, tapered tail fairing, twin exhausts) and a tucked rider in racing leathers with a team-striped helmet and dark visor.

## [2.1.0] — 2026-06-13 · Display, quality & analytics

### Added
- **Fullscreen** — press **F** to toggle true fullscreen (ignored while typing in a field).
- **Responsive canvas** — the view now scales to fill the window (and fullscreen) at 16:9 instead of sitting small with black bars.
- **Auto-resolution** — the canvas backing store renders at the device's real pixel density (crisp on Retina / 4K), capped at 2560px wide for performance. Logical game coordinates stay 1024×576, so nothing in the simulation changed.
- **Graphics quality** setting — **Auto / High / Medium / Low**. Now drives both render **resolution** *and* visual **effects** (below), so the setting visibly changes how the game looks, not just its sharpness. Low also thins particles/weather for weak devices.
- **Engine visual pass** (render-layer only — simulation & netcode untouched):
  - **Sun/light bloom** — a warm additive glow across the sky (High / Auto-on-Retina).
  - **Rainy atmosphere** — wet-road sheen + periodic **lightning flashes** (reflections tier).
  - **Stronger sense of speed** — speed lines ramp in earlier and scale up, plus a tunnel-vision **speed vignette** near top speed.
- **Vercel Web Analytics + Speed Insights** — visitors, referrers, country, devices, and real-user performance (privacy-friendly, no IP tracking).
- `Esc` (pause) and `F` (fullscreen) added to the in-game How-to-Play controls list.

## [2.0.0] — 2026-06-13 · Initial public release (TypeScript rewrite)

### Added
- Pseudo-3D, Road Rash-style combat racer on HTML5 Canvas; **Solo vs AI**.
- **Online multiplayer** — serverless P2P over WebRTC (Trystero), shareable room codes/links, AI backfill for empty slots, client-side prediction + remote interpolation.
- **3 seasons** — Summer / Winter / Rainy, each re-skinning the world; season-based grip (rainy is slippery) and weather (rain / snow).
- Combat (punch, weapon snatching), cops & heat, two-way traffic, drafting, laps & standings.
- **Pause** (Esc, solo) with CONTINUE / ABANDON menu, **3·2·1 resume**, and ambient pause music; auto-pause on tab switch.
- **Full keyboard navigation** of all menus; touch controls; **procedural audio** (no asset files).
- Settings persisted to localStorage; How-to-Play screen.

### Hardened
- Friendly **error screen** + global handlers + a guarded game loop + pre-boot fallback — users never see a raw crash.
- **All untrusted input validated**: every peer network message is parsed & range-clamped; localStorage settings sanitized; rendered text escaped; colours hex-validated.
- **Cross-browser**: `roundRect` polyfill (older Safari), `-webkit-` fallbacks; works on Chrome / Firefox / Safari / Edge + mobile.

### Infrastructure
- Migrated single-file game → modular **TypeScript + Vite** (SOLID seams: Transport / Session / Season / Rider).
- Deployed to **Vercel** with auto-deploy on every push. ~32 KB gzipped.

[2.2.0]: https://github.com/jason-bourne-gg/road-clash
[2.1.0]: https://github.com/jason-bourne-gg/road-clash
[2.0.0]: https://github.com/jason-bourne-gg/road-clash
