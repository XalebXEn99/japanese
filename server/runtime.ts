import { config } from 'dotenv';
import { createApp, defaultOrigins } from './app.js';
import { createTokenVerifier } from './auth.js';
import { createProgressStore } from './store.js';

export function createRuntimeApp() {
  config({ path: '.env.local', quiet: true });
  config({ quiet: true });
  const { DATABASE_URL, NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL, CORS_ORIGINS } = process.env;
  if (!DATABASE_URL || !NEON_AUTH_BASE_URL) throw new Error('Backend environment is incomplete; run npm run db:setup');
  return createApp({
    store: createProgressStore(DATABASE_URL),
    verifyToken: createTokenVerifier({ baseUrl: NEON_AUTH_BASE_URL, jwksUrl: NEON_AUTH_JWKS_URL }),
    allowedOrigins: CORS_ORIGINS ? CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean) : defaultOrigins,
  });
}
