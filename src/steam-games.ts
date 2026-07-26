declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
};

type Source = "search" | "applist";
type OutputMode = "json" | "ndjson";
type SortKey =
  | "discount_asc"
  | "discount_desc"
  | "rating_asc"
  | "rating_desc"
  | "reviews_asc"
  | "reviews_desc"
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
  source: Source;
  outputMode: OutputMode;
  outputFile: string | null;
  progress: boolean;
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
  term: string;
};

type ScriptConfig = RuntimeConfig & {
  filters: EditableFilters;
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
  term: string;
};

type SearchItem = {
  name?: string;
  logo?: string;
};

type SearchResponse = {
  items?: SearchItem[];
};

type AppListResponse = {
  response?: {
    apps?: Array<{
      appid: number;
      name?: string;
      last_modified?: number;
      price_change_number?: number;
    }>;
    have_more_results?: boolean;
    last_appid?: number;
  };
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
  type?: string;
  name?: string;
  steam_appid?: number;
  is_free?: boolean;
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
  metacritic?: {
    score?: number;
    url?: string;
  };
  recommendations?: {
    total?: number;
  };
  genres?: Array<{ id?: string; description?: string }>;
  categories?: Array<{ id?: number; description?: string }>;
  mac_requirements?: {
    minimum?: string;
    recommended?: string;
  };
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

type Candidate = {
  appid: number;
  name?: string;
};

type EnrichedGameData = {
  type: string;
  releaseDate: string | null;
  releaseTimestamp: number | null;
  platforms: {
    windows: boolean;
    mac: boolean;
    linux: boolean;
  };
  appleSilicon: {
    requested: boolean;
    publicSteamFilter: "mac" | null;
    requirementHint: "mentioned" | "not_mentioned" | "unknown";
  };
  price: {
    currency: string | null;
    initial: number | null;
    final: number | null;
    discountPercent: number;
    initialFormatted: string | null;
    finalFormatted: string | null;
  };
  reviews: {
    score: number | null;
    scoreDescription: string | null;
    total: number;
    positive: number;
    negative: number;
    positivePercent: number | null;
  };
  metacritic: {
    score: number | null;
    url: string | null;
  };
  recommendations: number | null;
  genres: Array<{ id: string | null; description: string | null }>;
  categories: Array<{ id: number | null; description: string | null }>;
};

type GameResult = {
  appid: number;
  name: string;
  steamUrl: string;
  enriched: EnrichedGameData;
};

// Edit this block to change what `pnpm run games` returns.
const SCRIPT_CONFIG: ScriptConfig = {
  source: "search",
  country: process.env.STEAM_CC ?? "US",
  language: process.env.STEAM_LANG ?? "english",
  start: 0,
  pages: null,
  limit: null,
  maxCandidates: null,
  concurrency: 2,
  outputMode: "json",
  outputFile: "steam-games.json",
  progress: true,
  filters: {
    displayOnly: "Game",
    minDiscount: 25,
    minRating: 0,
    minRelease: "2000-01-01",
    minReviews: 500,
    os: "mac",
    sort: "discount_asc",
    includeTags: [],
    excludeTags: [1625, 1664, 3799, 3843, 3859, 5537, 7178],
    term: "",
  },
};

const USER_AGENT = "steam-db-ts-script/0.1 (+https://store.steampowered.com)";
const SEARCH_PAGE_SIZE = 50;
const DETAIL_FILTERS = [
  "price_overview",
  "release_date",
  "platforms",
  "recommendations",
  "metacritic",
  "type",
  "name",
  "steam_appid",
  "is_free",
  "categories",
  "genres",
  "mac_requirements",
].join(",");

async function main(): Promise<void> {
  const config = normalizeRuntimeConfig(SCRIPT_CONFIG);
  const filters = normalizeFilters(SCRIPT_CONFIG.filters);
  const outputWriter = await createOutputWriter(config);
  const warnings: string[] = [];

  try {
    logProgress(config, "Starting Steam search.");
    if (outputWriter.path !== null) {
      logProgress(config, `Writing ${config.outputMode.toUpperCase()} output to ${outputWriter.path}.`);
    }
    if (config.pages === null && config.maxCandidates === null && config.limit === null) {
      logProgress(config, "Full crawl enabled: this can take several minutes and may hit Steam rate limits.");
    }

    if (filters.os === "applesilicon") {
      warnings.push(
        "Steam's public store APIs expose macOS filtering, but not a reliable Apple Silicon-native flag; this query uses os=mac and returns a best-effort macOS requirement hint."
      );
    }

    const discoveredCandidates =
      config.source === "applist"
        ? await fetchAppListCandidates(config, warnings)
        : await fetchSearchCandidates(filters, config);
    const candidates =
      config.maxCandidates === null ? discoveredCandidates : discoveredCandidates.slice(0, config.maxCandidates);
    logProgress(config, `Discovered ${discoveredCandidates.length} candidate(s); enriching ${candidates.length}.`);

    const skippedCandidates: string[] = [];
    let enrichedCandidates = 0;
    const games = await mapConcurrent(candidates, config.concurrency, async (candidate) => {
      try {
        const game = await enrichCandidate(candidate, config, filters);
        if (config.outputMode === "ndjson" && game !== null && matchesFilters(game, filters)) {
          await outputWriter.write(`${JSON.stringify({ type: "game", game })}\n`);
        }
        return game;
      } catch (error) {
        skippedCandidates.push(`${candidate.appid}: ${errorMessage(error).split("\n")[0]}`);
        return null;
      } finally {
        enrichedCandidates += 1;
        if (enrichedCandidates === candidates.length || enrichedCandidates % 25 === 0) {
          logProgress(config, `Enriched ${enrichedCandidates}/${candidates.length} candidate(s).`);
        }
      }
    });

    if (skippedCandidates.length > 0) {
      warnings.push(
        `Skipped ${skippedCandidates.length} candidate(s) after Steam request failures. First errors: ${skippedCandidates
          .slice(0, 3)
          .join(" | ")}`
      );
    }

    const filtered = games
      .filter((game): game is GameResult => game !== null)
      .filter((game) => matchesFilters(game, filters))
      .sort((a, b) => compareGames(a, b, filters.sort));
    const returnedGames = config.limit === null ? filtered : filtered.slice(0, config.limit);

    const output = {
      generatedAt: new Date().toISOString(),
      source: config.source,
      discoveredCandidates: discoveredCandidates.length,
      scannedCandidates: candidates.length,
      returned: returnedGames.length,
      options: serializableOptions(config),
      filters: serializableFilters(filters),
      warnings,
      games: returnedGames,
    };

    if (config.outputMode === "json") {
      await outputWriter.write(`${JSON.stringify(output, null, 2)}\n`);
    } else {
      await outputWriter.write(`${JSON.stringify({ type: "summary", ...output, games: undefined })}\n`);
    }
    if (outputWriter.path !== null) {
      logProgress(config, `Finished writing ${outputWriter.path}.`);
    }
  } finally {
    await outputWriter.close();
  }
}

async function createOutputWriter(config: RuntimeConfig): Promise<OutputWriter> {
  if (config.outputFile === null) {
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
    await mkdir(outputDir, { recursive: true });
  }

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const path = withNumericSuffix(config.outputFile, attempt, { basename, dirname, extname, join });
    try {
      const file = await open(path, "wx");
      let pendingWrite = Promise.resolve();

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
      if (hasErrorCode(error, "EEXIST")) continue;
      throw error;
    }
  }

  throw new Error(`Could not create a non-existing output file for ${config.outputFile}.`);
}

