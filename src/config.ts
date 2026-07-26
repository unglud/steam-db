import type { OutputMode, PlatformName, ScriptConfig, SortKey } from "./steam-games.ts";

declare const process: {
  env: Record<string, string | undefined>;
};

// Edit this object to change repository defaults. Values in .env override these at runtime.
export const SCRIPT_CONFIG: ScriptConfig = {
  country: "MY",
  language: "english",
  euroApproximation: {
    myrToEurRate: 0.2145,
  },
  requestPacing: {
    searchDelayMs: 1000,
    appDetailsDelayMs: 1500,
    reviewSummaryDelayMs: 500,
  },
  retry: {
    maxAttempts: 8,
    baseDelayMs: 3000,
    maxDelayMs: 120000,
  },
  start: 0,
  pages: null,
  limit: null,
  maxCandidates: null,
  concurrency: 1,
  outputMode: "json",
  outputFile: "steam-games.json",
  outputRetention: {
    enabled: true,
    keepLast: 10,
  },
  progress: true,
  verbose: true,
  cache: {
    enabled: true,
    directory: ".cache/steam",
    cleanupExpired: true,
    searchTtlHours: 24,
    appDetailsTtlHours: 24,
    demoPageTtlHours: 168,
    reviewSummaryTtlHours: 72,
  },
  filters: {
    displayOnly: "Game",
    minDiscount: 25,
    minRating: 0,
    minRelease: "2000-01-01",
    minReviews: 500,
    os: "mac",
    sort: "demo_positive_desc",
    includeTags: [],
    excludeTags: [1625, 1664, 3799, 3843, 3859, 5537, 7178],
    ignoreNames: ["Undertale", "Hades", "Soulstone Survivors", "Nova Drift"],
    term: "",
  },
};

export function getScriptConfig(env: Record<string, string | undefined> = process.env): ScriptConfig {
  const config = structuredClone(SCRIPT_CONFIG);

  config.country = envString(env, "STEAM_COUNTRY", config.country);
  config.language = envString(env, "STEAM_LANG", config.language);
  config.euroApproximation.myrToEurRate = envNumber(
    env,
    "STEAM_MYR_TO_EUR_RATE",
    config.euroApproximation.myrToEurRate
  );

  config.start = envInteger(env, "STEAM_START", config.start);
  config.pages = envNullableInteger(env, "STEAM_PAGES", config.pages);
  config.limit = envNullableInteger(env, "STEAM_LIMIT", config.limit);
  config.maxCandidates = envNullableInteger(env, "STEAM_MAX_CANDIDATES", config.maxCandidates);
  config.concurrency = envInteger(env, "STEAM_CONCURRENCY", config.concurrency);
  config.outputMode = envEnum<OutputMode>(env, "STEAM_OUTPUT_MODE", config.outputMode, ["json", "ndjson"]);
  config.outputFile = envNullableString(env, "STEAM_GAMES_OUTPUT_FILE", config.outputFile);
  config.progress = envBoolean(env, "STEAM_PROGRESS", config.progress);
  config.verbose = envBoolean(env, "STEAM_VERBOSE", config.verbose);

  config.outputRetention.enabled = envBoolean(
    env,
    "STEAM_OUTPUT_RETENTION_ENABLED",
    config.outputRetention.enabled
  );
  config.outputRetention.keepLast = envInteger(
    env,
    "STEAM_OUTPUT_RETENTION_KEEP_LAST",
    config.outputRetention.keepLast
  );

  config.cache.enabled = envBoolean(env, "STEAM_CACHE_ENABLED", config.cache.enabled);
  config.cache.directory = envString(env, "STEAM_GAMES_CACHE_DIR", config.cache.directory);
  config.cache.cleanupExpired = envBoolean(env, "STEAM_CACHE_CLEANUP_EXPIRED", config.cache.cleanupExpired);
  config.cache.searchTtlHours = envNumber(env, "STEAM_CACHE_SEARCH_TTL_HOURS", config.cache.searchTtlHours);
  config.cache.appDetailsTtlHours = envNumber(
    env,
    "STEAM_CACHE_APP_DETAILS_TTL_HOURS",
    config.cache.appDetailsTtlHours
  );
  config.cache.demoPageTtlHours = envNumber(
    env,
    "STEAM_CACHE_DEMO_PAGE_TTL_HOURS",
    config.cache.demoPageTtlHours
  );
  config.cache.reviewSummaryTtlHours = envNumber(
    env,
    "STEAM_CACHE_REVIEW_SUMMARY_TTL_HOURS",
    config.cache.reviewSummaryTtlHours
  );

  config.requestPacing.searchDelayMs = envNumber(
    env,
    "STEAM_REQUEST_SEARCH_DELAY_MS",
    config.requestPacing.searchDelayMs
  );
  config.requestPacing.appDetailsDelayMs = envNumber(
    env,
    "STEAM_REQUEST_APP_DETAILS_DELAY_MS",
    config.requestPacing.appDetailsDelayMs
  );
  config.requestPacing.reviewSummaryDelayMs = envNumber(
    env,
    "STEAM_REQUEST_REVIEW_SUMMARY_DELAY_MS",
    config.requestPacing.reviewSummaryDelayMs
  );

  config.retry.maxAttempts = envInteger(env, "STEAM_RETRY_MAX_ATTEMPTS", config.retry.maxAttempts);
  config.retry.baseDelayMs = envNumber(env, "STEAM_RETRY_BASE_DELAY_MS", config.retry.baseDelayMs);
  config.retry.maxDelayMs = envNumber(env, "STEAM_RETRY_MAX_DELAY_MS", config.retry.maxDelayMs);

  config.filters.displayOnly = envString(env, "STEAM_FILTER_DISPLAY_ONLY", config.filters.displayOnly);
  config.filters.minDiscount = envNumber(env, "STEAM_FILTER_MIN_DISCOUNT", config.filters.minDiscount);
  config.filters.minRating = envNumber(env, "STEAM_FILTER_MIN_RATING", config.filters.minRating);
  config.filters.minRelease = envString(env, "STEAM_FILTER_MIN_RELEASE", config.filters.minRelease);
  config.filters.minReviews = envNumber(env, "STEAM_FILTER_MIN_REVIEWS", config.filters.minReviews);
  config.filters.os = envPlatformName(env, "STEAM_FILTER_OS", config.filters.os);
  config.filters.sort = envEnum<SortKey>(env, "STEAM_FILTER_SORT", config.filters.sort, [
    "discount_asc",
    "discount_desc",
    "rating_asc",
    "rating_desc",
    "reviews_asc",
    "reviews_desc",
    "positive_asc",
    "positive_desc",
    "demo_positive_desc",
    "release_asc",
    "release_desc",
    "price_asc",
    "price_desc",
  ]);
  config.filters.includeTags = envNumberList(env, "STEAM_FILTER_INCLUDE_TAGS", config.filters.includeTags);
  config.filters.excludeTags = envNumberList(env, "STEAM_FILTER_EXCLUDE_TAGS", config.filters.excludeTags);
  config.filters.ignoreNames = envStringList(env, "STEAM_FILTER_IGNORE_NAMES", config.filters.ignoreNames);
  config.filters.term = envString(env, "STEAM_FILTER_TERM", config.filters.term);

  return config;
}

