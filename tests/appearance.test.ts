import { describe, expect, it } from 'vitest';
import { japanSeason, localDaylight } from '../src/lib/season';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Japanese seasons', () => {
  it.each([
    ['2026-02-28T14:59:00Z', 'winter'],
    ['2026-02-28T15:00:00Z', 'spring'],
    ['2026-05-31T15:00:00Z', 'summer'],
    ['2026-08-31T15:00:00Z', 'autumn'],
    ['2026-11-30T15:00:00Z', 'winter'],
  ])('uses the Japan calendar at %s', (date, season) => {
    expect(japanSeason(new Date(date))).toBe(season);
  });
  it.each([[0, 'night'], [5, 'night'], [6, 'day'], [12, 'day'], [17, 'day'], [18, 'evening'], [23, 'evening']])('uses local hour %s for %s lighting', (hour, expected) => {
    expect(localDaylight(new Date(2026, 5, 1, Number(hour), 0))).toBe(expected);
  });
  it('ships 24 standalone landscape PNGs at their original resolution', () => {
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      for (const scene of [0, 1]) {
        for (const time of ['day', 'evening', 'night']) {
          const file = resolve('public', 'scenery', `${season}-${scene}-${time}.png`);
          expect(existsSync(file)).toBe(true);
          const image = readFileSync(file);
          expect(image.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
          const width = image.readUInt32BE(16);
          const height = image.readUInt32BE(20);
          expect(width).toBeGreaterThanOrEqual(1536);
          expect(height).toBeGreaterThanOrEqual(940);
          expect(width / height).toBeGreaterThanOrEqual(1.5);
          expect(width / height).toBeLessThan(1.8);
          expect(existsSync(resolve('public', 'scenery', `${season}-${scene}-${time}.jpg`))).toBe(false);
        }
      }
    }
  });
});
