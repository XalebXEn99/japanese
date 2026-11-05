import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { toRomaji, toKatakana } from 'wanakana';
import type { ContentManifest, Kana, Kanji, Level, LevelContent, Vocabulary } from '../src/types';
import { buildExpandedGrammar } from './grammar-data';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'public', 'data');
const strokeDir = join(root, 'public', 'strokes');
const levels: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const contentRevision = '0d1d3410bec90bd4098a7c72de820543cb4f707c';
const kanjivgRevision = '610091ce618cf757ed1357a8954cd65283e015d6';
const contentURL = `https://raw.githubusercontent.com/evanclan/OpenJLPT/${contentRevision}`;

async function download(url: string): Promise<Buffer> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 2) throw new Error(`Download failed: ${url}: ${String(error)}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Unreachable');
}

function tarFiles(archive: Buffer): Map<string, Buffer> {
  const tar = gunzipSync(archive);
  const files = new Map<string, Buffer>();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
    if (!name) break;
    const prefix = header.subarray(345, 500).toString().replace(/\0.*$/, '');
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim(), 8) || 0;
    if (header[156] === 0 || header[156] === 48) files.set(prefix ? `${prefix}/${name}` : name, tar.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

async function dictionary(kind: 'vocab' | 'kanji', level: Level): Promise<{ data: any[]; url: string; sha256: string }> {
  const url = `${contentURL}/data/json/${kind}/${level.toLowerCase()}.json`;
  const buffer = await download(url);
  const data = JSON.parse(buffer.toString());
  if (!Array.isArray(data)) throw new Error(`Expected an entry array: ${url}`);
  return { data, url, sha256: createHash('sha256').update(buffer).digest('hex') };
}

function kana(): Kana[] {
  const groups: [string, string][] = [
    ['basic', 'あ い う え お か き く け こ さ し す せ そ た ち つ て と な に ぬ ね の は ひ ふ へ ほ ま み む め も や ゆ よ ら り る れ ろ わ を ん'],
    ['voiced', 'が ぎ ぐ げ ご ざ じ ず ぜ ぞ だ ぢ づ で ど ば び ぶ べ ぼ ゔ'],
    ['semi-voiced', 'ぱ ぴ ぷ ぺ ぽ'],
    ['digraph', 'きゃ きゅ きょ ぎゃ ぎゅ ぎょ しゃ しゅ しょ じゃ じゅ じょ ちゃ ちゅ ちょ にゃ にゅ にょ ひゃ ひゅ ひょ びゃ びゅ びょ ぴゃ ぴゅ ぴょ みゃ みゅ みょ りゃ りゅ りょ ぢゃ ぢゅ ぢょ'],
    ['small', 'ぁ ぃ ぅ ぇ ぉ っ ゃ ゅ ょ ゎ'],
    ['marks', 'ー'],
    ['modern', 'いぇ うぃ うぇ うぉ きぇ ぎぇ くぁ くぃ くぇ くぉ ぐぁ しぇ じぇ すぃ ずぃ ちぇ つぁ つぃ つぇ つぉ てぃ てゅ とぅ でぃ でゅ どぅ ふぁ ふぃ ふぇ ふぉ ふゅ ゔぁ ゔぃ ゔぇ ゔぉ ゔゅ'],
  ];
  return (['hiragana', 'katakana'] as const).flatMap(kind => groups.flatMap(([group, characters]) =>
    characters.split(' ').map(text => {
      const character = kind === 'katakana' ? toKatakana(text) : text;
      return { id: `kana-${kind}-${[...character].map(c => c.codePointAt(0)!.toString(16)).join('-')}`, character, romaji: text === 'っ' ? 'xtsu' : text === 'ー' ? '-' : toRomaji(character), kind, group };
    })));
}

const themes: [string, Set<string>][] = [
  ['Numbers & time', new Set(('zero|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|ten thousand|number|numeral|count|quantity|amount|time|hour|minute|second|day|week|month|year|today|tomorrow|yesterday|morning|noon|afternoon|evening|night|midnight|tonight|weekend|weekday|holiday|birthday|calendar|date|schedule|appointment|deadline|past|present|future|century|age|era|season|spring|summer|autumn|winter|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|daily|weekly|monthly|annual|early morning|day before yesterday|day after tomorrow|last week|next week|last month|next month|last year|next year|this week|this month|this year').split('|'))],
  ['People & family', new Set(('person|people|human being|man|woman|boy|girl|child|children|baby|infant|adult|family|relative|relatives|parent|parents|father|mother|dad|mum|mom|son|daughter|brother|sister|older brother|younger brother|elder brother|older sister|younger sister|elder sister|grandfather|grandmother|grandchild|grandson|granddaughter|uncle|aunt|nephew|niece|cousin|husband|wife|spouse|couple|marriage|wedding|divorce|friend|friendship|acquaintance|neighbour|neighbor|guest|visitor|stranger|generation|ancestor|descendant|twins|youth|young person|elderly person|grandparents|siblings|household|birth|pregnancy').split('|'))],
  ['Food & drink', new Set(('food|meal|breakfast|lunch|dinner|supper|snack|cooking|cuisine|dish|ingredient|ingredients|taste|flavour|flavor|appetite|hunger|thirst|rice|cooked rice|uncooked rice|bread|noodle|noodles|pasta|ramen|udon|soba|sushi|soup|miso|soy sauce|salt|sugar|vinegar|pepper|spice|spices|oil|butter|cheese|yogurt|yoghurt|milk|egg|eggs|meat|beef|pork|chicken meat|seafood|vegetable|vegetables|fruit|apple|orange|banana|grape|grapes|peach|pear|strawberry|watermelon|lemon|potato|onion|carrot|tomato|cabbage|lettuce|cucumber|bean|beans|tofu|mushroom|cake|candy|chocolate|ice cream|dessert|sweet|sweets|tea|green tea|black tea|coffee|juice|beer|wine|sake|alcohol|drink|beverage|drinking water|drinking|eat|drink alcohol|boil|fry|bake|steam|cook|chopsticks|spoon|fork|restaurant|cafeteria|menu|bill of fare').split('|'))],
  ['Travel & places', new Set(('travel|trip|journey|tour|tourism|tourist|sightseeing|vacation|travel abroad|departure|arrival|destination|transport|transportation|traffic|train|railway|railroad|subway|underground railway|bullet train|bus|taxi|car|automobile|bicycle|bike|motorcycle|airplane|aeroplane|aircraft|ship|boat|ferry|station|railway station|train station|bus stop|airport|port|harbour|harbor|ticket|fare|passport|visa|luggage|baggage|suitcase|hotel|inn|lodging|reservation|map|road|street|avenue|highway|motorway|intersection|crossroads|bridge|tunnel|sidewalk|pavement|crosswalk|pedestrian crossing|parking lot|parking|city|town|village|country|nation|capital|capital city|district|region|area|place|location|address|neighbourhood|neighborhood|downtown|suburb|suburbs|countryside|abroad|overseas|foreign country|border|entrance|exit|north|south|east|west|direction|distance|walk|stroll|commute|transfer|boarding|landing|takeoff').split('|'))],
  ['Home & daily life', new Set(('home|house|apartment|flat|room|bedroom|bathroom|kitchen|living room|dining room|toilet|lavatory|garden|yard|balcony|roof|wall|floor|ceiling|door|window|stairs|staircase|corridor|hallway|furniture|table|desk|chair|sofa|bed|bedding|pillow|blanket|futon|sheet|sheets|curtain|carpet|mirror|clock|alarm clock|key|lock|shelf|shelves|cupboard|drawer|closet|wardrobe|refrigerator|washing machine|vacuum cleaner|air conditioner|heater|stove|oven|microwave oven|electricity|gas|tap|faucet|soap|shampoo|toothbrush|toothpaste|towel|bath|shower|laundry|washing|cleaning|housework|garbage|rubbish|trash|clothes|clothing|shirt|t-shirt|trousers|pants|skirt|dress|coat|jacket|sweater|socks|shoes|shoe|hat|cap|gloves|scarf|umbrella|bag|wallet|purse|shopping|shopping bag|shop|store|supermarket|department store|convenience store|price|money|cash|coin|banknote|change|rent|wake up|sleep|wash|clean|wear|put on|take off|tidy up').split('|'))],
  ['School & work', new Set(('school|elementary school|primary school|middle school|junior high school|high school|university|college|classroom|class|lesson|lecture|course|curriculum|education|study|studies|learning|teaching|teacher|instructor|professor|student|pupil|classmate|schoolmate|homework|assignment|examination|exam|test|quiz|grade|score|graduation|entrance examination|textbook|notebook|dictionary|book|library|pen|pencil|eraser|paper|blackboard|chalk|ruler|scissors|stapler|work|job|occupation|profession|employment|employee|employer|worker|staff|colleague|coworker|co-worker|boss|manager|director|company|corporation|business|enterprise|office|factory|workplace|meeting|conference|interview|salary|wage|wages|income|overtime|promotion|retirement|unemployment|resignation|contract|document|documents|report|presentation|project|research|training|practice|skill|qualification|application|resume|curriculum vitae|computer|printer|email|e-mail|telephone|phone|fax|typewriter|typist|engineer|secretary|accountant|lawyer|journalist|reporter|teach|learn|study abroad|work overtime').split('|'))],
  ['Nature & animals', new Set(('nature|environment|ecology|weather|climate|sky|sun|moon|star|stars|cloud|clouds|rain|snow|hail|fog|mist|wind|storm|thunder|lightning|typhoon|hurricane|earthquake|tsunami|flood|drought|rainbow|sunshine|sunlight|temperature|humidity|mountain|hill|valley|river|stream|lake|pond|sea|ocean|beach|coast|shore|island|forest|woods|woodland|tree|branch|leaf|leaves|root|flower|grass|plant|seed|soil|earth|sand|stone|rock|mud|desert|waterfall|volcano|animal|mammal|bird|fish|insect|bug|dog|cat|horse|cow|pig|sheep|goat|chicken|hen|rooster|duck|rabbit|mouse|rat|monkey|ape|bear|tiger|lion|elephant|giraffe|deer|fox|wolf|snake|lizard|frog|turtle|tortoise|whale|dolphin|shark|octopus|squid|crab|shrimp|prawn|butterfly|bee|ant|mosquito|fly|spider|crow|sparrow|pigeon|eagle|owl|penguin|pet|fur|feather|wing|tail|bark|meow|bloom').split('|'))],
  ['Body & health', new Set(('body|head|face|hair|eye|eyes|ear|ears|nose|mouth|lip|lips|tongue|tooth|teeth|neck|throat|shoulder|arm|elbow|hand|finger|fingers|thumb|nail|chest|back|waist|hip|leg|knee|foot|feet|toe|toes|skin|bone|muscle|blood|heart|lung|lungs|stomach|liver|kidney|brain|nerve|health|illness|disease|sickness|injury|wound|pain|ache|headache|stomachache|toothache|fever|cough|sneeze|cold|flu|influenza|allergy|symptom|symptoms|infection|virus|bacteria|medicine|medication|drug|prescription|pill|tablet|injection|vaccination|vaccine|treatment|cure|recovery|surgery|operation|hospital|clinic|pharmacy|doctor|physician|dentist|nurse|patient|ambulance|first aid|medical examination|medical treatment|checkup|check-up|rest|exercise|fatigue|tiredness|insomnia|nutrition|diet|disability|blindness|deafness|pulse|blood pressure|breath|breathing|sweat|tear|tears|vomit|bleed|heal|recover').split('|'))],
];

function vocabularyCategory(meanings: string[], pos: string[], fallback = 'expressions'): string {
  // Only the primary gloss can choose a theme; incidental secondary senses must not.
  const primary = (meanings[0] ?? '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/^to /, '').replace(/\s+/g, ' ').trim().replace(/[.;]$/, '');
  const theme = themes.find(([, terms]) => terms.has(primary));
  if (theme) return theme[0];
  if (pos.some(p => /^v[1-5s]/.test(p))) return 'verbs';
  if (pos.some(p => p.startsWith('adj'))) return 'adjectives';
  if (pos.some(p => p.startsWith('adv'))) return 'adverbs';
  if (pos.includes('n')) return 'nouns';
  return fallback;
}

async function main() {
  if (process.argv.includes('--categories-only')) {
    const counts: Record<string, Record<string, number>> = {};
    for (const level of levels) {
      const path = join(out, `${level}.json`);
      const content: LevelContent = JSON.parse(await readFile(path, 'utf8'));
      counts[level] = {};
      for (const word of content.vocabulary) {
        word.category = vocabularyCategory(word.meanings, [], word.category);
        counts[level][word.category] = (counts[level][word.category] ?? 0) + 1;
      }
      await writeFile(path, JSON.stringify(content));
    }
    console.log(JSON.stringify(counts, null, 2));
    return;
  }
  await Promise.all([mkdir(out, { recursive: true }), mkdir(strokeDir, { recursive: true })]);
  console.log('Downloading pinned OpenJLPT dictionary data and KanjiVG…');
  const [datasets, svgArchive] = await Promise.all([
    Promise.all(levels.map(async level => ({ level, vocabulary: await dictionary('vocab', level), kanji: await dictionary('kanji', level) }))),
    download(`https://codeload.github.com/KanjiVG/kanjivg/tar.gz/${kanjivgRevision}`),
  ]);
  const grammar = buildExpandedGrammar(JSON.parse(await readFile(join(out, 'grammar-source.json'), 'utf8')));
  const content: Record<Level, LevelContent> = {
    N5: { vocabulary: [], kanji: [], grammar: grammar.N5 },
    N4: { vocabulary: [], kanji: [], grammar: grammar.N4 },
    N3: { vocabulary: [], kanji: [], grammar: grammar.N3 },
    N2: { vocabulary: [], kanji: [], grammar: grammar.N2 },
    N1: { vocabulary: [], kanji: [], grammar: grammar.N1 },
  };
  const ids = new Set<string>();
  const kanjiCharacters = new Set<string>();
  for (const { level, vocabulary, kanji } of datasets) {
    for (const w of vocabulary.data) {
      const entry: Vocabulary = {
        id: `vocab-openjlpt-${w.id}`, word: w.word, reading: w.reading,
        romaji: toRomaji(w.reading), meanings: w.meanings, level, category: vocabularyCategory(w.meanings, w.pos ?? []),
      };
      if (!entry.word || !entry.reading || !entry.meanings?.length || !entry.romaji) throw new Error(`Invalid vocabulary entry ${entry.id}`);
      if (ids.has(entry.id)) throw new Error(`Duplicate vocabulary ID ${entry.id}`);
      ids.add(entry.id);
      content[level].vocabulary.push(entry);
    }
    for (const k of kanji.data) {
      const entry: Kanji = {
        id: `kanji-${k.character.codePointAt(0).toString(16)}`, character: k.character,
        onyomi: k.onyomi, kunyomi: k.kunyomi, meanings: k.meanings, level, strokes: k.strokes,
      };
      if (!entry.meanings?.length || !(entry.strokes > 0) || [...entry.character].length !== 1) throw new Error(`Invalid kanji entry ${entry.id}`);
      if (ids.has(entry.id)) throw new Error(`Duplicate kanji ID ${entry.id}`);
      ids.add(entry.id);
      kanjiCharacters.add(entry.character);
      content[level].kanji.push(entry);
    }
  }
  const syllabary = kana();
  const needed = new Set([...kanjiCharacters, ...syllabary.flatMap(k => [...k.character])].map(c => c.codePointAt(0)!.toString(16).padStart(5, '0')));
  const available = new Set<string>();
  for (const [name, buffer] of tarFiles(svgArchive)) {
    const match = /\/kanji\/([0-9a-f]{5})\.svg$/.exec(name);
    if (match && needed.has(match[1])) {
      await writeFile(join(strokeDir, `${match[1]}.svg`), buffer);
      available.add(match[1]);
    }
  }
  const missing = [...needed].filter(key => !available.has(key));
  const sources: ContentManifest['sources'] = [
    { name: 'JMdict — James William Breen / Electronic Dictionary Research and Development Group', url: 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project', license: 'CC BY-SA 4.0', usage: 'Vocabulary verification, corrected spellings/readings/glosses and part-of-speech metadata via OpenJLPT; romanized here. No imported Tatoeba examples.' },
    { name: 'KANJIDIC2 — James William Breen / EDRDG', url: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project', license: 'CC BY-SA 4.0', usage: 'Kanji stroke counts, Japanese readings and English meanings via OpenJLPT. Levels are community estimates, not official JLPT assignments.' },
    { name: 'OpenJLPT — Evan Clan and contributors', url: 'https://github.com/evanclan/OpenJLPT', license: 'CC BY-SA 4.0', usage: `Verified vocabulary and kanji JSON, revision ${contentRevision}; fields mapped to this app, vocabulary romanized and categorized. Upstream NOTICE and LICENSE included locally.` },
    { name: "Jonathan Waller's JLPT Resources", url: 'https://www.tanos.co.uk/jlpt/', license: 'CC BY (as recorded in OpenJLPT NOTICE)', usage: 'Community-estimated N5–N1 level lists and vocabulary glosses through OpenJLPT. Attribution/license documented in its pinned NOTICE.md; original host DNS was unavailable at verification time. No claim of official exam coverage.' },
    { name: 'KanjiVG — Ulrich Apel and contributors', url: 'https://kanjivg.tagaini.net/', license: 'CC BY-SA 3.0', usage: `Unmodified SVGs, revision ${kanjivgRevision}; ${available.size} single-character stroke diagrams. Missing codepoints: ${missing.join(', ') || 'none'}. Multi-kana combinations are written as their separate component characters.` },
    { name: 'Original Japanese curriculum', url: 'https://creativecommons.org/licenses/by-sa/4.0/', license: 'CC BY-SA 4.0', usage: 'Original grammar explanations, examples, exercises, kana tables and estimated study sequence; not endorsed by JLPT or dictionary authors.' },
    { name: "Tae Kim's Guide to Learning Japanese (reference only)", url: 'https://guidetojapanese.org/learn/grammar', license: 'CC BY-NC-SA 3.0 US (official grammar guide web page)', usage: 'Local PDF reference at grammar_guide.pdf, copied unmodified for noncommercial study. The 353-page PDF has no discoverable license notice; the official corresponding grammar-guide page explicitly supplies this license. Not the source of the authored lessons; not claimed to cover every N1 topic.' },
  ];
  const manifest: ContentManifest & Record<string, unknown> = {
    levels: Object.fromEntries(levels.map(level => [level, { vocabulary: content[level].vocabulary.length, kanji: content[level].kanji.length, grammar: content[level].grammar.length }])) as ContentManifest['levels'],
    sources,
    levelAssignment: "ESTIMATED: no official exhaustive JLPT vocabulary/kanji syllabus exists. Vocabulary and kanji use Jonathan Waller's community level assignments, corrected and deduplicated by OpenJLPT. Grammar levels are independently authored estimates. None is an official exam guarantee.",
    upstream: [...datasets.flatMap(d => [d.vocabulary, d.kanji]).map(({ url, sha256 }) => ({ url, sha256 })), { url: `https://codeload.github.com/KanjiVG/kanjivg/tar.gz/${kanjivgRevision}`, sha256: createHash('sha256').update(svgArchive).digest('hex') }],
    strokeCoverage: { available: available.size, missing },
    grammarReference: 'grammar_guide.pdf',
    schemaVersion: 1,
  };
  await Promise.all([
    ...levels.map(level => writeFile(join(out, `${level}.json`), JSON.stringify(content[level]))),
    writeFile(join(out, 'kana.json'), JSON.stringify(syllabary)),
    writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2)),
    copyFile(join(root, 'grammar_guide.pdf'), join(root, 'public', 'grammar_guide.pdf')),
    download(`https://raw.githubusercontent.com/KanjiVG/kanjivg/${kanjivgRevision}/COPYING`).then(buffer => writeFile(join(strokeDir, 'COPYING'), buffer)),
    download(`${contentURL}/NOTICE.md`).then(buffer => writeFile(join(out, 'OPENJLPT-NOTICE.md'), buffer)),
    download(`${contentURL}/LICENSE`).then(buffer => writeFile(join(out, 'OPENJLPT-LICENSE.txt'), buffer)),
    download(`${contentURL}/data/json/meta.json`).then(buffer => writeFile(join(out, 'upstream-meta.json'), buffer)),
    download('https://www.edrdg.org/edrdg/licence.html').then(buffer => writeFile(join(out, 'EDRDG-LICENCE.html'), buffer)),
  ]);
  console.log(JSON.stringify({ levels: manifest.levels, kana: syllabary.length, strokes: manifest.strokeCoverage }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
