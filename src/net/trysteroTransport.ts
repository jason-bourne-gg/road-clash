import { joinRoom, selfId } from 'trystero/nostr';
import type { Transport, MessageHandler, PeerHandler } from './transport';
import type { NetMessage } from '../core/types';
import { parseMessage } from './protocol';

// Serverless P2P transport over WebRTC, using Trystero's Nostr strategy for
// peer discovery (no signaling server to run or pay for). Two logical channels:
//   'ev' — reliable: hello / start / hit / finished
//   'st' — frequent: position snapshots
const APP_ID = 'road-clash-v2-bsr';

export class TrysteroTransport implements Transport {
  readonly id = selfId;
  private room: ReturnType<typeof joinRoom> | null = null;
  private sendEv: ((d: NetMessage) => void) | null = null;
  private sendSt: ((d: NetMessage) => void) | null = null;
  private msgCb: MessageHandler = () => {};
  private joinCb: PeerHandler = () => {};
  private leaveCb: PeerHandler = () => {};

  async connect(roomCode: string): Promise<void> {
    const room = joinRoom({ appId: APP_ID }, roomCode);
    this.room = room;
    // Trystero's action payload type is a JSON shape; our NetMessage union is
    // JSON-serializable but doesn't structurally match the index signature, so
    // we cast at this single boundary (the whole point of the Transport seam).
    const [sendEv, getEv] = room.makeAction('ev');
    const [sendSt, getSt] = room.makeAction('st');
    this.sendEv = (d) => sendEv(d as any);
    this.sendSt = (d) => sendSt(d as any);
    // Validate + clamp every inbound payload, and never let a handler throw
    // bubble out of the WebRTC callback.
    const receive = (data: unknown, peer: string) => {
      try {
        const msg = parseMessage(data);
        if (msg) this.msgCb(msg, peer);
      } catch (e) { console.warn('[net] dropped bad message', e); }
    };
    getEv((data, peer) => receive(data, peer));
    getSt((data, peer) => receive(data, peer));
    room.onPeerJoin((peer) => this.joinCb(peer));
    room.onPeerLeave((peer) => this.leaveCb(peer));
  }

  send(msg: NetMessage): void { this.sendEv?.(msg); }
  sendState(msg: NetMessage): void { this.sendSt?.(msg); }
  onMessage(cb: MessageHandler): void { this.msgCb = cb; }
  onPeerJoin(cb: PeerHandler): void { this.joinCb = cb; }
  onPeerLeave(cb: PeerHandler): void { this.leaveCb = cb; }

  peers(): string[] {
    return this.room ? Object.keys(this.room.getPeers()) : [];
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
    this.sendEv = this.sendSt = null;
  }
}
