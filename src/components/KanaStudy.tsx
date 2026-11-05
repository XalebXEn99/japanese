import { useState } from 'react';
import type { Kana } from '../types';
import { kanaItem, type StudyItem } from '../lib/study';

export default function KanaStudy({ kana, onPractice, onInspect }: { kana: Kana[]; onPractice: (items: StudyItem[], title: string) => void; onInspect: (item: StudyItem) => void }) {
  const [kind, setKind] = useState<'hiragana' | 'katakana'>('hiragana');
  const [groups, setGroups] = useState<string[]>([]);
  const relevant = kana.filter(k => k.kind === kind);
  const availableGroups = [...new Set(relevant.map(k => k.group))];
  const filtered = relevant.filter(k => !groups.length || groups.includes(k.group));
  return <>
    <div className="section-heading"><div className="segmented">{(['hiragana', 'katakana'] as const).map(value => <button key={value} aria-pressed={kind === value} onClick={() => { setKind(value); setGroups([]); }}>{value === 'hiragana' ? 'Hiragana · ひらがな' : 'Katakana · カタカナ'}</button>)}</div><button className="primary" onClick={() => onPractice(filtered.map(kanaItem), `${kind} practice`)}>Practise {filtered.length} kana</button></div>
    <p>Start with the basic sounds, then voiced sounds and combinations. Select groups to focus your practice, or leave all unselected to study the whole script.</p>
    <div className="filter-chips">{availableGroups.map(group => <button key={group} aria-pressed={groups.includes(group)} onClick={() => setGroups(previous => previous.includes(group) ? previous.filter(value => value !== group) : [...previous, group])}>{group}</button>)}</div>
    {availableGroups.filter(group => !groups.length || groups.includes(group)).map(group => <section key={group} className="kana-section"><h3>{group}</h3><div className="kana-grid">{relevant.filter(k => k.group === group).map(k => <button key={k.id} className="kana-tile" onClick={() => onInspect(kanaItem(k))}><span lang="ja">{k.character}</span><span>{k.romaji}</span></button>)}</div></section>)}
  </>;
}
