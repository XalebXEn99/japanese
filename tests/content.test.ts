import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import type { ContentManifest, Level, LevelContent } from '../src/types';
import { buildUnits } from '../src/lib/study';

const root = resolve(import.meta.dirname, '..');
const levels: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const text = z.string().trim().min(1);
const vocabSchema = z.object({ id: text, word: text, reading: text, romaji: text, meanings: z.array(text).min(1), level: z.enum(levels), category: text });
const kanjiSchema = z.object({ id: text, character: text, onyomi: z.array(text), kunyomi: z.array(text), meanings: z.array(text).min(1), level: z.enum(levels), strokes: z.number().int().positive() });
const grammarSchema = z.object({
  id: text, title: text, level: z.enum(levels), explanation: z.string().min(70),
  examples: z.array(z.object({ ja: text, en: text, reading: text.optional() })).min(1),
  questions: z.array(z.object({ prompt: text, choices: z.array(text).min(3), answer: z.number().int().nonnegative(), explanation: z.string().min(25) })).min(1),
  source: text,
});
const levelSchema = z.object({ vocabulary: z.array(vocabSchema), kanji: z.array(kanjiSchema), grammar: z.array(grammarSchema) });
const json = async (name: string) => JSON.parse(await readFile(resolve(root, 'public', 'data', name), 'utf8'));

