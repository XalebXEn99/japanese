import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyProgress, mergeProgress, progressSchema, recordAnswer } from '../shared/progress';
import {
  challengeStreak, checkDailyAnswer, currentLevel, getDailyQuestion, listeningQuestions,
  localDateKey, recordDailyChallenge, reviewDays, sentenceQuestions, type DailyContent, type DailyResult,
} from '../src/lib/daily';
import { LEVELS, type Level, type LevelContent } from '../src/types';
import DailyChallenge from '../src/components/DailyChallenge';
import ReviewInsights from '../src/components/ReviewInsights';

const now = new Date(2026, 10, 5, 14).getTime();
const date = localDateKey(new Date(now));
const result = (overrides: Partial<DailyResult> = {}): DailyResult => ({
  date, level: 'N5', topic: 'Topic marker', questionId: 'daily-sentence-g-N5-0',
  correct: false, answer: 'を', completedAt: now, mode: 'sentence', ...overrides,
});
const content = (level: Level): LevelContent => ({
  vocabulary: [], kanji: [],
  grammar: [{
    id: `g-${level}`, title: 'Topic marker', level, explanation: 'Marks the topic.', examples: [],
    questions: [
      { prompt: 'Complete: 私＿学生です。', choices: ['は', 'を', 'で'], answer: 0, explanation: 'は marks the topic.' },
      { prompt: 'Complete: 本＿読みます。', choices: ['が', 'を', 'で'], answer: 1, explanation: 'を marks the object.' },
      { prompt: 'Which form?', choices: ['Dictionary form', 'Past form'], answer: 0, explanation: 'A form label is not a sentence challenge.' },
    ],
  }],
});
const byLevel: DailyContent = Object.fromEntries(LEVELS.map(level => [level, content(level)]));

describe('daily progress compatibility', () => {
  it('loads version-one data with new defaults and remains strict', () => {
    const { challenges: _challenges, activity: _activity, ...legacy } = emptyProgress();
    expect(progressSchema.parse(legacy)).toMatchObject({ version: 1, challenges: {}, activity: {} });
    expect(progressSchema.safeParse({ ...legacy, arbitrary: true }).success).toBe(false);
    expect(progressSchema.parse({ ...legacy, challenges: { [date]: resultWithoutDate(result()) } }).challenges[date].correct).toBe(false);
  });
  it('validates dates, bounded answers, levels, modes and timestamps', () => {
    for (const invalid of [
      { level: 'N0' }, { mode: 'quiz' }, { answer: 'a'.repeat(501) }, { completedAt: -1 }, { questionId: '' },
    ]) {
      expect(progressSchema.safeParse({
        ...emptyProgress(), challenges: { [date]: { ...resultWithoutDate(result()), ...invalid } },
      }).success).toBe(false);
    }
    for (const invalidDate of ['2026-02-31', '2026-13-01', '2026-2-01', 'not-a-date']) {
      expect(progressSchema.safeParse({ ...emptyProgress(), challenges: { [invalidDate]: resultWithoutDate(result()) } }).success).toBe(false);
    }
    expect(progressSchema.safeParse({ ...emptyProgress(), activity: { [date]: { answers: 1, correct: 2 } } }).success).toBe(false);
  });
  it('records only the first daily outcome and counts it once with other practice', () => {
    const first = recordDailyChallenge(emptyProgress(), result());
    const duplicate = recordDailyChallenge(first, result({ correct: true, answer: 'は', completedAt: now + 100 }));
    expect(duplicate).toBe(first);
    expect(duplicate.challenges[date]).toMatchObject({ correct: false, answer: 'を' });
    expect(duplicate.stats).toMatchObject({ answers: 1, correct: 0, studyDays: [date] });
    expect(duplicate.activity[date]).toEqual({ answers: 1, correct: 0 });
    const practice = recordAnswer(duplicate, true, now + 200);
    expect(practice.stats).toMatchObject({ answers: 2, correct: 1, studyDays: [date] });
    expect(practice.activity[date]).toEqual({ answers: 2, correct: 1 });
    expect(practice.challenges).toEqual(first.challenges);
  });
  it('refuses a mismatch between the local day and completion time', () => {
    expect(() => recordDailyChallenge(emptyProgress(), result({ date: '2026-11-04' }))).toThrow(/date/);
  });
  it('merges the earliest daily submission regardless of device update time', () => {
    const earlier = recordDailyChallenge(emptyProgress(), result());
    const later = recordDailyChallenge(emptyProgress(), result({ correct: true, answer: 'は', completedAt: now + 100 }));
    earlier.updatedAt = new Date(now + 10000).toISOString();
    for (const merged of [mergeProgress(earlier, later), mergeProgress(later, earlier)]) {
      expect(merged.challenges[date]).toEqual(earlier.challenges[date]);
      expect(merged.stats.answers).toBe(1);
      expect(merged.activity[date].answers).toBe(1);
      expect(progressSchema.safeParse(merged).success).toBe(true);
    }
  });
  it('resolves simultaneous device conflicts deterministically', () => {
    const a = recordDailyChallenge(emptyProgress(), result());
    const b = recordDailyChallenge(emptyProgress(), result({ correct: true, answer: 'は' }));
    expect(mergeProgress(a, b).challenges).toEqual(mergeProgress(b, a).challenges);
  });
});

