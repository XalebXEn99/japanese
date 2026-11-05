import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyProgress, mergeProgress, type Progress } from '../../shared/progress';
import { requestProgress as request } from '../lib/progress-api';
import { readProgress, saveProgress } from '../lib/storage';

export function useProgress(userId: string | null, onError: (message: string) => void) {
  const owner = userId || 'guest';
  const [state, setState] = useState<{ owner: string; progress: Progress }>({ owner: '', progress: emptyProgress() });
  const [status, setStatus] = useState('Loading progress');
  const [ready, setReady] = useState(false);
  const [storageValid, setStorageValid] = useState(true);
  const revision = useRef(0);
  const generation = useRef(0);
  const syncing = useRef(false);
  const current = useRef(state);
  current.current = state;
  const update = useCallback((change: (p: Progress) => Progress) => {
    setState(previous => previous.owner === owner ? { owner, progress: change(previous.progress) } : previous);
  }, [owner]);
  useEffect(() => {
    const epoch = ++generation.current;
    syncing.current = false;
    revision.current = 0;
    setReady(false);
    setStorageValid(true);
    let local: Progress;
    try { local = readProgress(owner); }
    catch (error) {
      onError(error instanceof Error ? error.message : 'Could not load browser progress.');
      setStorageValid(false);
      setState({ owner, progress: emptyProgress() });
      setStatus('Saved data needs attention; saving is paused');
      return;
    }
    setState({ owner, progress: local });
    if (!userId) {
      setReady(true);
      setStatus('Saved on this device');
      return;
    }
    setStatus('Loading account progress');
    request('GET').then(({ data }) => {
      if (epoch !== generation.current) return;
      revision.current = data.revision;
      setState(previous => ({ owner, progress: data.progress ? mergeProgress(previous.progress, data.progress) : previous.progress }));
      setReady(true);
      setStatus('Account connected');
    }).catch(error => {
      if (epoch !== generation.current) return;
      setStatus('Sync unavailable — saved on this device');
      onError(error instanceof Error ? error.message : 'Account sync failed.');
    });
    return () => { generation.current++; };
  }, [owner, userId, onError]);
  const sync = useCallback(async () => {
    if (!userId || !storageValid || syncing.current || current.current.owner !== owner) return;
    syncing.current = true;
    const epoch = generation.current;
    const sent = current.current.progress;
    setStatus('Syncing');
    try {
      let result = await request('PUT', { progress: sent, revision: revision.current });
      if (epoch !== generation.current) return;
      if (result.status === 409) {
        const merged = result.data.progress ? mergeProgress(current.current.progress, result.data.progress) : current.current.progress;
        result = await request('PUT', { progress: merged, revision: result.data.revision });
        if (epoch !== generation.current) return;
        if (result.status === 409) throw new Error('Progress changed on another device. Retry sync.');
        setState(previous => ({ owner, progress: mergeProgress(previous.progress, merged) }));
      }
      revision.current = result.data.revision;
      setReady(true);
      setStatus('Synced to your account');
    } catch (error) {
      if (epoch !== generation.current) return;
      setStatus('Sync failed — saved on this device');
      onError(error instanceof Error ? error.message : 'Sync failed.');
    } finally { if (epoch === generation.current) syncing.current = false; }
  }, [userId, owner, storageValid, onError]);
  useEffect(() => {
    if (state.owner !== owner || !storageValid) return;
    try { saveProgress(owner, state.progress); }
    catch (error) { onError(error instanceof Error ? error.message : 'Your browser could not save progress. Export a backup.'); }
    if (!userId || !ready) return;
    setStatus('Saved locally — sync pending');
    const timeout = setTimeout(() => { void sync(); }, 1200);
    return () => clearTimeout(timeout);
  }, [state, owner, userId, ready, storageValid, sync, onError]);
  return { progress: state.progress, update, status, sync, loaded: state.owner === owner };
}
