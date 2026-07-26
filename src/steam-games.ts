declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
};

type OutputMode = "json" | "ndjson";
type SortKey =
  | "discount_asc"
  | "discount_desc"
  | "rating_asc"
  | "rating_desc"
  | "reviews_asc"
  | "reviews_desc"
  | "positive_asc"
  | "positive_desc"
  | "demo_positive_desc"
  | "release_asc"
  | "release_desc"
  | "price_asc"
  | "price_desc";

type PlatformName = "win" | "mac" | "linux" | "applesilicon" | "";

type RuntimeConfig = {
  limit: number | null;
  pages: number | null;
  maxCandidates: number | null;
  start: number;
  concurrency: number;
  country: string;
  language: string;
  euroApproximation: EuroApproximationConfig;
  requestPacing: RequestPacingConfig;
  retry: RetryConfig;
  outputMode: OutputMode;
  outputFile: string | null;
  outputRetention: OutputRetentionConfig;
  progress: boolean;
  verbose: boolean;
  cache: CacheConfig;
};

type EditableFilters = {
  displayOnly: string;
  minDiscount: number;
  minRating: number;
  minRelease: string;
  minReviews: number;
  os: PlatformName;
  sort: SortKey;
  includeTags: number[];
  excludeTags: number[];
  ignoreNames: string[];
  term: string;
};

type ScriptConfig = RuntimeConfig & {
  filters: EditableFilters;
};

type EuroApproximationConfig = {
  myrToEurRate: number;
};

type RequestPacingConfig = {
  searchDelayMs: number;
  appDetailsDelayMs: number;
  reviewSummaryDelayMs: number;
};

type RetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

type OutputRetentionConfig = {
  enabled: boolean;
  keepLast: number;
};

type CacheConfig = {
  enabled: boolean;
  directory: string;
  cleanupExpired: boolean;
  searchTtlHours: number;
  appDetailsTtlHours: number;
  reviewSummaryTtlHours: number;
};

type OutputWriter = {
  path: string | null;
  write(chunk: string): Promise<void>;
  close(): Promise<void>;
};

type Filters = {
  displayOnly: string;
  minDiscount: number;
  minRating: number;
  minRelease: string;
  minReleaseTime: number;
  minReviews: number;
  os: PlatformName;
  sort: SortKey;
  includeTags: number[];
  excludeTags: number[];
  ignoreNames: string[];
  ignoreNameKeys: Set<string>;
  term: string;
};

type SearchItem = {
  name?: string;
  logo?: string;
};

type SearchResponse = {
  items?: SearchItem[];
};

type PriceOverview = {
  currency?: string;
  initial?: number;
  final?: number;
  discount_percent?: number;
  initial_formatted?: string;
  final_formatted?: string;
};

type StoreDetails = {
  name?: string;
  steam_appid?: number;
  short_description?: string;
  price_overview?: PriceOverview;
  platforms?: {
    windows?: boolean;
    mac?: boolean;
    linux?: boolean;
  };
  release_date?: {
    coming_soon?: boolean;
    date?: string;
  };
  demos?: Array<{ appid?: number; description?: string }>;
  genres?: Array<{ id?: string; description?: string }>;
};

type AppDetailsResponse = Record<
  string,
  {
    success?: boolean;
    data?: StoreDetails;
  }
>;

type ReviewSummary = {
  review_score?: number;
  review_score_desc?: string;
  total_positive?: number;
  total_negative?: number;
  total_reviews?: number;
};

type ReviewResponse = {
  success?: number;
  query_summary?: ReviewSummary;
};

type RequestNamespace = "search" | "appdetails" | "reviews";

type Candidate = {
  appid: number;
  name?: string;
};

type GamePrice = {
  currency: string | null;
  initial: number | null;
  final: number | null;
  discountPercent: number;
  initialFormatted: string | null;
  finalFormatted: string | null;
  euroApproximation: GamePriceEuroApproximation;
};

type GamePriceEuroApproximation = {
  currency: "EUR";
  sourceCurrency: string | null;
  sourceToEurRate: number;
  initial: number | null;
  final: number | null;
  initialFormatted: string | null;
  finalFormatted: string | null;
};

type GameReviews = {
  score: number | null;
  scoreDescription: string | null;
  total: number;
  positive: number;
  negative: number;
  positivePercent: number | null;
};

type GameGenre = {
  id: string | null;
  description: string | null;
};

type GameResult = {
  appid: number;
  name: string;
  steamUrl: string;
  description: string | null;
  demoAvailable: boolean;
  releaseDate: string | null;
  price: GamePrice;
  reviews: GameReviews;
  genres: GameGenre[];
  internal: {
    releaseTimestamp: number | null;
    platforms: {
      windows: boolean;
      mac: boolean;
      linux: boolean;
    };
  };
};

type SerializableGamePrice = {
  discountPercent: number;
  finalFormatted: string | null;
  finalEuroFormatted: string | null;
};

type SerializableGameResult = {
  appid: number;
  name: string;
  steamUrl: string;
  description: string | null;
  demoAvailable: boolean;
  releaseDate: string | null;
  price: SerializableGamePrice;
  reviews: GameReviews;
  genres: GameGenre[];
};

type FilterDecision = {
  matched: boolean;
  reason: string | null;
};

// Edit this block to change what `pnpm run games` returns.
const SCRIPT_CONFIG: ScriptConfig = {
  country: "MY",
  language: process.env.STEAM_LANG ?? "english",
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
    ignoreNames: ['Undertale', 'Hades'],
    term: "",
  },
};

const USER_AGENT = "steam-db-ts-script/0.1 (+https://store.steampowered.com)";
const SEARCH_PAGE_SIZE = 50;
const requestQueues = new Map<RequestNamespace, Promise<void>>();
const lastRequestAt = new Map<RequestNamespace, number>();
const DETAIL_FILTERS = [
  "basic",
  "price_overview",
  "release_date",
  "platforms",
  "demos",
  "genres",
].join(",");