describe('persisted curriculum', () => {
  it('conforms to the application contract with accurate counts and licensed sources', async () => {
    const manifest: ContentManifest = await json('manifest.json');
    expect(manifest.sources.length).toBeGreaterThanOrEqual(6);
    for (const source of manifest.sources) {
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.license).toMatch(/CC BY/);
      expect(source.usage.length).toBeGreaterThan(30);
    }
    const ids = new Set<string>();
    let totalVocab = 0;
    let totalKanji = 0;
    const explanations = new Set<string>();
    for (const level of levels) {
      const content = levelSchema.parse(await json(`${level}.json`));
      expect(content.vocabulary.length).toBeGreaterThanOrEqual(600);
      expect(content.kanji.length).toBeGreaterThanOrEqual(80);
      expect(content.grammar).toHaveLength(20);
      expect(buildUnits(content, level)[0].id).toBe(`${level}-vocab-${content.vocabulary[0].id}`);
      expect(manifest.levels[level]).toEqual({ vocabulary: content.vocabulary.length, kanji: content.kanji.length, grammar: content.grammar.length });
      for (const entry of [...content.vocabulary, ...content.kanji, ...content.grammar]) {
        expect(entry.level).toBe(level);
        expect(ids.has(entry.id)).toBe(false);
        ids.add(entry.id);
      }
      for (const point of content.grammar) {
        expect(explanations.has(point.explanation)).toBe(false);
        explanations.add(point.explanation);
        for (const q of point.questions) {
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.choices.length);
          expect(new Set(q.choices).size).toBe(q.choices.length);
        }
      }
      totalVocab += content.vocabulary.length;
      totalKanji += content.kanji.length;
    }
    expect(totalVocab).toBe(7811);
    expect(totalKanji).toBe(2383);
    expect((await json('manifest.json')).levelAssignment).toMatch(/ESTIMATED/);
    const beginners: LevelContent = await json('N5.json');
    for (const word of ['会う', '青', '食べる', '飲む']) expect(beginners.vocabulary.some(v => v.word === word)).toBe(true);
  });

  it('contains both complete syllabaries and extended practice combinations', async () => {
    const kana = z.array(z.object({ id: text, character: text, romaji: text, kind: z.enum(['hiragana', 'katakana']), group: text })).parse(await json('kana.json'));
    expect(new Set(kana.map(k => k.id)).size).toBe(kana.length);
    for (const c of ['あ', 'ん', 'を', 'が', 'ぴ', 'きゃ', 'しゃ', 'ちゃ', 'ファ', 'ティ', 'ヴォ', 'イェ', 'っ', 'ッ']) expect(kana.some(k => k.character === c)).toBe(true);
    expect(kana.filter(k => k.kind === 'hiragana').length).toBe(kana.filter(k => k.kind === 'katakana').length);
  });

  it('uses exact primary-gloss themes with POS fallback without changing the first unit anchor', async () => {
    const all: LevelContent[] = await Promise.all(levels.map(level => json(`${level}.json`)));
    const words = all.flatMap(content => content.vocabulary);
    const themes: Record<string, string> = {
      family: 'People & family', food: 'Food & drink', travel: 'Travel & places',
      home: 'Home & daily life', school: 'School & work', nature: 'Nature & animals',
      body: 'Body & health', time: 'Numbers & time',
    };
    for (const [gloss, category] of Object.entries(themes)) {
      const entries = words.filter(word => word.meanings[0].toLowerCase() === gloss);
      expect(entries.length, gloss).toBeGreaterThan(0);
      for (const word of entries) expect(word.category).toBe(category);
    }
    for (const fallback of ['verbs', 'adjectives', 'adverbs', 'nouns', 'expressions']) {
      expect(words.some(word => word.category === fallback), fallback).toBe(true);
    }
    const primary = (gloss: string) => gloss.toLowerCase().replace(/\([^)]*\)/g, '').replace(/^to /, '').replace(/\s+/g, ' ').trim().replace(/[.;]$/, '');
    for (const word of words.filter(word => primary(word.meanings[0]) === 'food poisoning')) {
      expect(word.category).not.toBe('Food & drink');
    }
    for (let i = 0; i < levels.length; i++) expect(buildUnits(all[i], levels[i])[0].items[0].id).toBe(all[i].vocabulary[0].id);
  });

  it('supplies a licensed, numbered SVG for every curriculum kanji', async () => {
    const names = new Set(await readdir(resolve(root, 'public', 'strokes')));
    for (const level of levels) {
      const content: LevelContent = await json(`${level}.json`);
      for (let i = 0; i < content.kanji.length; i += 32) await Promise.all(content.kanji.slice(i, i + 32).map(async k => {
        const name = `${k.character.codePointAt(0)!.toString(16).padStart(5, '0')}.svg`;
        expect(names.has(name), name).toBe(true);
        const svg = await readFile(resolve(root, 'public', 'strokes', name), 'utf8');
        expect(svg).toContain('<svg');
        expect(svg).toContain('<path');
        expect(svg).toContain('StrokeNumbers');
        expect(svg).toContain('Creative Commons');
      }));
    }
    expect(await readFile(resolve(root, 'public', 'strokes', 'COPYING'), 'utf8')).toContain('License');
    expect((await readFile(resolve(root, 'public', 'grammar_guide.pdf'))).subarray(0, 4).toString()).toBe('%PDF');
  }, 60000);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('content requests', () => {
  it('uses the Pages base and caches each request', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetcher);
    const { loadKana, loadLevel, loadManifest } = await import('../src/data/content');
    const a = loadKana();
    const b = loadKana();
    expect(a).toBe(b);
    await Promise.all([a, b, loadLevel('N5'), loadManifest()]);
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      `${import.meta.env.BASE_URL}data/kana.json`,
      `${import.meta.env.BASE_URL}data/N5.json`,
      `${import.meta.env.BASE_URL}data/manifest.json`,
    ]);
  });

  it('reports HTTP, network and JSON failures and permits retry', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('bad'); } })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetcher);
    const { loadKana, loadLevel } = await import('../src/data/content');
    await expect(loadKana()).rejects.toThrow('404 Not Found');
    await expect(loadKana()).rejects.toThrow('offline');
    await expect(loadKana()).rejects.toThrow('invalid JSON');
    await expect(loadKana()).resolves.toEqual([]);
    await expect(loadLevel('N0' as Level)).rejects.toThrow('Unknown curriculum level');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
