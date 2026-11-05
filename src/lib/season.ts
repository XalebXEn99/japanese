export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Daylight = 'day' | 'evening' | 'night';
export type ThemeMode = 'light' | 'seasonal' | 'dark';
export function japanSeason(date = new Date()): Season {
  const month = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tokyo', month: 'numeric' }).format(date));
  return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
}
export function localDaylight(date = new Date()): Daylight {
  const hour = date.getHours();
  return hour < 6 ? 'night' : hour < 18 ? 'day' : 'evening';
}
export const sceneNames: Record<Season, [string, string]> = {
  spring: ['Lake Kawaguchi', 'Philosopher’s Path'],
  summer: ['Enoshima coast', 'Arashiyama'],
  autumn: ['Kiyomizu-dera', 'Shinkyo Bridge'],
  winter: ['Shirakawa-go', 'Kinkaku-ji'],
};
export function sceneryUrl(season: Season, scene: number, daylight: Daylight): string {
  return `${import.meta.env.BASE_URL}scenery/${season}-${scene % 2}-${daylight}.png`;
}