async function main(): Promise<void> {
  const config = normalizeRuntimeConfig(SCRIPT_CONFIG);
  const filters = normalizeFilters(SCRIPT_CONFIG.filters);
  const outputWriter = await createOutputWriter(config);
  const warnings: string[] = [];
  let completed = false;

  try {
    logProgress(config, "Starting Steam search.");
    logVerbose(config, `Runtime options: ${JSON.stringify(serializableOptions(config))}`);
    logVerbose(config, `Normalized filters: ${JSON.stringify(serializableFilters(filters))}`);
    if (outputWriter.path !== null) {
      logProgress(config, `Writing ${config.outputMode.toUpperCase()} output to ${outputWriter.path}.`);
    } else {
      logVerbose(config, "Writing output to stdout.");
    }
    if (config.pages === null && config.maxCandidates === null && config.limit === null) {
      logProgress(config, "Full crawl enabled: this can take several minutes and may hit Steam rate limits.");
    }
    if (config.cache.enabled && config.cache.cleanupExpired) {
      logVerbose(config, `Cleaning expired cache files under ${config.cache.directory}.`);
      const removedCacheFiles = await cleanupExpiredCache(config);
      if (removedCacheFiles > 0) {
        logProgress(config, `Removed ${removedCacheFiles} expired cache file(s).`);
      } else {
        logVerbose(config, "No expired cache files found.");
      }
    } else if (!config.cache.enabled) {
      logVerbose(config, "Cache disabled; every request will fetch fresh Steam data.");
    } else {
      logVerbose(config, "Expired cache cleanup disabled.");
    }

    if (filters.os === "applesilicon") {
      warnings.push(
        "Steam's public store APIs expose macOS filtering, but not a reliable Apple Silicon-native flag; this query uses os=mac."
      );
    }

    const discoveredCandidates = await fetchSearchCandidates(filters, config);
    const candidates =
      config.maxCandidates === null ? discoveredCandidates : discoveredCandidates.slice(0, config.maxCandidates);
    if (config.maxCandidates !== null && discoveredCandidates.length > candidates.length) {
      logVerbose(
        config,
        `Limiting candidates from ${discoveredCandidates.length} to maxCandidates=${config.maxCandidates}.`
      );
    }
    logProgress(config, `Discovered ${discoveredCandidates.length} candidate(s); processing ${candidates.length}.`);

    const skippedCandidates: string[] = [];
    let processedCandidates = 0;
    const games = await mapConcurrent(candidates, config.concurrency, async (candidate) => {
      try {
        logVerbose(config, `Processing candidate ${candidateLabel(candidate)}.`);
        const game = await enrichCandidate(candidate, config);
        if (game === null) {
          logVerbose(config, `Candidate ${candidateLabel(candidate)} returned no appdetails data.`);
        } else {
          logVerbose(
            config,
            `Candidate ${candidateLabel(candidate)} enriched as ${gameLabel(game)}; demo=${game.demoAvailable}; price=${game.price.finalFormatted ?? game.price.final ?? "n/a"} ${game.price.currency ?? ""}; positive=${game.reviews.positive}; totalReviews=${game.reviews.total}.`
          );
        }
        if (config.outputMode === "ndjson" && game !== null) {
          const decision = filterGame(game, filters);
          if (decision.matched) {
            await outputWriter.write(`${JSON.stringify(serializeGame(game))}\n`);
            logVerbose(config, `Wrote NDJSON game line for ${gameLabel(game)}.`);
          } else {
            logVerbose(config, `Skipped NDJSON game line for ${gameLabel(game)}: ${decision.reason}.`);
          }
        }
        return game;
      } catch (error) {
        const message = errorMessage(error).split("\n")[0];
        logVerbose(config, `Candidate ${candidateLabel(candidate)} failed: ${message}`);
        skippedCandidates.push(`${candidate.appid}: ${message}`);
        return null;
      } finally {
        processedCandidates += 1;
        if (processedCandidates === candidates.length || processedCandidates % 25 === 0) {
          logProgress(config, `Processed ${processedCandidates}/${candidates.length} candidate(s).`);
        }
      }
    });

    if (skippedCandidates.length > 0) {
      const rateLimitHint = skippedCandidates.some((error) => error.includes("429 Too Many Requests"))
        ? " Steam rate-limited the crawl; wait a bit and rerun `pnpm run games`. Cached successful requests will be reused, so reruns mostly fill the missing app details."
        : "";
      warnings.push(
        `Skipped ${skippedCandidates.length} candidate(s) after repeated Steam request failures.${rateLimitHint} First errors: ${skippedCandidates
          .slice(0, 3)
          .join(" | ")}`
      );
    }

    const enrichedGames = games.filter((game): game is GameResult => game !== null);
    const filterReasonCounts = new Map<string, number>();
    const filtered = enrichedGames
      .filter((game) => {
        const decision = filterGame(game, filters);
        if (decision.matched) {
          logVerbose(config, `Accepted ${gameLabel(game)} after filters.`);
          return true;
        }

        const reason = decision.reason ?? "unknown";
        incrementCount(filterReasonCounts, reason);
        logVerbose(config, `Filtered out ${gameLabel(game)}: ${reason}.`);
        return false;
      })
      .sort((a, b) => compareGames(a, b, filters.sort));
    logProgress(
      config,
      `Enriched ${enrichedGames.length}/${candidates.length} candidate(s); ${filtered.length} matched filters.`
    );
    if (filterReasonCounts.size > 0) {
      logVerbose(config, `Filter rejection counts: ${formatCounts(filterReasonCounts)}.`);
    }
    logVerbose(config, `Sorting ${filtered.length} matched game(s) by ${filters.sort}.`);
    const returnedGames = config.limit === null ? filtered : filtered.slice(0, config.limit);
    if (config.limit !== null) {
      logVerbose(config, `Applying limit=${config.limit}; returning ${returnedGames.length}/${filtered.length} matched game(s).`);
    }
    const outputGames = returnedGames.map(serializeGame);
    logVerbose(config, `Serialized ${outputGames.length} game(s) for output.`);

    const output = {
      generatedAt: new Date().toISOString(),
      source: "search",
      discoveredCandidates: discoveredCandidates.length,
      scannedCandidates: candidates.length,
      returned: returnedGames.length,
      options: serializableOptions(config),
      filters: serializableFilters(filters),
      warnings,
      games: outputGames,
    };

    if (config.outputMode === "json") {
      await outputWriter.write(`${JSON.stringify(output, null, 2)}\n`);
      logVerbose(config, `Wrote JSON output with ${outputGames.length} game(s) and ${warnings.length} warning(s).`);
    } else {
      await outputWriter.write(`${JSON.stringify({ type: "summary", ...output, games: undefined })}\n`);
      logVerbose(config, `Wrote NDJSON summary with ${warnings.length} warning(s).`);
    }
    if (outputWriter.path !== null) {
      logProgress(config, `Finished writing ${outputWriter.path}.`);
    }
    completed = true;
  } finally {
    await outputWriter.close();
    if (completed && outputWriter.path !== null) {
      await cleanupOldOutputFiles(config, outputWriter.path);
    }
  }
}

