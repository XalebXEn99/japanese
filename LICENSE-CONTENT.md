# Learning content: sources, changes and permissions

This app is intended for **noncommercial study**. Its content is a collection
with different licenses, not a single proprietary dataset. No endorsement by
JLPT, EDRDG, Tae Kim, or KanjiVG is implied.

## Dictionary-derived JSON: CC BY-SA 4.0

The vocabulary and kanji in `public/data/N5.json` through `N1.json` use the
**JMdict** and **KANJIDIC2** dictionary files, copyright **James William Breen
and the Electronic Dictionary Research and Development Group (EDRDG)**.
We acknowledge and thank their many dictionary contributors.

- [JMdict documentation](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project)
- [KANJIDIC documentation](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project)
- [EDRDG copyright and permissions](https://www.edrdg.org/edrdg/licence.html)
- [CC BY-SA 4.0 deed](https://creativecommons.org/licenses/by-sa/4.0/)
- [CC BY-SA 4.0 legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode)

A copy of the EDRDG statement is included as `public/data/EDRDG-LICENCE.html`.
The required source acknowledgements are also in the app's manifest for display
in its sources/reference interface.

The source JSON comes from **Evan Clan and OpenJLPT contributors**,
[OpenJLPT](https://github.com/evanclan/OpenJLPT), revision
`0d1d3410bec90bd4098a7c72de820543cb4f707c` (dataset version 0.3.0).
Its per-field provenance is included as `public/data/OPENJLPT-NOTICE.md`, and its
CC BY-SA 4.0 legal code as `public/data/OPENJLPT-LICENSE.txt`.
`public/data/upstream-meta.json` records its upstream dictionary dates
(JMdict and KANJIDIC2: September 29, 2026).

**Jonathan Waller's JLPT Resources**
([tanos.co.uk](https://www.tanos.co.uk/jlpt/)) supplies the community level
assignments and vocabulary glosses through OpenJLPT. OpenJLPT's pinned NOTICE
explicitly identifies these source lists as **CC BY** and credits Waller.
The original Tanos host could not resolve during verification; the downstream
source snapshot and explicit attribution/license declaration are our evidence.
We do not infer a particular CC BY version where none was stated.
OpenJLPT verifies/corrects readings and glosses against JMdict and adds
JMdict-linked part-of-speech metadata; its kanji fields come from KANJIDIC2.

Changes made here: projecting vocabulary and kanji fields into this app's
contract; romanizing readings with WanaKana; assigning broad grammatical
categories; prefixing stable IDs; and attaching independently authored grammar.
No Tatoeba sentences, OpenJLPT grammar, WaniKani data, or separately copyrighted
non-English translations are imported. These dictionary-derived files and their
adaptations remain under CC BY-SA 4.0. No ownership of the original sources is
claimed. Exact pinned download URLs and SHA-256 digests are in `manifest.json`.

Vocabulary units first use eight conservative themes: Numbers & time,
People & family, Food & drink, Travel & places, Home & daily life, School & work,
Nature & animals, and Body & health. Classification matches the complete primary
English gloss against curated phrase sets after lowercasing, stripping
parenthetical notes, normalizing whitespace, and removing infinitive `to`.
It does not search arbitrary substrings or infer themes from incidental secondary
senses. Unmatched entries fall back to verbs, adjectives, adverbs, nouns, or
expressions (in that precedence). Themes are a browsing aid, not exhaustive
semantic annotation; ambiguous or elaborately worded glosses often retain POS
categories. No source entry is reordered, removed, or assigned a different ID.

### Level estimates are not an official JLPT syllabus

The modern JLPT does not publish an exhaustive official vocabulary/kanji list.
This project therefore does **not** claim official assignments or guaranteed
examination coverage. Word and kanji assignments follow Waller's community lists,
corrected and deduplicated by OpenJLPT, rather than inventing a frequency-only
assignment or treating KANJIDIC's legacy four-level JLPT field as modern N levels.
Each item appears once, at its easiest assigned level. Upstream vocabulary order
is preserved; the sequence within a level is not a rigorously ordered textbook.

| Estimated level | Vocabulary | Kanji | Authored grammar points |
|---|---:|---:|---:|
| N5 | 674 | 84 | 20 |
| N4 | 630 | 169 | 20 |
| N3 | 1,659 | 387 | 20 |
| N2 | 1,778 | 398 | 20 |
| N1 | 3,070 | 1,345 | 20 |
| Total | 7,811 | 2,383 | 100 |

## Stroke SVGs: CC BY-SA 3.0

`public/strokes/*.svg` are **unmodified KanjiVG diagrams**, copyright
**Ulrich Apel and contributors**, from
[KanjiVG](https://kanjivg.tagaini.net/) /
[source repository](https://github.com/KanjiVG/kanjivg), revision
`610091ce618cf757ed1357a8954cd65283e015d6`.

- [CC BY-SA 3.0 deed](https://creativecommons.org/licenses/by-sa/3.0/)
- [CC BY-SA 3.0 legal code](https://creativecommons.org/licenses/by-sa/3.0/legalcode)
- Full upstream terms: `public/strokes/COPYING`.

Copyright/license comments inside every SVG are preserved. Character filenames
are lowercase hexadecimal Unicode scalars padded to five digits. Only selected
curriculum characters are copied from the upstream archive; no binary source
archives are kept. Kana combinations consist of separately written characters,
not a fabricated single stroke diagram. Any unavailable scalar is explicitly
listed in `manifest.json` under `strokeCoverage.missing`.

## Original curriculum: CC BY-SA 4.0

The kana tables, 100 authored grammar explanations, examples, and exercises
(20 points per estimated level) were written for this application and are
released under **CC BY-SA 4.0**. They are not extracted from Tae Kim or from any
third-party textbook. Attribution: **Japanese Learning app contributors**.
The editable grammar sources are `public/data/grammar-source.json` and the
original supplements in `scripts/grammar-data.ts`; the content generator uses
`buildExpandedGrammar` to preserve stable IDs and compose expanded explanations,
three examples and five questions per lesson (300 examples and 500 questions).
Examples are original, not a licensed sentence-corpus import. Grammar topics can
straddle adjacent test levels, and this introductory set does not exhaust N1.
Kana include basic, voiced, semi-voiced, digraph, small-character, and modern
loanword spellings in both scripts. Extended hiragana spellings are practice
counterparts of katakana loanword spellings, not claims of common everyday usage.
Romaji is a learning aid, not a substitute for Japanese spelling or pronunciation:
particle は/へ/を, small kana, long vowels, and context need explicit instruction.
Isolated small っ/ッ is labelled `xtsu` (an input spelling, not a spoken syllable);
the long-vowel mark ー is labelled `-`. There are 310 kana/practice entries.

## Tae Kim PDF: separate noncommercial reference

`public/grammar_guide.pdf` is an unmodified copy of the user-provided local
**Japanese Grammar Guide**, **Tae Kim**, dated **November 21, 2012**, 353 pages.
Local PDF text was inspected using pypdf; no explicit copyright/license text was
discoverable in the PDF. The corresponding
[official grammar-guide page](https://guidetojapanese.org/learn/grammar)
explicitly states **Creative Commons Attribution-Noncommercial-Share Alike
3.0 United States** and links to
[its license](https://creativecommons.org/licenses/by-nc-sa/3.0/us/).
That published permission is the basis for this noncommercial reference copy.
The local PDF was not uploaded to any service.

This PDF's noncommercial restriction is **not** imposed on the EDRDG or KanjiVG
sources. Remove it or obtain separate permission before commercial distribution
of the collection. Linking to this reference does not mean Tae Kim supplies a
complete N5–N1 or N1 curriculum; the app's grammar lessons are independently authored.

## Rebuilding and verification

Run `npm run content:build` (or `npx tsx scripts/build-content.ts`) after installing
the app's declared dependencies. Requires internet access and the original local
`grammar_guide.pdf`. Downloads use pinned public upstream versions, in memory.
The script writes all five level files, kana, manifest, selected SVGs, attribution,
and the PDF reference; it uses only the explicitly licensed upstream content
described above and does not upload local files.
For a theme-only update without upstream downloads, run
`npm run content:build -- --categories-only` against the existing level JSON.
This keeps every other field and entry order unchanged, preserving the existing
POS fallback when the primary gloss has no exact theme match.
Run `npx vitest run tests/content.test.ts` to check schemas, IDs, meaningful lessons,
counts, complete kanji stroke coverage, SVG structure, and request caching/errors.
When changing upstream releases, review licenses and pedagogical quality again.
