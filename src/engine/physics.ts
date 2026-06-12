import {
  SEG_LEN, PLAYER_Z, MAX_SPEED, ACCEL, BRAKE, DECEL, OFF_DECEL, OFF_LIMIT,
  PUNCH_RANGE_Z, PUNCH_RANGE_X, GRIP_ROAD, GRIP_OFF, CENT_K, SLOPE_PULL, DRAFT_Z, DRAFT_X,
  BIKE_LEN, BIKE_W, CAR_LEN, CAR_W, VAN_W, REL_CRASH_BIKE, REL_CRASH_CAR, WEAPONS, W, H,
  BOOST_FILL, BOOST_DRAFT_FILL, BOOST_KNOCK_FILL, BOOST_COST, BOOST_DUR, BOOST_SPEED, BOOST_ACCEL,
  SHIELD_DUR, PICKUP_W, PICKUP_LEN,
} from '../core/constants';
import { clamp, lerp, overlap } from '../core/math';
import { world, setMsg, input } from '../core/state';
import { S, DIFF } from '../core/settings';
import { findSegment, relZ, zdist, wrapZ } from './track';
import { emit, updateParts } from './particles';
import { sfx, punchSfx, crashSfx, knockSfx, setAudioLevels, boostSfx, pickupSfx, shieldSfx, screechSfx, gearSfx } from './audio';
import { activeSeason } from './seasons';
import { bg } from './render';
import type { Rider, Combatant } from '../core/types';

// Throttled state for feel cues (screech / gear blips) + cop respawn rest.
let screechCd = 0, lastGear = 0, copRest = 0;

const throttleOn = (): boolean => S.throttle === 'on' || (S.throttle === 'auto' && input.touchActive);

export function currentPlace(): number {
  return 1 + world.riders.filter(c => c.total > world.player.total).length;
}

export function crashPlayer(dmg: number, msg: string): void {
  const p = world.player;
  // A shield absorbs one crash (and the damage) instead of going down.
  if (p.shieldT > 0) {
    p.shieldT = 0; p.speed *= 0.85; p.wobbleT = Math.min(1, p.wobbleT + 0.5);
    shieldSfx(); world.game.flash = 0.5;
    setMsg('SHIELD ABSORBED!', 1.2);
    return;
  }
  p.health = Math.max(0, p.health - dmg);
  p.crashT = 2.2; p.speed *= 0.1; p.weapon = 'fist';
  crashSfx(); world.game.shake = 1;
  setMsg(msg, 1.8);
}

export function spawnCop(): void {
  world.cop = {
    name: 'POLICE', z: wrapZ(world.player.position - 5000), offset: 0,
    speed: world.player.speed * 0.9, maxSpeed: MAX_SPEED * DIFF().copSpeed,
    health: 120, knocked: 0, punchT: 0, wobble: 0, weapon: 'club',
  };
  setMsg('COPS ON YOUR TAIL!', 2);
}

