import { createAuthClient } from '@neon/auth';
import { z } from 'zod';

export const authClient = import.meta.env.VITE_NEON_AUTH_URL
  ? createAuthClient(import.meta.env.VITE_NEON_AUTH_URL)
  : null;

export async function accessToken(): Promise<string> {
  if (!authClient) throw new Error('Accounts are not configured. Set VITE_NEON_AUTH_URL to your Neon Auth URL.');
  // Neon injects the JWT into session.token and caches the session for token requests too.
  const { data, error } = await authClient.getSession();
  if (error) throw new Error(error.message || 'Your session expired. Sign in again to sync.');
  return z.object({ session: z.object({ token: z.string().min(1) }) }).parse(data).session.token;
}
