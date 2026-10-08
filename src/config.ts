import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export interface Config {
  clientId: string;
  clientSecret: string;
  redirectPort: number;
  outDir?: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Unix epoch milliseconds. */
  expiresAt: number;
}

export const DEFAULT_REDIRECT_PORT = 8477;
const SECRET_FILE_MODE = 0o600;

export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME ? env.XDG_CONFIG_HOME : join(homedir(), '.config');
  return join(base, 'oura-sync');
}

/**
 * Write to a temp file in the same directory, then rename over the target.
 * A crash mid-write leaves the previous file intact. Creates parent directories.
 */
export async function writeFileAtomic(path: string, contents: string, mode?: number): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${randomBytes(6).toString('hex')}.tmp`);
  try {
    await writeFile(tmp, contents, mode === undefined ? { encoding: 'utf8' } : { encoding: 'utf8', mode });
    await rename(tmp, path);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

async function readJson(path: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${path} is not valid JSON. Delete it and run \`oura-sync login\` again.`);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isConfig(v: unknown): v is Config {
  return (
    isRecord(v) &&
    typeof v.clientId === 'string' &&
    typeof v.clientSecret === 'string' &&
    typeof v.redirectPort === 'number' &&
    (v.outDir === undefined || typeof v.outDir === 'string')
  );
}

function isTokens(v: unknown): v is Tokens {
  return (
    isRecord(v) &&
    typeof v.accessToken === 'string' &&
    typeof v.refreshToken === 'string' &&
    typeof v.expiresAt === 'number'
  );
}

export async function readConfig(dir: string): Promise<Config | null> {
  const path = join(dir, 'config.json');
  const v = await readJson(path);
  if (v === null) return null;
  if (!isConfig(v)) throw new Error(`${path} is missing required fields. Delete it and run \`oura-sync login\` again.`);
  return v;
}

export function writeConfig(dir: string, config: Config): Promise<void> {
  return writeFileAtomic(join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n', SECRET_FILE_MODE);
}

export async function readTokens(dir: string): Promise<Tokens | null> {
  const path = join(dir, 'tokens.json');
  const v = await readJson(path);
  if (v === null) return null;
  if (!isTokens(v)) throw new Error(`${path} is missing required fields. Run \`oura-sync login\` again.`);
  return v;
}

export function writeTokens(dir: string, tokens: Tokens): Promise<void> {
  return writeFileAtomic(join(dir, 'tokens.json'), JSON.stringify(tokens, null, 2) + '\n', SECRET_FILE_MODE);
}

export interface OutDirOptions {
  flag?: string;
  env: NodeJS.ProcessEnv;
  config: Config | null;
  cwd: string;
}

/** Precedence: --out flag, OURA_SYNC_OUT, config.outDir, cwd. A leading ~ expands to the home directory. Relative paths resolve against cwd. */
export function resolveOutDir(opts: OutDirOptions): string {
  const chosen = opts.flag ?? (opts.env.OURA_SYNC_OUT || undefined) ?? opts.config?.outDir ?? opts.cwd;
  const expanded = chosen === '~' || chosen.startsWith('~/') ? homedir() + chosen.slice(1) : chosen;
  return resolve(opts.cwd, expanded);
}
