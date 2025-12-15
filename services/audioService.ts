export class AudioService {
  private ctx: AudioContext | null = null;
  private reverbNode: ConvolverNode | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // AudioContext must be initialized after user interaction
  }

  public async initialize() {
    if (this.ctx) return;
    
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4;
    this.masterGain.connect(this.ctx.destination);

    // Create a simple reverb
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = await this.createImpulseResponse(2.0, 2.0, false);
    this.reverbNode.connect(this.masterGain);
  }

  public resume() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Plays a plucked string sound.
   * @param normalizedX 0 to 1, maps to pitch
   */
  public playPluck(normalizedX: number) {
    if (!this.ctx || !this.masterGain || !this.reverbNode) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Map X position to a pentatonic-ish scale or just a nice frequency range
    // A pentatonic scale in C Major: C, D, E, G, A
    // Frequencies approx: 261, 293, 329, 392, 440
    // Let's go for a cosmic floaty scale (Lydian or Pentatonic)
    const baseFreq = 200;
    const freqRange = 600;
    const freq = baseFreq + (normalizedX * freqRange);
    
    // Snap to somewhat harmonious intervals for musicality (optional, but sounds better)
    // Simple quantization
    const quantizedFreq = Math.round(freq / 50) * 50; 

    osc.type = 'triangle'; // Triangle waves sound good for strings
    osc.frequency.setValueAtTime(quantizedFreq, this.ctx.currentTime);

    // Envelope
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 0.01); // Quick attack
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5); // Long decay

    // Connect
    osc.connect(gain);
    gain.connect(this.masterGain); // Direct
    gain.connect(this.reverbNode); // Wet

    osc.start();
    osc.stop(this.ctx.currentTime + 2.0);
  }

  private async createImpulseResponse(duration: number, decay: number, reverse: boolean): Promise<AudioBuffer> {
    if (!this.ctx) throw new Error("No Audio Context");
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = reverse ? length - i : i;
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
    return impulse;
  }
}

export const audioService = new AudioService();
