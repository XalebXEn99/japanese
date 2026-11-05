export function japaneseVoices(): SpeechSynthesisVoice[] {
  return typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices().filter(v => /^ja(?:-|_)/i.test(v.lang));
}
export async function speakJapanese(text: string, slow = false): Promise<void> {
  if (!('speechSynthesis' in window)) throw new Error('This browser does not support speech. Use a current browser with a Japanese voice installed.');
  if (!text.trim()) throw new Error('No Japanese pronunciation is available for this item.');
  let voices = japaneseVoices();
  if (!voices.length) {
    await new Promise(resolve => setTimeout(resolve, 600));
    voices = japaneseVoices();
  }
  if (!voices.length) throw new Error('No Japanese voice is installed. Add a Japanese speech voice in your device language settings, then reload.');
  speechSynthesis.cancel();
  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.voice = voices[0];
    utterance.rate = slow ? 0.65 : 0.9;
    utterance.onend = () => resolve();
    utterance.onerror = event => {
      if (event.error === 'canceled' || event.error === 'interrupted') resolve();
      else reject(new Error(`Pronunciation failed (${event.error}). Check your installed Japanese voice.`));
    };
    speechSynthesis.speak(utterance);
  });
}
