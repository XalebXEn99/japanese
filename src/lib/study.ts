import { toHiragana, toRomaji } from 'wanakana';
import type { Grammar, Kana, Kanji, LevelContent, Vocabulary } from '../types';

export interface StudyItem {
  id: string;
  kind: 'kana' | 'vocabulary' | 'kanji' | 'grammar';
  prompt: string;
  reading: string;
  romaji: string;
  meanings: string[];
  accepted: string[];
  audio: string;
  character?: string;
  grammar?: Grammar;
}
export interface Unit {
  id: string;
  title: string;
  kind: string;
  items: StudyItem[];
}
export function kanaItem(k: Kana): StudyItem {
  return { id: k.id, kind: 'kana', prompt: k.character, reading: k.character, romaji: k.romaji, meanings: [k.romaji], accepted: [k.romaji, k.character], audio: k.character, character: k.character };
}
export function vocabularyItem(v: Vocabulary): StudyItem {
  return { id: v.id, kind: 'vocabulary', prompt: v.word, reading: v.reading, romaji: v.romaji || toRomaji(v.reading), meanings: v.meanings, accepted: [v.reading, v.romaji || toRomaji(v.reading)], audio: v.reading };
}
export function kanjiItem(k: Kanji): StudyItem {
  const readings = [...k.onyomi, ...k.kunyomi];
  return { id: k.id, kind: 'kanji', prompt: k.character, reading: readings.join(' · '), romaji: readings.map(r => toRomaji(r)).join(' · '), meanings: k.meanings, accepted: [...k.meanings], audio: readings[0]?.replace(/[.-]/g, '') || k.character, character: k.character };
}
export function grammarItem(g: Grammar): StudyItem {
  return { id: g.id, kind: 'grammar', prompt: g.title, reading: '', romaji: '', meanings: [g.explanation], accepted: [], audio: g.examples[0]?.ja || '', grammar: g };
}
export function allItems(content: LevelContent): StudyItem[] {
  return [...content.vocabulary.map(vocabularyItem), ...content.kanji.map(kanjiItem), ...content.grammar.map(grammarItem)];
}
export function buildUnits(content: LevelContent, level: string): Unit[] {
  const groups = new Map<string, StudyItem[]>();
  for (const word of content.vocabulary) {
    const category = word.category || 'General';
    const list = groups.get(category) ?? [];
    list.push(vocabularyItem(word));
    groups.set(category, list);
  }
  const vocab: Unit[] = [];
  for (const [category, items] of groups) {
    for (let i = 0; i < items.length; i += 15) {
      vocab.push({ id: `${level}-vocab-${items[i].id}`, title: `${category}${items.length > 15 ? ` ${Math.floor(i / 15) + 1}` : ''}`, kind: 'Vocabulary', items: items.slice(i, i + 15) });
    }
  }
  const kanji: Unit[] = [];
  for (let i = 0; i < content.kanji.length; i += 10) kanji.push({
    id: `${level}-kanji-${i}`, title: `Kanji ${Math.floor(i / 10) + 1}`, kind: 'Kanji', items: content.kanji.slice(i, i + 10).map(kanjiItem),
  });
  const grammar = content.grammar.map(g => ({ id: `${level}-grammar-${g.id}`, title: g.title, kind: 'Grammar', items: [grammarItem(g)] }));
  const units: Unit[] = [];
  for (let i = 0; i < Math.max(vocab.length, kanji.length, grammar.length); i++) {
    if (vocab[i]) units.push(vocab[i]);
    if (grammar[i]) units.push(grammar[i]);
    if (kanji[i]) units.push(kanji[i]);
  }
  return units;
}
export function shuffle<T>(values: readonly T[], random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function normalizeAnswer(value: string): string {
  return toHiragana(value.normalize('NFKC').trim().toLowerCase(), { passRomaji: false }).replace(/[\s・.、。!?！？，,]/g, '');
}
export function isAnswerCorrect(answer: string, accepted: string[]): boolean {
  return accepted.some(value => normalizeAnswer(value) === normalizeAnswer(answer));
}
export interface Question {
  id: string;
  prompt: string;
  audio: string;
  answer: string;
  accepted: string[];
  choices: string[];
  explanation: string;
  item: StudyItem;
}
export function makeQuestions(items: StudyItem[], pool: StudyItem[], limit = 15, mode: 'choice' | 'typed' | 'listening' = 'choice', direction: 'reading' | 'meaning' | 'mixed' = 'reading'): Question[] {
  const result: Question[] = [];
  for (const item of shuffle(items)) {
    if (item.grammar) {
      for (const [index, q] of item.grammar.questions.entries()) {
        result.push({ id: `${item.id}-${index}`, prompt: q.prompt, audio: '', answer: q.choices[q.answer], accepted: [q.choices[q.answer]], choices: q.choices, explanation: q.explanation, item });
      }
      continue;
    }
    const meaningQuestion = item.kind === 'kanji' || (item.kind === 'vocabulary' && (direction === 'meaning' || (direction === 'mixed' && Math.random() < 0.5)));
    const answer = meaningQuestion ? item.meanings[0] : item.kind === 'kana' ? item.romaji : item.reading;
    const others = pool.filter(p => p.kind === item.kind && p.id !== item.id);
    const distractors = shuffle([...new Set(others.map(p => meaningQuestion ? p.meanings[0] : p.kind === 'kana' ? p.romaji : p.reading))].filter(a => a && !isAnswerCorrect(a, [answer])));
    result.push({
      id: item.id,
      prompt: mode === 'listening' && item.kind !== 'kanji' ? 'Listen, then give the reading.' : meaningQuestion ? `What does ${item.prompt} mean?` : `Read ${item.prompt}`,
      audio: item.audio, answer,
      accepted: meaningQuestion ? item.meanings : mode === 'typed' ? item.accepted : [answer],
      choices: shuffle([answer, ...distractors.slice(0, 3)]),
      explanation: `${item.prompt} — ${item.reading}${item.romaji ? ` (${item.romaji})` : ''} — ${item.meanings.join('; ')}`, item,
    });
  }
  return shuffle(result).slice(0, limit);
}