function envString(env: Record<string, string | undefined>, name: string, fallback: string): string {
  const value = env[name];
  return value === undefined ? fallback : value;
}

function envNullableString(
  env: Record<string, string | undefined>,
  name: string,
  fallback: string | null
): string | null {
  const value = env[name];
  if (value === undefined) return fallback;
  if (isNullableFileString(value)) return null;
  return value;
}

function envNumber(env: Record<string, string | undefined>, name: string, fallback: number): number {
  const value = env[name];
  if (value === undefined || value.trim() === "") return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number.`);
  }
  return parsed;
}

function envInteger(env: Record<string, string | undefined>, name: string, fallback: number): number {
  const parsed = envNumber(env, name, fallback);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  return parsed;
}

function envNullableInteger(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number | null
): number | null {
  const value = env[name];
  if (value === undefined || value.trim() === "") return fallback;
  if (isNullableLimitString(value)) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer, "all", or "null".`);
  }
  return parsed;
}

function envBoolean(env: Record<string, string | undefined>, name: string, fallback: boolean): boolean {
  const value = env[name];
  if (value === undefined || value.trim() === "") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`${name} must be true or false.`);
}

function envEnum<T extends string>(
  env: Record<string, string | undefined>,
  name: string,
  fallback: T,
  supported: readonly T[]
): T {
  const value = env[name];
  if (value === undefined || value.trim() === "") return fallback;
  if (supported.includes(value as T)) return value as T;
  throw new Error(
    `${name} must be one of: ${supported.map((item) => (item === "" ? "<empty>" : item)).join(", ")}.`
  );
}

function envPlatformName(env: Record<string, string | undefined>, name: string, fallback: PlatformName): PlatformName {
  const value = env[name];
  if (value === undefined) return fallback;

  const normalized = value.trim().toLowerCase();
  if (normalized === "" || normalized === "all" || normalized === "any" || normalized === "none") return "";
  if (normalized === "windows") return "win";
  if (normalized === "macos") return "mac";
  if (normalized === "steamos") return "linux";

  return envEnum<PlatformName>({ [name]: normalized }, name, fallback, ["win", "mac", "linux", "applesilicon"]);
}

function envNumberList(env: Record<string, string | undefined>, name: string, fallback: number[]): number[] {
  const value = env[name];
  if (value === undefined) return fallback;
  if (value.trim() === "") return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const parsed = Number(item);
      if (!Number.isInteger(parsed)) {
        throw new Error(`${name} must be a comma-separated list of integers.`);
      }
      return parsed;
    });
}

function envStringList(env: Record<string, string | undefined>, name: string, fallback: string[]): string[] {
  const value = env[name];
  if (value === undefined) return fallback;
  if (value.trim() === "") return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isNullableLimitString(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "null" || normalized === "none" || normalized === "stdout" || normalized === "all";
}

function isNullableFileString(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "null" || normalized === "none" || normalized === "stdout";
}
