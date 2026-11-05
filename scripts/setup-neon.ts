import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

let stage = 'loading environment';
async function setup() {
  const path = process.env.NEON_ENV_FILE || '.env.local';
  const loaded = config({ path, quiet: true });
  if (loaded.error) throw loaded.error;
  const { DATABASE_URL_UNPOOLED, NEON_AUTH_BASE_URL, NEON_DATA_API_URL } = process.env;
  if (!DATABASE_URL_UNPOOLED || !NEON_AUTH_BASE_URL || !NEON_DATA_API_URL) {
    throw new Error("Pull the same branch's postgres, auth, and data-api environment before setup.");
  }
  stage = 'reading progress schema';
  const sql = neon(DATABASE_URL_UNPOOLED);
  const schemas = await Promise.all(['schema.sql', 'data-api.sql'].map(name =>
    readFile(fileURLToPath(new URL(`../server/${name}`, import.meta.url)), 'utf8')));
  stage = 'applying progress schema';
  await sql.transaction(schemas.map(schema => sql.query(schema)));
  stage = 'writing frontend aliases';
  let contents = await readFile(path, 'utf8');
  const aliases = { VITE_NEON_AUTH_URL: NEON_AUTH_BASE_URL, VITE_NEON_DATA_API_URL: NEON_DATA_API_URL };
  for (const [key, value] of Object.entries(aliases)) {
    const line = `${key}=${JSON.stringify(value)}`;
    const existing = new RegExp(`^${key}=.*$`, 'm');
    contents = existing.test(contents) ? contents.replace(existing, () => line) : `${contents.trimEnd()}\n${line}\n`;
  }
  await writeFile(path, contents);
  console.log(`Protected progress schema ready; public Auth/Data API aliases written to ${path}. Existing user data was preserved.`);
}

setup().catch(() => {
  console.error(`Neon setup failed while ${stage}. Check connectivity, server credentials, and enabled Managed Auth; credentials have not been logged.`);
  process.exitCode = 1;
});
