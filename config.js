import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Minimal .env loader — avoids needing the `dotenv` package.
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const contents = readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(rootDir, '.env'));

export const config = {
  rootDir,
  port: Number(process.env.PORT || 4000),
  authSecret: process.env.AUTH_SECRET || 'dev-only-insecure-secret-change-me',
  dbPath: path.resolve(rootDir, process.env.DB_PATH || './data/natural-stone-network.db'),
  corsOrigins: (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
