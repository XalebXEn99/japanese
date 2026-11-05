import { useEffect, useRef, useState } from 'react';
import { AmbientPlayer, type Ambience } from '../lib/ambient';

const sounds = [
  { value: 'rain', label: 'Rain' }, { value: 'stream', label: 'Stream' },
  { value: 'white-noise', label: 'White noise' }, { value: 'pentatonic', label: 'Pentatonic chimes' },
] as const;

export default function AmbientControls({ onError }: { onError: (message: string) => void }) {
  const [kind, setKind] = useState<Ambience>('rain');
  const [volume, setVolume] = useState(.2);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const player = useRef<AmbientPlayer | undefined>(undefined);
  const popup = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent | FocusEvent) => {
      if (popup.current?.open && event.target instanceof Node && !popup.current.contains(event.target)) popup.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && popup.current?.open) {
        event.preventDefault();
        popup.current.open = false;
        popup.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
      document.removeEventListener('keydown', escape);
      const previous = player.current;
      player.current = undefined;
      if (previous) void previous.stop().catch(error => onError(error instanceof Error ? error.message : 'Ambient audio could not stop.'));
    };
  }, [onError]);
  const audioError = async (error: unknown) => {
    const failed = player.current;
    player.current = undefined;
    setPlaying(false);
    let message = error instanceof Error ? error.message : 'Ambient audio could not play.';
    if (failed) {
      try { await failed.stop(); }
      catch (cleanupError) { message += ` ${cleanupError instanceof Error ? cleanupError.message : 'Audio cleanup also failed.'}`; }
    }
    onError(message);
  };
  return <details ref={popup} className="ambient-controls"><summary aria-label="Ambient sound settings" title="Ambient sound" className={playing ? 'sound-playing' : undefined}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></svg>
  </summary><div className="ambient-panel">
    <label>Ambience<select aria-label="Ambience" value={kind} disabled={busy} onChange={event => {
      const sound = sounds.find(option => option.value === event.target.value);
      if (!sound) { onError('Unknown ambient sound.'); return; }
      setKind(sound.value);
      try { player.current?.setAmbience(sound.value); }
      catch (error) { void audioError(error); }
    }}>{sounds.map(sound => <option key={sound.value} value={sound.value}>{sound.label}</option>)}</select></label>
    <label className="volume-control"><span>Volume <output>{Math.round(volume * 100)}%</output></span><input aria-label="Volume" aria-valuetext={`${Math.round(volume * 100)} percent`} type="range" min={0} max={1} step={.01} value={volume} style={{ backgroundSize: `${volume * 100}% 4px` }} onChange={event => { const value = Number(event.target.value); setVolume(value); player.current?.setVolume(value); }} /></label>
    <button className="ambient-playback" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        if (!player.current) { const next = new AmbientPlayer(); player.current = next; await next.start(kind, volume); setPlaying(true); }
        else if (playing) { await player.current.pause(); setPlaying(false); }
        else { await player.current.resume(); setPlaying(true); }
      } catch (error) { await audioError(error); }
      finally { setBusy(false); }
    }}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <path d="M7 5h4v14H7Zm6 0h4v14h-4Z" /> : <path d="m8 5 11 7-11 7Z" />}</svg>{busy ? 'Please wait' : playing ? 'Pause' : 'Play'}</button>
  </div></details>;
}
