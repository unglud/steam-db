import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { SCRIPT_CONFIG, runSteamGames, type ScriptConfig } from "./steam-games.ts";

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
  on(event: "SIGINT" | "SIGTERM", listener: () => void): void;
};

type SchedulerState = {
  running: boolean;
  lastRunStartedAt: string | null;
  lastRunFinishedAt: string | null;
  lastRunError: string | null;
  lastOutputFile: string | null;
  nextRunAt: string | null;
};

type ServerConfig = {
  host: string;
  port: number;
  intervalMs: number;
  scriptConfig: ScriptConfig;
};

const DEFAULT_DOCKER_OUTPUT_FILE = "/data/steam-games.json";
const DEFAULT_DOCKER_CACHE_DIR = "/data/.cache/steam";
const DEFAULT_INTERVAL_HOURS = 24;

export function buildServerConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const scriptConfig = structuredClone(SCRIPT_CONFIG);

  scriptConfig.outputFile = env.STEAM_GAMES_OUTPUT_FILE ?? defaultOutputFile(env);
  scriptConfig.cache.directory = env.STEAM_GAMES_CACHE_DIR ?? defaultCacheDirectory(env);

  return {
    host: env.HOST ?? "0.0.0.0",
    port: parsePositiveInteger(env.PORT, 3000, "PORT"),
    intervalMs: parsePositiveNumber(env.STEAM_GAMES_INTERVAL_HOURS, DEFAULT_INTERVAL_HOURS, "STEAM_GAMES_INTERVAL_HOURS") *
      60 *
      60 *
      1000,
    scriptConfig,
  };
}

export async function findLatestResultFile(outputFile: string | null): Promise<string | null> {
  if (outputFile === null) return null;

  const outputDir = dirname(outputFile);
  const ext = extname(outputFile);
  const baseName = basename(outputFile, ext);
  let entries;
  try {
    entries = await readdir(outputDir === "." ? "." : outputDir, { withFileTypes: true });
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return null;
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !matchesOutputFileName(entry.name, baseName, ext)) continue;

    const path = join(outputDir, entry.name);
    const stats = await stat(path);
    files.push({
      path,
      name: entry.name,
      sortTime: outputFileSortTime(entry.name, baseName, ext, stats.mtimeMs),
    });
  }

  files.sort((a, b) => b.sortTime - a.sortTime || b.name.localeCompare(a.name));
  return files[0]?.path ?? null;
}

export async function readLatestResultContent(
  outputFile: string | null,
  knownLatestFile: string | null = null
): Promise<{ path: string; body: string } | null> {
  const latestFile = knownLatestFile ?? (await findLatestResultFile(outputFile));
  if (latestFile === null) return null;

  return {
    path: latestFile,
    body: await readFile(latestFile, "utf8"),
  };
}

export function shouldRunStartupCrawl(latestResultFile: string | null): boolean {
  return latestResultFile === null;
}

