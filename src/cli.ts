import { execFile } from 'node:child_process';
import { platform } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { OuraApi } from './api.ts';
import { login, refreshTokens } from './auth.ts';
import {
  configDir as defaultConfigDir,
  DEFAULT_REDIRECT_PORT,
  readConfig,
  readTokens,
  resolveOutDir,
  writeConfig,
  writeFileAtomic,
  writeTokens,
  type Config,
  type Tokens,
} from './config.ts';
import { assembleDays, toCsv } from './csv.ts';
import { exportFileName, previousDay, resolveRange, todayLocal } from './dates.ts';
import { ApiError, AuthRequiredError, NoDataError, UsageError } from './errors.ts';
import type { DailyActivity, DailyReadiness, DailySleep, SleepPeriod } from './oura-types.ts';

const REFRESH_MARGIN_MS = 60_000;

export const USAGE = `Usage:
  oura-sync login                       Authorize with Oura (one-time app setup, then browser login)
  oura-sync export --start YYYY-MM-DD [options]
                                        Write <start>-to-<end>-oura-trends.csv (default command)

Options:
  --start YYYY-MM-DD   First day to export (required)
  --end YYYY-MM-DD     Last day to export (default: yesterday)
  --out DIR            Output directory (default: $OURA_SYNC_OUT, then config outDir, then cwd)
  -h, --help           Show this help`;

export interface ExportArgs {
  start?: string;
  end?: string;
  out?: string;
}

export interface ExportDeps {
  configDir: string;
  env: NodeJS.ProcessEnv;
  cwd: string;
  /** Local calendar date, YYYY-MM-DD. */
  today: string;
  fetchFn?: typeof fetch;
  log: (message: string) => void;
}

export async function runExport(args: ExportArgs, deps: ExportDeps): Promise<string> {
  const config = await readConfig(deps.configDir);
  if (!config) throw new AuthRequiredError('No configuration found. Run `oura-sync login` first.');
  const stored = await readTokens(deps.configDir);
  if (!stored) throw new AuthRequiredError('Not logged in. Run `oura-sync login`.');
  let tokens: Tokens = stored;

  const range = resolveRange({ start: args.start, end: args.end, defaultEnd: previousDay(deps.today) });
  const outDir = resolveOutDir({ flag: args.out, env: deps.env, config, cwd: deps.cwd });

  // Save before use: the old refresh token is consumed the moment Oura answers.
  const refresh = async (): Promise<string> => {
    tokens = await refreshTokens({ config, tokens, fetchFn: deps.fetchFn });
    await writeTokens(deps.configDir, tokens);
    return tokens.accessToken;
  };
  const api = new OuraApi({
    fetchFn: deps.fetchFn,
    getAccessToken: async () => (tokens.expiresAt - Date.now() < REFRESH_MARGIN_MS ? refresh() : tokens.accessToken),
    refreshAccessToken: refresh,
  });

  // Sequential on purpose: a concurrent 401 would trigger overlapping refreshes.
  const dailySleep = await api.fetchCollection<DailySleep>('daily_sleep', range.start, range.end);
  const sleep = await api.fetchCollection<SleepPeriod>('sleep', range.start, range.end);
  const readiness = await api.fetchCollection<DailyReadiness>('daily_readiness', range.start, range.end);
  const activity = await api.fetchCollection<DailyActivity>('daily_activity', range.start, range.end);

  const records = assembleDays({ dailySleep, sleep, readiness, activity }, range);
  if (records.length === 0) {
    throw new NoDataError(`Oura returned no data for ${range.start} to ${range.end}. Nothing written.`);
  }
  const path = join(outDir, exportFileName(range.start, range.end));
  await writeFileAtomic(path, toCsv(records));
  deps.log(`Wrote ${records.length} row${records.length === 1 ? '' : 's'} (${range.start} to ${range.end}) to ${path}`);
  return path;
}

export interface LoginDeps {
  configDir: string;
  prompt: (question: string) => Promise<string>;
  log: (message: string) => void;
  fetchFn?: typeof fetch;
  openBrowser?: (url: string) => Promise<void>;
  timeoutMs?: number;
  /** Port stored in a newly created config. Defaults to DEFAULT_REDIRECT_PORT. */
  redirectPort?: number;
}

export async function runLogin(deps: LoginDeps): Promise<void> {
  let config: Config | null = await readConfig(deps.configDir);
  if (!config) {
    const port = deps.redirectPort ?? DEFAULT_REDIRECT_PORT;
    deps.log('No Oura app configured yet. Create one at https://cloud.ouraring.com/oauth/applications');
    deps.log(`with redirect URI http://localhost:${port}/callback, then enter its credentials.`);
    const clientId = (await deps.prompt('Client ID: ')).trim();
    const clientSecret = (await deps.prompt('Client secret: ')).trim();
    if (!clientId || !clientSecret) throw new UsageError('Client ID and client secret are both required.');
    config = { clientId, clientSecret, redirectPort: port };
    await writeConfig(deps.configDir, config);
    deps.log(`Saved ${join(deps.configDir, 'config.json')}`);
  }
  const tokens = await login({
    config,
    fetchFn: deps.fetchFn,
    openBrowser: deps.openBrowser,
    log: deps.log,
    timeoutMs: deps.timeoutMs,
  });
  await writeTokens(deps.configDir, tokens);
  deps.log(`Logged in. Tokens saved to ${join(deps.configDir, 'tokens.json')}`);
}

function openBrowser(url: string): Promise<void> {
  const [cmd, args]: [string, string[]] =
    platform() === 'darwin' ? ['open', [url]] : platform() === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
  });
}

async function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

const OPTIONS = {
  start: { type: 'string' },
  end: { type: 'string' },
  out: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const;

export async function main(argv: string[]): Promise<number> {
  let values: { start?: string; end?: string; out?: string; help?: boolean };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true }));
  } catch (err) {
    console.error(`${(err as Error).message}\n\n${USAGE}`);
    return 1;
  }
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const command = positionals[0] ?? 'export';
  const log = (m: string) => console.log(m);
  try {
    if (command === 'login') {
      await runLogin({ configDir: defaultConfigDir(), prompt: promptLine, log, openBrowser });
    } else if (command === 'export') {
      await runExport(
        { start: values.start, end: values.end, out: values.out },
        { configDir: defaultConfigDir(), env: process.env, cwd: process.cwd(), today: todayLocal(), log },
      );
    } else {
      console.error(`Unknown command "${command}"\n\n${USAGE}`);
      return 2;
    }
    return 0;
  } catch (err) {
    if (
      err instanceof UsageError ||
      err instanceof AuthRequiredError ||
      err instanceof ApiError ||
      err instanceof NoDataError
    ) {
      console.error(err.message);
      return 1;
    }
    throw err;
  }
}
