# sports-sync — Phase 1 proof of concept (read-only)

A standalone Node + Playwright script that opens the publicly rendered sports
table on the reference site, reads the event rows that are actually visible in
the DOM, normalises them and prints JSON to the terminal.

**This is Phase 1 only.** It is a proof of concept for *reading* data. Nothing
here is wired into the jsk-1 website.

## What it does

1. Launches Chromium through Playwright.
2. Opens `https://jsk1.com/` (overridable with `--url`).
3. Waits for `.bet-table` to render, then waits for the `.bet-table-row` count
   to hold steady, so rows inserted after first paint are included.
4. Reads every `.bet-table-row`, filters out the rows that are not events
   (column headers, sport section headings, spacers, hidden rows, name cells
   that hold only a date).
5. Normalises what is left into JSON and prints it, followed by a summary and
   diagnostics for the rows it skipped.

## What it explicitly does NOT do

- It does **not** call or reproduce the site's internal API.
- It does **not** touch encrypted payloads or attempt to decode them.
- It does **not** bypass authentication, CAPTCHA, rate limits or any other
  access control. It reads the page as a normal visitor's browser renders it.
- It does **not** log in, submit anything, or click through the site.
- It does **not** write to this website, the CMS, `localStorage`, Supabase, or
  any database. Its only output is stdout and, optionally, a local JSON file.
- It is not scheduled, deployed or run automatically. You run it by hand.

## Install

Its dependency is local to this folder and does not touch anything else in the
repository (there is no Node setup at the repo root).

```bash
cd tools/sports-sync
npm install
```