function withNumericSuffix(
  filePath: string,
  suffixNumber: number,
  pathTools: {
    basename(path: string, suffix?: string): string;
    dirname(path: string): string;
    extname(path: string): string;
    join(...paths: string[]): string;
  }
): string {
  if (suffixNumber === 0) return filePath;

  const dir = pathTools.dirname(filePath);
  const ext = pathTools.extname(filePath);
  const name = pathTools.basename(filePath, ext);
  const suffixedFile = `${name}-${suffixNumber}${ext}`;
  return dir === "." ? suffixedFile : pathTools.join(dir, suffixedFile);
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
  if (config.source !== "search" && config.source !== "applist") {
    throw new Error('SCRIPT_CONFIG.source must be "search" or "applist".');
  }
  if (config.outputMode !== "json" && config.outputMode !== "ndjson") {
    throw new Error('SCRIPT_CONFIG.outputMode must be "json" or "ndjson".');
  }
  if (config.outputFile !== null && config.outputFile.trim() === "") {
    throw new Error("SCRIPT_CONFIG.outputFile must be a file path string or null.");
  }

  return {
    limit: config.limit,
    pages: config.pages,
    maxCandidates: config.maxCandidates,
    start: config.start,
    concurrency: config.concurrency,
    country: config.country.toUpperCase(),
    language: config.language,
    source: config.source,
    outputMode: config.outputMode,
    outputFile: config.outputFile,
    progress: config.progress,
  };
}

