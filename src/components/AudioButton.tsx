import { useState } from 'react';
import { speakJapanese } from '../lib/speech';

export default function AudioButton({ text, onError, slow = false }: { text: string; onError: (message: string) => void; slow?: boolean }) {
  const [busy, setBusy] = useState(false);
  return <button type="button" className="audio-button" disabled={busy || !text} aria-label={slow ? 'Play slow Japanese pronunciation' : 'Play Japanese pronunciation'} onClick={async () => {
    setBusy(true);
    try { await speakJapanese(text, slow); }
    catch (error) { onError(error instanceof Error ? error.message : 'Pronunciation failed.'); }
    finally { setBusy(false); }
  }}>{busy ? 'Speaking…' : slow ? 'Listen slowly' : 'Listen'}</button>;
}