export function update(dt: number): void {
  const { player, game } = world;
  const riders = world.riders, traffic = world.traffic;
  const { KEYS, TOUCH } = input;

  game.time += dt;
  if (game.msgT > 0) game.msgT -= dt;
  if (game.flash > 0) game.flash -= dt * 3;
  if (game.shake > 0) game.shake -= dt * 2;
  if (game.countdown > 0) {
    const prev = Math.ceil(game.countdown - 0.7);
    game.countdown -= dt;
    if (game.countdown <= 0.7 && prev >= 1) setMsg('GO!', 1);
  }
  const racing = game.countdown <= 0.7;

  const playerSeg = findSegment(player.position + PLAYER_Z);
  const spct = player.speed / MAX_SPEED;
  bg.pan -= playerSeg.curve * spct * dt * 40;

  const inLeft = KEYS.ArrowLeft || TOUCH.steer < 0;
  const inRight = KEYS.ArrowRight || TOUCH.steer > 0;
  const inBrake = KEYS.ArrowDown || TOUCH.brake;
  const inAccel = (KEYS.ArrowUp || throttleOn()) && !inBrake;
  const inPunch = KEYS.KeyA || KEYS.Space || TOUCH.punch;
  const inBoost = KEYS.ShiftLeft || KEYS.ShiftRight || KEYS.KeyB || TOUCH.boost;

  /* --- player physics --- */
  if (player.crashT > 0) {
    player.crashT -= dt;
    player.speed = Math.max(0, player.speed + BRAKE * 0.7 * dt);
    if (player.crashT > 1) emit(W / 2 + (Math.random() - 0.5) * 80, H - 40, 2, { color: '#b58a5a', vy0: -90, life: 0.7, size: 7, vx: 220 });
    if (player.crashT <= 0) {
      player.x = clamp(player.x, -0.9, 0.9);
      player.health = Math.max(player.health, 55);
      player.bustedT = 0;
    }
  } else if (!player.finished && racing) {
    const target = inLeft ? -1 : inRight ? 1 : 0;
    player.steerV = lerp(player.steerV, target, 1 - Math.exp(-10 * dt));
    // --- nitro: fill (faster while drafting), activate, decay ---
    player.boostT = Math.max(0, player.boostT - dt);
    player.shieldT = Math.max(0, player.shieldT - dt);
    player.boost = clamp(player.boost + (player.draft ? BOOST_DRAFT_FILL : BOOST_FILL) * dt, 0, 1);
    if (inBoost && player.boostT <= 0 && player.boost >= BOOST_COST) {
      player.boostT = BOOST_DUR; player.boost -= BOOST_COST; boostSfx(); setMsg('NITRO!', 0.7);
    }
    const offroad = Math.abs(player.x) > 1;
    // Season grip: rainy roads are slippery (vx converges to intent slower).
    const grip = (offroad ? GRIP_OFF : GRIP_ROAD) * activeSeason().gripMult;
    const wantVx = player.steerV * 1.45 * spct;
    player.vx += (wantVx - player.vx) * (1 - Math.exp(-grip * dt));
    player.vx -= playerSeg.curve * spct * spct * CENT_K * dt;
    if (player.wobbleT > 0) {
      player.vx += Math.sin(world.worldT * 24) * player.wobbleT * 1.6 * dt;
      player.wobbleT = Math.max(0, player.wobbleT - dt * 0.8);
    }
    player.x += player.vx * dt;
    const slope = (playerSeg.p2.world.y - playerSeg.p1.world.y) / SEG_LEN;
    if (inAccel) player.speed += ACCEL * (1 - 0.55 * spct) * dt;
    else if (inBrake) player.speed += BRAKE * dt;
    else player.speed += DECEL * dt;
    player.speed -= slope * SLOPE_PULL * dt;
    player.draft = false;
    if (spct > 0.55) {
      const aheadOf = (b: { z: number }) => { const dz = relZ(b.z); return dz > 100 && dz < DRAFT_Z; };
      for (const c of riders) if (c.knocked <= 0 && aheadOf(c) && Math.abs(c.offset - player.x) < DRAFT_X) { player.draft = true; break; }
      if (!player.draft) for (const t of traffic) if (!t.oncoming && aheadOf(t) && Math.abs(t.offset - player.x) < DRAFT_X) { player.draft = true; break; }
    }
    if (player.draft && inAccel) player.speed += ACCEL * 0.55 * dt;
    if (player.boostT > 0) {
      player.speed += ACCEL * BOOST_ACCEL * dt;
      emit(W / 2 + (Math.random() - 0.5) * 34, H - 30, 2, { color: '#5ad6ff', vy0: -70, life: 0.4, size: 6, vx: 160 });
    }
    if (offroad) {
      if (player.speed > OFF_LIMIT) player.speed += OFF_DECEL * dt;
      player.vx += (Math.random() - 0.5) * 0.6 * dt;
      if (player.speed > MAX_SPEED * 0.05)
        emit(W / 2 + Math.sign(player.x) * 40, H - 28, 1, { color: '#b58a5a', vy0: -70, life: 0.6, size: 6, vx: 180 });
    }
    const cap = player.boostT > 0 ? BOOST_SPEED : player.draft ? 1.05 : 1;
    player.speed = clamp(player.speed, 0, MAX_SPEED * cap + (slope < 0 ? MAX_SPEED * 0.04 : 0));
    player.x = clamp(player.x, -2.4, 2.4);
  } else {
    player.steerV = lerp(player.steerV, 0, 1 - Math.exp(-6 * dt));
    if (!racing) player.speed = 0;
    else player.speed = Math.max(0, player.speed + DECEL * dt);
  }

  /* --- feel cues: tyre screech on hard cornering, gear blips climbing speed --- */
  screechCd = Math.max(0, screechCd - dt);
  if (racing && player.crashT <= 0 && Math.abs(player.steerV) > 0.72 && spct > 0.5 && Math.abs(player.x) <= 1 && screechCd <= 0) {
    screechSfx(); screechCd = 0.45;
  }
  const gear = Math.floor(spct * 5);
  if (gear > lastGear && racing && player.crashT <= 0) gearSfx();
  lastGear = gear;

  /* --- player attacking --- */
  player.punchCool = Math.max(0, player.punchCool - dt);
  player.punchT = Math.max(0, player.punchT - dt);
  player.hurtT = Math.max(0, player.hurtT - dt);
  if (inPunch && player.punchCool <= 0 && player.crashT <= 0 && !player.finished && racing) {
    player.punchCool = 0.55; player.punchT = 0.28;
    const wpn = WEAPONS[player.weapon];
    const reachZ = PUNCH_RANGE_Z * wpn.range, reachX = PUNCH_RANGE_X * wpn.range;
    let target: Combatant | null = null, best = 1e9;
    const candidates: Combatant[] = world.cop && world.cop.knocked <= 0 ? [...riders, world.cop] : riders;
    for (const c of candidates) {
      const dz = relZ(c.z);
      if (dz > -350 && dz < reachZ && Math.abs(c.offset - player.x) < reachX && c.knocked <= 0) {
        if (Math.abs(dz) < best) { best = Math.abs(dz); target = c; }
      }
    }
    player.punchDir = target ? (Math.sign(target.offset - player.x) || 1) : 1;
    if (target) {
      punchSfx();
      emit(W / 2 + player.punchDir * 110, H - 130, 10, { color: '#ffe08a', vy0: -120, life: 0.4, size: 4, vx: 400 });
      target.health -= wpn.dmg; target.wobble = 0.6;
      target.offset += player.punchDir * wpn.knock;
      target.speed *= 0.92;
      if (target.controller === 'remote') world.outbox.push({ t: 'hit', id: (target as Rider).id, dmg: wpn.dmg, knock: player.punchDir * wpn.knock });
      if (target !== world.cop && target.weapon !== 'fist' && Math.random() < 0.45) {
        player.weapon = target.weapon; target.weapon = 'fist';
        setMsg('SNATCHED THE ' + WEAPONS[player.weapon].name + '!', 1.6);
      }
      if (target.health <= 0) {
        target.knocked = 3; knockSfx();
        player.boost = Math.min(1, player.boost + BOOST_KNOCK_FILL); // aggression feeds nitro
        world.game.shake = Math.max(world.game.shake, 0.5);          // satisfying thud
        emit(W / 2 + player.punchDir * 120, H - 150, 16, { color: '#ffd23b', vy0: -150, life: 0.5, size: 5, vx: 460 });
        if (target === world.cop) { world.heat++; setMsg('COP DOWN! HEAT RISING!', 1.8); }
        else { world.heat++; setMsg(target.name + ' IS DOWN!', 1.6); }
      }
    }
  }

  /* --- roadside obstacle crash --- */
  if (player.crashT <= 0 && Math.abs(player.x) > 1 && player.speed > MAX_SPEED * 0.12) {
    for (const s of playerSeg.sprites) {
      if (overlap(player.x, 0.6, s.offset, 0.7)) { crashPlayer(20, 'WIPEOUT!'); break; }
    }
  }

  /* --- rival AI (skipped for network-controlled riders) --- */
  for (const c of riders) {
    if (c.controller === 'remote') { c.z = wrapZ(c.z); c.wobble = Math.max(0, c.wobble - dt); c.punchT = Math.max(0, c.punchT - dt); continue; }
    if (c.knocked > 0) {
      c.knocked -= dt;
      c.speed = Math.max(0, c.speed - MAX_SPEED * 1.5 * dt);
      c.offset = lerp(c.offset, Math.sign(c.offset || 1) * 1.6, dt * 2);
      if (c.knocked <= 0) { c.health = 100; c.speed = c.maxSpeed * 0.4; c.offset = clamp(c.offset, -0.8, 0.8); }
    } else {
      const dz = relZ(c.z);
      const rubber = dz < 0 ? 1.06 : 0.97;
      const targetSpeed = racing ? Math.min(c.maxSpeed * rubber, MAX_SPEED) : 0;
      c.speed += clamp(targetSpeed - c.speed, BRAKE * dt, ACCEL * 0.9 * dt);
      c.punchT = Math.max(0, c.punchT - dt);
      c.wobble = Math.max(0, c.wobble - dt);
      let dodging = false;
      for (const t of traffic) {
        const d = zdist(t.z, c.z);
        const horizon = t.oncoming ? 1400 : 800;
        if (d > 0 && d < horizon && Math.abs(t.offset - c.offset) < 0.35) {
          c.offset += (c.offset > t.offset ? 1 : -1) * 0.9 * dt;
          dodging = true; break;
        }
      }
      const aggrMul = c.style === 'aggressive' ? 1.9 : c.style === 'blocker' ? 1.0 : 0.3;
      /* rider-vs-rider brawl: aggressors/blockers shove a neighbouring rival down */
      if ((c.style === 'aggressive' || c.style === 'blocker') && racing) {
        for (const o of riders) {
          if (o === c || o.knocked > 0) continue;
          const odz = zdist(o.z, c.z);
          if (odz > 0 && odz < PUNCH_RANGE_Z * 0.8 && Math.abs(o.offset - c.offset) < PUNCH_RANGE_X &&
              Math.random() < DIFF().aggr * aggrMul * 0.45 * dt) {
            c.punchT = 0.3;
            o.health -= 26; o.wobble = 0.6; o.offset += (Math.sign(o.offset - c.offset) || 1) * 0.3; o.speed *= 0.9;
            const near = Math.abs(relZ(o.z)) < 4000;
            if (near) punchSfx();
            if (o.health <= 0) { o.knocked = 3; o.health = 100; if (near) { knockSfx(); setMsg(c.name + ' downs ' + o.name + '!', 1.2); } }
            break;
          }
        }
      }
      if (!dodging && racing && Math.abs(dz) < 1400 && player.crashT <= 0 && !player.finished) {
        // racers hold their line; aggressors & blockers home in on you
        const chase = c.style === 'racer' ? 0.12 : c.style === 'blocker' ? 0.62 : 0.5;
        c.offset += clamp(player.x - c.offset, -chase * dt, chase * dt);
        if (Math.abs(dz) < PUNCH_RANGE_Z && Math.abs(c.offset - player.x) < PUNCH_RANGE_X &&
            Math.random() < DIFF().aggr * aggrMul * dt) {
          c.punchT = 0.3; punchSfx();
          const dmg = c.weapon === 'club' ? 16 : c.weapon === 'chain' ? 14 : 12;
          player.health -= dmg; player.hurtT = 0.4; game.flash = 1;
          player.x += (Math.sign(player.x - c.offset) || 1) * 0.22;
          if (player.health <= 0) crashPlayer(0, 'KNOCKED OUT!');
          else setMsg(c.name + ' hits you!', 1);
        }
      } else if (!dodging) {
        c.offset += clamp(c.home - c.offset, -0.35 * dt, 0.35 * dt);
      }
      c.offset = clamp(c.offset, -1.0, 1.0);
    }
    c.z = wrapZ(c.z + c.speed * dt);
    c.total += c.speed * dt;
  }

  /* --- traffic movement --- */
  for (const t of traffic) t.z = wrapZ(t.z + t.speed * dt);

  /* --- physical contact: player vs world --- */
  if (player.crashT <= 0 && racing && !player.finished) {
    const bodies: Array<{ e: any; z: number; x: number; hl: number; hw: number; speed: number; mass: number; kind: string }> = [];
    for (const c of riders) if (c.knocked <= 0)
      bodies.push({ e: c, z: c.z, x: c.offset, hl: BIKE_LEN / 2, hw: BIKE_W / 2, speed: c.speed, mass: 1, kind: 'bike' });
    if (world.cop && world.cop.knocked <= 0)
      bodies.push({ e: world.cop, z: world.cop.z, x: world.cop.offset, hl: BIKE_LEN / 2, hw: BIKE_W / 2, speed: world.cop.speed, mass: 1.1, kind: 'bike' });
    for (const t of traffic)
      bodies.push({ e: t, z: t.z, x: t.offset, hl: CAR_LEN / 2, hw: (t.van ? VAN_W : CAR_W) / 2, speed: t.speed, mass: 6, kind: t.oncoming ? 'oncoming' : 'car' });
    const meHl = BIKE_LEN / 2, meHw = BIKE_W / 2;
    for (const b of bodies) {
      const dz = relZ(b.z), dx = b.x - player.x;
      const ovZ = meHl + b.hl - Math.abs(dz);
      const ovX = meHw + b.hw - Math.abs(dx);
      if (ovZ <= 0 || ovX <= 0) continue;
      const side = (ovX / (meHw + b.hw)) < (ovZ / (meHl + b.hl));
      if (side) {
        const dir = Math.sign(dx) || 1;
        player.x -= dir * ovX * (b.mass / (1 + b.mass));
        player.vx = -dir * (Math.abs(player.vx) * 0.4 + 0.25);
        player.wobbleT = Math.min(1, player.wobbleT + 0.6);
        sfx(140, 0.15, 'sawtooth', 0.22);
        emit(W / 2 + dir * 70, H - 90, 6, { color: '#ffe08a', vy0: -80, life: 0.35, size: 3, vx: 300 });
        if (b.kind === 'bike') { b.e.offset += dir * ovX * (1 / (1 + b.mass)); b.e.wobble = 0.5; }
        if (b.kind === 'oncoming') {
          player.health = Math.max(0, player.health - 14);
          player.speed *= 0.88; game.flash = 0.6;
          if (player.health <= 0) { crashPlayer(0, 'SHREDDED!'); break; }
          setMsg('SCRAPE!', 0.8);
        } else player.speed *= 0.97;
      } else if (b.kind === 'oncoming') {
        crashPlayer(clamp(35 + (player.speed - b.speed) / MAX_SPEED * 15, 25, 55), 'HEAD-ON!');
        break;
      } else if (dz > 0) {
        const rel = player.speed - b.speed;
        const limit = b.kind === 'bike' ? REL_CRASH_BIKE : REL_CRASH_CAR;
        if (rel > limit) {
          crashPlayer(clamp(rel / MAX_SPEED * 55, 15, 45), b.kind === 'car' ? 'REAR-ENDED TRAFFIC!' : 'TANGLED WHEELS!');
          break;
        }
        if (rel > 0) {
          player.speed -= rel * (b.mass / (1 + b.mass)) * 1.3;
          player.wobbleT = Math.min(1, player.wobbleT + 0.4);
          if (b.kind === 'bike') { b.e.speed += rel * (1 / (1 + b.mass)); b.e.wobble = 0.5; }
          sfx(110, 0.12, 'square', 0.25);
        }
      } else {
        const rel = b.speed - player.speed;
        if (rel > 0) {
          player.speed += rel * 0.45;
          player.wobbleT = Math.min(1, player.wobbleT + 0.5);
          if (b.kind === 'bike') { b.e.speed -= rel * 0.5; b.e.wobble = 0.5; }
          else if (rel > REL_CRASH_CAR) { crashPlayer(25, 'RUN DOWN!'); break; }
        }
      }
    }
  }

  /* --- pack physicality: rivals shouldn't overlap; traffic hurts them too --- */
  for (let i = 0; i < riders.length; i++) {
    const a = riders[i];
    if (a.knocked > 0 || a.controller === 'remote') continue;
    for (let j = i + 1; j < riders.length; j++) {
      const b = riders[j];
      if (b.knocked > 0) continue;
      const ddz = zdist(a.z, b.z), ddx = a.offset - b.offset;
      if (Math.abs(ddz) < BIKE_LEN && Math.abs(ddx) < BIKE_W) {
        const push = (BIKE_W - Math.abs(ddx)) / 2 * (Math.sign(ddx) || 1);
        a.offset = clamp(a.offset + push, -1.1, 1.1);
        if (b.controller !== 'remote') b.offset = clamp(b.offset - push, -1.1, 1.1);
      }
    }
    for (const t of traffic) {
      const ddz = zdist(t.z, a.z);
      if (Math.abs(ddz) < (CAR_LEN + BIKE_LEN) / 2 &&
          Math.abs(t.offset - a.offset) < ((t.van ? VAN_W : CAR_W) + BIKE_W) / 2) {
        const rel = a.speed - t.speed;
        if (rel > REL_CRASH_CAR) {
          a.knocked = 2; a.health = 100; knockSfx();
          if (Math.abs(relZ(a.z)) < 3500) setMsg(a.name + ' ate a bumper!', 1.2);
        } else {
          a.speed = Math.max(0, t.speed);
          a.offset += (a.offset > t.offset ? 1 : -1) * 0.06;
        }
        break;
      }
    }
  }

  /* --- cop --- */
  copRest = Math.max(0, copRest - dt);
  const hadCop = !!world.cop;
  // Heat brings the law early; otherwise a patrol shows up mid-race anyway for fun.
  if (!world.cop && S.police && racing && copRest <= 0 &&
      (world.heat >= 2 || (player.lap >= 2 && world.heat >= 1) || game.time > 22)) spawnCop();
  if (world.cop) {
    const cop = world.cop;
    if (cop.knocked > 0) {
      cop.knocked -= dt;
      cop.speed = Math.max(0, cop.speed - MAX_SPEED * 1.5 * dt);
      cop.offset = lerp(cop.offset, Math.sign(cop.offset || 1) * 1.6, dt * 2);
      if (cop.knocked <= 0) world.cop = null;
    } else {
      const dz = relZ(cop.z);
      const want = dz < -3000 ? cop.maxSpeed * 1.15 : dz > 600 ? cop.maxSpeed * 0.8 : cop.maxSpeed;
      cop.speed += clamp(want - cop.speed, BRAKE * dt, ACCEL * dt);
      cop.punchT = Math.max(0, cop.punchT - dt);
      cop.wobble = Math.max(0, cop.wobble - dt);
      cop.offset += clamp(player.x - cop.offset, -0.6 * dt, 0.6 * dt);
      cop.offset = clamp(cop.offset, -1.0, 1.0);
      if (Math.abs(dz) < PUNCH_RANGE_Z && Math.abs(cop.offset - player.x) < PUNCH_RANGE_X &&
          player.crashT <= 0 && Math.random() < 1.1 * dt) {
        cop.punchT = 0.3; punchSfx();
        player.health -= DIFF().copDmg; player.hurtT = 0.4; game.flash = 1;
        player.x += (Math.sign(player.x - cop.offset) || 1) * 0.25;
        if (player.health <= 0) crashPlayer(0, 'KNOCKED OUT!');
        else setMsg('The law cracks down!', 1);
      }
      if (player.crashT > 0 && player.bustedT <= 0 && Math.abs(dz) < 1500) {
        player.bustedT = 3.5;
        player.crashT = Math.max(player.crashT, 3.5);
        player.speed = 0;
        world.heat = 0;
        setMsg('BUSTED!', 3);
        sfx(840, 0.25, 'triangle', 0.25); sfx(620, 0.25, 'triangle', 0.25);
      }
      cop.z = wrapZ(cop.z + cop.speed * dt);
    }
  }
  if (player.bustedT > 0) {
    player.bustedT -= dt;
    if (player.bustedT <= 0 && world.cop) world.cop = null;
  }
  if (hadCop && !world.cop) copRest = 14; // breather before the next patrol

  /* --- pickups: drive over to collect (local player only) --- */
  if (player.crashT <= 0 && racing) {
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      if (Math.abs(relZ(pk.z)) < PICKUP_LEN / 2 && Math.abs(pk.offset - player.x) < PICKUP_W) {
        pk.taken = true; pickupSfx();
        emit(W / 2, H - 120, 12, { color: '#9fffd0', vy0: -130, life: 0.5, size: 5, vx: 360 });
        if (pk.kind === 'boost') { player.boost = 1; setMsg('NITRO FULL!', 1.1); }
        else if (pk.kind === 'repair') { player.health = Math.min(100, player.health + 45); setMsg('REPAIRED!', 1.1); }
        else { player.shieldT = SHIELD_DUR; shieldSfx(); setMsg('SHIELD UP!', 1.1); }
      }
    }
  }

  /* --- track position & laps --- */
  const old = player.position;
  player.position = wrapZ(player.position + player.speed * dt);
  player.total += player.speed * dt;
  if (racing && !player.finished) player.lapTime += dt;
  if (player.position < old && player.speed > 0) {
    if (player.bestLap === null || player.lapTime < player.bestLap) player.bestLap = player.lapTime;
    player.lapTime = 0; player.lap++;
    for (const pk of world.pickups) pk.taken = false; // respawn pickups each lap
    if (player.lap > S.laps) {
      player.finished = true;
      player.finalPlace = currentPlace();
      world.game.state = 'finished';
      sfx(880, 0.4, 'square', 0.2);
    } else if (player.lap === S.laps) setMsg('FINAL LAP!', 2);
    else setMsg('LAP ' + player.lap, 1.5);
  }
  player.place = currentPlace();

  updateParts(dt);
  setAudioLevels(spct);
}
