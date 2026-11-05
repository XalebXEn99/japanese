export type Ambience = 'rain' | 'stream' | 'white-noise' | 'pentatonic';
export class AmbientPlayer {
  private context: AudioContext;
  private master: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  private effects: AudioNode[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private chime?: () => void;
  private stopping?: Promise<void>;
  constructor() {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
  }
  async start(kind: Ambience, volume: number) {
    await this.context.resume();
    this.setVolume(volume);
    this.setAmbience(kind);
  }
  setAmbience(kind: Ambience) {
    this.clearSources();
    if (kind === 'pentatonic') {
      const notes = [146.83, 164.81, 220, 246.94, 293.66, 329.63, 440];
      let step = 0;
      const play = () => {
        const oscillator = this.context.createOscillator();
        const envelope = this.context.createGain();
        const now = this.context.currentTime;
        oscillator.type = 'sine';
        oscillator.frequency.value = notes[(step++ * 3) % notes.length];
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(.12, now + .04);
        envelope.gain.exponentialRampToValueAtTime(.001, now + 3);
        oscillator.connect(envelope); envelope.connect(this.master);
        oscillator.start(now); oscillator.stop(now + 3.2);
        oscillator.onended = () => {
          oscillator.disconnect(); envelope.disconnect();
          this.sources = this.sources.filter(node => node !== oscillator);
          this.effects = this.effects.filter(node => node !== envelope);
        };
        this.sources.push(oscillator);
        this.effects.push(envelope);
      };
      this.chime = play;
      play();
      if (this.context.state === 'running') this.timer = setInterval(play, 2300);
      return;
    }
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 4, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      previous = (previous + .02 * white) / 1.02;
      data[i] = kind === 'white-noise' ? white * .3 : kind === 'rain' ? white * .2 + previous * 1.5 : previous * 3.2;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer; source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = kind === 'rain' ? 3500 : kind === 'stream' ? 900 : 12000;
    source.connect(filter); filter.connect(this.master); source.start();
    this.sources.push(source);
    this.effects.push(filter);
  }
  setVolume(volume: number) { this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.context.currentTime, .15); }
  async pause() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.context.suspend();
  }
  async resume() {
    await this.context.resume();
    if (this.chime && !this.timer) this.timer = setInterval(this.chime, 2300);
  }
  private clearSources() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.chime = undefined;
    for (const source of this.sources) { source.onended = null; source.stop(); source.disconnect(); }
    for (const effect of this.effects) effect.disconnect();
    this.sources = [];
    this.effects = [];
  }
  stop(): Promise<void> {
    this.stopping ??= (async () => {
      if (this.context.state === 'closed') return;
      if (this.timer) clearInterval(this.timer);
      this.master.gain.setTargetAtTime(0, this.context.currentTime, .05);
      await new Promise(resolve => setTimeout(resolve, 200));
      this.clearSources();
      this.master.disconnect();
      await this.context.close();
    })();
    return this.stopping;
  }
}
