import { useMemo, useState } from 'react';
import { toRomaji } from 'wanakana';
import type { LevelContent } from '../types';
import type { Progress } from '../../shared/progress';
import { grammarItem, kanjiItem, vocabularyItem, type StudyItem } from '../lib/study';
import AudioButton from './AudioButton';

export default function Library({ kind, content, settings, onPractice, onInspect, onError }: {
  kind: 'vocabulary' | 'kanji' | 'grammar'; content: LevelContent; settings: Progress['settings'];
  onPractice: (items: StudyItem[], title: string) => void; onInspect: (item: StudyItem) => void; onError: (message: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [page, setPage] = useState(0);
  const items = useMemo(() => kind === 'vocabulary' ? content.vocabulary.map(vocabularyItem) : kind === 'kanji' ? content.kanji.map(kanjiItem) : content.grammar.map(grammarItem), [content, kind]);
  const wordCategories = useMemo(() => new Map(content.vocabulary.map(word => [word.id, word.category])), [content]);
  const categories = [...new Set(content.vocabulary.map(v => v.category))].sort();
  const filtered = items.filter(item => {
    const categoryMatches = kind !== 'vocabulary' || category === 'All categories' || wordCategories.get(item.id) === category;
    return categoryMatches && `${item.prompt} ${item.reading} ${item.romaji} ${item.meanings.join(' ')}`.toLowerCase().includes(query.toLowerCase().trim());
  });
  const pages = Math.ceil(filtered.length / 36);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const visible = filtered.slice(currentPage * 36, (currentPage + 1) * 36);
  return <>
    <div className="toolbar">
      <label className="grow">Search {kind}<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Japanese, reading, romaji or English…" /></label>
      {kind === 'vocabulary' && <label>Category<select value={category} onChange={event => { setCategory(event.target.value); setPage(0); }}><option>All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>}
      <button className="primary" disabled={!filtered.length} onClick={() => onPractice(filtered, `${kind} practice`)}>Practise selection</button>
    </div>
    <p className="muted">{filtered.length.toLocaleString()} {kind === 'kanji' ? 'characters' : kind === 'grammar' ? 'lessons' : 'words'}{kind === 'grammar' && <> · <a href={`${import.meta.env.BASE_URL}grammar_guide.pdf`} target="_blank" rel="noreferrer">Tae Kim guide</a></>}</p>
    {!visible.length && <div className="empty-state"><h3>No matching items</h3><p>Try a different search or category.</p></div>}
    <div className={kind === 'grammar' ? 'grammar-list' : 'item-grid'}>
      {visible.map(item => kind === 'grammar' && item.grammar ? <details className="panel grammar-lesson" key={item.id}>
        <summary>{item.grammar.title}</summary>
        <p>{item.grammar.explanation}</p>
        {item.grammar.examples.map((example, i) => <div className="example" key={i}><p lang="ja">{example.ja}</p>{settings.showFurigana && example.reading && <p className="reading" lang="ja">{example.reading}</p>}{settings.showRomaji && example.reading && <p className="romaji">{toRomaji(example.reading)}</p>}<p>{example.en}</p><AudioButton text={example.ja} onError={onError} /></div>)}
        <button className="primary" onClick={() => onPractice([item], item.prompt)}>Practise this grammar</button>
      </details> : <article className={`item-card ${kind === 'kanji' ? 'kanji-card' : ''}`} key={item.id}>
        <button className="word-button" lang="ja" onClick={() => onInspect(item)}>{item.prompt}</button>
        {settings.showFurigana && <p className="reading" lang="ja">{item.reading}</p>}
        {settings.showRomaji && <p className="romaji">{item.romaji}</p>}
        <p className="meaning">{item.meanings.slice(0, 3).join('; ')}</p>
        {kind === 'kanji' && <button className="text-button" onClick={() => onInspect(item)}>Readings &amp; stroke order</button>}
        {kind === 'vocabulary' && <AudioButton text={item.audio} onError={onError} />}
      </article>)}
    </div>
    {pages > 1 && <div className="pagination"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {pages}</span><button disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>}
  </>;
}
