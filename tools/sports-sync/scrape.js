#!/usr/bin/env node
/**
 * Phase 1 proof of concept - READ ONLY.
 *
 * Opens the reference site, waits for the sports table to render, reads the
 * event rows that are actually visible in the DOM, normalises them and prints
 * JSON to stdout.
 *
 * It only reads the rendered DOM. It does not call the site's internal API,
 * does not touch encrypted payloads, and does not go near authentication,
 * CAPTCHA or any other access control. It writes nothing to this website,
 * to the CMS or to Supabase.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const DEFAULTS = {
    url: 'https://jsk1.com/',
    timeout: 45000,      // total budget for "the table appeared"
    settle: 8000,        // outer budget for the row count to stop changing
    stableMs: 1500,      // how long the row count must hold steady before we read
    maxDiagnostics: 12,
    out: '',
    browser: '',
    headful: false,
    quietJson: false
};

/* ------------------------------------------------------------------ CLI -- */

function parseArgs(argv) {
    const o = Object.assign({}, DEFAULTS);
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        switch (a) {
            case '--url': o.url = next(); break;
            case '--timeout': o.timeout = parseInt(next(), 10); break;
            case '--settle': o.settle = parseInt(next(), 10); break;
            case '--stable-for': o.stableMs = parseInt(next(), 10); break;
            case '--out': o.out = next(); break;
            case '--browser': o.browser = next(); break;
            case '--max-diagnostics': o.maxDiagnostics = parseInt(next(), 10); break;
            case '--headful': o.headful = true; break;
            case '--summary-only': o.quietJson = true; break;
            case '--browser-info': o.browserInfo = true; break;
            case '-h':
            case '--help': o.help = true; break;
            default:
                if (a.startsWith('--')) { console.error('Unknown option: ' + a); process.exit(2); }
        }
    }
    return o;
}

function usage() {
    console.log(`
jsk1 sports-sync - Phase 1 read-only proof of concept

  node scrape.js [options]

  --url <url>              page to read (default: ${DEFAULTS.url})
                           a local path or file:// URL also works, for offline testing
  --timeout <ms>           budget for the table to appear (default: ${DEFAULTS.timeout})
  --settle <ms>            outer budget for the row count to stop changing (default: ${DEFAULTS.settle})
  --stable-for <ms>        how long the row count must hold steady before reading (default: ${DEFAULTS.stableMs})
  --out <file>             also write the JSON to this file
  --browser <path>         browser executable to launch (default: an installed
                           Google Chrome if there is one, else Playwright's Chromium)
  --max-diagnostics <n>    how many skipped rows to explain (default: ${DEFAULTS.maxDiagnostics})
  --browser-info           show which browser would be launched, then exit
  --headful                run a visible browser (useful when the table will not render)
  --summary-only           print the summary only, not the JSON body
  -h, --help               this text

Read-only. It does not modify the website, the CMS or Supabase.
`);
}

