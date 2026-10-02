#!/usr/bin/env node
/**
 * End-to-end extraction test: runs scrape.js against the synthetic offline
 * fixture and checks the normalised JSON.
 *
 * It launches whatever browser scrape.js resolves, so on a Mac with Chrome
 * installed it also proves the real launch path works. Set
 * SPORTS_SYNC_TEST_BROWSER to force a particular executable.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixtures', 'sample-table.html');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  PASS  ' + name); }
    catch (e) { failed++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}

const args = [path.join(ROOT, 'scrape.js'), '--url', FIXTURE];
const forced = process.env.SPORTS_SYNC_TEST_BROWSER || process.env.PLAYWRIGHT_CHROMIUM_PATH;
if (forced) args.push('--browser', forced);

console.log('\n===== running the scraper against the offline fixture =====');
let data;
try {
    const stdout = execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
    data = JSON.parse(stdout);
} catch (e) {
    console.log('  FAIL  the scraper did not produce JSON: ' + (e.message || e).split('\n')[0]);
    console.log('\n==== 0 passed, 1 failed ====');
    process.exit(1);
}

const byName = (needle) => data.events.find((e) => e.name.includes(needle));

test('the fixture table is found and read', () => {
    assert.strictEqual(data.counts.tablesFound, 1);
    assert.strictEqual(data.source, 'local-file');
    assert.strictEqual(data.readOnly, true);
});

test('6 events parsed, 6 rows skipped', () => {
    assert.strictEqual(data.counts.eventsParsed, 6);
    assert.strictEqual(data.counts.rowsSkipped, 6);
    assert.strictEqual(data.events.length, 6);
});

test('every event has a name and a date/time', () => {
    for (const e of data.events) {
        assert.ok(e.name && e.name.length > 2, 'name missing: ' + JSON.stringify(e.name));
        assert.ok(e.datetime, 'datetime missing for ' + e.name);
    }
});

test('column labels come from the table header', () => {
    assert.deepStrictEqual(data.headerLabels, ['1', 'X', '2']);
    const m = byName('Alpha').markets;
    assert.deepStrictEqual(m.map((x) => x.type), ['1', 'X', '2']);
    assert.ok(m.every((x) => x.typeSource === 'table-header'));
});

test('back and lay prices are read as displayed', () => {
    const m = byName('Alpha').markets[0];
    assert.strictEqual(m.back, '1.85');
    assert.strictEqual(m.lay, '1.87');
    assert.strictEqual(m.backDetail.priceNumber, 1.85);
    assert.strictEqual(m.backDetail.size, '2.4K');
});

test('a suspended match is flagged and not priced', () => {
    const e = byName('Echo');
    assert.strictEqual(e.status, 'suspended');
    assert.strictEqual(e.suspended, true);
    assert.ok(e.markets.every((m) => m.suspended));
});

test('a live match is flagged', () => {
    const e = byName('Charlie');
    assert.strictEqual(e.status, 'live');
    assert.strictEqual(e.live, true);
});

test('an empty market yields nulls rather than a guess', () => {
    const m = byName('Golf').markets[1];
    assert.strictEqual(m.back, null);
    assert.strictEqual(m.lay, null);
});

test('a two-market sport is not padded to three', () => {
    assert.strictEqual(byName('Juliet').marketCount, 2);
});

test('every visible price is kept when a market has several', () => {
    const all = byName('Juliet').markets[0].allPrices;
    assert.deepStrictEqual(all.back.map((b) => b.price), ['2.10', '2.12', '2.14']);
});

test('event ids come from the visible href, with their source', () => {
    assert.strictEqual(byName('Alpha').eventId, '33871049');
    assert.strictEqual(byName('Alpha').eventIdSource, 'path-segment');
    assert.strictEqual(byName('Charlie').eventId, '99871234');
    assert.strictEqual(byName('Charlie').eventIdSource, 'query:eventId');
});

test('a row without a link gets a null id rather than an invented one', () => {
    assert.strictEqual(byName('Golf').eventId, null);
});

test('the sport comes from the section heading', () => {
    assert.strictEqual(byName('Alpha').sport, 'Cricket');
    assert.strictEqual(byName('Juliet').sport, 'Soccer');
});

test('a row inserted after load is still captured', () => {
    assert.ok(byName('November'), 'the late-injected row was missed');
});

test('headers, spacers, hidden rows and date-only cells are skipped', () => {
    assert.strictEqual(data.counts.rowsTotal, 12);
    assert.strictEqual(data.counts.rowsVisible, 11);
    assert.ok(!data.events.some((e) => e.name.includes('Kilo')), 'a CSS-hidden row was parsed');
    assert.ok(!data.events.some((e) => /^\d{2}\/\d{2}\/\d{4}$/.test(e.name)), 'a date-only row was parsed');
});

console.log('\n==== ' + passed + ' passed, ' + failed + ' failed ====');
process.exit(failed ? 1 : 0);
