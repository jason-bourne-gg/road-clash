import type { NetMessage } from '../core/types';

export type MessageHandler = (msg: NetMessage, peerId: string) => void;
export type PeerHandler = (peerId: string) => void;

// The single seam between the game and "how bytes move between players".
// Sessions depend ONLY on this interface. Swapping Trystero (P2P) for a
// WebSocket relay later means writing one new implementation — no game changes.
export interface Transport {
  readonly id: string;                 // this peer's stable id
  connect(roomCode: string): Promise<void>;
  send(msg: NetMessage): void;         // reliable channel: lobby, hits, finish
  sendState(msg: NetMessage): void;    // high-frequency channel: position snapshots
  onMessage(cb: MessageHandler): void;
  onPeerJoin(cb: PeerHandler): void;
  onPeerLeave(cb: PeerHandler): void;
  peers(): string[];
  disconnect(): void;
  // Optional media streaming (voice chat). A relay transport may omit these.
  addStream?(stream: MediaStream): void;
  removeStream?(stream: MediaStream): void;
  onPeerStream?(cb: (stream: MediaStream, peerId: string) => void): void;
}
