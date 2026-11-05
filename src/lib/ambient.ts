export type Ambience = 'rain' | 'stream' | 'white-noise' | 'pentatonic';
export class AmbientPlayer {
  private context: AudioContext;
  private master: GainNode;
  private nodes: AudioScheduledSourceNode[] = [];
  private timer?: ReturnType<typeof setInterval>;
  constructor() {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
  }
  async start(kind: Ambience, volume: number) {
    await this.context.resume();
    this.setVolume(volume);
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
        oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.nodes = this.nodes.filter(node => node !== oscillator); };
        this.nodes.push(oscillator);
      };
      play(); this.timer = setInterval(play, 2300);
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
    this.nodes.push(source);
  }
  setVolume(volume: number) { this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.context.currentTime, .15); }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.master.gain.setTargetAtTime(0, this.context.currentTime, .05);
    await new Promise(resolve => setTimeout(resolve, 200));
    for (const node of this.nodes) { node.stop(); node.disconnect(); }
    this.nodes = [];
    await this.context.close();
  }
}
