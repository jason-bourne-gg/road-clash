import { Session, prepareRace } from './session';
import { world } from '../core/state';
import { S } from '../core/settings';
import { PACK_SIZE } from '../core/constants';
import { makeRemoteRider, makeAiRider } from '../entities/riders';
import { captureSnapshot, pushSample, applyInterpolated } from '../net/snapshot';
import { crashPlayer } from '../engine/physics';
import { randomSeed } from '../core/rng';
import type { Transport } from '../net/transport';
import type { NetMessage, PlayerInfo, Rider } from '../core/types';

const SNAPSHOT_HZ = 20;

// Multiplayer: humans take rider slots, AI backfills the rest. Each peer is the
// authority on its own bike (instant local control); remote bikes arrive as
// interpolated snapshots. Combat the local player lands is relayed as a 'hit'
// event the victim applies.
export class MultiplayerSession extends Session {
  readonly kind = 'multiplayer' as const;
  isHost: boolean;
  started = false;

  private transport: Transport;
  private me: PlayerInfo;
  private playersById = new Map<string, PlayerInfo>(); // remote peers only
  private sendAcc = 0;

  // UI hooks
  onLobbyChange: () => void = () => {};
  onStarted: () => void = () => {};

  constructor(transport: Transport, me: PlayerInfo, isHost: boolean) {
    super();
    this.transport = transport;
    this.me = { ...me, id: transport.id };
    this.isHost = isHost;
  }

  async connect(roomCode: string): Promise<void> {
    this.transport.onMessage((m, peer) => this.onMessage(m, peer));
    this.transport.onPeerJoin(() => this.onLobbyChange());
    this.transport.onPeerLeave((peer) => {
      this.playersById.delete(peer);
      world.riders = world.riders.filter(r => r.id !== peer);
      this.onLobbyChange();
    });
    await this.transport.connect(roomCode);
    this.transport.send({ t: 'hello', info: this.me }); // announce myself
  }

  // Lobby roster shown in the UI (me first).
  lobbyPlayers(): PlayerInfo[] {
    return [this.me, ...this.playersById.values()];
  }

  // Host only: lock settings + seed, tell everyone to start, then start locally.
  // Gated on race state (not the one-shot `started` flag) so rematches work.
  hostStart(): void {
    if (!this.isHost || world.game.state === 'race') return;
    const msg: NetMessage = { t: 'start', seed: randomSeed(), season: S.season, laps: S.laps, diff: S.diff, at: 0 };
    this.transport.send(msg);
    this.applyStart(msg);
  }

  begin(): void { /* race begins via applyStart, driven by host's 'start' */ }

  private onMessage(m: NetMessage, peer: string): void {
    switch (m.t) {
      case 'hello':
        if (!this.playersById.has(peer)) {
          this.playersById.set(peer, { ...m.info, id: peer });
          this.transport.send({ t: 'hello', info: this.me }); // reply once
          this.onLobbyChange();
        }
        break;
      case 'start':
        if (world.game.state !== 'race') this.applyStart(m); // allow rematch from finished/menu
        break;
      case 'state': {
        const r = world.riders.find(rr => rr.id === peer);
        if (r) pushSample(r, m.s, world.worldT);
        break;
      }
      case 'hit':
        if (m.to === this.transport.id) this.takeHit(m.dmg, m.knock);
        break;
      case 'finished':
        break; // standings handled locally for v1
    }
  }

  private applyStart(m: Extract<NetMessage, { t: 'start' }>): void {
    this.started = true;
    S.season = m.season; S.laps = m.laps; S.diff = m.diff;
    prepareRace(m.seed);
    const peers = [...this.playersById.values()];
    const riders: Rider[] = peers.map((p, i) => makeRemoteRider(p.id, p.name, p.color, i));
    for (let i = peers.length; i < PACK_SIZE; i++) riders.push(makeAiRider(i)); // AI backfill
    world.riders = riders;
    this.onStarted();
  }

  beforeSim(now: number): void {
    for (const r of world.riders) if (r.controller === 'remote') applyInterpolated(r, now);
  }

  afterSim(dt: number): void {
    if (!this.started) return;
    this.sendAcc += dt;
    if (this.sendAcc >= 1 / SNAPSHOT_HZ) {
      this.sendAcc = 0;
      this.transport.sendState({ t: 'state', s: captureSnapshot(world.player) });
    }
    if (world.outbox.length) {
      for (const e of world.outbox) {
        this.transport.send({ t: 'hit', from: this.transport.id, to: e.id, dmg: e.dmg, knock: e.knock });
      }
      world.outbox.length = 0;
    }
  }

  private takeHit(dmg: number, knock: number): void {
    const p = world.player;
    if (p.crashT > 0) return;
    p.health -= dmg; p.hurtT = 0.4; world.game.flash = 1;
    p.x += knock;
    if (p.health <= 0) crashPlayer(0, 'KNOCKED OUT!');
  }

  end(): void {
    this.transport.disconnect();
    world.game.state = 'menu';
  }
}