export async function startSchedulerServer(
  serverConfig: ServerConfig = buildServerConfig(),
  runGames: (scriptConfig: ScriptConfig) => Promise<void> = runSteamGames
): Promise<{ close: () => Promise<void>; port: number; state: SchedulerState }> {
  const state: SchedulerState = {
    running: false,
    lastRunStartedAt: null,
    lastRunFinishedAt: null,
    lastRunError: null,
    lastOutputFile: await findLatestResultFile(serverConfig.scriptConfig.outputFile),
    nextRunAt: null,
  };

  const runOnce = async (reason: string): Promise<void> => {
    if (state.running) {
      log(`Skipping ${reason} run because another run is still active.`);
      return;
    }

    state.running = true;
    state.lastRunStartedAt = new Date().toISOString();
    state.lastRunFinishedAt = null;
    state.lastRunError = null;
    log(`Starting ${reason} run.`);

    try {
      await runGames(serverConfig.scriptConfig);
      state.lastOutputFile = await findLatestResultFile(serverConfig.scriptConfig.outputFile);
      log(`Finished ${reason} run. Latest output: ${state.lastOutputFile ?? "none"}.`);
    } catch (error) {
      state.lastRunError = errorMessage(error);
      log(`Failed ${reason} run: ${state.lastRunError}`);
    } finally {
      state.running = false;
      state.lastRunFinishedAt = new Date().toISOString();
      state.nextRunAt = new Date(Date.now() + serverConfig.intervalMs).toISOString();
    }
  };

  const server = createServer((request, response) => {
    void handleRequest(request, response, state, serverConfig.scriptConfig.outputFile);
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(serverConfig.port, serverConfig.host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  const shownPort = typeof address === "object" && address !== null ? address.port : serverConfig.port;
  log(`Server listening on ${serverConfig.host}:${shownPort}.`);

  if (shouldRunStartupCrawl(state.lastOutputFile)) {
    void runOnce("startup");
  } else {
    log(`Skipping startup run because existing output was found: ${state.lastOutputFile}.`);
  }
  const interval = setInterval(() => {
    void runOnce("scheduled");
  }, serverConfig.intervalMs);
  state.nextRunAt = new Date(Date.now() + serverConfig.intervalMs).toISOString();

  const close = async (): Promise<void> => {
    clearInterval(interval);
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error) rejectClose(error);
        else resolveClose();
      });
    });
  };

  return { close, port: shownPort, state };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: SchedulerState,
  outputFile: string | null
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (url.pathname === "/health") {
    sendJson(response, 200, state);
    return;
  }

  if (url.pathname !== "/" && url.pathname !== "/games") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  let latestResult;
  try {
    latestResult = await readLatestResultContent(outputFile, state.lastOutputFile);
  } catch (error) {
    sendJson(response, 500, {
      error: "Could not read latest result file",
      detail: errorMessage(error),
    });
    return;
  }

  if (latestResult === null) {
    sendJson(response, 404, {
      error: "No result file available yet",
      running: state.running,
    });
    return;
  }

  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-steam-games-result-file": resolve(latestResult.path),
  });
  response.end(latestResult.body);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function defaultOutputFile(env: Record<string, string | undefined>): string {
  return env.STEAM_GAMES_DOCKER === "1" ? DEFAULT_DOCKER_OUTPUT_FILE : SCRIPT_CONFIG.outputFile ?? "steam-games.json";
}

function defaultCacheDirectory(env: Record<string, string | undefined>): string {
  return env.STEAM_GAMES_DOCKER === "1" ? DEFAULT_DOCKER_CACHE_DIR : SCRIPT_CONFIG.cache.directory;
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = value === undefined ? fallback : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parsePositiveNumber(value: string | undefined, fallback: number, name: string): number {
  const parsed = value === undefined ? fallback : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return parsed;
}

function matchesOutputFileName(fileName: string, baseName: string, ext: string): boolean {
  return fileName === `${baseName}${ext}` || (fileName.startsWith(`${baseName}-`) && fileName.endsWith(ext));
}

function outputFileSortTime(fileName: string, baseName: string, ext: string, fallbackTime: number): number {
  return outputFileTimestamp(fileName, baseName, ext) ?? fallbackTime;
}

function outputFileTimestamp(fileName: string, baseName: string, ext: string): number | null {
  const prefix = `${baseName}-`;
  if (!fileName.startsWith(prefix) || !fileName.endsWith(ext)) return null;

  const withoutPrefix = fileName.slice(prefix.length, fileName.length - ext.length);
  const match = withoutPrefix.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z(?:-\d+)?$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second, millisecond] = match;
  return Date.UTC(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10),
    Number.parseInt(hour, 10),
    Number.parseInt(minute, 10),
    Number.parseInt(second, 10),
    Number.parseInt(millisecond, 10)
  );
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function log(message: string): void {
  process.stderr.write(`[steam-games-server] ${message}\n`);
}

function isDirectExecution(): boolean {
  const scriptPath = process.argv[1];
  return scriptPath !== undefined && import.meta.url === pathToFileURL(scriptPath).href;
}

if (isDirectExecution()) {
  let closeServer: (() => Promise<void>) | null = null;

  startSchedulerServer().then(({ close }) => {
    closeServer = close;
  }).catch((error: unknown) => {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      log(`Received ${signal}; shutting down.`);
      void closeServer?.().catch((error: unknown) => {
        process.stderr.write(`${errorMessage(error)}\n`);
        process.exitCode = 1;
      });
    });
  }
}
