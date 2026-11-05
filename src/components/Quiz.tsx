import { useState } from 'react';
import { isAnswerCorrect, type Question } from '../lib/study';
import AudioButton from './AudioButton';

export default function Quiz({ questions, mode, title, onAnswer, onComplete, onClose, onError }: {
  questions: Question[]; mode: 'choice' | 'typed' | 'listening'; title: string;
  onAnswer: (correct: boolean) => void; onComplete: (score: number) => void;
  onClose: () => void; onError: (message: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<{ question: Question; correct: boolean }[]>([]);
  if (!questions.length) return <section className="panel"><h2>No questions available</h2><p>Select a larger practice set.</p><button onClick={onClose}>Back</button></section>;
  const question = questions[index];
  const right = submitted && isAnswerCorrect(answer, question.accepted);
  const submit = (value: string) => {
    if (submitted || !value.trim()) return;
    const passed = isAnswerCorrect(value, question.accepted);
    setAnswer(value); setSubmitted(true); setCorrect(count => count + Number(passed));
    setResults(previous => [...previous, { question, correct: passed }]);
    onAnswer(passed);
  };
  if (finished) {
    const score = Math.round(correct / questions.length * 100);
    return <section className="panel quiz-result">
      <span className="eyebrow">Session complete</span><h2>{score >= 80 ? 'Well done!' : 'Keep practising'}</h2>
      <div className="result-score">{score}%</div><p>{correct} of {questions.length} correct. Unit tests require at least 80%.</p>
      <button className="primary" onClick={onClose}>Continue studying</button>
      {results.some(result => !result.correct) && <div className="mistakes"><h3>Review your mistakes</h3>{results.filter(result => !result.correct).map((result, i) => <article key={i}><strong>{result.question.prompt}</strong><p>{result.question.explanation}</p></article>)}</div>}
    </section>;
  }
  return <section className="panel quiz">
    <div className="section-heading"><span className="eyebrow">{title}</span><button onClick={onClose}>Exit quiz</button></div>
    <div className="section-heading"><span>Question {index + 1} / {questions.length}</span><span>{correct} correct</span></div>
    <progress max={questions.length} value={index} aria-label="Quiz progress" />
    <h2 className={question.item.kind === 'grammar' ? 'grammar-question' : 'quiz-prompt'}>{question.prompt}</h2>
    {mode === 'listening' && <div className="button-row"><AudioButton text={question.audio} onError={onError} /><AudioButton text={question.audio} slow onError={onError} /></div>}
    {mode === 'typed' ? <form onSubmit={event => { event.preventDefault(); submit(answer); }}>
      <label>Your answer <input key={index} autoFocus value={answer} onChange={event => setAnswer(event.target.value)} disabled={submitted} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={question.item.kind === 'kanji' ? 'English meaning' : question.item.kind === 'grammar' ? 'Missing expression' : 'Japanese or romaji reading'} /></label>
      {!submitted && <button className="primary" disabled={!answer.trim()}>Check answer</button>}
    </form> : <div className="choices">{question.choices.map((choice, i) => <button key={`${i}-${choice}`} disabled={submitted} className={submitted ? isAnswerCorrect(choice, question.accepted) ? 'correct-choice' : choice === answer ? 'wrong-choice' : '' : ''} onClick={() => submit(choice)}>{choice}</button>)}</div>}
    {submitted && <div className={`feedback ${right ? 'correct' : 'incorrect'}`} role="status">
      <h3>{right ? 'Correct!' : `Answer: ${question.answer}`}</h3><p>{question.explanation}</p>
      {question.audio && <AudioButton text={question.audio} onError={onError} />}
      <button className="primary" onClick={() => {
        if (index + 1 === questions.length) { setFinished(true); onComplete(correct / questions.length * 100); }
        else { setIndex(value => value + 1); setAnswer(''); setSubmitted(false); }
      }}>{index + 1 === questions.length ? 'See results' : 'Next question'}</button>
    </div>}
  </section>;
}
