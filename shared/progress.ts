import { z } from 'zod';

export const localDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
export const challengeSchema = z.object({
  level: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']),
  topic: z.string().min(1).max(500),
  questionId: z.string().min(1).max(200),
  correct: z.boolean(),
  answer: z.string().min(1).max(500),
  completedAt: z.number().finite().nonnegative(),
  mode: z.enum(['sentence', 'listening']),
}).strict();
export const activitySchema = z.object({
  answers: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
}).refine(value => value.correct <= value.answers, 'Correct answers cannot exceed attempts');
export type ChallengeOutcome = z.infer<typeof challengeSchema>;

export const cardSchema = z.object({
  due: z.number().finite().nonnegative(),
  interval: z.number().finite().nonnegative().max(36500),
  ease: z.number().finite().min(1.3).max(5),
  repetitions: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  reviewedAt: z.number().finite().nonnegative().default(0),
});
export const progressSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  cards: z.record(z.string().max(200), cardSchema),
  units: z.record(z.string().max(200), z.object({
    score: z.number().min(0).max(100),
    passed: z.boolean(),
    updatedAt: z.number().finite().nonnegative(),
  })),
  stats: z.object({
    answers: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    studyDays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(36500),
  }),
  settings: z.object({
    showRomaji: z.boolean(),
    showFurigana: z.boolean(),
    dailyGoal: z.number().int().min(1).max(500),
  }),
  challenges: z.record(localDaySchema, challengeSchema).default({}),
  activity: z.record(localDaySchema, activitySchema).default({}),
}).strict();
export type Progress = z.infer<typeof progressSchema>;
export type CardProgress = z.infer<typeof cardSchema>;

export function emptyProgress(): Progress {
  return {
    version: 1, updatedAt: new Date(0).toISOString(), cards: {}, units: {}, challenges: {}, activity: {},
    stats: { answers: 0, correct: 0, studyDays: [] },
    settings: { showRomaji: true, showFurigana: true, dailyGoal: 20 },
  };
}

export function scheduleCard(previous: CardProgress | undefined, rating: 'again' | 'hard' | 'good' | 'easy', now = Date.now()): CardProgress {
  const card = previous ?? { due: now, interval: 0, ease: 2.5, repetitions: 0, lapses: 0, reviewedAt: 0 };
  if (rating === 'again') {
    return { ...card, reviewedAt: now, due: now + 600000, interval: 0, repetitions: 0, lapses: card.lapses + 1, ease: Math.max(1.3, card.ease - 0.2) };
  }
  const ease = Math.min(5, Math.max(1.3, card.ease + (rating === 'easy' ? 0.15 : rating === 'hard' ? -0.15 : 0)));
  const interval = card.repetitions === 0 ? (rating === 'easy' ? 4 : 1)
    : card.repetitions === 1 ? (rating === 'hard' ? 3 : 6)
      : Math.min(36500, Math.max(1, Math.round(card.interval * (rating === 'hard' ? 1.2 : ease) * (rating === 'easy' ? 1.3 : 1))));
  return { ...card, reviewedAt: now, interval, due: now + interval * 86400000, ease, repetitions: card.repetitions + 1 };
}

export function recordAnswer(progress: Progress, correct: boolean, now = Date.now()): Progress {
  const date = new Date(now);
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const activity = progress.activity?.[today] ?? { answers: 0, correct: 0 };
  return {
    ...progress, updatedAt: date.toISOString(),
    activity: {
      ...progress.activity,
      [today]: { answers: activity.answers + 1, correct: activity.correct + Number(correct) },
    },
    stats: {
      answers: progress.stats.answers + 1,
      correct: progress.stats.correct + Number(correct),
      studyDays: [...new Set([...progress.stats.studyDays, today])],
    },
  };
}

export function mergeProgress(a: Progress, b: Progress): Progress {
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  const cards = { ...a.cards };
  for (const [id, card] of Object.entries(b.cards)) {
    const current = cards[id];
    if (!current || card.reviewedAt > current.reviewedAt || (card.reviewedAt === current.reviewedAt && card.lapses > current.lapses)) cards[id] = card;
  }
  const units = { ...a.units };
  for (const [id, result] of Object.entries(b.units)) {
    const current = units[id];
    if (!current || result.score > current.score || (result.score === current.score && result.updatedAt > current.updatedAt)) units[id] = result;
  }
  const challenges = { ...a.challenges };
  for (const [day, result] of Object.entries(b.challenges ?? {})) {
    const current = challenges[day];
    // A daily answer is immutable; earlier submissions win across devices.
    if (!current || result.completedAt < current.completedAt
      || (result.completedAt === current.completedAt && JSON.stringify(result) < JSON.stringify(current))) challenges[day] = result;
  }
  const activity = { ...a.activity };
  for (const [day, result] of Object.entries(b.activity ?? {})) {
    const current = activity[day];
    activity[day] = {
      answers: Math.max(current?.answers ?? 0, result.answers),
      correct: Math.max(current?.correct ?? 0, result.correct),
    };
  }
  return {
    ...newer, cards, units, challenges, activity, updatedAt: new Date().toISOString(),
    stats: {
      answers: Math.max(a.stats.answers, b.stats.answers),
      correct: Math.max(a.stats.correct, b.stats.correct),
      studyDays: [...new Set([...a.stats.studyDays, ...b.stats.studyDays])].sort(),
    },
  };
}
