import type { Progress } from '../../shared/progress';
import { challengeStreak, reviewDays, type DailyContent } from '../lib/daily';

export interface ReviewInsightsProps {
  progress: Progress;
  contentByLevel?: DailyContent;
}

export default function ReviewInsights({ progress, contentByLevel = {} }: ReviewInsightsProps) {
  const outcomes = Object.values(progress.challenges ?? {});
  const correct = outcomes.filter(outcome => outcome.correct).length;
  const topics = new Map<string, { answers: number; correct: number }>();
  for (const outcome of outcomes) {
    const key = `${outcome.level} · ${outcome.topic}`;
    const entry = topics.get(key) ?? { answers: 0, correct: 0 };
    topics.set(key, { answers: entry.answers + 1, correct: entry.correct + Number(outcome.correct) });
  }
  const days = reviewDays(progress);
  const max = Math.max(1, ...days.map(day => day.answers));
  const itemTopics = new Map<string, string>();
  for (const [level, content] of Object.entries(contentByLevel)) {
    if (!content) continue;
    for (const item of content.vocabulary) itemTopics.set(item.id, `${level} · ${item.category || 'Vocabulary'}`);
    for (const item of content.kanji) itemTopics.set(item.id, `${level} · Kanji`);
    for (const item of content.grammar) itemTopics.set(item.id, `${level} · ${item.title}`);
  }
  const cardTopics = new Map<string, { cards: number; lapses: number; reviews: number }>();
  for (const [id, card] of Object.entries(progress.cards)) {
    const topic = itemTopics.get(id) ?? 'Other reviewed cards';
    const entry = cardTopics.get(topic) ?? { cards: 0, lapses: 0, reviews: 0 };
    cardTopics.set(topic, { cards: entry.cards + 1, lapses: entry.lapses + card.lapses, reviews: entry.reviews + card.repetitions });
  }
  const percent = (right: number, total: number) => total ? `${Math.round(right / total * 100)}%` : '—';
  return <section className="panel review-insights" aria-labelledby="review-insights-title">
    <h2 id="review-insights-title">Insights</h2>
    <dl className="insight-stats">
      <div><dt>Daily challenge streak</dt><dd>{challengeStreak(progress)} days</dd></div>
      <div><dt>Daily challenges completed</dt><dd>{outcomes.length}</dd></div>
      <div><dt>Daily answers correct</dt><dd>{correct} / {outcomes.length} ({percent(correct, outcomes.length)})</dd></div>
      <div><dt>Overall practice answers</dt><dd>{progress.stats.answers}</dd></div>
      <div><dt>Overall correct answers</dt><dd>{progress.stats.correct} ({percent(progress.stats.correct, progress.stats.answers)})</dd></div>
      <div><dt>Study days</dt><dd>{progress.stats.studyDays.length}</dd></div>
    </dl>
    <h3>Last 14 days</h3>
    <svg className="activity-chart" viewBox="0 0 700 180" role="img" aria-labelledby="review-chart-title review-chart-desc">
      <title id="review-chart-title">Practice answers over the last 14 local calendar days</title>
      <desc id="review-chart-desc">Each bar shows recorded answer attempts. Exact dates, totals, correct answers, and challenge completions appear in the table below.</desc>
      <line x1="20" y1="140" x2="690" y2="140" stroke="currentColor" />
      {days.map((day, index) => {
        const height = day.answers / max * 95;
        const x = 25 + index * 47;
        return <g key={day.date}>
          <rect x={x} y={140 - height} width="30" height={height} fill="currentColor"><title>{day.date}: {day.answers} answers, {day.correct} correct</title></rect>
          <text x={x + 15} y={132 - height} textAnchor="middle" fill="currentColor" fontSize="12">{day.answers}</text>
          <text x={x + 15} y="160" textAnchor="middle" fill="currentColor" fontSize="10">{day.date.slice(5)}</text>
        </g>;
      })}
    </svg>
    <details className="activity-table"><summary>Show daily activity numbers</summary>
      <table><caption>Last 14 days of practice</caption><thead><tr><th scope="col">Date</th><th scope="col">Answers</th><th scope="col">Correct</th><th scope="col">Daily challenge</th></tr></thead>
        <tbody>{days.map(day => <tr key={day.date}><th scope="row">{day.date}</th><td>{day.answers}</td><td>{day.correct}</td><td>{day.challenge ? 'Completed' : '—'}</td></tr>)}</tbody>
      </table>
    </details>
    <h3>Daily challenge accuracy by topic</h3>
    {!topics.size ? <p>Complete a daily challenge to start tracking topic accuracy.</p> : <table>
      <caption>First daily attempts only</caption><thead><tr><th scope="col">Topic</th><th scope="col">Correct / attempted</th><th scope="col">Accuracy</th></tr></thead>
      <tbody>{[...topics].sort(([a], [b]) => a.localeCompare(b)).map(([topic, value]) => <tr key={topic}><th scope="row">{topic}</th><td>{value.correct} / {value.answers}</td><td>{percent(value.correct, value.answers)}</td></tr>)}</tbody>
    </table>}
    <h3>Flashcard review areas</h3>
    {!cardTopics.size ? <p>Review flashcards to see reviewed areas and lapses.</p> : <>
      <table><caption>Current flashcard scheduling metrics</caption><thead><tr><th scope="col">Area</th><th scope="col">Cards</th><th scope="col">Lapses</th><th scope="col">Successful repetitions</th></tr></thead>
        <tbody>{[...cardTopics].sort((a, b) => b[1].lapses - a[1].lapses || a[0].localeCompare(b[0])).map(([topic, value]) => <tr key={topic}><th scope="row">{topic}</th><td>{value.cards}</td><td>{value.lapses}</td><td>{value.reviews}</td></tr>)}</tbody>
      </table>
    </>}
  </section>;
}
