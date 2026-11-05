import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyProgress, mergeProgress, progressSchema, recordAnswer, scheduleCard, type Progress } from '../shared/progress';
import { LEVELS, type ContentManifest, type Kana, type Level, type LevelContent } from './types';
import { loadKana, loadLevel, loadManifest } from './data/content';
import { allItems, buildUnits, makeQuestions, shuffle, type Question, type StudyItem, type Unit } from './lib/study';
import { authClient } from './lib/auth';
import { exportProgress, readProgress } from './lib/storage';
import { useProgress } from './hooks/useProgress';
import AudioButton from './components/AudioButton';
import Account, { type User } from './components/Account';
import Course from './components/Course';
import Dialog from './components/Dialog';
import Flashcards from './components/Flashcards';
import Handwriting from './components/Handwriting';
import KanaStudy from './components/KanaStudy';
import Library from './components/Library';
import Quiz from './components/Quiz';
import { SceneryControls, SeasonalBackground, ThemeSlider, useAppearance } from './components/Appearance';
import AmbientControls from './components/AmbientControls';
import DailyChallenge from './components/DailyChallenge';
import ReviewInsights from './components/ReviewInsights';
import { recordDailyChallenge } from './lib/daily';

const navigation = [
  ['home', 'Home'], ['course', 'Learn'], ['kana', 'Kana'],
  ['vocabulary', 'Vocabulary'], ['kanji', 'Kanji'], ['grammar', 'Grammar'],
  ['review', 'Reviews'], ['settings', 'Settings'],
] as const;
type Page = typeof navigation[number][0] | 'about' | 'account';
interface QuizSession { questions: Question[]; title: string; mode: 'choice' | 'typed' | 'listening'; unitId?: string; assessment?: Level }
const titles: Record<Page, string> = { home: 'Home', course: 'Learn', kana: 'Kana', vocabulary: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar', review: 'Reviews', settings: 'Settings', about: 'Sources & licenses', account: 'Account' };
function route(): Page {
  const value = location.hash.slice(1).split('/')[0];
  return [...navigation.map(([id]) => id), 'about', 'account'].includes(value) ? value as Page : 'home';
}
export default function App() {
  const [page, setPage] = useState<Page>(route);
  const [level, setLevel] = useState<Level>('N5');
  const [manifest, setManifest] = useState<ContentManifest>();
  const [kana, setKana] = useState<Kana[]>([]);
  const [content, setContent] = useState<LevelContent>();
  const [contentError, setContentError] = useState('');
  const [retry, setRetry] = useState(0);
  const [allContent, setAllContent] = useState<LevelContent[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!authClient);
  const [error, setError] = useState('');
  const notify = useCallback((message: string) => setError(message), []);
  const appearance = useAppearance(notify);
  const { progress, update, status, sync, loaded } = useProgress(user?.id ?? null, notify);
  const [quiz, setQuiz] = useState<QuizSession>();
  const [cards, setCards] = useState<StudyItem[]>();
  const [practice, setPractice] = useState<{ items: StudyItem[]; title: string }>();
  const [inspect, setInspect] = useState<StudyItem>();
  const [confirmReset, setConfirmReset] = useState(false);
  const refreshSession = useCallback(async () => {
    if (!authClient) { setAuthReady(true); return; }
    try {
      const result = await authClient.getSession();
      if (result.error) throw new Error(result.error.message || 'Could not restore your session.');
      setUser(result.data?.user ?? null);
    } finally { setAuthReady(true); }
  }, []);
  useEffect(() => { refreshSession().catch(error => notify(error instanceof Error ? error.message : 'Account connection failed.')); }, [refreshSession, notify]);
  useEffect(() => {
    const changed = () => { setPage(route()); setQuiz(undefined); setCards(undefined); setPractice(undefined); setInspect(undefined); };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([loadManifest(), loadKana()]).then(([m, k]) => { if (active) { setManifest(m); setKana(k); } }).catch(error => { if (active) setContentError(String(error)); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    let active = true;
    setContent(undefined); setContentError('');
    loadLevel(level).then(data => { if (active) setContent(data); }).catch(error => { if (active) setContentError(String(error)); });
    return () => { active = false; };
  }, [level, retry]);
  useEffect(() => {
    let active = true;
    Promise.all(LEVELS.map(loadLevel)).then(data => { if (active) setAllContent(data); }).catch(error => { if (active) notify(String(error)); });
    return () => { active = false; };
  }, [retry, notify]);
  const contentByLevel = useMemo(() => Object.fromEntries(LEVELS.map((value, index) => [value, allContent[index]])) as Partial<Record<Level, LevelContent>>, [allContent]);
  const units = useMemo(() => content ? buildUnits(content, level) : [], [content, level]);
  const pool = useMemo(() => content ? allItems(content) : [], [content]);
  const reviewItems = useMemo(() => [...kana.map(k => ({
    id: k.id, kind: 'kana' as const, prompt: k.character, reading: k.character, romaji: k.romaji, meanings: [k.romaji], accepted: [k.romaji, k.character], audio: k.character, character: k.character,
  })), ...allContent.flatMap(allItems)], [kana, allContent]);
  const dueItems = reviewItems.filter(item => progress.cards[item.id] && progress.cards[item.id].due <= Date.now());
  const dueCount = Object.values(progress.cards).filter(card => card.due <= Date.now()).length;
  const navigate = (next: Page) => { if (location.hash === `#${next}`) { setPage(next); setQuiz(undefined); setCards(undefined); } else location.hash = next; window.scrollTo({ top: 0 }); };
  const answer = (correct: boolean) => update(previous => recordAnswer(previous, correct));
  const completeQuiz = (score: number) => {
    if (!quiz?.unitId && !quiz?.assessment) return;
    const key = quiz.assessment ? `level-${quiz.assessment}` : quiz.unitId!;
    update(previous => {
      const old = previous.units[key];
      const results = { ...previous.units, [key]: { score: Math.max(old?.score ?? 0, score), passed: !!old?.passed || score >= 80, updatedAt: Date.now() } };
      if (quiz.unitId && units.every(unit => results[unit.id]?.passed)) results[`level-${level}`] = { score: 100, passed: true, updatedAt: Date.now() };
      return { ...previous, units: results, updatedAt: new Date().toISOString() };
    });
  };
  const startPractice = (items: StudyItem[], title: string) => setPractice({ items, title });
  const startTest = (unit: Unit) => {
    setQuiz({ questions: makeQuestions(unit.items, pool, unit.kind === 'Grammar' ? 100 : 15, 'choice', 'mixed'), title: unit.title, mode: 'choice', unitId: unit.id });
    window.scrollTo({ top: 0 });
  };
  const importFile = async (file: File) => {
    try {
      if (file.size > 5_000_000) throw new Error('Progress files must be smaller than 5 MB.');
      const imported = progressSchema.parse(JSON.parse(await file.text()));
      update(previous => mergeProgress(previous, imported));
    } catch (error) { notify(error instanceof Error ? `Import failed: ${error.message}` : 'Could not import progress.'); }
  };
  const loading = !manifest || !content || !kana.length;
  return <div className="app-shell">
    <SeasonalBackground appearance={appearance} onError={notify} />
    <div className="main-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="化 Home"><span className="brand-mark" lang="ja">化</span><span className="brand-word">ka<small>change</small></span></a>
        <nav aria-label="Main navigation">{navigation.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={page === id ? 'page' : undefined}>{label}{id === 'review' && dueCount > 0 && <span className="nav-count">{dueCount}</span>}</a>)}</nav>
        <div className="header-controls"><ThemeSlider mode={appearance.mode} onChange={appearance.setMode} /><AmbientControls onError={notify} /><button className="account-button" onClick={() => navigate('account')}>{!authReady ? 'Connecting…' : user ? user.name || 'Account' : 'Sign in'}</button></div>
      </header>
      <main id="main-content">
        {error && page !== 'account' && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">Dismiss</button></div>}
        <div className="page-heading"><h1>{titles[page]}</h1>
          {['course', 'vocabulary', 'kanji', 'grammar'].includes(page) && <label className="level-select">Study level<select value={level} onChange={event => { setLevel(event.target.value as Level); setQuiz(undefined); setCards(undefined); }} aria-label="Study level">{LEVELS.map(l => <option key={l}>{l}</option>)}</select></label>}
        </div>
        {!loaded ? <p role="status">Loading your saved progress…</p> : quiz ? <Quiz key={`${quiz.title}-${quiz.mode}`} {...quiz} onAnswer={answer} onComplete={completeQuiz} onClose={() => setQuiz(undefined)} onError={notify} /> : cards ? <Flashcards items={cards} settings={progress.settings} onRate={(id, rating) => update(previous => ({
          ...recordAnswer(previous, rating !== 'again'), cards: { ...previous.cards, [id]: scheduleCard(previous.cards[id], rating) },
        }))} onClose={() => setCards(undefined)} onError={notify} /> : <>
          {contentError && <section className="feedback incorrect" role="alert"><h2>Study content could not load</h2><p>{contentError}</p><button onClick={() => setRetry(value => value + 1)}>Retry loading</button></section>}
          {page === 'account' ? <Account user={user} error={error} onSession={refreshSession} onError={notify} onClose={() => navigate('home')} /> : page === 'settings' ? <>
            <section className="panel appearance-settings"><h2>Appearance</h2><ThemeSlider mode={appearance.mode} onChange={appearance.setMode} /><p className="small">{appearance.mode === 'seasonal' ? `${appearance.season[0].toUpperCase() + appearance.season.slice(1)} · ${appearance.daylight}` : appearance.mode === 'light' ? 'Light' : 'Dark'}</p></section>
            <section className="panel"><h2>Reading support</h2>
              <label className="check"><input type="checkbox" checked={progress.settings.showFurigana} onChange={event => update(previous => ({ ...previous, updatedAt: new Date().toISOString(), settings: { ...previous.settings, showFurigana: event.target.checked } }))} /> Show kana readings</label>
              <label className="check"><input type="checkbox" checked={progress.settings.showRomaji} onChange={event => update(previous => ({ ...previous, updatedAt: new Date().toISOString(), settings: { ...previous.settings, showRomaji: event.target.checked } }))} /> Show romaji</label>
              <label>Daily review target<input type="number" min={1} max={500} value={progress.settings.dailyGoal} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && value <= 500) update(previous => ({ ...previous, updatedAt: new Date().toISOString(), settings: { ...previous.settings, dailyGoal: value } })); }} /></label>
            </section>
            <section className="panel"><h2>Progress &amp; backups</h2><p className="sync-status" role="status">{status}</p><p>{user ? 'Progress syncs to your account.' : 'Guest progress is saved in this browser.'}</p>
              <div className="button-row"><button onClick={() => exportProgress(progress)}>Export progress</button><label className="file-button">Import progress<input type="file" accept=".json,application/json" onChange={event => { if (event.target.files?.[0]) void importFile(event.target.files[0]); event.target.value = ''; }} /></label>{user && <button onClick={() => void sync()}>Sync now</button>}</div>
              {user && <button onClick={() => { try { const guest = readProgress('guest'); update(previous => mergeProgress(previous, guest)); } catch (error) { notify(String(error)); } }}>Import this device’s guest progress</button>}
            </section>
            <section className="panel"><h2>Pronunciation</h2><p>Speech uses your device’s Japanese voice through the browser Web Speech API. Install a Japanese voice in your operating system if playback is unavailable. Voice quality and internet requirements vary by device.</p><AudioButton text="こんにちは。日本語を勉強しましょう。" onError={notify} /></section>
            <section className="panel"><h2>Start over locally</h2><p>This clears the current browser profile. Account history is not deleted; a future sync can restore it.</p>{confirmReset ? <div className="button-row"><button className="danger" onClick={() => { localStorage.removeItem(`kotoba-progress-v1:${user?.id || 'guest'}`); location.reload(); }}>Confirm local reset</button><button onClick={() => setConfirmReset(false)}>Cancel</button></div> : <button onClick={() => setConfirmReset(true)}>Reset local progress</button>}</section>
          </> : page === 'about' ? <section className="panel"><h2>Built for learning, not competition</h2><p>A personal, noncommercial Japanese study tool inspired by Obenkyo and LingoDeer. Not affiliated with either application, Tae Kim, or the JLPT.</p><h3>Curriculum limits</h3><p>JLPT does not publish an exhaustive official vocabulary, kanji or grammar list. Level assignments here are study estimates, not guaranteed exam coverage. Original grammar exercises supplement Tae Kim’s guide. These quizzes are not official JLPT exams.</p><h3>Content sources</h3>{manifest?.sources.map(source => <article className="source" key={source.name}><h4><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></h4><p>{source.license} · {source.usage}</p></article>)}<p><a href={`${import.meta.env.BASE_URL}grammar_guide.pdf`} target="_blank" rel="noreferrer">Read Tae Kim’s supplied grammar guide</a></p><p>Source-specific attribution and share-alike requirements remain applicable to their respective content. Do not monetize redistributed noncommercial material.</p></section> : loading ? <p role="status">Loading Japanese study content…</p> : <>
            {page === 'home' && <>
              <section className="hero"><div><h2><span lang="ja">日本語</span><small>Japanese</small></h2><div className="button-row"><button className="primary" onClick={() => navigate('course')}>Continue learning →</button><button onClick={() => navigate('kana')}>Start with kana</button></div></div><div className="hero-character" lang="ja" aria-hidden="true">化</div></section>
              <DailyChallenge contentByLevel={contentByLevel} progress={progress} onComplete={result => update(previous => recordDailyChallenge(previous, result))} onError={notify} />
              <div className="stats-grid"><article className="stat"><span>Answers practised</span><strong>{progress.stats.answers}</strong></article><article className="stat"><span>Accuracy</span><strong>{progress.stats.answers ? Math.round(progress.stats.correct / progress.stats.answers * 100) : 0}%</strong></article><article className="stat"><span>Cards due</span><strong>{dueCount}</strong><button className="text-button" onClick={() => navigate('review')}>Review now →</button></article><article className="stat"><span>Days studied</span><strong>{progress.stats.studyDays.length}</strong></article></div>
              <div className="section-heading"><h2>Study</h2></div>
              <div className="feature-grid">{([['kana', 'あ', 'Kana'], ['vocabulary', '語', 'Vocabulary'], ['kanji', '字', 'Kanji'], ['grammar', '文', 'Grammar']] as const).map(([id, icon, title]) => <button className="feature-card" key={id} onClick={() => navigate(id)}><span lang="ja" className="feature-icon">{icon}</span><h3>{title}</h3></button>)}</div>
              <section className="panel"><h2>Levels</h2><div className="level-overview">{LEVELS.map(l => <button key={l} onClick={() => { setLevel(l); navigate('course'); }}><strong>{l}</strong><span>{manifest.levels[l].vocabulary.toLocaleString()} words</span><span>{manifest.levels[l].kanji} kanji · {manifest.levels[l].grammar} grammar</span></button>)}</div></section>
            </>}
            {page === 'course' && <Course units={units} level={level} progress={progress} onLearn={unit => { if (unit.kind === 'Grammar') startPractice(unit.items, unit.title); else setCards(unit.items); }} onTest={startTest} onAssessment={() => {
              const vocabQuestions = makeQuestions(pool.filter(item => item.kind === 'vocabulary'), pool, 10, 'choice', 'mixed');
              const kanjiQuestions = makeQuestions(pool.filter(item => item.kind === 'kanji'), pool, 5);
              const grammarQuestions = makeQuestions(pool.filter(item => item.kind === 'grammar'), pool, 5);
              setQuiz({ questions: shuffle([...vocabQuestions, ...kanjiQuestions, ...grammarQuestions]), title: `${level} assessment`, mode: 'choice', assessment: level });
            }} />}
            {page === 'kana' && <KanaStudy kana={kana} onPractice={startPractice} onInspect={setInspect} />}
            {(page === 'vocabulary' || page === 'kanji' || page === 'grammar') && <Library key={`${page}-${level}`} kind={page} content={content!} settings={progress.settings} onPractice={startPractice} onInspect={setInspect} onError={notify} />}
            {page === 'review' && <section className="panel"><h2>{dueCount ? `${dueCount} cards due` : 'No cards due'}</h2>{allContent.length !== LEVELS.length ? <p role="status">Loading…</p> : <button className="primary" disabled={!dueItems.length} onClick={() => setCards(shuffle(dueItems).slice(0, progress.settings.dailyGoal))}>Review up to {progress.settings.dailyGoal} cards</button>}<div className="button-row"><button onClick={() => navigate('vocabulary')}>Vocabulary</button><button onClick={() => navigate('kana')}>Kana</button></div><p className="muted">{Object.keys(progress.cards).length} cards studied</p></section>}
          </>}
        </>}
        {page === 'review' && loaded && <ReviewInsights progress={progress} contentByLevel={contentByLevel} />}
      </main>
      <footer className="site-footer"><a href="#about">Sources &amp; licenses</a>{appearance.mode === 'seasonal' && <SceneryControls appearance={appearance} />}</footer>
    </div>
    {practice && <Dialog title={practice.title} onClose={() => setPractice(undefined)}>
      {practice.items[0]?.grammar && <div className="lesson-preview"><p>{practice.items[0].grammar.explanation}</p>{practice.items[0].grammar.examples.map((example, index) => <p key={index}><span lang="ja">{example.ja}</span><br />{example.en}</p>)}</div>}
      <p>{practice.items.length} items selected. Choose how you’d like to practise.</p><div className="practice-modes">
        <button onClick={() => { setCards(shuffle(practice.items).slice(0, progress.settings.dailyGoal)); setPractice(undefined); }}>Flashcards<span>Learn &amp; schedule reviews</span></button>
        {practice.items.some(item => item.kind === 'vocabulary') && <button onClick={() => {
          setQuiz({ questions: makeQuestions(practice.items.filter(item => item.kind === 'vocabulary'), pool, 20, 'choice', 'meaning'), mode: 'choice', title: `${practice.title} · meanings` });
          setPractice(undefined);
        }}>Meaning quiz<span>Match Japanese words to English translations</span></button>}
        {(['choice', 'typed', 'listening'] as const).map(mode => {
          const eligible = mode === 'listening' ? practice.items.filter(item => item.kind === 'vocabulary' || item.kind === 'kana') : practice.items;
          return <button key={mode} disabled={!eligible.length} onClick={() => {
            const questions = makeQuestions(eligible, [...pool, ...kana.map(k => ({ id: k.id, kind: 'kana' as const, prompt: k.character, reading: k.character, romaji: k.romaji, meanings: [k.romaji], accepted: [k.romaji], audio: k.character }))], 20, mode);
            setQuiz({ questions, mode, title: practice.title }); setPractice(undefined);
          }}>{mode === 'choice' ? 'Multiple choice' : mode === 'typed' ? 'Type your answer' : 'Listening quiz'}<span>{mode === 'typed' ? 'Japanese / romaji readings; English kanji meanings' : mode === 'listening' ? 'Requires a Japanese device voice' : 'Build recognition & recall'}</span></button>;
        })}
      </div>
    </Dialog>}
    {inspect && <Dialog title={inspect.prompt} onClose={() => setInspect(undefined)}><div className="word-detail"><p lang="ja" className="reading">{inspect.reading}</p><p>{inspect.romaji}</p><p>{inspect.meanings.join('; ')}</p><AudioButton text={inspect.audio} onError={notify} /><button onClick={() => { startPractice([inspect], inspect.prompt); setInspect(undefined); }}>Practise this item</button></div>{[...inspect.prompt].length === 1 && <Handwriting character={inspect.prompt} onError={notify} />}{inspect.kind === 'kana' && [...inspect.prompt].length > 1 && <div><p>Write each character separately:</p>{[...inspect.prompt].map((character, i) => <Handwriting key={i} character={character} onError={notify} />)}</div>}</Dialog>}
  </div>;
}
