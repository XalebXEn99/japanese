import type { ContentManifest, Kana, Level, LevelContent } from '../types';

const requests = new Map<string, Promise<unknown>>();

function load<T>(path: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}${path}`;
  let request = requests.get(url);
  if (!request) {
    request = fetch(url).then(async response => {
      if (!response.ok) throw new Error(`Could not load ${url}: HTTP ${response.status} ${response.statusText}`);
      try {
        return await response.json();
      } catch {
        throw new Error(`Could not load ${url}: invalid JSON`);
      }
    }).catch(error => {
      requests.delete(url);
      throw new Error(`Content request failed (${url}): ${error instanceof Error ? error.message : String(error)}`);
    });
    requests.set(url, request);
  }
  return request as Promise<T>;
}

export const loadManifest = (): Promise<ContentManifest> => load('data/manifest.json');
export const loadKana = (): Promise<Kana[]> => load('data/kana.json');
export const loadLevel = (level: Level): Promise<LevelContent> => {
  if (!['N5', 'N4', 'N3', 'N2', 'N1'].includes(level)) return Promise.reject(new Error(`Unknown curriculum level: ${level}`));
  return load(`data/${level}.json`);
};
