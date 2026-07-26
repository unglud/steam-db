import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  SCRIPT_CONFIG,
  buildSearchUrl,
  compareGames,
  enrichCandidate,
  filterGame,
  hasInstallLink,
  isDemoPageInstallable,
  normalizeFilters,
  normalizeRuntimeConfig,
  serializeGame,
} from "../src/steam-games.ts";
import { buildServerConfig, findLatestResultFile, readLatestResultContent } from "../src/server.ts";

function makeScriptConfig() {
  const config = structuredClone(SCRIPT_CONFIG);
  config.outputFile = null;
  config.progress = false;
  config.verbose = false;
  config.cache.enabled = false;
  config.requestPacing = {
    searchDelayMs: 0,
    appDetailsDelayMs: 0,
    reviewSummaryDelayMs: 0,
  };
  config.retry = {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 1,
  };
  return config;
}

function makeRuntimeConfig() {
  return normalizeRuntimeConfig(makeScriptConfig());
}

function makeFilterConfig(overrides = {}) {
  return {
    displayOnly: "Game",
    minDiscount: 0,
    minRating: 0,
    minRelease: "2000-01-01",
    minReviews: 0,
    os: "mac",
    sort: "demo_positive_desc",
    includeTags: [],
    excludeTags: [],
    ignoreNames: [],
    term: "",
    ...overrides,
  };
}

function makeGame(overrides = {}) {
  const base = {
    appid: 1,
    name: "Alpha",
    steamUrl: "https://store.steampowered.com/app/1/",
    description: "Description",
    demoAvailable: false,
    releaseDate: "Jan 1, 2020",
    price: {
      currency: "MYR",
      initial: 2000,
      final: 1000,
      discountPercent: 50,
      initialFormatted: "RM20.00",
      finalFormatted: "RM10.00",
      euroApproximation: {
        currency: "EUR",
        sourceCurrency: "MYR",
        sourceToEurRate: 0.2145,
        initial: 4.29,
        final: 2.15,
        initialFormatted: "€4.29",
        finalFormatted: "€2.15",
      },
    },
    reviews: {
      score: null,
      scoreDescription: null,
      total: 1000,
      positive: 900,
      negative: 100,
      positivePercent: 90,
    },
    genres: [],
    internal: {
      releaseTimestamp: Date.UTC(2020, 0, 1),
      platforms: {
        windows: true,
        mac: true,
        linux: false,
      },
    },
  };

  return {
    ...base,
    ...overrides,
    price: {
      ...base.price,
      ...overrides.price,
      euroApproximation: {
        ...base.price.euroApproximation,
        ...(overrides.price?.euroApproximation ?? {}),
      },
    },
    reviews: {
      ...base.reviews,
      ...overrides.reviews,
    },
    internal: {
      ...base.internal,
      ...overrides.internal,
      platforms: {
        ...base.internal.platforms,
        ...(overrides.internal?.platforms ?? {}),
      },
    },
  };
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function textResponse(body) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html",
    },
  });
}

test("buildSearchUrl includes the initial Steam search params", () => {
  const scriptConfig = makeScriptConfig();
  scriptConfig.start = 10;
  const runtimeConfig = normalizeRuntimeConfig(scriptConfig);
  const filters = normalizeFilters(
    makeFilterConfig({
      minDiscount: 25,
      os: "applesilicon",
      includeTags: [19, 21],
      excludeTags: [-1625, 1664],
      term: "farm",
    })
  );

  const url = buildSearchUrl(filters, runtimeConfig, 2);

  assert.equal(url.origin + url.pathname, "https://store.steampowered.com/search/results/");
  assert.equal(url.searchParams.get("json"), "1");
  assert.equal(url.searchParams.get("ignore_preferences"), "1");
  assert.equal(url.searchParams.get("start"), "110");
  assert.equal(url.searchParams.get("category1"), "998");
  assert.equal(url.searchParams.get("specials"), "1");
  assert.equal(url.searchParams.get("os"), "mac");
  assert.equal(url.searchParams.get("tags"), "19,21");
  assert.equal(url.searchParams.get("untags"), "1625,1664");
  assert.equal(url.searchParams.get("term"), "farm");
});

test("filterGame rejects ignored names and Early Access games", () => {
  const ignoredFilters = normalizeFilters(makeFilterConfig({ ignoreNames: ["  Hades  "] }));
  assert.deepEqual(filterGame(makeGame({ name: "hades" }), ignoredFilters), {
    matched: false,
    reason: 'ignored name "hades"',
  });

  const normalFilters = normalizeFilters(makeFilterConfig());
  assert.deepEqual(
    filterGame(
      makeGame({
        genres: [{ id: "70", description: "Early Access" }],
      }),
      normalFilters
    ),
    {
      matched: false,
      reason: "Early Access genre",
    }
  );
});

test("demo_positive_desc sorts demo games first, then by positive reviews", () => {
  const games = [
    makeGame({ appid: 1, name: "Demo Low", demoAvailable: true, reviews: { positive: 800 } }),
    makeGame({ appid: 2, name: "No Demo High", demoAvailable: false, reviews: { positive: 950 } }),
    makeGame({ appid: 3, name: "Demo High", demoAvailable: true, reviews: { positive: 900 } }),
  ];

  const sortedAppIds = [...games].sort((a, b) => compareGames(a, b, "demo_positive_desc")).map((game) => game.appid);

  assert.deepEqual(sortedAppIds, [3, 1, 2]);
});

