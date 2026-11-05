import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildExpandedGrammar } from '../scripts/grammar-data';
import type { Level, LevelContent } from '../src/types';

const levels: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const dataDirectory = resolve(import.meta.dirname, '..', 'public', 'data');
const readJSON = async (name: string) => JSON.parse(await readFile(resolve(dataDirectory, name), 'utf8'));

describe('expanded original grammar curriculum', () => {
  it('persists all 100 expanded lessons and preserves their established identifiers and titles', async () => {
    const source = await readJSON('grammar-source.json');
    const authored = buildExpandedGrammar(source);
    let lessonCount = 0;
    let exampleCount = 0;
    let questionCount = 0;
    const ids = new Set<string>();
    const exampleSentences = new Set<string>();
    const questionPrompts = new Set<string>();

    for (const level of levels) {
      const content: LevelContent = await readJSON(`${level}.json`);
      expect(content.grammar).toEqual(authored[level]);
      expect(content.grammar).toHaveLength(20);

      for (const [index, lesson] of content.grammar.entries()) {
        expect(lesson.id).toBe(`grammar-${level}-${String(index + 1).padStart(2, '0')}`);
        expect(lesson.title).toBe(source[level][index][0]);
        expect(lesson.level).toBe(level);
        expect(ids.has(lesson.id)).toBe(false);
        ids.add(lesson.id);
        expect(lesson.explanation.length).toBeGreaterThanOrEqual(300);
        expect(lesson.explanation).toContain('\n\nFormation: ');
        expect(lesson.explanation).toContain('\n\nUsage and cautions: ');
        expect(lesson.source).toContain('Original curriculum; CC BY-SA 4.0');
        expect(lesson.examples.length).toBeGreaterThanOrEqual(3);
        expect(lesson.questions.length).toBeGreaterThanOrEqual(5);
        expect(lesson.examples.filter(example => example.reading).length).toBeGreaterThanOrEqual(2);

        for (const example of lesson.examples) {
          expect(example.ja.trim().length).toBeGreaterThan(3);
          expect(example.ja).toMatch(/[ぁ-んァ-ン一-龯]/u);
          expect(example.en.trim().length).toBeGreaterThan(5);
          if (example.reading) expect(example.reading).toMatch(/[ぁ-んァ-ン]/u);
          expect(exampleSentences.has(example.ja), `Repeated example: ${example.ja}`).toBe(false);
          exampleSentences.add(example.ja);
        }

        const exerciseSignatures = new Set<string>();
        for (const question of lesson.questions) {
          expect(question.prompt.trim().length).toBeGreaterThan(8);
          expect(questionPrompts.has(question.prompt), `Repeated prompt: ${question.prompt}`).toBe(false);
          questionPrompts.add(question.prompt);
          expect(question.choices).toHaveLength(4);
          expect(question.choices.every(choice => choice.trim().length > 0)).toBe(true);
          expect(new Set(question.choices).size).toBe(4);
          expect(Number.isInteger(question.answer)).toBe(true);
          expect(question.answer).toBeGreaterThanOrEqual(0);
          expect(question.answer).toBeLessThan(question.choices.length);
          expect(question.explanation.trim().length).toBeGreaterThanOrEqual(35);
          const signature = [...question.choices].sort().join('\0');
          expect(exerciseSignatures.has(signature), 'An exercise must not just reshuffle an existing choice set').toBe(false);
          exerciseSignatures.add(signature);
        }

        expect(lesson.questions.filter(question => question.prompt.startsWith('Choose the best English meaning:'))).toHaveLength(2);
        expect(lesson.questions.filter(question => !question.prompt.startsWith('Choose the best English meaning:')).length).toBeGreaterThanOrEqual(3);
        lessonCount++;
        exampleCount += lesson.examples.length;
        questionCount += lesson.questions.length;
      }
    }

    expect(lessonCount).toBe(100);
    expect(exampleCount).toBeGreaterThanOrEqual(300);
    expect(questionCount).toBeGreaterThanOrEqual(500);
  });

  it('rejects a partial authored curriculum rather than silently publishing unexpanded lessons', async () => {
    const source = await readJSON('grammar-source.json');
    expect(() => buildExpandedGrammar({ ...source, N5: source.N5.slice(1) })).toThrow('Missing grammar supplements for N5');
  });
});
