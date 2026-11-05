import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createLocalJWKSet, errors, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createApp } from '../server/app.js';
import { createTokenVerifier } from '../server/auth.js';
import { emptyProgress, type Progress } from '../shared/progress.js';
import type { ProgressSnapshot, ProgressStore } from '../server/store.js';

function memoryStore(): ProgressStore {
  const rows = new Map<string, ProgressSnapshot>();
  const get = async (subject: string) => rows.get(subject) ?? { progress: null, revision: 0 };
  return {
    get: vi.fn(get),
    put: vi.fn(async (subject: string, progress: Progress, revision: number) => {
      const previous = await get(subject);
      if (previous.revision !== revision) return { saved: false, snapshot: previous };
      const snapshot = { progress, revision: revision + 1 };
      rows.set(subject, snapshot);
      return { saved: true, snapshot };
    }),
  };
}

describe('progress API', () => {
  let store: ProgressStore;
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    store = memoryStore();
    app = createApp({
      store,
      verifyToken: async token => token === 'alice-token' ? 'alice' : token === 'bob-token' ? 'bob' : null,
    });
  });

  it('exposes health without authentication or private configuration', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it.each([undefined, 'Basic abc', 'Bearer invalid', 'Bearer alice-token extra'])('denies unauthorized access: %s', async authorization => {
    const get = request(app).get('/api/progress');
    const put = request(app).put('/api/progress').send({ progress: emptyProgress(), revision: 0 });
    if (authorization) { get.set('Authorization', authorization); put.set('Authorization', authorization); }
    await get.expect(401);
    await put.expect(401);
    expect(store.get).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
  });

  it.each(['http://localhost:5173', 'http://127.0.0.1:5173', 'https://japanese.thestone.co.za'])('allows frontend preflight: %s', async origin => {
    const response = await request(app).options('/api/progress')
      .set('Origin', origin).set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'authorization,content-type').expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    expect(response.headers.vary).toContain('Origin');
    expect(store.get).not.toHaveBeenCalled();
  });

  it('rejects disallowed and lookalike origins, including preflight', async () => {
    for (const origin of ['https://evil.example', 'https://japanese.thestone.co.za.evil.example', 'null']) {
      const response = await request(app).get('/api/progress').set('Origin', origin).set('Authorization', 'Bearer alice-token').expect(403);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      await request(app).options('/api/progress').set('Origin', origin).expect(403);
    }
  });

  it('can replace the CORS allowlist for a deployment', async () => {
    const configured = createApp({ store, verifyToken: async () => null, allowedOrigins: ['https://preview.example'] });
    await request(configured).options('/api/progress').set('Origin', 'https://preview.example').expect(204);
    await request(configured).options('/api/progress').set('Origin', 'http://localhost:5173').expect(403);
  });

  it('returns an empty snapshot then saves progress and increments revisions', async () => {
    const initial = await request(app).get('/api/progress').set('Authorization', 'Bearer alice-token').expect(200);
    expect(initial.body).toEqual({ progress: null, revision: 0 });
    const progress = emptyProgress();
    const saved = await request(app).put('/api/progress').set('Authorization', 'Bearer alice-token').send({ progress, revision: 0 }).expect(200);
    expect(saved.body).toEqual({ progress, revision: 1 });
    const second = await request(app).put('/api/progress').set('Authorization', 'Bearer alice-token').send({ progress, revision: 1 }).expect(200);
    expect(second.body.revision).toBe(2);
    expect(store.put).toHaveBeenLastCalledWith('alice', progress, 1);
  });

  it('returns 409 with the current snapshot on stale revisions without overwriting', async () => {
    const progress = emptyProgress();
    await request(app).put('/api/progress').set('Authorization', 'Bearer alice-token').send({ progress, revision: 0 }).expect(200);
    const stale = await request(app).put('/api/progress').set('Authorization', 'Bearer alice-token')
      .send({ progress: { ...progress, settings: { ...progress.settings, dailyGoal: 42 } }, revision: 0 }).expect(409);
    expect(stale.body).toEqual({ progress, revision: 1 });
    const current = await request(app).get('/api/progress').set('Authorization', 'Bearer alice-token').expect(200);
    expect(current.body).toEqual(stale.body);
  });

  it('scopes all reads and writes to the authenticated subject, not a query user id', async () => {
    await request(app).put('/api/progress?userId=bob').set('Authorization', 'Bearer alice-token')
      .send({ progress: emptyProgress(), revision: 0 }).expect(200);
    const bob = await request(app).get('/api/progress?userId=alice').set('Authorization', 'Bearer bob-token').expect(200);
    expect(bob.body).toEqual({ progress: null, revision: 0 });
    expect(store.get).toHaveBeenLastCalledWith('bob');
  });

  it.each([
    {}, { progress: emptyProgress() }, { progress: emptyProgress(), revision: -1 },
    { progress: emptyProgress(), revision: 0.5 }, { progress: emptyProgress(), revision: '0' },
    { progress: emptyProgress(), revision: 0, userId: 'bob' },
    { progress: { ...emptyProgress(), version: 2 }, revision: 0 },
    { progress: { ...emptyProgress(), stats: { answers: -1, correct: 0, studyDays: [] } }, revision: 0 },
  ])('rejects invalid snapshots and browser supplied identities', async body => {
    await request(app).put('/api/progress').set('Authorization', 'Bearer alice-token').send(body).expect(400);
    expect(store.put).not.toHaveBeenCalled();
  });

  it('rejects malformed, oversized, and non-JSON bodies', async () => {
    await request(app).put('/api/progress').set('Authorization', 'Bearer alice-token')
      .set('Content-Type', 'application/json').send('{').expect(400);
    await request(app).put('/api/progress').set('Authorization', 'Bearer alice-token')
      .set('Content-Type', 'application/json').send(JSON.stringify({ oversized: 'x'.repeat(1024 * 1024) })).expect(413);
    await request(app).put('/api/progress').set('Authorization', 'Bearer alice-token')
      .set('Content-Type', 'text/plain').send('{}').expect(415);
    expect(store.put).not.toHaveBeenCalled();
  });

  it('returns sanitized service errors without exposing credentials', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(store.get).mockRejectedValue(new Error('postgres://secret:password@example/db'));
    try {
      const response = await request(app).get('/api/progress').set('Authorization', 'Bearer alice-token').expect(503);
      expect(JSON.stringify(response.body)).not.toContain('password');
      expect(response.body).toEqual({ error: 'Progress service temporarily unavailable' });
      expect(log).toHaveBeenCalledWith('Progress service request failed', 'Error');
    } finally { log.mockRestore(); }
  });

  it('reports authentication service outages without treating a session as invalid', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unavailable = createApp({ store, verifyToken: async () => { throw new errors.JWKSTimeout(); } });
    try {
      const response = await request(unavailable).get('/api/progress').set('Authorization', 'Bearer alice-token').expect(503);
      expect(response.body).toEqual({ error: 'Progress service temporarily unavailable' });
      expect(store.get).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith('Progress service request failed', 'JWKSTimeout');
    } finally { log.mockRestore(); }
  });

  it('rejects unsupported routes and methods', async () => {
    await request(app).post('/api/progress').set('Authorization', 'Bearer alice-token').expect(405);
    await request(app).get('/api/unknown').expect(404);
  });
});

