import { describe, expect, it } from 'vitest';
import { buildUnits, isAnswerCorrect, makeQuestions, shuffle, type StudyItem } from '../src/lib/study';
import { emptyProgress, mergeProgress, progressSchema, recordAnswer, scheduleCard } from '../shared/progress';
import { gradeHandwriting, resample } from '../src/lib/handwriting';
import type { LevelContent } from '../src/types';

const item = (id: string, reading: string): StudyItem => ({ id, prompt: reading, reading, kind: 'vocabulary', romaji: '', meanings: ['word'], accepted: [reading], audio: reading });
describe('answer checking', () => {
  it('accepts Japanese scripts, romaji, case and full-width equivalents', () => {
    expect(isAnswerCorrect(' ＳＨＩ ', ['し'])).toBe(true);
    expect(isAnswerCorrect('シ', ['し'])).toBe(true);
    expect(isAnswerCorrect('si', ['し'])).toBe(true);
    expect(isAnswerCorrect('tsu', ['つ'])).toBe(true);
    expect(isAnswerCorrect('kyo', ['きょ'])).toBe(true);
    expect(isAnswerCorrect('きよ', ['きょ'])).toBe(false);
    expect(isAnswerCorrect('し', ['ち'])).toBe(false);
  });
  it('does not silently accept a wrong answer', () => {
    expect(isAnswerCorrect('', ['し'])).toBe(false);
    expect(isAnswerCorrect('cat', ['dog'])).toBe(false);
  });
  it('creates unique choices including the right answer', () => {
    const items = [item('a', 'あ'), item('b', 'い'), item('c', 'う'), item('d', 'え'), item('e', 'お')];
    for (const q of makeQuestions(items, items)) {
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices).toContain(q.answer);
    }
  });
  it('does not mutate shuffled inputs', () => {
    const original = [1, 2, 3];
    expect(shuffle(original, () => 0)).not.toBe(original);
    expect(original).toEqual([1, 2, 3]);
  });
  it('tests English meanings as well as readings', () => {
    const word = { ...item('cat', 'ねこ'), prompt: '猫', meanings: ['cat'] };
    const question = makeQuestions([word], [word], 1, 'choice', 'meaning')[0];
    expect(question.prompt).toBe('What does 猫 mean?');
    expect(question.answer).toBe('cat');
    expect(question.accepted).toContain('cat');
  });
});
describe('progress and spaced repetition', () => {
  it('schedules again for ten minutes and successful first review for one day', () => {
    expect(scheduleCard(undefined, 'again', 1000).due).toBe(601000);
    expect(scheduleCard(undefined, 'good', 1000).due).toBe(86401000);
    expect(scheduleCard(undefined, 'easy', 1000).interval).toBe(4);
  });
  it('increases good intervals and bounds ease', () => {
    let card = scheduleCard(undefined, 'good', 1000);
    card = scheduleCard(card, 'good', 2000);
    expect(card.interval).toBe(6);
    card = scheduleCard(card, 'good', 3000);
    expect(card.interval).toBe(15);
    for (let i = 0; i < 50; i++) card = scheduleCard(card, 'again', 4000 + i);
    expect(card.ease).toBe(1.3);
    expect(progressSchema.safeParse({ ...emptyProgress(), cards: { test: card } }).success).toBe(true);
  });
  it('merges most recent review, not the furthest due date', () => {
    const a = emptyProgress(), b = emptyProgress();
    a.cards.x = scheduleCard(undefined, 'easy', 1000);
    b.cards.x = scheduleCard(a.cards.x, 'again', 2000);
    a.units.u = { score: 90, passed: true, updatedAt: 1000 };
    b.units.u = { score: 50, passed: false, updatedAt: 2000 };
    const merged = mergeProgress(a, b);
    expect(merged.cards.x.lapses).toBe(1);
    expect(merged.cards.x.due).toBe(602000);
    expect(merged.units.u.score).toBe(90);
    expect(merged.units.u.passed).toBe(true);
  });
  it('restores settings from the server on a new device', () => {
    const server = emptyProgress();
    server.updatedAt = new Date().toISOString();
    server.settings.showRomaji = false;
    expect(mergeProgress(emptyProgress(), server).settings.showRomaji).toBe(false);
  });
  it('records unique study days and correct totals', () => {
    const p = recordAnswer(recordAnswer(emptyProgress(), true), false);
    expect(p.stats).toMatchObject({ answers: 2, correct: 1 });
    expect(p.stats.studyDays).toHaveLength(1);
    expect(p.stats.studyDays[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('rejects invalid imports', () => {
    expect(progressSchema.safeParse({ ...emptyProgress(), version: 2 }).success).toBe(false);
    expect(progressSchema.safeParse({ ...emptyProgress(), settings: { dailyGoal: -1 } }).success).toBe(false);
  });
});
describe('handwriting feedback', () => {
  const model = [[{ x: 10, y: 30 }, { x: 100, y: 30 }]];
  it('recognises a correct stroke and rejects wrong count/direction/location', () => {
    expect(gradeHandwriting(model, model)).toMatchObject({ passed: true, score: 100 });
    expect(gradeHandwriting([], model).passed).toBe(false);
    expect(gradeHandwriting([[...model[0]].reverse()], model).passed).toBe(false);
    expect(gradeHandwriting([[{ x: 10, y: 90 }, { x: 100, y: 90 }]], model).passed).toBe(false);
  });
  it('resamples a single tap without errors but does not accept it as a long stroke', () => {
    expect(resample([{ x: 10, y: 10 }])).toHaveLength(24);
    expect(gradeHandwriting([[{ x: 50, y: 30 }]], model).passed).toBe(false);
  });
});
describe('curriculum construction', () => {
  it('includes every item exactly once in stable interleaved units', () => {
    const content: LevelContent = { vocabulary: [{ id: 'v1', word: '猫', reading: 'ねこ', romaji: 'neko', meanings: ['cat'], category: 'Animals', level: 'N5' }], kanji: [{ id: 'k1', character: '一', onyomi: ['イチ'], kunyomi: ['ひと'], meanings: ['one'], level: 'N5', strokes: 1 }], grammar: [{ id: 'g1', title: 'です', level: 'N5', explanation: 'Polite copula.', examples: [], questions: [{ prompt: 'X', answer: 0, choices: ['a', 'b'], explanation: 'A' }] }] };
    const units = buildUnits(content, 'N5');
    expect(units.map(u => u.kind)).toEqual(['Vocabulary', 'Grammar', 'Kanji']);
    expect(units.flatMap(u => u.items).map(i => i.id).sort()).toEqual(['g1', 'k1', 'v1']);
    expect(new Set(units.map(u => u.id)).size).toBe(units.length);
  });
});
