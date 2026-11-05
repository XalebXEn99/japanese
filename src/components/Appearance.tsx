import { useEffect, useId, useRef, useState } from 'react';
import { japanSeason, localDaylight, sceneNames, sceneryUrl, type ThemeMode } from '../lib/season';

function storedTheme(): ThemeMode {
  const value = localStorage.getItem('ka-theme');
  return value === 'light' || value === 'dark' ? value : 'seasonal';
}
export function useAppearance(onError: (message: string) => void) {
  const [mode, setMode] = useState<ThemeMode>(storedTheme);
  const [clock, setClock] = useState(() => new Date());
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(() => localStorage.getItem('ka-slideshow-paused') === 'true');
  const season = japanSeason(clock);
  const daylight = localDaylight(clock);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    const visible = () => { if (!document.hidden) setClock(new Date()); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
  useEffect(() => {
    if (paused || mode !== 'seasonal' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => { if (!document.hidden) setScene(value => (value + 1) % 2); }, 60000);
    return () => clearInterval(timer);
  }, [paused, mode]);
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.season = season;
    document.documentElement.dataset.light = daylight;
    document.documentElement.style.colorScheme = mode === 'dark' || (mode === 'seasonal' && daylight !== 'day') ? 'dark' : 'light';
    try { localStorage.setItem('ka-theme', mode); localStorage.setItem('ka-slideshow-paused', String(paused)); }
    catch { onError('Appearance preferences could not be saved in this browser.'); }
  }, [mode, season, daylight, paused, onError]);
  return { mode, setMode, season, daylight, scene, paused, setPaused, nextScene: () => setScene(value => (value + 1) % 2) };
}
export function ThemeSlider({ mode, onChange }: { mode: ThemeMode; onChange: (mode: ThemeMode) => void }) {
  const name = useId();
  const modes: ThemeMode[] = ['light', 'seasonal', 'dark'];
  return <fieldset className="theme-control">
    <legend className="sr-only">Appearance</legend>
    <span className="theme-thumb" aria-hidden="true" style={{ transform: `translateX(${modes.indexOf(mode) * 100}%)` }} />
    {modes.map(value => <label key={value} className="theme-option" title={value[0].toUpperCase() + value.slice(1)}>
      <input type="radio" name={name} value={value} checked={mode === value} onChange={() => onChange(value)} />
      <span className="sr-only">{value[0].toUpperCase() + value.slice(1)}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {value === 'light' ? <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></g>
          : value === 'dark' ? <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" d="M20.5 14.5A9 9 0 0 1 9.5 3.5a9 9 0 1 0 11 11Z" />
          : <g fill="currentColor">{[0, 72, 144, 216, 288].map(angle => <path key={angle} transform={`rotate(${angle} 12 12)`} d="M12 12C8 10 7.5 6 9 3l3 1.8L15 3c1.5 3 1 7-3 9Z" />)}<circle cx="12" cy="12" r="1.6" fill="var(--surface)" /></g>}
      </svg>
    </label>)}
  </fieldset>;
}
export function SeasonalBackground({ appearance, onError }: { appearance: ReturnType<typeof useAppearance>; onError: (message: string) => void }) {
  const target = sceneryUrl(appearance.season, appearance.scene, appearance.daylight);
  const [layers, setLayers] = useState<[string, string]>([target, target]);
  const [front, setFront] = useState(0);
  const frontRef = useRef(0);
  const current = useRef(target);
  useEffect(() => {
    if (target === current.current) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const next = 1 - frontRef.current;
      setLayers(previous => next === 0 ? [target, previous[1]] : [previous[0], target]);
      requestAnimationFrame(() => { if (active) { setFront(next); frontRef.current = next; current.current = target; } });
    };
    image.onerror = () => { if (active) onError('The seasonal background could not load.'); };
    image.src = target;
    return () => { active = false; };
  }, [target, onError]);
  if (appearance.mode !== 'seasonal') return null;
  return <div className="seasonal-background" aria-hidden="true">{layers.map((url, index) => <div key={index} className={`scenery-layer ${front === index ? 'visible' : ''}`} style={{ backgroundImage: `url("${url}")` }} />)}<div className="scenery-shade" /></div>;
}
export function SceneryControls({ appearance }: { appearance: ReturnType<typeof useAppearance> }) {
  const sceneName = sceneNames[appearance.season][appearance.scene];
  const pauseLabel = appearance.paused ? 'Resume scenery slideshow' : 'Pause scenery slideshow';
  return <div className="scenery-controls" role="group" aria-label="Seasonal scenery">
    <span className="scene-name" title={sceneName}>{sceneName}</span>
    <button aria-label={pauseLabel} title={pauseLabel} aria-pressed={appearance.paused} onClick={() => appearance.setPaused(value => !value)}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{appearance.paused ? <path d="m8 5 11 7-11 7Z" /> : <path d="M7 5h4v14H7Zm6 0h4v14h-4Z" />}</svg>
    </button>
    <button aria-label="Next scene" title="Next scene" onClick={appearance.nextScene}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 5 8 7-8 7M18 5v14" /></svg>
    </button>
  </div>;
}