function normalizeFilters(config: EditableFilters): Filters {
  const minRelease = config.minRelease || "1970-01-01";
  const minReleaseTime = Date.parse(`${minRelease}T00:00:00Z`);

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

    const response = await fetchJson<SearchResponse>(url);
    const items = response.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const appid = extractAppId(item.logo ?? "");
      if (appid === null) continue;
      candidates.set(appid, { appid, name: item.name });
    }
    logProgress(config, `Fetched search page ${page + 1}; found ${candidates.size} unique candidate(s).`);

    if (items.length < SEARCH_PAGE_SIZE || candidates.size === previousCandidateCount) break;
  }

  return [...candidates.values()];
}

async function fetchAppListCandidates(config: RuntimeConfig, warnings: string[]): Promise<Candidate[]> {
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) {
    throw new Error("source=applist requires STEAM_WEB_API_KEY in the environment.");
  }

  warnings.push(
    "source=applist scans Valve's app catalog but cannot prefilter by search-only fields such as tags, OS, or active discounts."
  );

  const candidates: Candidate[] = [];
  let lastAppId = config.start;

  for (let page = 0; config.pages === null || page < config.pages; page += 1) {
    const input = {
      include_games: true,
      include_dlc: false,
      include_software: false,
      include_videos: false,
      include_hardware: false,
      max_results: SEARCH_PAGE_SIZE,
      last_appid: lastAppId,
    };
    const url = new URL("https://api.steampowered.com/IStoreService/GetAppList/v1/");
    url.searchParams.set("key", key);
    url.searchParams.set("input_json", JSON.stringify(input));

    const response = await fetchJson<AppListResponse>(url);
    const apps = response.response?.apps ?? [];
    if (apps.length === 0) break;

    for (const app of apps) {
      candidates.push({ appid: app.appid, name: app.name });
    }
    logProgress(config, `Fetched app-list page ${page + 1}; found ${candidates.length} candidate(s).`);

    lastAppId = response.response?.last_appid ?? apps[apps.length - 1]?.appid ?? lastAppId;
    if (!response.response?.have_more_results) break;
  }

  return candidates;
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

async function enrichCandidate(candidate: Candidate, config: RuntimeConfig, filters: Filters): Promise<GameResult | null> {
  const [details, reviews] = await Promise.all([
    fetchAppDetails(candidate.appid, config),
    fetchReviewSummary(candidate.appid),
  ]);

  if (!details) return null;

  const price = details.price_overview;
  const reviewTotal = reviews.total_reviews ?? 0;
  const positive = reviews.total_positive ?? 0;
  const negative = reviews.total_negative ?? 0;
  const releaseTime = parseSteamReleaseDate(details.release_date?.date ?? null);
  const inferredType = details.type ?? (filters.displayOnly.toLowerCase() === "game" ? "game" : "unknown");
  const platforms = {
    windows: details.platforms?.windows ?? false,
    mac: details.platforms?.mac ?? false,
    linux: details.platforms?.linux ?? false,
  };

  return {
    appid: details.steam_appid ?? candidate.appid,
    name: details.name ?? candidate.name ?? String(candidate.appid),
    steamUrl: `https://store.steampowered.com/app/${candidate.appid}/`,
    enriched: {
      type: inferredType,
      releaseDate: details.release_date?.date ?? null,
      releaseTimestamp: releaseTime,
      platforms,
      appleSilicon: {
        requested: filters.os === "applesilicon",
        publicSteamFilter: filters.os === "applesilicon" ? "mac" : null,
        requirementHint: detectAppleSiliconHint(details),
      },
      price: {
        currency: price?.currency ?? null,
        initial: price?.initial ?? null,
        final: price?.final ?? null,
        discountPercent: price?.discount_percent ?? 0,
        initialFormatted: price?.initial_formatted ?? null,
        finalFormatted: price?.final_formatted ?? null,
      },
      reviews: {
        score: reviews.review_score ?? null,
        scoreDescription: reviews.review_score_desc ?? null,
        total: reviewTotal,
        positive,
        negative,
        positivePercent: reviewTotal > 0 ? roundPercent((positive / reviewTotal) * 100) : null,
      },
      metacritic: {
        score: details.metacritic?.score ?? null,
        url: details.metacritic?.url ?? null,
      },
      recommendations: details.recommendations?.total ?? null,
      genres: (details.genres ?? []).map((genre) => ({
        id: genre.id ?? null,
        description: genre.description ?? null,
      })),
      categories: (details.categories ?? []).map((category) => ({
        id: category.id ?? null,
        description: category.description ?? null,
      })),
    },
  };
}

