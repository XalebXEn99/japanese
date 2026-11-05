export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
export interface Kana {
  id: string;
  character: string;
  romaji: string;
  kind: 'hiragana' | 'katakana';
  group: string;
}
export interface Vocabulary {
  id: string;
  word: string;
  reading: string;
  romaji: string;
  meanings: string[];
  level: Level;
  category: string;
}
export interface Kanji {
  id: string;
  character: string;
  onyomi: string[];
  kunyomi: string[];
  meanings: string[];
  level: Level;
  strokes: number;
}
export interface Grammar {
  id: string;
  title: string;
  level: Level;
  explanation: string;
  examples: { ja: string; reading?: string; en: string }[];
  questions: { prompt: string; choices: string[]; answer: number; explanation: string }[];
  source?: string;
}
export interface LevelContent {
  vocabulary: Vocabulary[];
  kanji: Kanji[];
  grammar: Grammar[];
}
export interface ContentManifest {
  levels: Record<Level, { vocabulary: number; kanji: number; grammar: number }>;
  sources: { name: string; url: string; license: string; usage: string }[];
}