async function createOutputWriter(config: RuntimeConfig): Promise<OutputWriter> {
  if (config.outputFile === null) {
    logVerbose(config, "No outputFile configured; output will stream to stdout.");
    return {
      path: null,
      write: async (chunk: string) => {
        process.stdout.write(chunk);
      },
      close: async () => {},
    };
  }

  const { mkdir, open } = await import("node:fs/promises");
  const { basename, dirname, extname, join } = await import("node:path");
  const outputDir = dirname(config.outputFile);
  if (outputDir !== ".") {
    logVerbose(config, `Ensuring output directory exists: ${outputDir}.`);
    await mkdir(outputDir, { recursive: true });
  }

  const timestamp = outputTimestamp(new Date());
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const path = withTimestampSuffix(config.outputFile, timestamp, attempt, { basename, dirname, extname, join });
    try {
      logVerbose(config, `Attempting to create output file ${path}.`);
      const file = await open(path, "wx");
      let pendingWrite = Promise.resolve();
      logVerbose(config, `Created output file ${path}.`);

      return {
        path,
        write: async (chunk: string) => {
          pendingWrite = pendingWrite.then(() => file.writeFile(chunk));
          await pendingWrite;
        },
        close: async () => {
          await pendingWrite;
          await file.close();
        },
      };
    } catch (error) {
      if (hasErrorCode(error, "EEXIST")) {
        logVerbose(config, `Output file ${path} already exists; trying next suffix.`);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Could not create a non-existing output file for ${config.outputFile}.`);
}

function withTimestampSuffix(
  filePath: string,
  timestamp: string,
  suffixNumber: number,
  pathTools: {
    basename(path: string, suffix?: string): string;
    dirname(path: string): string;
    extname(path: string): string;
    join(...paths: string[]): string;
  }
): string {
  const dir = pathTools.dirname(filePath);
  const ext = pathTools.extname(filePath);
  const name = pathTools.basename(filePath, ext);
  const collisionSuffix = suffixNumber === 0 ? "" : `-${suffixNumber}`;
  const suffixedFile = `${name}-${timestamp}${collisionSuffix}${ext}`;
  return dir === "." ? suffixedFile : pathTools.join(dir, suffixedFile);
}

function outputTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function cleanupOldOutputFiles(config: RuntimeConfig, currentOutputPath: string): Promise<void> {
  if (config.outputFile === null || !config.outputRetention.enabled) {
    logVerbose(config, "Output retention cleanup disabled.");
    return;
  }

  const { readdir, stat, unlink } = await import("node:fs/promises");
  const { basename, dirname, extname, join, resolve } = await import("node:path");
  const outputDir = dirname(config.outputFile);
  const ext = extname(config.outputFile);
  const baseName = basename(config.outputFile, ext);
  const currentResolvedPath = resolve(currentOutputPath);
  const entries = await readdir(outputDir === "." ? "." : outputDir, { withFileTypes: true });
  const outputFiles = [];

  for (const entry of entries) {
    if (!entry.isFile() || !matchesOutputFileName(entry.name, baseName, ext)) continue;

    const path = join(outputDir, entry.name);
    const stats = await stat(path);
    outputFiles.push({
      path,
      resolvedPath: resolve(path),
      name: entry.name,
      sortTime: outputFileSortTime(entry.name, baseName, ext, stats.mtimeMs),
    });
  }

  outputFiles.sort((a, b) => {
    if (a.resolvedPath === currentResolvedPath) return -1;
    if (b.resolvedPath === currentResolvedPath) return 1;
    return b.sortTime - a.sortTime || b.name.localeCompare(a.name);
  });

  const keep = new Set(outputFiles.slice(0, config.outputRetention.keepLast).map((file) => file.resolvedPath));
  keep.add(currentResolvedPath);
  const removable = outputFiles.filter((file) => !keep.has(file.resolvedPath));

  if (removable.length === 0) {
    logVerbose(
      config,
      `Output retention kept ${outputFiles.length}/${outputFiles.length} matching file(s); nothing to delete.`
    );
    return;
  }

  for (const file of removable) {
    try {
      await unlink(file.path);
      logVerbose(config, `Deleted old output file ${file.path}.`);
    } catch (error) {
      if (!hasErrorCode(error, "ENOENT")) throw error;
    }
  }

  logProgress(
    config,
    `Output retention removed ${removable.length} old file(s); kept newest ${Math.min(
      config.outputRetention.keepLast,
      outputFiles.length
    )} matching ${baseName}*${ext} file(s).`
  );
}

function matchesOutputFileName(fileName: string, baseName: string, ext: string): boolean {
  return fileName === `${baseName}${ext}` || (fileName.startsWith(`${baseName}-`) && fileName.endsWith(ext));
}

function outputFileSortTime(fileName: string, baseName: string, ext: string, fallbackTime: number): number {
  const timestamp = outputFileTimestamp(fileName, baseName, ext);
  return timestamp ?? fallbackTime;
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

function normalizeRuntimeConfig(config: ScriptConfig): RuntimeConfig {
  if (config.limit !== null && (!Number.isFinite(config.limit) || config.limit < 1)) {
    throw new Error("SCRIPT_CONFIG.limit must be a positive number or null.");
  }
  if (config.pages !== null && (!Number.isFinite(config.pages) || config.pages < 1)) {
    throw new Error("SCRIPT_CONFIG.pages must be a positive number or null.");
  }
  if (config.maxCandidates !== null && (!Number.isFinite(config.maxCandidates) || config.maxCandidates < 1)) {
    throw new Error("SCRIPT_CONFIG.maxCandidates must be a positive number or null.");
  }
  if (!Number.isFinite(config.start) || config.start < 0) {
    throw new Error("SCRIPT_CONFIG.start must be zero or a positive number.");
  }
  if (!Number.isFinite(config.concurrency) || config.concurrency < 1 || config.concurrency > 10) {
    throw new Error("SCRIPT_CONFIG.concurrency must be between 1 and 10.");
  }
  if (config.outputMode !== "json" && config.outputMode !== "ndjson") {
    throw new Error('SCRIPT_CONFIG.outputMode must be "json" or "ndjson".');
  }
  if (config.outputFile !== null && config.outputFile.trim() === "") {
    throw new Error("SCRIPT_CONFIG.outputFile must be a file path string or null.");
  }
  if (typeof config.outputRetention.enabled !== "boolean") {
    throw new Error("SCRIPT_CONFIG.outputRetention.enabled must be true or false.");
  }
  if (!Number.isInteger(config.outputRetention.keepLast) || config.outputRetention.keepLast < 1) {
    throw new Error("SCRIPT_CONFIG.outputRetention.keepLast must be a positive integer.");
  }
  if (typeof config.progress !== "boolean") {
    throw new Error("SCRIPT_CONFIG.progress must be true or false.");
  }
  if (typeof config.verbose !== "boolean") {
    throw new Error("SCRIPT_CONFIG.verbose must be true or false.");
  }
  if (config.cache.directory.trim() === "") {
    throw new Error("SCRIPT_CONFIG.cache.directory must be a non-empty path.");
  }
  if (typeof config.cache.cleanupExpired !== "boolean") {
    throw new Error("SCRIPT_CONFIG.cache.cleanupExpired must be true or false.");
  }
  if (!isPositiveNumber(config.cache.searchTtlHours)) {
    throw new Error("SCRIPT_CONFIG.cache.searchTtlHours must be a positive number.");
  }
  if (!isPositiveNumber(config.cache.appDetailsTtlHours)) {
    throw new Error("SCRIPT_CONFIG.cache.appDetailsTtlHours must be a positive number.");
  }
  if (!isPositiveNumber(config.cache.reviewSummaryTtlHours)) {
    throw new Error("SCRIPT_CONFIG.cache.reviewSummaryTtlHours must be a positive number.");
  }
  if (!isPositiveNumber(config.euroApproximation.myrToEurRate)) {
    throw new Error("SCRIPT_CONFIG.euroApproximation.myrToEurRate must be a positive number.");
  }
  if (!isNonNegativeNumber(config.requestPacing.searchDelayMs)) {
    throw new Error("SCRIPT_CONFIG.requestPacing.searchDelayMs must be zero or a positive number.");
  }
  if (!isNonNegativeNumber(config.requestPacing.appDetailsDelayMs)) {
    throw new Error("SCRIPT_CONFIG.requestPacing.appDetailsDelayMs must be zero or a positive number.");
  }
  if (!isNonNegativeNumber(config.requestPacing.reviewSummaryDelayMs)) {
    throw new Error("SCRIPT_CONFIG.requestPacing.reviewSummaryDelayMs must be zero or a positive number.");
  }
  if (!Number.isInteger(config.retry.maxAttempts) || config.retry.maxAttempts < 1) {
    throw new Error("SCRIPT_CONFIG.retry.maxAttempts must be a positive integer.");
  }
  if (!isNonNegativeNumber(config.retry.baseDelayMs)) {
    throw new Error("SCRIPT_CONFIG.retry.baseDelayMs must be zero or a positive number.");
  }
  if (!isPositiveNumber(config.retry.maxDelayMs)) {
    throw new Error("SCRIPT_CONFIG.retry.maxDelayMs must be a positive number.");
  }

  return {
    limit: config.limit,
    pages: config.pages,
    maxCandidates: config.maxCandidates,
    start: config.start,
    concurrency: config.concurrency,
    country: config.country.toUpperCase(),
    language: config.language,
    euroApproximation: config.euroApproximation,
    requestPacing: config.requestPacing,
    retry: config.retry,
    outputMode: config.outputMode,
    outputFile: config.outputFile,
    outputRetention: config.outputRetention,
    progress: config.progress,
    verbose: config.verbose,
    cache: config.cache,
  };
}

function isPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function normalizeFilters(config: EditableFilters): Filters {
  const minRelease = config.minRelease || "1970-01-01";
  const minReleaseTime = Date.parse(`${minRelease}T00:00:00Z`);
  const ignoreNames = config.ignoreNames.map((name) => name.trim()).filter(Boolean);

  if (!Number.isFinite(minReleaseTime)) {
    throw new Error(`min_release must be an ISO date like 2000-01-01. Got "${minRelease}".`);
  }

  return {
    displayOnly: config.displayOnly,
    minDiscount: config.minDiscount,
    minRating: config.minRating,
    minRelease,
    minReleaseTime,
    minReviews: config.minReviews,
    os: parsePlatform(config.os),
    sort: parseSort(config.sort),
    includeTags: config.includeTags,
    excludeTags: config.excludeTags.map((tag) => Math.abs(tag)),
    ignoreNames,
    ignoreNameKeys: new Set(ignoreNames.map(normalizeGameName)),
    term: config.term,
  };
}

function parsePlatform(value: string): PlatformName {
  const normalized = value.toLowerCase();
  if (normalized === "windows") return "win";
  if (normalized === "macos") return "mac";
  if (normalized === "steamos") return "linux";
  if (normalized === "win" || normalized === "mac" || normalized === "linux" || normalized === "applesilicon") {
    return normalized;
  }
  if (normalized === "") return "";

  throw new Error(`Unsupported os "${value}". Use win, mac, linux, or applesilicon.`);
}

function parseSort(value: string): SortKey {
  const supported: SortKey[] = [
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
  ];

  if (supported.includes(value as SortKey)) return value as SortKey;
  throw new Error(`Unsupported sort "${value}". Supported sorts: ${supported.join(", ")}.`);
}

async function fetchSearchCandidates(filters: Filters, config: RuntimeConfig): Promise<Candidate[]> {
  const candidates = new Map<number, Candidate>();
  logVerbose(
    config,
    `Starting candidate discovery at offset ${config.start} with page size ${SEARCH_PAGE_SIZE}; pages=${config.pages ?? "all"}.`
  );

  for (let page = 0; config.pages === null || page < config.pages; page += 1) {
    const previousCandidateCount = candidates.size;
    const url = new URL("https://store.steampowered.com/search/results/");
    url.searchParams.set("json", "1");
    url.searchParams.set("ignore_preferences", "1");
    url.searchParams.set("start", String(config.start + page * SEARCH_PAGE_SIZE));

    if (filters.displayOnly.toLowerCase() === "game") {
      url.searchParams.set("category1", "998");
    }

    if (filters.minDiscount > 0) {
      url.searchParams.set("specials", "1");
    }

    const steamSearchOs = toSteamSearchOs(filters.os);
    if (steamSearchOs) {
      url.searchParams.set("os", steamSearchOs);
    }

    if (filters.includeTags.length > 0) {
      url.searchParams.set("tags", filters.includeTags.join(","));
    }

    if (filters.excludeTags.length > 0) {
      url.searchParams.set("untags", filters.excludeTags.join(","));
    }

    if (filters.term) {
      url.searchParams.set("term", filters.term);
    }

    logVerbose(config, `Requesting search page ${page + 1}: ${redactUrl(url)}.`);
    const response = await fetchCachedJson<SearchResponse>(
      config,
      "search",
      url.toString(),
      hoursToMs(config.cache.searchTtlHours),
      () => fetchJson<SearchResponse>(url, config)
    );
    const items = response.items ?? [];
    logVerbose(config, `Search page ${page + 1} returned ${items.length} item(s).`);
    if (items.length === 0) {
      logVerbose(config, `Stopping search discovery: page ${page + 1} returned no items.`);
      break;
    }

    let duplicates = 0;
    let missingAppIds = 0;
    for (const item of items) {
      const appid = extractAppId(item.logo ?? "");
      if (appid === null) {
        missingAppIds += 1;
        logVerbose(config, `Search item "${item.name ?? "unknown"}" had no extractable appid.`);
        continue;
      }
      if (candidates.has(appid)) {
        duplicates += 1;
        logVerbose(config, `Duplicate search candidate ignored: ${appid} (${item.name ?? "unknown"}).`);
      } else {
        logVerbose(config, `Discovered search candidate ${appid} (${item.name ?? "unknown"}).`);
      }
      candidates.set(appid, { appid, name: item.name });
    }
    if (duplicates > 0 || missingAppIds > 0) {
      logVerbose(
        config,
        `Search page ${page + 1} skipped ${duplicates} duplicate item(s) and ${missingAppIds} item(s) without appids.`
      );
    }
    logProgress(config, `Fetched search page ${page + 1}; found ${candidates.size} unique candidate(s).`);

    if (items.length < SEARCH_PAGE_SIZE) {
      logVerbose(config, `Stopping search discovery: page ${page + 1} returned fewer than ${SEARCH_PAGE_SIZE} items.`);
      break;
    }
    if (candidates.size === previousCandidateCount) {
      logVerbose(config, `Stopping search discovery: page ${page + 1} added no new candidates.`);
      break;
    }
  }

  logVerbose(config, `Candidate discovery complete with ${candidates.size} unique candidate(s).`);
  return [...candidates.values()];
}

function toSteamSearchOs(os: PlatformName): "win" | "mac" | "linux" | null {
  if (os === "applesilicon") return "mac";
  if (os === "win" || os === "mac" || os === "linux") return os;
  return null;
}

function extractAppId(logo: string): number | null {
  const match = logo.match(/\/apps\/(\d+)\//);
  if (!match) return null;

  const appid = Number.parseInt(match[1], 10);
  return Number.isFinite(appid) ? appid : null;
}

async function enrichCandidate(candidate: Candidate, config: RuntimeConfig): Promise<GameResult | null> {
  logVerbose(config, `Fetching app details and review summary for ${candidateLabel(candidate)}.`);
  const [details, reviews] = await Promise.all([
    fetchAppDetails(candidate.appid, config),
    fetchReviewSummary(candidate.appid, config),
  ]);

  if (!details) {
    logVerbose(config, `No store details returned for ${candidateLabel(candidate)}.`);
    return null;
  }

  const price = details.price_overview;
  const reviewTotal = reviews.total_reviews ?? 0;
  const positive = reviews.total_positive ?? 0;
  const negative = reviews.total_negative ?? 0;
  const demoAvailable = (details.demos?.length ?? 0) > 0;
  const releaseTime = parseSteamReleaseDate(details.release_date?.date ?? null);
  const platforms = {
    windows: details.platforms?.windows ?? false,
    mac: details.platforms?.mac ?? false,
    linux: details.platforms?.linux ?? false,
  };
  logVerbose(
    config,
    `Building result for ${details.steam_appid ?? candidate.appid}: release="${details.release_date?.date ?? "unknown"}", demo=${demoAvailable}, discount=${price?.discount_percent ?? 0}, reviews=${reviewTotal}, platforms=${platformSummary(platforms)}.`
  );

  return {
    appid: details.steam_appid ?? candidate.appid,
    name: details.name ?? candidate.name ?? String(candidate.appid),
    steamUrl: `https://store.steampowered.com/app/${candidate.appid}/`,
    description: details.short_description ?? null,
    demoAvailable,
    releaseDate: details.release_date?.date ?? null,
    price: {
      currency: price?.currency ?? null,
      initial: price?.initial ?? null,
      final: price?.final ?? null,
      discountPercent: price?.discount_percent ?? 0,
      initialFormatted: price?.initial_formatted ?? null,
      finalFormatted: price?.final_formatted ?? null,
      euroApproximation: approximateEuroPrice(price, config.euroApproximation),
    },
    reviews: {
      score: reviews.review_score ?? null,
      scoreDescription: reviews.review_score_desc ?? null,
      total: reviewTotal,
      positive,
      negative,
      positivePercent: reviewTotal > 0 ? roundPercent((positive / reviewTotal) * 100) : null,
    },
    genres: (details.genres ?? []).map((genre) => ({
      id: genre.id ?? null,
      description: genre.description ?? null,
    })),
    internal: {
      releaseTimestamp: releaseTime,
      platforms,
    },
  };
}

function serializeGame({
  appid,
  name,
  steamUrl,
  description,
  demoAvailable,
  releaseDate,
  price,
  reviews,
  genres,
}: GameResult): SerializableGameResult {
  return {
    appid,
    name,
    steamUrl,
    description,
    demoAvailable,
    releaseDate,
    price: serializePrice(price),
    reviews,
    genres,
  };
}

function serializePrice(price: GamePrice): SerializableGamePrice {
  return {
    discountPercent: price.discountPercent,
    finalFormatted: price.finalFormatted,
    finalEuroFormatted: price.euroApproximation.finalFormatted,
  };
}

async function fetchAppDetails(appid: number, config: RuntimeConfig): Promise<StoreDetails | null> {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(appid));
  url.searchParams.set("filters", DETAIL_FILTERS);
  url.searchParams.set("cc", config.country);
  url.searchParams.set("l", config.language);
  logVerbose(config, `Preparing appdetails request for ${appid}: ${redactUrl(url)}.`);

  const response = await fetchCachedJson<AppDetailsResponse>(
    config,
    "appdetails",
    url.toString(),
    hoursToMs(config.cache.appDetailsTtlHours),
    () => fetchJson<AppDetailsResponse>(url, config)
  );
  const app = response[String(appid)];
  if (!app?.success || !app.data) {
    logVerbose(config, `Appdetails response for ${appid} was not successful or had no data.`);
    return null;
  }

  logVerbose(config, `Appdetails loaded for ${appid}: ${app.data.name ?? "unnamed app"}.`);
  return app.data;
}