async function fetchAppDetails(appid: number, config: RuntimeConfig): Promise<StoreDetails | null> {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(appid));
  url.searchParams.set("filters", DETAIL_FILTERS);
  url.searchParams.set("cc", config.country);
  url.searchParams.set("l", config.language);

  const response = await fetchJson<AppDetailsResponse>(url);
  const app = response[String(appid)];
  if (!app?.success || !app.data) return null;

  return app.data;
}

async function fetchReviewSummary(appid: number): Promise<ReviewSummary> {
  const url = new URL(`https://store.steampowered.com/appreviews/${appid}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("language", "all");
  url.searchParams.set("purchase_type", "all");
  url.searchParams.set("num_per_page", "0");

  const response = await fetchJson<ReviewResponse>(url);
  return response.query_summary ?? {};
}

async function fetchJson<T>(url: URL, attempt = 0): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (shouldRetry(response.status) && attempt < 1) {
      await sleep(retryDelayMs(response, attempt));
      return fetchJson<T>(url, attempt + 1);
    }

    throw new Error(`Steam request failed: ${response.status} ${response.statusText} ${redactUrl(url)}\n${body.slice(0, 300)}`);
  }

  return (await response.json()) as T;
}

function shouldRetry(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 30000);
  }

  return [1500, 3500, 7000][attempt] ?? 7000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  if (filters.displayOnly.toLowerCase() === "game" && game.enriched.type !== "game") return false;
  if (game.enriched.price.discountPercent < filters.minDiscount) return false;
  if (game.enriched.reviews.total < filters.minReviews) return false;
  if ((game.enriched.reviews.positivePercent ?? 0) < filters.minRating) return false;
  if (game.enriched.releaseTimestamp !== null && game.enriched.releaseTimestamp < filters.minReleaseTime) return false;

  if (filters.os === "win" && !game.enriched.platforms.windows) return false;
  if ((filters.os === "mac" || filters.os === "applesilicon") && !game.enriched.platforms.mac) return false;
  if (filters.os === "linux" && !game.enriched.platforms.linux) return false;

  return true;
}

function compareGames(a: GameResult, b: GameResult, sort: SortKey): number {
  if (sort === "discount_asc") return ascending(a.enriched.price.discountPercent, b.enriched.price.discountPercent) || byName(a, b);
  if (sort === "discount_desc") return descending(a.enriched.price.discountPercent, b.enriched.price.discountPercent) || byName(a, b);
  if (sort === "rating_asc") return ascending(a.enriched.reviews.positivePercent ?? -1, b.enriched.reviews.positivePercent ?? -1) || byName(a, b);
  if (sort === "rating_desc") return descending(a.enriched.reviews.positivePercent ?? -1, b.enriched.reviews.positivePercent ?? -1) || byName(a, b);
  if (sort === "reviews_asc") return ascending(a.enriched.reviews.total, b.enriched.reviews.total) || byName(a, b);
  if (sort === "reviews_desc") return descending(a.enriched.reviews.total, b.enriched.reviews.total) || byName(a, b);
  if (sort === "release_asc") return ascending(a.enriched.releaseTimestamp ?? Number.MAX_SAFE_INTEGER, b.enriched.releaseTimestamp ?? Number.MAX_SAFE_INTEGER) || byName(a, b);
  if (sort === "release_desc") return descending(a.enriched.releaseTimestamp ?? 0, b.enriched.releaseTimestamp ?? 0) || byName(a, b);
  if (sort === "price_asc") return ascending(a.enriched.price.final ?? Number.MAX_SAFE_INTEGER, b.enriched.price.final ?? Number.MAX_SAFE_INTEGER) || byName(a, b);
  if (sort === "price_desc") return descending(a.enriched.price.final ?? -1, b.enriched.price.final ?? -1) || byName(a, b);

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

function detectAppleSiliconHint(details: StoreDetails): "mentioned" | "not_mentioned" | "unknown" {
  const requirements = [details.mac_requirements?.minimum, details.mac_requirements?.recommended]
    .filter((value): value is string => Boolean(value))
    .map(stripHtml)
    .join(" ")
    .toLowerCase();

  if (!requirements) return "unknown";
  if (/\b(apple silicon|arm64|aarch64|m[1-9](\s|-)?(pro|max|ultra)?)\b/.test(requirements)) {
    return "mentioned";
  }

  return "not_mentioned";
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
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
    outputMode: config.outputMode,
    outputFile: config.outputFile,
    progress: config.progress,
  };
}

function logProgress(config: RuntimeConfig, message: string): void {
  if (!config.progress) return;
  process.stderr.write(`[steam-games] ${message}\n`);
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
