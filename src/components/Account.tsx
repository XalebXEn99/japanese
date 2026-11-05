import { useState } from 'react';
import { authClient } from '../lib/auth';
import Dialog from './Dialog';

export interface User { id: string; email: string; name?: string }
export function AccountButton({ user, ready, onClick }: { user: User | null; ready: boolean; onClick: () => void }) {
  const name = user?.name?.trim() || 'Account';
  const initial = Array.from(name.normalize('NFC'))[0]?.toLocaleUpperCase() ?? 'A';
  return <button className={`account-button${user ? ' account-avatar' : ''}`} aria-label={user ? `Account: ${name}` : undefined} title={user ? name : undefined} onClick={onClick}>
    {!ready ? 'Connecting…' : user ? initial : 'Sign in'}
  </button>;
}

export default function Account({ user, error, onSession, onError, onClose }: {
  user: User | null; error: string; onSession: () => Promise<void>; onError: (message: string) => void; onClose: () => void;
}) {
  const resetToken = new URLSearchParams(location.search).get('token');
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>(resetToken ? 'reset' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <Dialog className="account-dialog" title={user ? 'Your account' : mode === 'signup' ? 'Create an account' : mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : 'Welcome back'} onClose={onClose}><section className="account">
    {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => onError('')} aria-label="Dismiss error">Dismiss</button></div>}
    {!authClient ? <p className="feedback incorrect">Accounts are not configured for this deployment. Guest study still works. Configure the public Neon Auth URL to enable accounts.</p> : user ? <>
      <p>Signed in as <strong>{user.email}</strong>.</p><p>Your study progress syncs to your account. Guest progress is kept separate until you choose to import it in Settings.</p>
      <button disabled={busy} onClick={async () => {
        setBusy(true); onError('');
        try { if (!authClient) throw new Error('Accounts are not configured.'); const result = await authClient.signOut(); if (result.error) throw new Error(result.error.message); await onSession(); onClose(); }
        catch (error) { onError(error instanceof Error ? error.message : 'Sign out failed.'); }
        finally { setBusy(false); }
      }}>Sign out</button>
    </> : <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setMessage(''); onError('');
      try {
        if (!authClient) throw new Error('Authentication is not configured.');
        if (mode === 'forgot') {
          const result = await authClient.requestPasswordReset({ email, redirectTo: `${location.origin}${location.pathname}#account` });
          if (result.error) throw new Error(result.error.message);
          setMessage('If this email has an account, password-reset instructions have been sent.');
        } else if (mode === 'reset') {
          if (!resetToken) throw new Error('This password-reset link is missing its token.');
          const result = await authClient.resetPassword({ newPassword: password, token: resetToken });
          if (result.error) throw new Error(result.error.message);
          history.replaceState(null, '', `${location.pathname}#account`);
          setMode('signin'); setPassword(''); setMessage('Password updated. Sign in with your new password.');
        } else {
          const result = mode === 'signup' ? await authClient.signUp.email({ email, password, name }) : await authClient.signIn.email({ email, password });
          if (result.error) throw new Error(result.error.message || 'Authentication failed.');
          await onSession();
          setMessage(mode === 'signup' ? 'Account created. If verification is required, check your email before signing in.' : 'Signed in successfully.');
        }
      } catch (error) { onError(error instanceof Error ? error.message : 'Authentication request failed.'); }
      finally { setBusy(false); }
    }}>
      {mode === 'signup' && <label>Name <input required value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={100} /></label>}
      {mode !== 'reset' && <label>Email <input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></label>}
      {mode !== 'forgot' && <label>Password <input type="password" minLength={8} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>}
      <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset email' : mode === 'reset' ? 'Update password' : 'Sign in'}</button>
      <div className="button-row">{mode !== 'reset' && <button type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setMessage(''); }}>{mode === 'signup' ? 'Already have an account?' : 'Create an account'}</button>}{mode === 'signin' && <button type="button" onClick={() => setMode('forgot')}>Forgot password</button>}{mode === 'forgot' && <button type="button" onClick={() => setMode('signin')}>Back to sign in</button>}</div>
    </form>}
    {message && <p className="feedback correct" role="status">{message}</p>}
  </section></Dialog>;
}
