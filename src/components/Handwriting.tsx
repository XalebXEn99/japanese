import { useEffect, useRef, useState } from 'react';
import { gradeHandwriting, type Point } from '../lib/handwriting';

interface Props { character: string; onError: (message: string) => void }
export default function Handwriting({ character, onError }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  const [model, setModel] = useState<Point[][]>([]);
  const [drawn, setDrawn] = useState<Point[][]>([]);
  const [active, setActive] = useState<Point[]>([]);
  const [trace, setTrace] = useState(true);
  const [animation, setAnimation] = useState(0);
  const [message, setMessage] = useState('Loading stroke model…');
  const [grade, setGrade] = useState<ReturnType<typeof gradeHandwriting>>();
  const drawing = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setPaths([]); setDrawn([]); setActive([]); setGrade(undefined); setModel([]);
    setMessage('Loading stroke model…');
    const hex = character.codePointAt(0)!.toString(16).padStart(5, '0');
    fetch(`${import.meta.env.BASE_URL}strokes/${hex}.svg`).then(async response => {
      if (!response.ok) throw new Error(`No licensed stroke model is bundled for ${character}. You can still use the drawing pad.`);
      const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      const strokePaths = [...doc.querySelectorAll('path[d]')].map(path => path.getAttribute('d')!).filter(Boolean);
      if (!strokePaths.length || doc.querySelector('parsererror')) throw new Error('The stroke model could not be read.');
      const samples = strokePaths.map(d => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        const length = path.getTotalLength();
        return Array.from({ length: 60 }, (_, i) => {
          const point = path.getPointAtLength(length * i / 59);
          return { x: point.x, y: point.y };
        });
      });
      if (!cancelled) { setPaths(strokePaths); setModel(samples); setMessage(`${strokePaths.length} strokes. Draw each stroke in one movement.`); }
    }).catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not load stroke order.'); });
    return () => { cancelled = true; };
  }, [character]);
  const point = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 109, y: (event.clientY - rect.top) / rect.height * 109 };
  };
  return <section className="writing">
    <div className="section-heading"><h3>Write {character}</h3><span className="badge">Stroke-model practice</span></div>
    <p>{message}</p>
    <div className="writing-grids">
      <div><h4>Stroke order</h4><svg key={`${character}-${animation}`} className="writing-pad model" viewBox="0 0 109 109" aria-label={`Stroke order for ${character}`}>
        {paths.map((d, i) => <g key={i}><path d={d} pathLength={1} className="animated-stroke" style={{ animationDelay: `${i * 0.65}s` }} /><text x={model[i]?.[0].x ?? 0} y={(model[i]?.[0].y ?? 0) - 3}>{i + 1}</text></g>)}
      </svg><button onClick={() => setAnimation(x => x + 1)}>Replay strokes</button></div>
      <div><h4>Your turn</h4><svg className="writing-pad" viewBox="0 0 109 109" role="img" aria-label={`Drawing pad for ${character}`}
        onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drawing.current = true; setActive([point(event)]); setGrade(undefined); }}
        onPointerMove={event => { if (drawing.current) { const p = point(event); setActive(previous => [...previous, p]); } }}
        onPointerUp={event => { if (!drawing.current) return; const end = point(event); drawing.current = false; setDrawn(previous => [...previous, [...active, end]]); setActive([]); }}
        onPointerCancel={() => { drawing.current = false; setActive([]); }}>
        <path className="grid-lines" d="M54.5 0V109 M0 54.5H109" />
        {trace && paths.map((d, i) => <path key={i} d={d} className="trace-stroke" />)}
        {[...drawn, ...(active.length ? [active] : [])].map((stroke, i) => <polyline key={i} points={stroke.map(p => `${p.x},${p.y}`).join(' ')} className="drawn-stroke" />)}
      </svg><label className="check"><input type="checkbox" checked={trace} onChange={event => setTrace(event.target.checked)} /> Show tracing guide</label></div>
    </div>
    <div className="button-row">
      <button onClick={() => { setDrawn(previous => previous.slice(0, -1)); setGrade(undefined); }}>Undo</button>
      <button onClick={() => { setDrawn([]); setGrade(undefined); }}>Clear</button>
      <button className="primary" disabled={!model.length || !drawn.length} onClick={() => {
        try { setGrade(gradeHandwriting(drawn, model)); }
        catch (error) { onError(error instanceof Error ? error.message : 'Could not grade handwriting.'); }
      }}>Check writing</button>
    </div>
    {grade && <p role="status" className={grade.passed ? 'feedback correct' : 'feedback incorrect'}><strong>{grade.score}% model match.</strong> {grade.feedback}</p>}
    <p className="muted small">Automatic feedback compares stroke count, order, direction and geometry with a reference. It is not general handwriting recognition or a measure of Japanese proficiency. KanjiVG diagrams: CC BY-SA 3.0.</p>
  </section>;
}
