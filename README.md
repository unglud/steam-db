# Steam games filter

Fetch Steam games as JSON using public Steam endpoints and filters shaped like the SteamDB sale URL parameters.

```sh
pnpm install
pnpm run games
```

This project pins Node through pnpm, so `pnpm install` downloads the project runtime if your shell does not have `node`.

Change what the script returns by editing `SCRIPT_CONFIG` near the top of `src/steam-games.ts`. `pnpm run games` returns all matches for that config in one CLI run. Steam still serves the data through paginated and per-app HTTP calls, so a large result set can take a while.

The script prints progress to stderr while it works, then writes a JSON object with `filters`, `warnings`, and `games` to the configured output file.

Each item in `games` keeps the basic Steam identity at the top level:

```json
{
  "appid": 1145350,
  "name": "Hades II",
  "steamUrl": "https://store.steampowered.com/app/1145350/",
  "description": "Battle beyond the Underworld using dark sorcery to take on the Titan of Time in this bewitching sequel to the award-winning rogue-like dungeon crawler.",
  "releaseDate": "Sep 25, 2025",
  "price": {
    "currency": "MYR",
    "euroApproximation": {
      "currency": "EUR",
      "sourceCurrency": "MYR",
      "sourceToEurRate": 0.2145,
      "final": 12.87,
      "finalFormatted": "€12.87"
    }
  },
  "reviews": {},
  "recommendations": 112725,
  "genres": []
}
```

## Config fields

- `displayOnly: "Game"`
- `minDiscount: 25`
- `minRating: 0`
- `minRelease: "2000-01-01"`
- `minReviews: 500`
- `os: "win" | "mac" | "linux" | "applesilicon"`
- `sort: "discount_asc" | "discount_desc" | "rating_asc" | "rating_desc" | "reviews_asc" | "reviews_desc" | "positive_asc" | "positive_desc" | "release_asc" | "release_desc" | "price_asc" | "price_desc"`
- `includeTags: [19]`
- `excludeTags: [1625, 1664]`

`os=applesilicon` is mapped to Steam's public `mac` search filter. The public Steam store APIs expose Mac support, but not a reliable Apple Silicon-native flag.

Games marked with Steam genre `{ "id": "70", "description": "Early Access" }` are filtered out.

Useful runtime fields in `SCRIPT_CONFIG`:

- `limit`: maximum returned games, or `null` for all
- `pages`: Steam search pages to scan, or `null` for all
- `maxCandidates`: maximum candidates to enrich, or `null` for all
- `start`: first Steam search offset
- `concurrency`: concurrent detail/review lookups
- `country`: country code for price data
- `euroApproximation.myrToEurRate`: MYR to EUR approximation used inside each `price.euroApproximation`
- `language`: language for store details
- `requestPacing`: minimum delay between fresh Steam requests per endpoint
- `retry`: retry/backoff settings for 429 and temporary Steam failures
- `progress`: print progress messages to stderr
- `verbose`: print detailed trace logs for cache, requests, candidates, filtering, and output
- `outputMode`: `json` for one final object, or `ndjson` to stream matching games line-by-line
- `outputFile`: result file path, or `null` for stdout
- `outputRetention`: delete old result files after a successful run
- `cache`: disk cache settings
- `cache.cleanupExpired`: delete expired cache JSON files at startup

The script only uses Steam Store search for discovery because it supports OS, specials, and tag filters.

Cache defaults:

- Steam search pages: 24 hours
- App details, including price/discount: 24 hours
- Review summaries: 3 days

Cache files are written under `.cache/steam`.

Expired cache files are deleted at startup when `cache.cleanupExpired` is `true`.

Existing output files are never overwritten. For `outputFile: "steam-games.json"`, each run writes a timestamped file like `steam-games-2026-07-26T14-32-02-725Z.json`. When `outputRetention.enabled` is `true`, the script keeps the newest `outputRetention.keepLast` matching result files and deletes older ones after a successful run.

Steam may throttle app detail requests when scanning many pages. The script spaces fresh requests, retries 429 responses with backoff, and reports any candidates that still fail in `warnings`. If that happens, wait a bit and run `pnpm run games` again; cached successful requests are reused, so reruns mostly fill the missing app details.
