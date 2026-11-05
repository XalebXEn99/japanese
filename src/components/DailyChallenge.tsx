import { useEffect, useRef, useState } from 'react';
import type { Progress } from '../../shared/progress';
import { checkDailyAnswer, getDailyQuestion, localDateKey, type DailyContent, type DailyResult } from '../lib/daily';
import AudioButton from './AudioButton';

export type { DailyResult } from '../lib/daily';
export interface DailyChallengeProps {
  contentByLevel: DailyContent;
  progress: Progress;
  onComplete: (result: DailyResult) => void;
  onError: (message: string) => void;
}

interface RecognitionResultEvent {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}
interface JapaneseRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
interface RecognitionWindow extends Window {
  SpeechRecognition?: new () => JapaneseRecognition;
  webkitSpeechRecognition?: new () => JapaneseRecognition;
}
function recognitionConstructor() {
  if (typeof window === 'undefined') return undefined;
  const browser = window as RecognitionWindow;
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

function ChallengeSession({ date, contentByLevel, progress, onComplete, onError }: DailyChallengeProps & { date: string }) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState<DailyResult>();
  const [listening, setListening] = useState(false);
  const [inputMode, setInputMode] = useState<'typed' | 'choice'>('typed');
  const [microphoneMessage, setMicrophoneMessage] = useState('');
  const recognition = useRef<JapaneseRecognition | null>(null);
  const submissionLock = useRef(false);
  const outcome = progress.challenges?.[date] ?? submitted;
  const question = getDailyQuestion(progress, contentByLevel, date);
  const supported = Boolean(recognitionConstructor());

  useEffect(() => () => {
    if (recognition.current) {
      recognition.current.onend = null;
      recognition.current.onerror = null;
      recognition.current.onresult = null;
      recognition.current.abort();
      recognition.current = null;
    }
  }, []);
  useEffect(() => {
    if (outcome && recognition.current) {
      recognition.current.stop();
      setListening(false);
    }
  }, [outcome]);

  const stopMicrophone = () => {
    recognition.current?.stop();
    setListening(false);
  };
  const startMicrophone = () => {
    const Constructor = recognitionConstructor();
    if (!Constructor || outcome) return;
    try {
      const instance = new Constructor();
      recognition.current = instance;
      instance.lang = 'ja-JP';
      instance.continuous = false;
      instance.interimResults = false;
      instance.onresult = event => {
        const transcript = Array.from(event.results).filter(result => result.isFinal).map(result => result[0].transcript).join('');
        if (transcript) {
          setAnswer(transcript.slice(0, 500));
          setMicrophoneMessage('Transcript ready. Check or edit it before submitting.');
        }
      };
      instance.onerror = event => {
        setListening(false);
        const message = `Japanese microphone input failed (${event.error}). You can still type your answer.`;
        setMicrophoneMessage(message);
        onError(message);
      };
      instance.onend = () => {
        setListening(false);
        if (recognition.current === instance) recognition.current = null;
      };
      setMicrophoneMessage('Listening for Japanese. Nothing is submitted automatically.');
      setListening(true);
      instance.start();
    } catch (error) {
      setListening(false);
      if (recognition.current) {
        recognition.current.onend = null;
        recognition.current.onerror = null;
        recognition.current.onresult = null;
        recognition.current = null;
      }
      const message = error instanceof Error ? error.message : 'Microphone could not start. Type your answer instead.';
      setMicrophoneMessage(message);
      onError(message);
    }
  };
  const submit = (value: string) => {
    if (!question || outcome || submissionLock.current || !value.trim() || value.length > 500) return;
    if (localDateKey() !== date) {
      onError('A new day has started. Please open today’s challenge.');
      return;
    }
    stopMicrophone();
    const result: DailyResult = {
      date, level: question.level, topic: question.topic, questionId: question.id, mode: question.mode,
      answer: value.trim(), correct: checkDailyAnswer(question, value), completedAt: Date.now(),
    };
    submissionLock.current = true;
    setSubmitted(result);
    onComplete(result);
  };

  return <section className="panel daily-challenge" aria-labelledby="daily-challenge-title">
    <span className="eyebrow">Daily challenge · {date}</span>
    <h2 id="daily-challenge-title">{outcome?.mode === 'listening' || question?.mode === 'listening' ? 'Listen and understand' : 'Build a Japanese sentence'}</h2>
    {!outcome && <p className="small">One attempt per day.</p>}
    {outcome ? <div className={`feedback ${outcome.correct ? 'correct' : 'incorrect'}`} role="status">
      <h3>{outcome.correct ? 'Correct' : 'Completed'}</h3>
      <p>{outcome.level} · {outcome.topic}</p>
      <p>Your answer: <strong>{outcome.answer}</strong></p>
      {question && <>
        <p>Expected answer: <strong>{question.answer}</strong></p>
        <p>{question.explanation}</p>
        {question.audio && <AudioButton text={question.audio} onError={onError} />}
      </>}
    </div> : !question ? <p role="status">Sentence content for your current level is loading or unavailable. Try again once the lessons have loaded.</p> : <>
      <p className="daily-level"><strong>{question.level}</strong></p>
      <h3>{question.prompt}</h3>
      {question.mode === 'listening' && <div className="button-row">
        <AudioButton text={question.audio} onError={onError} />
        <AudioButton text={question.audio} slow onError={onError} />
      </div>}
      <fieldset className="daily-answer-mode">
        <legend>Answer method</legend>
        <label><input type="radio" name="daily-answer-mode" checked={inputMode === 'typed'} onChange={() => setInputMode('typed')} />Type an answer</label>
        <label><input type="radio" name="daily-answer-mode" checked={inputMode === 'choice'} onChange={() => { stopMicrophone(); setInputMode('choice'); }} />Multiple choice</label>
      </fieldset>
      {inputMode === 'typed' ? <form onSubmit={event => { event.preventDefault(); submit(answer); }}>
        <label>{question.mode === 'listening' ? 'Japanese transcription or English meaning' : 'Your Japanese answer'}
          <input value={answer} maxLength={500} onChange={event => setAnswer(event.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={question.mode === 'sentence' ? 'Type the missing expression or requested Japanese sentence' : 'Type what you heard, or its meaning'} />
        </label>
        <div className="button-row">
          <button className="primary" disabled={!answer.trim() || listening}>Check daily answer</button>
          {supported && <button type="button" aria-pressed={listening} aria-describedby="daily-microphone-disclosure" onClick={listening ? stopMicrophone : startMicrophone}>{listening ? 'Stop microphone' : 'Use Japanese microphone'}</button>}
        </div>
        <p id="daily-microphone-disclosure" className="small">Microphone audio may be sent to your browser’s speech provider. Review the transcript before submitting.</p>
        {!supported && <p>Speech recognition is not supported in this browser. Please type your answer.</p>}
        <p role="status">{microphoneMessage}</p>
      </form> : <div className="choices" aria-label="Daily answer choices">{question.choices.map((choice, index) => <button key={`${index}-${choice}`} onClick={() => submit(choice)}>{choice}</button>)}</div>}
    </>}
  </section>;
}

export default function DailyChallenge(props: DailyChallengeProps) {
  const [date, setDate] = useState(() => localDateKey());
  useEffect(() => {
    const timer = window.setInterval(() => setDate(localDateKey()), 30000);
    const refresh = () => setDate(localDateKey());
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return <ChallengeSession key={date} {...props} date={date} />;
}