describe('Managed Better Auth JWT validation', () => {
  it('propagates key-service network failures instead of rejecting a valid session', async () => {
    const { privateKey } = await generateKeyPair('EdDSA');
    const token = await new SignJWT({ sub: 'alice' }).setProtectedHeader({ alg: 'EdDSA' }).sign(privateKey);
    const verify = createTokenVerifier({ baseUrl: 'https://auth.example/neondb/auth' }, async () => { throw new errors.JWKSTimeout(); });
    await expect(verify(token)).rejects.toBeInstanceOf(errors.JWKSTimeout);
  });

  it('checks signature, EdDSA, origin issuer/audience, expiry, subject, and authenticated role', async () => {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA');
    const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'EdDSA', use: 'sig' };
    const origin = 'https://auth.example';
    const verify = createTokenVerifier({ baseUrl: `${origin}/neondb/auth` }, createLocalJWKSet({ keys: [jwk] }));
    const token = (claims: Record<string, unknown> = {}) => new SignJWT({
      sub: 'alice', iss: origin, aud: origin, role: 'authenticated',
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60,
      ...claims,
    }).setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' }).sign(privateKey);
    expect(await verify(await token())).toBe('alice');
    for (const claims of [
      { iss: `${origin}/neondb/auth` }, { aud: 'https://another.example' },
      { exp: 1 }, { sub: '' }, { role: 'anonymous' }, { banned: true },
    ]) expect(await verify(await token(claims))).toBeNull();
    const { privateKey: otherKey } = await generateKeyPair('EdDSA');
    const forged = await new SignJWT({ sub: 'alice', role: 'authenticated' })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' }).setIssuer(origin).setAudience(origin)
      .setIssuedAt().setExpirationTime('1m').sign(otherKey);
    expect(await verify(forged)).toBeNull();
    expect(await verify('invalid.jwt.token')).toBeNull();
  });
});