async function fetchReviewSummary(appid: number, config: RuntimeConfig): Promise<ReviewSummary> {
  const url = new URL(`https://store.steampowered.com/appreviews/${appid}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("language", "all");
  url.searchParams.set("purchase_type", "all");
  url.searchParams.set("num_per_page", "0");
  logVerbose(config, `Preparing review summary request for ${appid}: ${redactUrl(url)}.`);

  const response = await fetchCachedJson<ReviewResponse>(
    config,
    "reviews",
    url.toString(),
    hoursToMs(config.cache.reviewSummaryTtlHours),
    () => fetchJson<ReviewResponse>(url, config)
  );
  const summary = response.query_summary ?? {};
  logVerbose(
    config,
    `Review summary loaded for ${appid}: total=${summary.total_reviews ?? 0}, positive=${summary.total_positive ?? 0}, negative=${summary.total_negative ?? 0}.`
  );
  return summary;
}

async function fetchCachedJson<T>(
  config: RuntimeConfig,
  namespace: RequestNamespace,
  key: string,
  ttlMs: number,
  loadFresh: () => Promise<T>
): Promise<T> {
  if (!config.cache.enabled) {
    logVerbose(config, `Cache disabled for ${namespace}; fetching ${summarizeCacheKey(key)}.`);
    await waitForRequestSlot(namespace, config);
    return loadFresh();
  }

  const filePath = await cacheFilePath(config, namespace, key);
  const cached = await readCache<T>(filePath);
  const now = Date.now();
  if (cached !== null && cached.expiresAt > now) {
    logVerbose(config, `Cache hit for ${namespace}: ${summarizeCacheKey(key)} (expires ${formatTimestamp(cached.expiresAt)}).`);
    return cached.data;
  }
  if (cached !== null) {
    logVerbose(config, `Cache expired for ${namespace}: ${summarizeCacheKey(key)} (expired ${formatTimestamp(cached.expiresAt)}).`);
  } else {
    logVerbose(config, `Cache miss for ${namespace}: ${summarizeCacheKey(key)}.`);
  }

  await waitForRequestSlot(namespace, config);
  logVerbose(config, `Fetching fresh ${namespace}: ${summarizeCacheKey(key)}.`);
  const data = await loadFresh();
  await writeCache(filePath, {
    createdAt: now,
    expiresAt: now + ttlMs,
    key,
    data,
  });
  logVerbose(config, `Stored ${namespace} cache file ${filePath} (ttl ${formatDuration(ttlMs)}).`);
  return data;
}

async function waitForRequestSlot(namespace: RequestNamespace, config: RuntimeConfig): Promise<void> {
  const delayMs = requestDelayMs(namespace, config);
  if (delayMs <= 0) return;

  const previous = requestQueues.get(namespace) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const previousRequestAt = lastRequestAt.get(namespace) ?? 0;
    const waitMs = Math.max(0, previousRequestAt + delayMs - Date.now());
    if (waitMs > 0) {
      logVerbose(config, `Waiting ${formatDuration(waitMs)} before next fresh ${namespace} request.`);
      await sleep(waitMs);
    }
    lastRequestAt.set(namespace, Date.now());
  });

  requestQueues.set(namespace, next);
  await next;
}

function requestDelayMs(namespace: RequestNamespace, config: RuntimeConfig): number {
  if (namespace === "search") return config.requestPacing.searchDelayMs;
  if (namespace === "appdetails") return config.requestPacing.appDetailsDelayMs;
  return config.requestPacing.reviewSummaryDelayMs;
}

type CacheEntry<T> = {
  createdAt: number;
  expiresAt: number;
  key: string;
  data: T;
};

async function cacheFilePath(config: RuntimeConfig, namespace: string, key: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  const { join } = await import("node:path");
  const digest = createHash("sha256").update(key).digest("hex");
  return join(config.cache.directory, namespace, `${digest}.json`);
}

async function readCache<T>(filePath: string): Promise<CacheEntry<T> | null> {
  const { readFile } = await import("node:fs/promises");
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as CacheEntry<T>;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return null;
    return null;
  }
}

async function writeCache<T>(filePath: string, entry: CacheEntry<T>): Promise<void> {
  const { mkdir, rename, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await writeFile(tempPath, JSON.stringify(entry));
  await rename(tempPath, filePath);
}

async function cleanupExpiredCache(config: RuntimeConfig): Promise<number> {
  const { readdir, readFile, unlink } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const now = Date.now();

  async function walk(directory: string): Promise<number> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) return 0;
      throw error;
    }

    let removed = 0;
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        removed += await walk(path);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      if (!(await isExpiredCacheFile(path, now, readFile))) continue;

      try {
        await unlink(path);
        removed += 1;
        logVerbose(config, `Deleted expired cache file ${path}.`);
      } catch (error) {
        if (!hasErrorCode(error, "ENOENT")) throw error;
      }
    }

    return removed;
  }

  return walk(config.cache.directory);
}

async function isExpiredCacheFile(
  filePath: string,
  now: number,
  readFile: (path: string, encoding: "utf8") => Promise<string>
): Promise<boolean> {
  try {
    const entry = JSON.parse(await readFile(filePath, "utf8")) as Partial<CacheEntry<unknown>>;
    return typeof entry.expiresAt === "number" && entry.expiresAt <= now;
  } catch {
    return false;
  }
}

function hoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

async function fetchJson<T>(url: URL, config: RuntimeConfig, attempt = 0): Promise<T> {
  let response: Response;
  try {
    logVerbose(config, `HTTP GET ${redactUrl(url)} (attempt ${attempt + 1}/${config.retry.maxAttempts}).`);
    response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (attempt + 1 < config.retry.maxAttempts) {
      const delayMs = retryDelayMs(null, attempt, config.retry);
      logProgress(
        config,
        `Steam request failed before response; retrying in ${formatDuration(delayMs)} (${attempt + 2}/${config.retry.maxAttempts}).`
      );
      await sleep(delayMs);
      return fetchJson<T>(url, config, attempt + 1);
    }

    throw error;
  }

  logVerbose(config, `HTTP ${response.status} ${response.statusText} for ${redactUrl(url)}.`);
  if (!response.ok) {
    const body = await response.text();
    if (shouldRetry(response.status) && attempt + 1 < config.retry.maxAttempts) {
      const delayMs = retryDelayMs(response, attempt, config.retry);
      logProgress(
        config,
        `Steam request returned ${response.status}; retrying in ${formatDuration(delayMs)} (${attempt + 2}/${config.retry.maxAttempts}).`
      );
      await sleep(delayMs);
      return fetchJson<T>(url, config, attempt + 1);
    }

    throw new Error(`Steam request failed: ${response.status} ${response.statusText} ${redactUrl(url)}\n${body.slice(0, 300)}`);
  }

  return (await response.json()) as T;
}

function shouldRetry(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelayMs(response: Response | null, attempt: number, config: RetryConfig): number {
  const retryAfter = response?.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, config.maxDelayMs);
  }

  const exponentialDelay = config.baseDelayMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * Math.min(1000, Math.max(1, config.baseDelayMs)));
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms >= 60 * 60 * 1000) return `${Math.round(ms / (60 * 60 * 1000))}h`;
  if (ms >= 60 * 1000) return `${Math.round(ms / (60 * 1000))}m`;
  return `${Math.round(ms / 1000)}s`;
}

function redactUrl(url: URL): string {
  const safe = new URL(url);
  if (safe.searchParams.has("key")) safe.searchParams.set("key", "<redacted>");
  return safe.toString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function matchesFilters(game: GameResult, filters: Filters): boolean {
  return filterGame(game, filters).matched;
}

function filterGame(game: GameResult, filters: Filters): FilterDecision {
  if (filters.ignoreNameKeys.has(normalizeGameName(game.name))) {
    return { matched: false, reason: `ignored name "${game.name}"` };
  }
  if (hasEarlyAccessGenre(game)) {
    return { matched: false, reason: "Early Access genre" };
  }
  if (game.price.discountPercent < filters.minDiscount) {
    return {
      matched: false,
      reason: `discount ${game.price.discountPercent} < minDiscount ${filters.minDiscount}`,
    };
  }
  if (game.reviews.total < filters.minReviews) {
    return {
      matched: false,
      reason: `reviews.total ${game.reviews.total} < minReviews ${filters.minReviews}`,
    };
  }
  if ((game.reviews.positivePercent ?? 0) < filters.minRating) {
    return {
      matched: false,
      reason: `reviews.positivePercent ${game.reviews.positivePercent ?? 0} < minRating ${filters.minRating}`,
    };
  }
  if (game.internal.releaseTimestamp !== null && game.internal.releaseTimestamp < filters.minReleaseTime) {
    return {
      matched: false,
      reason: `releaseDate before ${filters.minRelease}`,
    };
  }

  if (filters.os === "win" && !game.internal.platforms.windows) {
    return { matched: false, reason: "missing Windows platform support" };
  }
  if ((filters.os === "mac" || filters.os === "applesilicon") && !game.internal.platforms.mac) {
    return { matched: false, reason: "missing macOS platform support" };
  }
  if (filters.os === "linux" && !game.internal.platforms.linux) {
    return { matched: false, reason: "missing Linux platform support" };
  }

  return { matched: true, reason: null };
}

function hasEarlyAccessGenre(game: GameResult): boolean {
  return game.genres.some((genre) => genre.id === "70" || genre.description?.toLowerCase() === "early access");
}

function normalizeGameName(name: string): string {
  return name.trim().toLowerCase();
}

function compareGames(a: GameResult, b: GameResult, sort: SortKey): number {
  if (sort === "discount_asc") return ascending(a.price.discountPercent, b.price.discountPercent) || byName(a, b);
  if (sort === "discount_desc") return descending(a.price.discountPercent, b.price.discountPercent) || byName(a, b);
  if (sort === "rating_asc") return ascending(a.reviews.positivePercent ?? -1, b.reviews.positivePercent ?? -1) || byName(a, b);
  if (sort === "rating_desc") return descending(a.reviews.positivePercent ?? -1, b.reviews.positivePercent ?? -1) || byName(a, b);
  if (sort === "reviews_asc") return ascending(a.reviews.total, b.reviews.total) || byName(a, b);
  if (sort === "reviews_desc") return descending(a.reviews.total, b.reviews.total) || byName(a, b);
  if (sort === "positive_asc") return ascending(a.reviews.positive, b.reviews.positive) || byName(a, b);
  if (sort === "positive_desc") return descending(a.reviews.positive, b.reviews.positive) || byName(a, b);
  if (sort === "demo_positive_desc") {
    return (
      descending(Number(a.demoAvailable), Number(b.demoAvailable)) ||
      descending(a.reviews.positive, b.reviews.positive) ||
      byName(a, b)
    );
  }
  if (sort === "release_asc") return ascending(a.internal.releaseTimestamp ?? Number.MAX_SAFE_INTEGER, b.internal.releaseTimestamp ?? Number.MAX_SAFE_INTEGER) || byName(a, b);
  if (sort === "release_desc") return descending(a.internal.releaseTimestamp ?? 0, b.internal.releaseTimestamp ?? 0) || byName(a, b);
  if (sort === "price_asc") return ascending(a.price.final ?? Number.MAX_SAFE_INTEGER, b.price.final ?? Number.MAX_SAFE_INTEGER) || byName(a, b);
  if (sort === "price_desc") return descending(a.price.final ?? -1, b.price.final ?? -1) || byName(a, b);

  return byName(a, b);
}

function ascending(a: number, b: number): number {
  return a - b;
}

function descending(a: number, b: number): number {
  return b - a;
}

function byName(a: GameResult, b: GameResult): number {
  return a.name.localeCompare(b.name);
}

function parseSteamReleaseDate(value: string | null): number | null {
  if (!value) return null;

  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;

  const yearOnly = value.match(/\b(\d{4})\b/);
  if (yearOnly) {
    const year = Number.parseInt(yearOnly[1], 10);
    return Date.UTC(year, 0, 1);
  }

  return null;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function approximateEuroPrice(
  price: PriceOverview | undefined,
  config: EuroApproximationConfig
): GamePriceEuroApproximation {
  const initial = approximateSteamPriceToEuro(price?.initial ?? null, config.myrToEurRate);
  const final = approximateSteamPriceToEuro(price?.final ?? null, config.myrToEurRate);

  return {
    currency: "EUR",
    sourceCurrency: price?.currency ?? null,
    sourceToEurRate: config.myrToEurRate,
    initial,
    final,
    initialFormatted: formatEuroAmount(initial),
    finalFormatted: formatEuroAmount(final),
  };
}

function approximateSteamPriceToEuro(value: number | null, myrToEurRate: number): number | null {
  if (value === null) return null;
  return roundCurrency((value / 100) * myrToEurRate);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatEuroAmount(value: number | null): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function serializableFilters(filters: Filters) {
  return {
    displayOnly: filters.displayOnly,
    minDiscount: filters.minDiscount,
    minRating: filters.minRating,
    minRelease: filters.minRelease,
    minReviews: filters.minReviews,
    os: filters.os,
    sort: filters.sort,
    includeTags: filters.includeTags,
    excludeTags: filters.excludeTags,
    ignoreNames: filters.ignoreNames,
    term: filters.term,
  };
}

function serializableOptions(config: RuntimeConfig) {
  return {
    limit: config.limit,
    pages: config.pages,
    maxCandidates: config.maxCandidates,
    start: config.start,
    concurrency: config.concurrency,
    country: config.country,
    language: config.language,
    euroApproximation: config.euroApproximation,
    requestPacing: config.requestPacing,
    retry: config.retry,
    outputMode: config.outputMode,
    outputFile: config.outputFile,
    outputRetention: config.outputRetention,
    progress: config.progress,
    verbose: config.verbose,
    cache: config.cache,
  };
}

function logProgress(config: RuntimeConfig, message: string): void {
  if (!config.progress) return;
  process.stderr.write(`[steam-games] ${message}\n`);
}

function logVerbose(config: RuntimeConfig, message: string): void {
  if (!config.verbose) return;
  logProgress(config, message);
}

function candidateLabel(candidate: Candidate): string {
  return candidate.name ? `${candidate.appid} (${candidate.name})` : String(candidate.appid);
}

function gameLabel(game: GameResult): string {
  return `${game.appid} (${game.name})`;
}

function platformSummary(platforms: { windows: boolean; mac: boolean; linux: boolean }): string {
  return `windows=${platforms.windows}, mac=${platforms.mac}, linux=${platforms.linux}`;
}

function summarizeCacheKey(key: string): string {
  try {
    return redactUrl(new URL(key));
  } catch {
    return key.length > 200 ? `${key.slice(0, 200)}...` : key;
  }
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function incrementCount(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function formatCounts(counts: Map<string, number>): string {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `${key}: ${count}`)
    .join("; ");
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
