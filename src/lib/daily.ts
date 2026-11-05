import { challengeSchema, localDaySchema, recordAnswer, type ChallengeOutcome, type Progress } from '../../shared/progress';
import { LEVELS, type Level, type LevelContent } from '../types';
import { isAnswerCorrect } from './study';

export type DailyResult = ChallengeOutcome & { date: string };
export interface DailyQuestion {
  id: string;
  level: Level;
  topic: string;
  mode: 'sentence' | 'listening';
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string;
  audio: string;
}
export type DailyContent = Partial<Record<Level, LevelContent>>;

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function currentLevel(progress: Progress): Level {
  let index = 0;
  while (index < LEVELS.length - 1 && progress.units[`level-${LEVELS[index]}`]?.passed) index++;
  return LEVELS[index];
}

export function dailyHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

// Original complete sentences: audio never reads a blank or reveals a missing expression.
const listeningSentences: Record<Level, readonly (readonly [string, string, string])[]> = {
  N5: [
    ['毎朝、パンを食べます。', 'I eat bread every morning.', 'Daily routines'],
    ['駅は学校の隣にあります。', 'The station is next to the school.', 'Location'],
    ['昨日、友達と映画を見ました。', 'I watched a film with a friend yesterday.', 'Past actions'],
    ['この本はあまり高くありません。', 'This book is not very expensive.', 'Negation'],
    ['日曜日に公園へ行きませんか。', 'Would you like to go to the park on Sunday?', 'Invitations'],
  ],
  N4: [
    ['日本に行ったことがあります。', 'I have been to Japan before.', 'Experience'],
    ['雨が降ったら、家で本を読みます。', 'If it rains, I will read a book at home.', 'Conditions'],
    ['出かける前に、窓を閉めておきます。', 'I will close the windows in preparation before going out.', 'Preparation'],
    ['音楽を聞きながら、料理をしています。', 'I am cooking while listening to music.', 'Simultaneous actions'],
    ['明日までに宿題を終わらせなければなりません。', 'I must finish my homework by tomorrow.', 'Obligation'],
  ],
  N3: [
    ['毎日練習したので、漢字が読めるようになりました。', 'Daily practice has made me able to read kanji.', 'Change in ability'],
    ['忙しいにもかかわらず、彼は手伝ってくれました。', 'Despite being busy, he helped me.', 'Concession'],
    ['忘れないうちに、予定を書いておきます。', 'I will write down the plan before I forget.', 'Time limits'],
    ['電車が遅れたせいで、会議に間に合いませんでした。', 'Because the train was delayed, I missed the start of the meeting.', 'Negative causes'],
    ['旅行に行くたびに、新しい友達ができます。', 'Every time I travel, I make new friends.', 'Repeated occasions'],
  ],
  N2: [
    ['実際に住んで初めて、その町の良さが分かりました。', 'Only after living there did I appreciate the town.', 'Only after'],
    ['年齢にかかわらず、誰でも参加できます。', 'Anyone can participate regardless of age.', 'Regardless of'],
    ['引き受けた以上、最後まで責任を持ちます。', 'Now that I have accepted, I will take responsibility to the end.', 'Commitment'],
    ['この店は値段のわりに、料理の質がいいです。', 'For the price, the food at this restaurant is good.', 'Unexpected comparisons'],
    ['新しい制度に伴って、手続きも変わります。', 'Procedures will also change along with the new system.', 'Accompanying change'],
  ],
  N1: [
    ['彼は知らせを聞くが早いか、部屋を飛び出した。', 'As soon as he heard the news, he rushed out of the room.', 'Immediate succession'],
    ['扉が開くや否や、人々が中へ押し寄せた。', 'The moment the doors opened, people surged inside.', 'Almost simultaneous'],
    ['長年の努力なくして、この成功はあり得なかった。', 'This success would not have been possible without years of effort.', 'Necessary conditions'],
    ['感謝の念に堪えません。', 'I am filled with an overwhelming sense of gratitude.', 'Strong emotions'],
    ['専門家といえども、間違えることはある。', 'Even experts sometimes make mistakes.', 'Concessive emphasis'],
  ],
};

