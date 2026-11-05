import { useState } from 'react';
import type { Progress } from '../../shared/progress';
import type { StudyItem } from '../lib/study';
import AudioButton from './AudioButton';

export default function Flashcards({ items, settings, onRate, onClose, onError }: {
  items: StudyItem[]; settings: Progress['settings']; onRate: (id: string, rating: 'again' | 'hard' | 'good' | 'easy') => void;
  onClose: () => void; onError: (message: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [retry, setRetry] = useState<StudyItem[]>([]);
  const queue = [...items, ...retry];
  const item = queue[index];
  if (!item) return <section className="panel center"><h2>Review complete</h2><p>You reviewed {index} cards. Your next reviews have been scheduled.</p><button className="primary" onClick={onClose}>Done</button></section>;
  return <section className="panel">
    <div className="section-heading"><span className="eyebrow">Flashcards · {index + 1} / {queue.length}</span><button onClick={onClose}>Finish session</button></div>
    <button className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(value => !value)} aria-label={flipped ? 'Show front of flashcard' : 'Reveal flashcard answer'}>
      <span className="eyebrow">{item.kind}</span>
      <span lang="ja" className="flashcard-word">{item.prompt}</span>
      {flipped ? <>
        {settings.showFurigana && <span lang="ja" className="reading">{item.reading}</span>}
        {settings.showRomaji && <span className="romaji">{item.romaji}</span>}
        <span className="card-meaning">{item.meanings.join('; ')}</span>
        {item.grammar?.examples.map((example, i) => <span className="example" key={i}><span lang="ja">{example.ja}</span><span>{example.en}</span></span>)}
      </> : <span className="muted">Think of the reading and meaning. Tap to reveal.</span>}
    </button>
    <div className="button-row"><AudioButton text={item.audio} onError={onError} /><AudioButton text={item.audio} slow onError={onError} /></div>
    {flipped && <div className="rating-buttons">{(['again', 'hard', 'good', 'easy'] as const).map(rating => <button key={rating} className={rating === 'good' ? 'primary' : ''} onClick={() => {
      onRate(item.id, rating);
      if (rating === 'again' && retry.filter(card => card.id === item.id).length < 2) setRetry(previous => [...previous, item]);
      setIndex(value => value + 1); setFlipped(false);
    }}>{rating[0].toUpperCase() + rating.slice(1)}</button>)}</div>}
    <p className="muted small">Rate honestly. “Again” repeats the card and schedules a short review; other ratings increase its review interval.</p>
  </section>;
}
