import express, { type ErrorRequestHandler, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { progressSchema } from '../shared/progress.js';
import type { ProgressStore } from './store.js';

export const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://japanese.thestone.co.za'];
export interface AppDependencies {
  store: ProgressStore;
  verifyToken(token: string): Promise<string | null>;
  allowedOrigins?: string[];
}

const putSchema = z.object({
  progress: progressSchema,
  revision: z.number().int().min(0).max(2147483646),
}).strict();

export function createApp({ store, verifyToken, allowedOrigins = defaultOrigins }: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.vary('Origin');
    const origin = req.get('origin');
    if (origin && !allowedOrigins.includes(origin)) {
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }
    if (origin) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
      });
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.get('/api/health', (_req, res) => { res.json({ ok: true }); });
  const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };
  app.use('/api/progress', (req, res, next) => {
    void (async () => {
      const bearer = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') ?? '');
      const subject = bearer ? await verifyToken(bearer[1]) : null;
      if (!subject) {
        res.set('WWW-Authenticate', 'Bearer');
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      res.locals.subject = subject;
      next();
    })().catch(next);
  }, (req, res, next) => {
    if (req.method === 'PUT' && !req.is('application/json')) {
      res.status(415).json({ error: 'Content-Type must be application/json' });
      return;
    }
    next();
  });
  // Authentication runs before parsing potentially large request bodies.
  app.use(express.json({ limit: '1mb', strict: true }));
  app.get('/api/progress', asyncRoute(async (_req, res) => {
    res.json(await store.get(res.locals.subject as string));
  }));
  app.put('/api/progress', asyncRoute(async (req, res) => {
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid progress or revision' });
      return;
    }
    const { progress, revision } = parsed.data;
    const result = await store.put(res.locals.subject as string, progress, revision);
    res.status(result.saved ? 200 : 409).json(result.snapshot);
  }));
  app.all('/api/progress', (_req, res) => {
    res.set('Allow', 'GET, PUT, OPTIONS').status(405).json({ error: 'Method not allowed' });
  });
  app.use((_req, res) => { res.status(404).json({ error: 'Not found' }); });
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const type = error && typeof error === 'object' && 'type' in error ? error.type : '';
    if (type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body exceeds 1 MB' });
    } else if (type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON' });
    } else {
      console.error('Progress service request failed', error instanceof Error ? error.name : 'Unknown error');
      res.status(503).json({ error: 'Progress service temporarily unavailable' });
    }
  };
  app.use(errors);
  return app;
}
