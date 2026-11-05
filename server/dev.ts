import { setDefaultResultOrder } from 'node:dns';
import { setDefaultAutoSelectFamily } from 'node:net';
import { createRuntimeApp } from './runtime.js';

try {
  // Avoid intermittent dual-stack connection timeouts on Windows development hosts.
  if (process.platform === 'win32') {
    setDefaultResultOrder('ipv4first');
    setDefaultAutoSelectFamily(false);
  }
  const app = createRuntimeApp();
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`Japanese API listening on http://127.0.0.1:${port}`);
  });
  server.on('error', () => {
    console.error('Unable to start API listener');
    process.exitCode = 1;
  });
} catch {
  console.error('Unable to start API. Check server environment and run npm run db:setup.');
  process.exitCode = 1;
}