function resolveUrl(u) {
    if (/^[a-z]+:\/\//i.test(u)) return u;
    return pathToFileURL(path.resolve(u)).href;
}

/* --------------------------------------------------- browser resolution -- */
/**
 * Playwright's bundled Chromium download (cdn.playwright.dev) is blocked or
 * painfully slow on some networks. When a normal Google Chrome is already
 * installed we launch that instead, via Playwright's executablePath, so no
 * `npx playwright install` is needed.
 *
 * This only decides WHICH BINARY is launched. The page is opened, waited on
 * and read in exactly the same way either way.
 */

// The standard macOS install location, checked explicitly and first.
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function chromeCandidates(env) {
    env = env || {};
    const list = [
        // macOS - the standard location first
        MAC_CHROME,
        '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        // Linux
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/opt/google/chrome/chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
        // Windows
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
    if (env.HOME) {
        list.push(path.join(env.HOME, 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'));
    }
    if (env.LOCALAPPDATA) {
        list.push(path.join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
    return list;
}

/**
 * True when `p` is a real file on disk. statSync follows symlinks, and a file
 * that exists but is not marked executable for this user still counts as
 * found - Playwright will then give a precise error rather than us silently
 * pretending Chrome is absent.
 */
function isExecutableFile(p) {
    if (!p || typeof p !== 'string') return false;
    try {
        return fs.statSync(p).isFile();
    } catch (e) {
        return false;
    }
}

/**
 * Accepts either the binary itself or a macOS .app bundle, so
 * "/Applications/Google Chrome.app" resolves to the binary inside it.
 */
function normaliseBrowserPath(p, probe) {
    if (!p) return null;
    const exists = probe || isExecutableFile;
    if (exists(p)) return p;
    const m = /([^/\\]+)\.app\/?$/.exec(p);
    if (m) {
        const inner = path.join(p, 'Contents', 'MacOS', m[1]);
        if (exists(inner)) return inner;
    }
    return null;
}

/**
 * Order of preference:
 *   1. --browser <path>            (explicit, wins outright)
 *   2. PLAYWRIGHT_CHROMIUM_PATH    (explicit, environment)
 *   3. an installed Chrome/Chromium found on disk, macOS standard path first
 *   4. Playwright's "chrome" channel (still no download)
 *   5. Playwright's own bundled Chromium
 *
 * `deps` exists so the tests can drive this deterministically on any OS.
 */
function resolveBrowser(explicitPath, deps) {
    deps = deps || {};
    const probe = deps.exists || isExecutableFile;
    const env = deps.env || process.env;
    const warn = deps.warn || ((m) => console.error(m));
    const candidates = deps.candidates || chromeCandidates(env);

    if (explicitPath) {
        const resolved = normaliseBrowserPath(explicitPath, probe);
        if (resolved) return { executablePath: resolved, kind: 'explicit', checked: [explicitPath] };
        warn(`[sports-sync] warning: no browser executable at ${explicitPath} - looking for an installed Chrome instead`);
    }

    const checked = [];
    for (const c of candidates) {
        checked.push(c);
        const resolved = normaliseBrowserPath(c, probe);
        if (resolved) return { executablePath: resolved, kind: 'system', checked };
    }
    return { executablePath: null, kind: 'playwright', checked };
}

/**
 * The exact object handed to chromium.launch(). Exported so a test can prove
 * the detected path really reaches Playwright.
 */
function buildLaunchOptions(opts, deps) {
    opts = opts || {};
    const env = (deps && deps.env) || process.env;
    const choice = resolveBrowser(opts.browser || env.PLAYWRIGHT_CHROMIUM_PATH || '', deps);
    const launch = { headless: !opts.headful };
    if (choice.executablePath) launch.executablePath = choice.executablePath;
    return { launch, choice };
}

/* ------------------------------------------------- in-page DOM extraction -- */
/**
 * Runs inside the page. Must be self-contained: it is serialised across, so it
 * cannot close over anything from Node.
 *
 * Everything here is deliberately defensive. The reference DOM is not ours, its
 * row count changes, and rows are not all matches - there are headers, spacers
 * and suspended rows mixed in.
 */
function extractFromDom() {
    const txt = (el) => (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
    const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

    function isVisible(el) {
        if (!el || !el.isConnected) return false;
        if (typeof el.checkVisibility === 'function') {
            try {
                return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
            } catch (e) { /* older engines: fall through */ }
        }
        const r = el.getBoundingClientRect();
        if (r.width <= 0 && r.height <= 0) return false;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
    }

    // Date/time shapes we can recognise without guessing a locale.
    const DATE_RE = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(\d{4}-\d{2}-\d{2})|(\b\d{1,2}:\d{2}(:\d{2})?\b)|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
    const looksLikeDate = (s) => !!s && DATE_RE.test(s);
    // A string that is *only* date/time noise, with nothing else in it.
    const isOnlyDate = (s) => {
        if (!s) return false;
        const stripped = s
            .replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g, '')
            .replace(/\d{4}-\d{2}-\d{2}/g, '')
            .replace(/\d{1,2}:\d{2}(:\d{2})?/g, '')
            .replace(/\b(am|pm|today|tomorrow|ist|utc|gmt)\b/gi, '')
            .replace(/[^a-z0-9]/gi, '');
        return stripped.length === 0;
    };

    const num = (s) => {
        if (!s) return null;
        const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
        if (!m) return null;
        const v = parseFloat(m[0]);
        return Number.isFinite(v) ? v : null;
    };

    /* -- market column labels (1 / X / 2 ...) if the table publishes them -- */
    function headerLabels(table) {
        const candidates = [];
        const head = table.querySelector('.bet-table-header, .bet-table-head, thead');
        if (head) candidates.push(head);
        // Otherwise: a row-shaped element with no name cell, holding only short tokens.
        if (!candidates.length) {
            const first = table.querySelector('.bet-table-row');
            if (first && !first.querySelector('.bet-nation-name')) candidates.push(first);
        }
        for (const c of candidates) {
            const cells = Array.from(c.querySelectorAll('.bet-nation-odd, th, .odd-box'))
                .map((el) => txt(el))
                .filter((t) => t && t.length <= 4);
            if (cells.length >= 2) return cells;
        }
        return [];
    }

    /* -- the sport/category heading a row sits under, if the DOM shows one -- */
    function sportFor(row) {
        // a) nearest previous sibling that reads like a section heading
        let prev = row.previousElementSibling;
        let hops = 0;
        while (prev && hops < 40) {
            const cls = (prev.className || '').toString().toLowerCase();
            const t = txt(prev);
            const isHeadingish =
                /header|heading|title|sport|category|game-name-header|table-title/.test(cls) &&
                !prev.querySelector('.bet-nation-name');
            if (isHeadingish && t && t.length <= 60) {
                return { sport: t, sportSource: 'section-heading' };
            }
            prev = prev.previousElementSibling;
            hops++;
        }
        // b) an ancestor that names the sport
        let anc = row.parentElement;
        hops = 0;
        while (anc && hops < 10) {
            const cls = (anc.className || '').toString();
            const m = cls.match(/(?:^|[\s_-])(cricket|soccer|football|tennis|basketball|casino|kabaddi|volleyball|baseball|hockey|golf|darts|snooker|esports?)(?:$|[\s_-])/i);
            if (m) return { sport: m[1].toLowerCase(), sportSource: 'ancestor-class' };
            const heading = anc.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > .title, :scope > .sport-name');
            if (heading) {
                const t = txt(heading);
                if (t && t.length <= 60) return { sport: t, sportSource: 'ancestor-heading' };
            }
            anc = anc.parentElement;
            hops++;
        }
        // c) the active tab, when the table is tab-driven
        const activeTab = document.querySelector('.tab.active, .tabs .active, [role="tab"][aria-selected="true"], .nav-link.active');
        if (activeTab) {
            const t = txt(activeTab);
            if (t && t.length <= 40) return { sport: t, sportSource: 'active-tab' };
        }
        return { sport: null, sportSource: null };
    }

    /* -- event id, only when the visible href actually carries one -------- */
    function identityFor(row) {
        const anchor =
            row.querySelector('.bet-nation-name a[href]') ||
            row.querySelector('a[href]');
        let url = null;
        let eventId = null;
        let eventIdSource = null;

        if (anchor) {
            try {
                url = new URL(anchor.getAttribute('href'), location.href).href;
            } catch (e) { url = anchor.getAttribute('href') || null; }

            try {
                const u = new URL(url, location.href);
                const keys = ['eventId', 'event_id', 'gameId', 'game_id', 'matchId', 'match_id', 'marketId', 'market_id', 'eid', 'gmid', 'id'];
                for (const k of keys) {
                    const v = u.searchParams.get(k);
                    if (v) { eventId = v; eventIdSource = 'query:' + k; break; }
                }
                if (!eventId) {
                    const segs = u.pathname.split('/').filter(Boolean);
                    // last segment that looks like an identifier rather than a word
                    for (let i = segs.length - 1; i >= 0; i--) {
                        const s = decodeURIComponent(segs[i]);
                        if (/^\d{4,}$/.test(s) || /^[0-9a-f]{8,}$/i.test(s) || /^\d+(\.\d+)+$/.test(s)) {
                            eventId = s; eventIdSource = 'path-segment'; break;
                        }
                    }
                }
            } catch (e) { /* keep url, no id */ }
        }

        if (!eventId) {
            // data-* attribute on the row that names an id
            for (const att of Array.from(row.attributes || [])) {
                if (/^data-.*id$/i.test(att.name) && att.value) {
                    eventId = att.value; eventIdSource = 'attr:' + att.name; break;
                }
            }
        }
        return { url, eventId, eventIdSource };
    }

    /* -- name and date/time out of .bet-nation-game-name ------------------ */
    function nameFor(row) {
        const nameCell = row.querySelector('.bet-nation-name');
        if (!nameCell) return null;
        const gameName = nameCell.querySelector('.bet-nation-game-name') || nameCell;

        // leaf spans only, so nested wrappers are not counted twice
        const leaves = Array.from(gameName.querySelectorAll('span'))
            .filter((s) => !s.querySelector('span'))
            .map((s) => txt(s))
            .filter(Boolean);

        let name = null;
        let datetime = null;
        const extras = [];

        if (leaves.length) {
            for (const t of leaves) {
                if (!name && !isOnlyDate(t)) { name = t; continue; }
                if (!datetime && looksLikeDate(t)) { datetime = t; continue; }
                extras.push(t);
            }
        }

        if (!name) {
            // no usable spans: take the cell text and peel a trailing date off it
            const whole = txt(gameName);
            if (whole) {
                const m = whole.match(/^(.*?)(\s*)((\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}).*)$/);
                if (m && m[1].trim()) { name = m[1].trim(); datetime = datetime || m[3].trim(); }
                else if (!isOnlyDate(whole)) name = whole;
            }
        }

        return { name: name || null, datetime: datetime || null, extras };
    }

    /* -- one .odd-box -> its visible numbers ------------------------------ */
    function readOddBox(box) {
        const oddEl = box.querySelector('.bet-odd') || box;
        const strong = oddEl.querySelector('b, strong');
        const price = txt(strong) || txt(oddEl) || txt(box) || null;

        // a secondary figure (stake/size) often sits beside the bold price
        let size = null;
        const secondary = Array.from(oddEl.querySelectorAll('span, small, div'))
            .filter((el) => !el.querySelector('b, strong'))
            .map((el) => txt(el))
            .filter((t) => t && t !== price);
        if (secondary.length) size = secondary[0];

        const cls = (box.className || '').toString();
        const locked = /suspend|lock|disab/i.test(cls) || !!box.querySelector('.bet-nation-suspended-box');

        return {
            price: price || null,
            priceNumber: num(price),
            size: size || null,
            locked: locked || null
        };
    }

    /* -- markets for a row ------------------------------------------------ */
    function marketsFor(row, labels) {
        const containers = Array.from(row.querySelectorAll('.bet-nation-odd'));
        const markets = containers.map((c, index) => {
            const boxes = Array.from(c.querySelectorAll('.odd-box'));
            const back = [];
            const lay = [];
            const other = [];
            for (const b of boxes) {
                if (!isVisible(b)) continue;
                const v = readOddBox(b);
                if (b.classList.contains('back')) back.push(v);
                else if (b.classList.contains('lay')) lay.push(v);
                else other.push(v);
            }
            const suspendedBox = c.querySelector('.bet-nation-suspended-box');
            const suspended = !!(suspendedBox && isVisible(suspendedBox)) ||
                /suspend|lock/i.test((c.className || '').toString());

            const m = {
                index,
                type: null,
                typeSource: null,
                suspended,
                back: back.length ? back[0].price : null,
                lay: lay.length ? lay[0].price : null
            };
            if (suspended && suspendedBox) m.suspendedLabel = txt(suspendedBox) || null;
            // keep every visible value, so nothing is lost when a sport shows
            // more than one price per side
            if (back.length > 1 || lay.length > 1 || other.length) {
                m.allPrices = { back, lay, other };
            } else {
                if (back.length) m.backDetail = back[0];
                if (lay.length) m.layDetail = lay[0];
            }
            return m;
        });

        // label the columns only if the page gives us labels, otherwise say so
        if (labels.length === markets.length && markets.length) {
            markets.forEach((m, i) => { m.type = labels[i]; m.typeSource = 'table-header'; });
        } else if (markets.length === 3) {
            ['1', 'X', '2'].forEach((t, i) => { markets[i].type = t; markets[i].typeSource = 'inferred-from-count'; });
        } else if (markets.length === 2) {
            ['1', '2'].forEach((t, i) => { markets[i].type = t; markets[i].typeSource = 'inferred-from-count'; });
        }
        return markets;
    }

    /* -- live / suspended signals ---------------------------------------- */
    function statusFor(row, markets) {
        const signals = { icons: [], suspendedBoxes: 0 };

        const iconHost = row.querySelector('.game-icons');
        if (iconHost) {
            for (const el of Array.from(iconHost.querySelectorAll('*'))) {
                const bits = [
                    (el.className || '').toString(),
                    el.getAttribute('title') || '',
                    el.getAttribute('alt') || '',
                    el.getAttribute('aria-label') || '',
                    txt(el)
                ].filter(Boolean).join(' ').trim();
                if (bits) signals.icons.push(clip(bits, 60));
            }
            const own = txt(iconHost);
            if (own && !signals.icons.length) signals.icons.push(clip(own, 60));
        }

        const suspendedBoxes = Array.from(row.querySelectorAll('.bet-nation-suspended-box')).filter(isVisible);
        signals.suspendedBoxes = suspendedBoxes.length;

        const rowCls = (row.className || '').toString();
        const iconBlob = signals.icons.join(' ');
        const live = /(^|[\s_-])(live|in-?play|inplay)([\s_-]|$)/i.test(rowCls) ||
            /live|in-?play|tv|stream/i.test(iconBlob);

        const anyMarkets = markets.length > 0;
        const allSuspended = anyMarkets && markets.every((m) => m.suspended);
        const suspended = suspendedBoxes.length > 0 || allSuspended ||
            /suspend|lock/i.test(rowCls);

        let status = 'open';
        if (suspended) status = 'suspended';
        else if (live) status = 'live';
        else if (!anyMarkets) status = 'no-odds-shown';

        return { status, live, suspended, signals };
    }

    /* ---------------------------------------------------------- main pass */
    const tables = Array.from(document.querySelectorAll('.bet-table'));
    const scope = tables.length ? tables : [document];
    const labels = tables.length ? headerLabels(tables[0]) : [];

    const rows = [];
    for (const t of scope) {
        const host = t.querySelectorAll ? t : document;
        for (const r of Array.from(host.querySelectorAll('.bet-table-row'))) {
            if (!rows.includes(r)) rows.push(r);
        }
    }

    const events = [];
    const skipped = [];
    let visibleCount = 0;

    rows.forEach((row, i) => {
        const snippet = clip(txt(row), 80);

        if (!isVisible(row)) { skipped.push({ row: i, reason: 'not-visible', snippet }); return; }
        visibleCount++;

        if (!row.querySelector('.bet-nation-name')) {
            skipped.push({ row: i, reason: 'no-name-cell (header/spacer/other structure)', snippet });
            return;
        }

        const parsedName = nameFor(row);
        if (!parsedName || !parsedName.name) {
            skipped.push({ row: i, reason: 'no-readable-name', snippet });
            return;
        }
        if (isOnlyDate(parsedName.name)) {
            skipped.push({ row: i, reason: 'name-is-only-a-date', snippet });
            return;
        }

        const markets = marketsFor(row, labels);
        const identity = identityFor(row);
        const sport = sportFor(row);
        const st = statusFor(row, markets);

        // a real event shows at least one of: odds, a date/time, or a link
        if (!markets.length && !parsedName.datetime && !identity.url) {
            skipped.push({ row: i, reason: 'no-event-signal (no odds, no time, no link)', snippet });
            return;
        }

        const ev = {
            eventId: identity.eventId,
            eventIdSource: identity.eventIdSource,
            url: identity.url,
            sport: sport.sport,
            sportSource: sport.sportSource,
            name: parsedName.name,
            datetime: parsedName.datetime,
            status: st.status,
            live: st.live,
            suspended: st.suspended,
            marketCount: markets.length,
            markets
        };
        if (parsedName.extras && parsedName.extras.length) ev.nameExtras = parsedName.extras;
        if (st.signals.icons.length || st.signals.suspendedBoxes) ev.statusSignals = st.signals;

        events.push(ev);
    });

    return {
        tablesFound: tables.length,
        rowsTotal: rows.length,
        rowsVisible: visibleCount,
        headerLabels: labels,
        events,
        skipped
    };
}

/* ------------------------------------------------------------- main flow -- */

async function waitForTable(page, opts) {
    try {
        await page.waitForSelector('.bet-table', { timeout: opts.timeout, state: 'attached' });
    } catch (e) {
        throw new Error(`.bet-table never appeared within ${opts.timeout}ms`);
    }
    // at least one row, then let the count settle: rows arrive after the shell
    try {
        await page.waitForSelector('.bet-table .bet-table-row', { timeout: Math.min(opts.timeout, 20000), state: 'attached' });
    } catch (e) {
        return { rowsSettled: false, note: 'table rendered but no .bet-table-row appeared within the row timeout' };
    }

    // Wait for a quiet period: the row count has to hold steady for `stableMs`
    // before we read. Rows can be appended a second or more after first paint.
    const deadline = Date.now() + opts.settle;
    let last = -1;
    let lastChange = Date.now();
    while (Date.now() < deadline) {
        const n = await page.locator('.bet-table .bet-table-row').count();
        if (n !== last) { last = n; lastChange = Date.now(); }
        else if (n > 0 && Date.now() - lastChange >= opts.stableMs) {
            return { rowsSettled: true, rowCount: n };
        }
        await page.waitForTimeout(250);
    }
    return { rowsSettled: false, rowCount: last, note: 'row count was still changing when the settle budget ran out' };
}

function printBrowserInfo(opts) {
    const { launch, choice } = buildLaunchOptions(opts || {});
    console.log('sports-sync browser resolution');
    console.log('  script:            ' + __filename);
    console.log('  platform:          ' + process.platform);
    console.log('  --browser:         ' + (opts && opts.browser ? opts.browser : '(not set)'));
    console.log('  PLAYWRIGHT_CHROMIUM_PATH: ' + (process.env.PLAYWRIGHT_CHROMIUM_PATH || '(not set)'));
    console.log('  standard macOS Chrome path:');
    console.log('    ' + MAC_CHROME);
    console.log('    exists: ' + (isExecutableFile(MAC_CHROME) ? 'YES' : 'no'));
    console.log('');
    console.log('  selected:          ' + (choice.executablePath || "(none - will try the 'chrome' channel, then bundled Chromium)"));
    console.log('  how:               ' + choice.kind);
    console.log('  launch options:    ' + JSON.stringify(launch));
    if (!choice.executablePath) {
        console.log('  paths checked:');
        choice.checked.forEach((c) => console.log('    - ' + c));
    }
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) { usage(); return 0; }
    if (opts.browserInfo) { printBrowserInfo(opts); return 0; }

    const url = resolveUrl(opts.url);
    let host = 'unknown';
    try { host = new URL(url).host || 'local-file'; } catch (e) { /* ignore */ }

    const { chromium } = require('playwright');

    const { launch, choice } = buildLaunchOptions(opts);
    if (choice.executablePath) {
        const how = choice.kind === 'explicit' ? 'browser you specified' : 'installed system browser';
        console.error(`[sports-sync] browser: ${how} -> ${choice.executablePath}`);
    } else {
        console.error('[sports-sync] browser: no installed Chrome found at any known path');
        console.error('[sports-sync]   checked: ' + choice.checked.slice(0, 4).join(', ') + ` (+${Math.max(0, choice.checked.length - 4)} more)`);
        console.error('[sports-sync]   will try the "chrome" channel, then Playwright\'s bundled Chromium');
    }

    console.error(`[sports-sync] opening ${url} (read-only)`);

    let browser;
    try {
        browser = await chromium.launch(launch);
    } catch (e) {
        const first = String(e.message || e).split('\n')[0];
        // No explicit path: try the installed-Chrome channel before giving up,
        // since that also needs no download.
        if (!launch.executablePath) {
            try {
                console.error('[sports-sync] bundled Chromium unavailable, trying the installed "chrome" channel');
                browser = await chromium.launch(Object.assign({}, launch, { channel: 'chrome' }));
                console.error('[sports-sync] browser: installed Chrome via the "chrome" channel');
            } catch (e2) {
                console.error('\n[sports-sync] FAILED to launch a browser.');
                console.error('[sports-sync]   bundled Chromium: ' + first);
                console.error('[sports-sync]   chrome channel:   ' + String(e2.message || e2).split('\n')[0]);
                console.error('[sports-sync] Install Google Chrome, or pass one with --browser <path>.');
                console.error('[sports-sync] Run `node scrape.js --browser-info` to see what was checked.');
                return 1;
            }
        } else {
            console.error('\n[sports-sync] FAILED to launch ' + launch.executablePath);
            console.error('[sports-sync]   ' + first);
            return 1;
        }
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();

    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e).split('\n')[0]));

    let result = null;
    let wait = null;
    let failure = null;

    try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeout });
        if (resp && resp.status() >= 400) {
            failure = `HTTP ${resp.status()} from ${url}`;
        } else {
            wait = await waitForTable(page, opts);
            result = await page.evaluate(extractFromDom);
        }
    } catch (e) {
        failure = String(e.message || e).split('\n')[0];
    } finally {
        await browser.close();
    }

    if (failure) {
        console.error('\n[sports-sync] FAILED: ' + failure);
        if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|ENOTFOUND|ERR_NAME_NOT_RESOLVED/i.test(failure)) {
            console.error('[sports-sync] the host could not be reached from this machine/network.');
        }
        if (/bet-table never appeared/i.test(failure)) {
            console.error('[sports-sync] the page loaded but .bet-table never appeared. Try --headful to see what rendered,');
            console.error('[sports-sync] or raise --timeout if the table is just slow.');
        }
        if (pageErrors.length) console.error('[sports-sync] page errors: ' + pageErrors.slice(0, 3).join(' | '));
        return 1;
    }

    const payload = {
        source: host,
        sourceUrl: url,
        scrapedAt: new Date().toISOString(),
        readOnly: true,
        counts: {
            tablesFound: result.tablesFound,
            rowsTotal: result.rowsTotal,
            rowsVisible: result.rowsVisible,
            eventsParsed: result.events.length,
            rowsSkipped: result.skipped.length
        },
        headerLabels: result.headerLabels,
        events: result.events
    };

    if (!opts.quietJson) console.log(JSON.stringify(payload, null, 2));

    if (opts.out) {
        const outPath = path.resolve(opts.out);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
        console.error(`[sports-sync] JSON written to ${path.resolve(opts.out)}`);
    }

    /* ------------------------------------------------------- summary --- */
    const c = payload.counts;
    console.error('');
    console.error('---------------------------------------------');
    console.error(`Found ${c.rowsVisible} visible event rows (of ${c.rowsTotal} .bet-table-row in ${c.tablesFound} .bet-table)`);
    console.error(`Successfully parsed ${c.eventsParsed} events`);
    console.error(`Failed/skipped ${c.rowsSkipped} rows`);
    if (wait && wait.rowsSettled === false) {
        console.error(`Note: ${wait.note}`);
    }

    const withOdds = result.events.filter((e) => e.markets.some((m) => m.back || m.lay)).length;
    const withTime = result.events.filter((e) => e.datetime).length;
    const withId = result.events.filter((e) => e.eventId).length;
    const withSport = result.events.filter((e) => e.sport).length;
    const suspended = result.events.filter((e) => e.suspended).length;
    console.error(`  with a date/time: ${withTime}/${c.eventsParsed}`);
    console.error(`  with visible odds: ${withOdds}/${c.eventsParsed}`);
    console.error(`  with an event id: ${withId}/${c.eventsParsed}`);
    console.error(`  with a sport/category: ${withSport}/${c.eventsParsed}`);
    console.error(`  suspended/locked: ${suspended}/${c.eventsParsed}`);

    if (result.skipped.length) {
        const byReason = {};
        for (const s of result.skipped) byReason[s.reason] = (byReason[s.reason] || 0) + 1;
        console.error('\nSkipped rows by reason:');
        for (const [reason, n] of Object.entries(byReason)) console.error(`  ${n}x ${reason}`);

        console.error(`\nFirst ${Math.min(opts.maxDiagnostics, result.skipped.length)} skipped rows:`);
        result.skipped.slice(0, opts.maxDiagnostics).forEach((s) => {
            console.error(`  row ${s.row}: ${s.reason}${s.snippet ? ' | text: "' + s.snippet + '"' : ' | (no text)'}`);
        });
        if (result.skipped.length > opts.maxDiagnostics) {
            console.error(`  ... and ${result.skipped.length - opts.maxDiagnostics} more`);
        }
    }

    if (pageErrors.length) {
        console.error(`\nPage console errors (${pageErrors.length}), first 3:`);
        pageErrors.slice(0, 3).forEach((e) => console.error('  ' + e));
    }
    console.error('---------------------------------------------');

    return c.eventsParsed > 0 ? 0 : 1;
}

if (require.main === module) {
    main().then((code) => process.exit(code)).catch((e) => {
        console.error('[sports-sync] unexpected error: ' + (e && e.stack ? e.stack : e));
        process.exit(1);
    });
}

// Exported for the tests in ./test. Requiring this file does not launch anything.
module.exports = {
    MAC_CHROME,
    chromeCandidates,
    isExecutableFile,
    normaliseBrowserPath,
    resolveBrowser,
    buildLaunchOptions,
    parseArgs
};