test("serializeGame keeps output compact", () => {
  const serialized = serializeGame(makeGame());

  assert.deepEqual(serialized.price, {
    discountPercent: 50,
    finalFormatted: "RM10.00",
    finalEuroFormatted: "€2.15",
  });
  assert.equal("internal" in serialized, false);
  assert.equal("recommendations" in serialized, false);
});

test("hasInstallLink detects real demo install links", () => {
  assert.equal(hasInstallLink('<a href="steam://install/452280">Download Demo</a>', 452280), true);
  assert.equal(hasInstallLink("javascript:InstallGame( 452280, 'demo' )", 452280), true);
  assert.equal(hasInstallLink("<title>Site Error</title>", 666970), false);
});

test("enrichCandidate verifies demo availability through the demo page", async () => {
  const config = makeRuntimeConfig();
  const fetches = [];
  const fetch = async (input) => {
    const url = input.toString();
    fetches.push(url);
    if (url.includes("/api/appdetails")) {
      return jsonResponse({
        "666140": {
          success: true,
          data: {
            steam_appid: 666140,
            name: "My Time at Portia",
            short_description: "Build a workshop.",
            demos: [{ appid: 666970, description: "My Time At Portia Demo" }],
            price_overview: {
              currency: "MYR",
              final: 1000,
              discount_percent: 50,
              final_formatted: "RM10.00",
            },
            platforms: { windows: true, mac: true, linux: false },
            release_date: { date: "Jan 15, 2019" },
            genres: [],
          },
        },
      });
    }
    if (url.includes("/appreviews/666140")) {
      return jsonResponse({
        success: 1,
        query_summary: {
          total_reviews: 1000,
          total_positive: 900,
          total_negative: 100,
        },
      });
    }
    if (url.includes("/app/666970/")) {
      return textResponse("<title>Site Error</title>");
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const game = await enrichCandidate({ appid: 666140 }, config, {
    fetch,
    now: () => 1_000,
    sleep: async () => {},
  });

  assert.equal(game?.demoAvailable, false);
  assert.equal(fetches.some((url) => url.includes("/app/666970/")), true);
});

test("demo page availability uses the one-week demo page cache TTL", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "steam-games-test-"));
  try {
    const scriptConfig = makeScriptConfig();
    scriptConfig.cache.enabled = true;
    scriptConfig.cache.directory = tempDir;
    scriptConfig.cache.appDetailsTtlHours = 24;
    scriptConfig.cache.demoPageTtlHours = 168;
    const config = normalizeRuntimeConfig(scriptConfig);
    let fetchCount = 0;
    const deps = {
      fetch: async () => {
        fetchCount += 1;
        return textResponse('<a href="steam://install/452280">Download Demo</a>');
      },
      now: () => 1_000_000,
      sleep: async () => {},
    };

    assert.equal(await isDemoPageInstallable(452280, config, deps), true);
    assert.equal(await isDemoPageInstallable(452280, config, deps), true);
    assert.equal(fetchCount, 1);

    const cacheFiles = await readdir(join(tempDir, "demopage"));
    assert.equal(cacheFiles.length, 1);

    const cacheEntry = JSON.parse(await readFile(join(tempDir, "demopage", cacheFiles[0]), "utf8"));
    assert.equal(cacheEntry.expiresAt - cacheEntry.createdAt, 168 * 60 * 60 * 1000);
    assert.equal(cacheEntry.data, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("buildServerConfig applies Docker data defaults and environment overrides", () => {
  const config = buildServerConfig({
    STEAM_GAMES_DOCKER: "1",
    STEAM_GAMES_INTERVAL_HOURS: "12",
    PORT: "4567",
    HOST: "127.0.0.1",
  });

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 4567);
  assert.equal(config.intervalMs, 12 * 60 * 60 * 1000);
  assert.equal(config.scriptConfig.outputFile, "/data/steam-games.json");
  assert.equal(config.scriptConfig.cache.directory, "/data/.cache/steam");
});

test("findLatestResultFile returns newest timestamped output", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "steam-games-result-test-"));
  try {
    const older = join(tempDir, "steam-games-2026-01-01T00-00-00-000Z.json");
    const newer = join(tempDir, "steam-games-2026-01-02T00-00-00-000Z.json");
    await writeFile(older, "{}\n");
    await writeFile(newer, "{}\n");
    await writeFile(join(tempDir, "other.json"), "{}\n");

    assert.equal(await findLatestResultFile(join(tempDir, "steam-games.json")), newer);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("readLatestResultContent returns the latest JSON body", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "steam-games-server-test-"));
  try {
    const resultFile = join(tempDir, "steam-games-2026-01-02T00-00-00-000Z.json");
    await writeFile(resultFile, JSON.stringify({ games: [{ appid: 1 }] }));

    const result = await readLatestResultContent(join(tempDir, "steam-games.json"));

    assert.equal(result?.path, resultFile);
    assert.deepEqual(JSON.parse(result?.body ?? ""), { games: [{ appid: 1 }] });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