export function listeningQuestions(level: Level): DailyQuestion[] {
  const rows = listeningSentences[level];
  return rows.map(([audio, answer, topic], index) => ({
    id: `daily-listening-${level}-${index + 1}`, level, topic, mode: 'listening',
    prompt: 'Listen to the complete Japanese sentence. What does it mean?',
    audio, answer, choices: [answer, ...rows.filter((_, i) => i !== index).slice(0, 3).map(row => row[1])],
    explanation: `${audio} — ${answer}`,
  }));
}

export function sentenceQuestions(content: LevelContent | undefined, level: Level): DailyQuestion[] {
  return (content?.grammar ?? []).flatMap(lesson => lesson.questions.flatMap((question, index) => {
    const answer = question.choices[question.answer];
    if (!answer || !/[\u3040-\u30ff\u3400-\u9fff]/u.test(answer) || question.choices.length < 2) return [];
    return [{
      id: `daily-sentence-${lesson.id}-${index}`, level, topic: lesson.title, mode: 'sentence' as const,
      prompt: question.prompt, choices: [...question.choices], answer, audio: '',
      explanation: question.explanation,
    }];
  }));
}

export function getDailyQuestion(progress: Progress, contentByLevel: DailyContent, date = localDateKey()): DailyQuestion | undefined {
  localDaySchema.parse(date);
  const saved = progress.challenges?.[date];
  const level = saved?.level ?? currentLevel(progress);
  const sentencePool = sentenceQuestions(contentByLevel[level], level);
  const listeningPool = listeningQuestions(level);
  if (saved) return [...sentencePool, ...listeningPool].find(question => question.id === saved.questionId);
  const mode = Number(date.slice(-2)) % 2 === 0 ? 'listening' : 'sentence';
  // Prefer authored completion questions; retain substantive sentence choices when no blanks exist.
  const blanks = sentencePool.filter(question => /[＿_□]|[（(]\s*[）)]/.test(question.prompt));
  const pool = mode === 'listening' ? listeningPool : blanks.length ? blanks : sentencePool;
  if (!pool.length) return undefined;
  const selected = pool[dailyHash(`${date}:${level}`) % pool.length];
  const choices = [...selected.choices].sort((a, b) => dailyHash(`${date}:${selected.id}:${a}`) - dailyHash(`${date}:${selected.id}:${b}`) || a.localeCompare(b));
  return { ...selected, choices };
}

export function checkDailyAnswer(question: DailyQuestion, answer: string): boolean {
  return Boolean(answer.trim()) && (question.mode === 'listening'
    ? isAnswerCorrect(answer, [question.audio]) || answer.normalize('NFKC').trim().toLowerCase().replace(/[.!?。！？]+$/u, '') === question.answer.normalize('NFKC').trim().toLowerCase().replace(/[.!?。！？]+$/u, '')
    : isAnswerCorrect(answer, [question.answer]));
}

export function recordDailyChallenge(progress: Progress, result: DailyResult): Progress {
  const date = localDaySchema.parse(result.date);
  if (progress.challenges?.[date]) return progress;
  const { date: _date, ...value } = result;
  const outcome = challengeSchema.parse(value);
  if (localDateKey(new Date(outcome.completedAt)) !== date) throw new Error('The daily challenge date does not match the submission time.');
  const next = recordAnswer(progress, outcome.correct, outcome.completedAt);
  return { ...next, challenges: { ...progress.challenges, [date]: outcome } };
}

export function challengeStreak(progress: Progress, date = new Date()): number {
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  if (!progress.challenges?.[localDateKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (progress.challenges?.[localDateKey(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function reviewDays(progress: Progress, date = new Date(), count = 14) {
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate() - count + index + 1, 12);
    const key = localDateKey(day);
    const outcome = progress.challenges?.[key];
    const activity = progress.activity?.[key];
    return {
      date: key, answers: activity?.answers ?? Number(Boolean(outcome)), correct: activity?.correct ?? Number(Boolean(outcome?.correct)),
      challenge: Boolean(outcome),
    };
  });
}
