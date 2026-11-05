import { emptyProgress, progressSchema, type Progress } from '../../shared/progress';

const PREFIX = 'kotoba-progress-v1:';
export function readProgress(owner: string): Progress {
  const stored = localStorage.getItem(PREFIX + owner);
  if (!stored) return emptyProgress();
  const parsed = progressSchema.safeParse(JSON.parse(stored));
  if (!parsed.success) throw new Error('Saved progress is invalid. Export or back up your browser data before resetting it.');
  return parsed.data;
}
export function saveProgress(owner: string, progress: Progress): void {
  localStorage.setItem(PREFIX + owner, JSON.stringify(progressSchema.parse(progress)));
}
export function exportProgress(progress: Progress): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `kotoba-progress-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