describe('daily level and question selection', () => {
  it('advances only through contiguous passed level tests and caps at N1', () => {
    const progress = emptyProgress();
    progress.units['level-N3'] = { passed: true, score: 100, updatedAt: now };
    expect(currentLevel(progress)).toBe('N5');
    progress.units['level-N5'] = { passed: true, score: 80, updatedAt: now };
    expect(currentLevel(progress)).toBe('N4');
    progress.units['level-N4'] = { passed: false, score: 70, updatedAt: now };
    expect(currentLevel(progress)).toBe('N4');
    progress.units['level-N4'].passed = true;
    expect(currentLevel(progress)).toBe('N2');
    progress.units['level-N2'] = { passed: true, score: 80, updatedAt: now };
    progress.units['level-N1'] = { passed: true, score: 80, updatedAt: now };
    expect(currentLevel(progress)).toBe('N1');
  });
  it('is deterministic without mutating source arrays and uses source question answers', () => {
    const original = JSON.stringify(byLevel);
    const first = getDailyQuestion(emptyProgress(), byLevel, date)!;
    expect(getDailyQuestion(emptyProgress(), byLevel, date)).toEqual(first);
    expect(first.mode).toBe('sentence');
    expect(first.choices).toContain(first.answer);
    expect(first.prompt).toContain('＿');
    expect(sentenceQuestions(byLevel.N5, 'N5')).toHaveLength(2);
    expect(JSON.stringify(byLevel)).toBe(original);
    expect(checkDailyAnswer(first, first.answer)).toBe(true);
    expect(checkDailyAnswer(first, '違う')).toBe(false);
    expect(checkDailyAnswer(first, '')).toBe(false);
  });
  it('keeps the submitted level and question after a same-day promotion', () => {
    const first = getDailyQuestion(emptyProgress(), byLevel, date)!;
    const progress = recordDailyChallenge(emptyProgress(), result({
      questionId: first.id, answer: first.answer, level: first.level, topic: first.topic, correct: true,
    }));
    progress.units['level-N5'] = { passed: true, score: 100, updatedAt: now + 1 };
    expect(currentLevel(progress)).toBe('N4');
    expect(getDailyQuestion(progress, byLevel, date)?.id).toBe(first.id);
    expect(getDailyQuestion(progress, byLevel, date)?.level).toBe('N5');
  });
  it('provides at least five complete listening sentences per level and no blank audio', () => {
    for (const level of LEVELS) {
      const questions = listeningQuestions(level);
      expect(questions.length).toBeGreaterThanOrEqual(5);
      expect(new Set(questions.map(question => question.id)).size).toBe(questions.length);
      for (const question of questions) {
        expect(question.audio).toMatch(/[。！？]$/);
        expect(question.audio).not.toMatch(/[＿_□]/);
        expect(question.choices).toContain(question.answer);
        expect(new Set(question.choices).size).toBe(question.choices.length);
        expect(checkDailyAnswer(question, question.audio)).toBe(true);
        expect(checkDailyAnswer(question, question.answer)).toBe(true);
        expect(checkDailyAnswer(question, 'Wrong meaning')).toBe(false);
      }
    }
    expect(getDailyQuestion(emptyProgress(), {}, '2026-11-06')?.mode).toBe('listening');
    expect(getDailyQuestion(emptyProgress(), {}, date)).toBeUndefined();
  });
});

describe('review analytics', () => {
  it('uses local calendar keys and calendar adjacency across a month boundary', () => {
    const local = new Date(2026, 2, 1, 0, 5);
    expect(localDateKey(local)).toBe('2026-03-01');
    const progress = emptyProgress();
    for (const key of ['2026-02-27', '2026-02-28']) progress.challenges[key] = resultWithoutDate(result());
    expect(challengeStreak(progress, local)).toBe(2);
    progress.challenges['2026-03-01'] = resultWithoutDate(result());
    expect(challengeStreak(progress, local)).toBe(3);
    expect(challengeStreak(progress, new Date(2026, 2, 3))).toBe(0);
  });
  it('reports exactly 14 ordered dates, zero days, and no fabricated legacy counts', () => {
    const progress = recordDailyChallenge(emptyProgress(), result());
    progress.stats.answers = 500;
    const days = reviewDays(progress, new Date(now));
    expect(days).toHaveLength(14);
    expect(days[0].date).toBe('2026-10-23');
    expect(days.at(-1)).toEqual({ date, answers: 1, correct: 0, challenge: true });
    expect(days.reduce((sum, day) => sum + day.answers, 0)).toBe(1);
  });
  it('renders numeric equivalents, topic accuracy, and accessible graph labelling', () => {
    const progress = recordDailyChallenge(emptyProgress(), result());
    const html = renderToStaticMarkup(createElement(ReviewInsights, { progress, contentByLevel: byLevel }));
    expect(html).toContain('role="img"');
    expect(html).toContain('Practice answers over the last 14 local calendar days');
    expect(html).toContain('Show daily activity numbers');
    expect(html).toContain('N5 · Topic marker');
    expect(html).toContain('0 / 1');
  });
  it('renders saved feedback without a second submission form', () => {
    const progress = recordDailyChallenge(emptyProgress(), { ...result(), date: localDateKey(), completedAt: Date.now() });
    const html = renderToStaticMarkup(createElement(DailyChallenge, {
      progress, contentByLevel: byLevel, onComplete: () => { throw new Error('Must not submit on render'); }, onError: () => undefined,
    }));
    expect(html).toContain('Your answer:');
    expect(html).toContain('Completed');
    expect(html).not.toContain('Check daily answer');
    expect(html).not.toContain('Use Japanese microphone');
  });
});

function resultWithoutDate(value: DailyResult) {
  const { date: _date, ...outcome } = value;
  return outcome;
}
