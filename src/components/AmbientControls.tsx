import { useEffect, useRef, useState } from 'react';
import { AmbientPlayer, type Ambience } from '../lib/ambient';

export default function AmbientControls({ onError }: { onError: (message: string) => void }) {
  const [kind, setKind] = useState<Ambience>('rain');
  const [volume, setVolume] = useState(.2);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const player = useRef<AmbientPlayer | undefined>(undefined);
  useEffect(() => () => { if (player.current) void player.current.stop(); }, []);
  return <details className="ambient-controls"><summary aria-label="Ambient sound settings" title="Ambient sound" className={playing ? 'sound-playing' : undefined}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z" />{playing ? <><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></> : <path d="m16 9 5 6m0-6-5 6" />}</svg>
  </summary><div className="ambient-panel">
    <label>Ambience<select value={kind} disabled={playing || busy} onChange={event => setKind(event.target.value as Ambience)}><option value="rain">Rain</option><option value="stream">Stream</option><option value="white-noise">White noise</option><option value="pentatonic">Pentatonic chimes</option></select></label>
    <label className="volume-control"><span>Volume <output>{Math.round(volume * 100)}%</output></span><input aria-label="Volume" aria-valuetext={`${Math.round(volume * 100)} percent`} type="range" min={0} max={1} step={.01} value={volume} style={{ backgroundSize: `${volume * 100}% 4px` }} onChange={event => { const value = Number(event.target.value); setVolume(value); player.current?.setVolume(value); }} /></label>
    <button disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        if (player.current) { const previous = player.current; player.current = undefined; await previous.stop(); setPlaying(false); }
        else { const next = new AmbientPlayer(); player.current = next; await next.start(kind, volume); setPlaying(true); }
      } catch (error) {
        if (player.current) { const failed = player.current; player.current = undefined; await failed.stop(); }
        setPlaying(false); onError(error instanceof Error ? error.message : 'Ambient audio could not start.');
      } finally { setBusy(false); }
    }}>{busy ? 'Please wait' : playing ? 'Mute' : 'Play'}</button>
  </div></details>;
}