That is usually all you need. **If Google Chrome is already installed, the
scraper launches it** and no browser download is required — useful when
`cdn.playwright.dev` is slow or blocked. It looks for the usual locations,
including `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on
macOS, and prints which browser it chose:

```
[sports-sync] browser: installed system browser -> /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
[sports-sync] browser: Playwright's bundled Chromium (no system Chrome found)
```

Point it somewhere else with `--browser <path>` (or the
`PLAYWRIGHT_CHROMIUM_PATH` environment variable); a `.app` bundle works as
well as the binary inside it.

To see exactly what it found, without launching anything:

```bash
node scrape.js --browser-info
```

```
  standard macOS Chrome path:
    /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
    exists: YES

  selected:          /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
  how:               system
  launch options:    {"headless":true,"executablePath":"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
```

Only when no Chrome is found anywhere does it fall back — first to Playwright's
`chrome` channel (still no download), and finally to Playwright's own bundled
Chromium, which is the one case that needs `npx playwright install chromium`.

## Run

```bash
cd tools/sports-sync

# against the reference site
node scrape.js

# write the JSON to a file as well
node scrape.js --out out/events.json

# summary and diagnostics only, no JSON body
node scrape.js --summary-only

# against the offline fixture, no network needed
node scrape.js --url ./fixtures/sample-table.html

# watch it render, when the table will not appear
node scrape.js --headful
```

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `--url <url>` | `https://jsk1.com/` | page to read; a local path or `file://` URL works too |
| `--timeout <ms>` | `45000` | budget for the table to appear |
| `--settle <ms>` | `8000` | outer budget for the row count to stop changing |
| `--stable-for <ms>` | `1500` | how long the row count must hold steady before reading |
| `--out <file>` | – | also write the JSON here |
| `--browser <path>` | auto | browser executable to launch; defaults to an installed Google Chrome, else Playwright's Chromium |
| `--max-diagnostics <n>` | `12` | how many skipped rows to explain |
| `--browser-info` | – | show which browser would be launched, then exit |
| `--headful` | off | run a visible browser |
| `--summary-only` | off | print the summary only |

Browser preference order: `--browser` → `PLAYWRIGHT_CHROMIUM_PATH` → an installed
Google Chrome / Chromium (the standard macOS location is checked first) →
Playwright's `chrome` channel → Playwright's bundled Chromium.

## What it extracts

Per event, when the DOM actually shows it:

| Field | Source in the DOM |
| --- | --- |
| `name` | first non-date `span` in `.bet-nation-game-name` |
| `datetime` | the date/time-shaped `span` in the same cell, as displayed (not reformatted) |
| `url` | `href` of the anchor in `.bet-nation-name`, made absolute |
| `eventId` | derived from that visible `href` — a query key (`eventId`, `gameId`, …) or an id-shaped path segment; `null` when none can be derived |
| `eventIdSource` | how the id was derived, so an inferred value is never mistaken for a published one |
| `sport` | nearest preceding section heading, else an ancestor class/heading, else the active tab |
| `sportSource` | which of those was used |
| `status` | `suspended`, `live`, `open`, or `no-odds-shown` |
| `live` / `suspended` | from `.game-icons` contents and `.bet-nation-suspended-box` |
| `markets[]` | one entry per `.bet-nation-odd`, in DOM order |
| `markets[].back` / `.lay` | first visible `.back.odd-box` / `.lay.odd-box` price (`.bet-odd b`) |
| `markets[].backDetail` / `.layDetail` | that price plus its parsed number and the size/stake beside it |
| `markets[].allPrices` | every visible box, used when a market shows more than one price per side |
| `markets[].type` | `1` / `X` / `2` when the table publishes column labels, else inferred from the market count |
| `markets[].typeSource` | `table-header` or `inferred-from-count` |

Deliberate choices:

- Nothing is invented. A field that cannot be read is `null`, and anything
  inferred rather than read carries a `*Source` field saying so.
- Odds are kept **as displayed** (`"1.85"`, `"--"`). `priceNumber` holds the
  parsed number, or `null` when the cell is not a number.
- The number of markets is **not** assumed to be three. Sports with two
  markets, partly populated markets and empty markets all come through.
- Match names are never hard-coded; the script reports whatever is rendered.

## Output shape

```jsonc
{
  "source": "jsk1.com",
  "sourceUrl": "https://jsk1.com/",
  "scrapedAt": "2026-09-18T01:03:24.565Z",
  "readOnly": true,
  "counts": { "tablesFound": 1, "rowsTotal": 12, "rowsVisible": 11,
              "eventsParsed": 6, "rowsSkipped": 6 },
  "headerLabels": ["1", "X", "2"],
  "events": [
    {
      "eventId": "33871049",
      "eventIdSource": "path-segment",
      "url": "https://jsk1.com/game-detail/4/33871049",
      "sport": "Cricket",
      "sportSource": "section-heading",
      "name": "Team Alpha v Team Bravo",
      "datetime": "25/07/2026 23:30:00",
      "status": "open",
      "live": false,
      "suspended": false,
      "marketCount": 3,
      "markets": [
        { "index": 0, "type": "1", "typeSource": "table-header",
          "suspended": false, "back": "1.85", "lay": "1.87",
          "backDetail": { "price": "1.85", "priceNumber": 1.85, "size": "2.4K", "locked": null },
          "layDetail":  { "price": "1.87", "priceNumber": 1.87, "size": "1.1K", "locked": null } }
      ]
    }
  ]
}
```

## Tests

```bash
npm test              # browser resolution (18) + fixture extraction (15)
npm run test:browser  # resolution only, no browser needed
npm run test:fixture  # end-to-end extraction against the fixture
```

`test/test-browser-resolution.js` proves the exact path
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` is selected when
it exists and that it reaches `chromium.launch()` as `executablePath`. The
filesystem probe is injectable, so the macOS case is covered on any OS, and one
test uses the real probe against a real file.

Set `SPORTS_SYNC_TEST_BROWSER=/path/to/browser` to force a browser for the
fixture test.

## Offline fixture

`fixtures/sample-table.html` reproduces the documented DOM shape with
**entirely synthetic** names and odds. It exists so the parsing can be checked
without touching the live site, and it covers the awkward cases on purpose: a
column-header row, sport section headings, a spacer row, a hidden row, a fully
suspended match, a match with one empty market, a market with several back
boxes, a two-market sport, a name cell holding only a date, and a row injected
1.2 s after load.

```bash
node scrape.js --url ./fixtures/sample-table.html
```

Expected: 6 events parsed, 6 rows skipped, with the skip reason printed for each.

## Not in this phase

No Supabase tables or writes, no API endpoints, no cron, no GitHub Actions, no
background service, no deployment, no automatic sync, and no change to the
existing sports table on jsk-1. Those belong to Phase 2 and are designed
separately.

## Note on deployment

The repository's Pages workflow uploads the whole repository, so this folder is
also served from the live site. It contains no credentials and no site code,
but if you would rather it not be published, exclude `tools/` from the upload
step or disallow it in `robots.txt` — say the word and it can be done as its
own change.
