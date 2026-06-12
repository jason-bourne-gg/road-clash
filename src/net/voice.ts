import type { Transport } from './transport';

// In-room voice chat over the same WebRTC connection Trystero already uses for
// data. Strictly opt-in: the mic is only requested when the player enables it.
export class VoiceManager {
  private transport: Transport;
  private stream: MediaStream | null = null;
  private peers = new Map<string, HTMLAudioElement>();
  enabled = false;
  muted = false;
  supported: boolean;

  constructor(transport: Transport) {
    this.transport = transport;
    this.supported = !!(transport.addStream && navigator.mediaDevices?.getUserMedia);
    transport.onPeerStream?.((stream, peer) => this.playPeer(stream, peer));
  }

  // Request the mic (user gesture + HTTPS required) and start broadcasting.
  async enable(): Promise<boolean> {
    if (this.enabled || !this.supported) return this.enabled;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.transport.addStream?.(this.stream);
      this.enabled = true; this.muted = false;
      return true;
    } catch (e) {
      console.warn('[voice] mic denied/unavailable', e);
      return false;
    }
  }

  disable(): void {
    if (this.stream) {
      this.transport.removeStream?.(this.stream);
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.enabled = false;
  }

  toggleMute(): boolean {
    if (!this.enabled || !this.stream) return false;
    this.muted = !this.muted;
    this.stream.getAudioTracks().forEach((t) => { t.enabled = !this.muted; });
    return this.muted;
  }

  private playPeer(stream: MediaStream, peer: string): void {
    let el = this.peers.get(peer);
    if (!el) { el = new Audio(); el.autoplay = true; this.peers.set(peer, el); }
    el.srcObject = stream;
    el.play().catch(() => { /* autoplay may need a gesture; harmless */ });
  }

  dropPeer(peer: string): void {
    const el = this.peers.get(peer);
    if (el) { el.srcObject = null; this.peers.delete(peer); }
  }

  cleanup(): void {
    this.disable();
    this.peers.forEach((el) => { el.srcObject = null; });
    this.peers.clear();
  }
}
