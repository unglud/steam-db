# Steam games filter

Fetch Steam games as JSON using public Steam endpoints and filters shaped like the SteamDB sale URL parameters.

```sh
pnpm install
pnpm run games
```

This project pins Node through pnpm, so `pnpm install` downloads the project runtime if your shell does not have `node`.

Change what the script returns by editing `SCRIPT_CONFIG` near the top of `src/steam-games.ts`. `pnpm run games` returns all matches for that config in one CLI run. Steam still serves the data through paginated and per-app HTTP calls, so a large result set can take a while.

The script prints progress to stderr while it works, then writes a JSON object with `filters`, `warnings`, and `games` to the configured output file.

## Config fields

- `displayOnly: "Game"`
- `minDiscount: 25`
- `minRating: 0`
- `minRelease: "2000-01-01"`
- `minReviews: 500`
- `os: "win" | "mac" | "linux" | "applesilicon"`
- `sort: "discount_asc" | "discount_desc" | "rating_asc" | "rating_desc" | "reviews_asc" | "reviews_desc" | "release_asc" | "release_desc" | "price_asc" | "price_desc"`
- `includeTags: [19]`
- `excludeTags: [1625, 1664]`

`os=applesilicon` is mapped to Steam's public `mac` search filter. The public Steam store APIs expose Mac support, but not a reliable Apple Silicon-native flag, so each result includes an `appleSilicon` hint derived from macOS requirement text when Steam provides it.

Useful runtime fields in `SCRIPT_CONFIG`:

- `limit`: maximum returned games, or `null` for all
- `pages`: Steam search pages to scan, or `null` for all
- `maxCandidates`: maximum candidates to enrich, or `null` for all
- `start`: first Steam search offset
- `concurrency`: concurrent detail/review lookups
- `country`: country code for price data
- `language`: language for store details
- `source`: `search` or `applist`
- `progress`: print progress messages to stderr
- `outputMode`: `json` for one final object, or `ndjson` to stream matching games line-by-line
- `outputFile`: result file path, or `null` for stdout

`source=search` is the default because Steam search supports OS, specials, and tag filters. `source=applist` uses `IStoreService/GetAppList` and requires `STEAM_WEB_API_KEY`, but it cannot prefilter by tags or discounts.

Existing output files are never overwritten. If `steam-games.json` exists, the script writes `steam-games-1.json`, then `steam-games-2.json`, and so on.

Steam may throttle app detail requests when scanning many pages; throttled candidates are reported in `warnings`.
