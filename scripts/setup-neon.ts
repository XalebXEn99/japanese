import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

let stage = 'loading environment';
async function setup() {
  config({ path: '.env.local', quiet: true });
  config({ quiet: true });
  const { DATABASE_URL, NEON_AUTH_BASE_URL } = process.env;
  if (!DATABASE_URL || !NEON_AUTH_BASE_URL) {
    throw new Error('Run neon deploy and neon env pull --file .env.local before setup');
  }
  stage = 'reading progress schema';
  const sql = neon(DATABASE_URL);
  const schema = await readFile(fileURLToPath(new URL('../server/schema.sql', import.meta.url)), 'utf8');
  stage = 'applying progress schema';
  await sql.query(schema);
  stage = 'writing frontend aliases';
  const path = '.env.local';
  let contents = await readFile(path, 'utf8').catch(() => '');
  const aliases = { VITE_NEON_AUTH_URL: NEON_AUTH_BASE_URL, VITE_API_URL: '' };
  for (const [key, value] of Object.entries(aliases)) {
    const line = `${key}=${JSON.stringify(value)}`;
    const existing = new RegExp(`^${key}=.*$`, 'm');
    contents = existing.test(contents) ? contents.replace(existing, () => line) : `${contents.trimEnd()}\n${line}\n`;
  }
  await writeFile(path, contents);
  console.log('Progress schema ready; public frontend auth aliases written to .env.local. No user data changed.');
}

setup().catch(() => {
  console.error(`Neon setup failed while ${stage}. Check connectivity, server credentials, and enabled Managed Auth; credentials have not been logged.`);
  process.exitCode = 1;
});
