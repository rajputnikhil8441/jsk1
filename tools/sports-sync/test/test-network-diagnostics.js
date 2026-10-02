#!/usr/bin/env node
/**
 * Network-diagnostics tests.
 *
 * Two things matter here: the filtering/formatting is right, and nothing
 * sensitive can reach the output. The collector is pure, so it is driven
 * directly with the same shape the Playwright listeners pass it.
 */

'use strict';

const assert = require('assert');
const S = require('../scrape.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  PASS  ' + name); }
    catch (e) { failed++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}
function section(t) { console.log('\n===== ' + t + ' ====='); }

const SITE = 'https://jsk1.com/';
const TARGET = 'https://jsk1.com/api/front/get_highlight_open_data?etid=4';
const fresh = () => S.createNetworkDiagnostics(SITE);

section('1. What gets recorded');

test('a 403 on the site is recorded', () => {
    const d = fresh();
    const e = d.recordResponse({ method: 'post', status: 403, url: TARGET, resourceType: 'xhr' });
    assert.ok(e, 'entry not recorded');
    assert.strictEqual(e.status, 403);
    assert.strictEqual(e.method, 'POST');
    assert.strictEqual(e.resourceType, 'xhr');
    assert.strictEqual(d.counts().forbidden, 1);
});

test('a 2xx response is ignored', () => {
    const d = fresh();
    assert.strictEqual(d.recordResponse({ method: 'GET', status: 200, url: SITE, resourceType: 'document' }), null);
    assert.strictEqual(d.entries.length, 0);
});

test('a 500 counts as another 4xx/5xx, not as a 403', () => {
    const d = fresh();
    d.recordResponse({ method: 'GET', status: 500, url: 'https://jsk1.com/api/x', resourceType: 'fetch' });
    assert.strictEqual(d.counts().forbidden, 0);
    assert.strictEqual(d.counts().otherStatus, 1);
});

test('another host is ignored, a subdomain is kept', () => {
    const d = fresh();
    assert.strictEqual(d.recordResponse({ method: 'GET', status: 403, url: 'https://cdn.example.com/a.js', resourceType: 'script' }), null);
    assert.ok(d.recordResponse({ method: 'GET', status: 404, url: 'https://api.jsk1.com/thing', resourceType: 'xhr' }));
    assert.strictEqual(d.entries.length, 1);
});

test('a request failure is recorded with its errorText', () => {
    const d = fresh();
    const e = d.recordFailure({ method: 'GET', url: 'https://jsk1.com/api/y', resourceType: 'xhr', errorText: 'net::ERR_ABORTED' });
    assert.strictEqual(e.kind, 'failure');
    assert.strictEqual(e.errorText, 'net::ERR_ABORTED');
    assert.strictEqual(d.counts().failures, 1);
});

test('a failure with no failure() detail still records', () => {
    const d = fresh();
    const e = d.recordFailure({ method: 'GET', url: 'https://jsk1.com/api/z', resourceType: 'xhr', errorText: null });
    assert.strictEqual(e.errorText, 'unknown');
});

test('repeats are counted, not duplicated', () => {
    const d = fresh();
    d.recordResponse({ method: 'POST', status: 403, url: TARGET, resourceType: 'xhr' });
    d.recordResponse({ method: 'POST', status: 403, url: TARGET, resourceType: 'xhr' });
    d.recordResponse({ method: 'POST', status: 403, url: TARGET, resourceType: 'xhr' });
    assert.strictEqual(d.entries.length, 1);
    assert.strictEqual(d.entries[0].count, 3);
    assert.strictEqual(d.counts().forbidden, 3);
});

section('2. The watched endpoint is called out');

test('the watched path is the one seen returning data manually', () => {
    assert.strictEqual(S.WATCHED_PATH, '/api/front/get_highlight_open_data');
});

test('a 403 on it is flagged and reported', () => {
    const d = fresh();
    d.recordResponse({ method: 'POST', status: 403, url: TARGET, resourceType: 'xhr' });
    assert.strictEqual(d.entries[0].watched, true);
    assert.strictEqual(d.counts().watchedForbidden, 1);
    assert.ok(/REJECTED WITH 403/.test(d.report()));
});

test('when it is never seen, the report says so', () => {
    const d = fresh();
    d.recordResponse({ method: 'GET', status: 404, url: 'https://jsk1.com/other', resourceType: 'xhr' });
    assert.ok(/not observed during this run/.test(d.report()));
});

test('it is listed before other failures', () => {
    const d = fresh();
    d.recordResponse({ method: 'GET', status: 404, url: 'https://jsk1.com/other', resourceType: 'image' });
    d.recordResponse({ method: 'POST', status: 403, url: TARGET, resourceType: 'xhr' });
    assert.ok(d.lines()[0].includes('get_highlight_open_data'));
});

section('3. Nothing sensitive can reach the output');

test('an entry carries only method, status, url, type and failure text', () => {
    const d = fresh();
    const e = d.recordResponse({ method: 'POST', status: 403, url: TARGET, resourceType: 'xhr' });
    assert.deepStrictEqual(
        Object.keys(e).sort(),
        ['count', 'errorText', 'kind', 'method', 'resourceType', 'status', 'url', 'watched'].sort()
    );
});

test('credential-looking query values are redacted', () => {
    const dirty = 'https://jsk1.com/api/x?token=abc123&session_id=zz&etid=4';
    const clean = S.sanitiseUrl(dirty);
    assert.ok(!clean.includes('abc123'), 'token value leaked: ' + clean);
    assert.ok(!clean.includes('zz&') && !/session_id=zz/.test(clean), 'session value leaked: ' + clean);
    assert.ok(clean.includes('etid=4'), 'ordinary parameter was lost: ' + clean);
});

test('the watched endpoint keeps its readable etid parameter', () => {
    assert.strictEqual(S.sanitiseUrl(TARGET), TARGET);
});

test('basic-auth credentials in a URL are stripped', () => {
    const clean = S.sanitiseUrl('https://user:secret@jsk1.com/api/x');
    assert.ok(!clean.includes('secret'), 'password leaked: ' + clean);
});

test('the rendered report contains no cookie/header/body wording', () => {
    const d = fresh();
    d.recordResponse({ method: 'POST', status: 403, url: TARGET, resourceType: 'xhr' });
    d.recordFailure({ method: 'GET', url: 'https://jsk1.com/api/y', resourceType: 'xhr', errorText: 'net::ERR_FAILED' });
    const r = d.report();
    assert.ok(!/set-cookie|authorization:|bearer /i.test(r), 'sensitive material in report');
    assert.ok(/no cookies, headers or bodies/.test(r));
});

section('4. Formatting and the summary block');

test('a line reads METHOD STATUS URL [type]', () => {
    const d = fresh();
    d.recordResponse({ method: 'POST', status: 403, url: TARGET, resourceType: 'xhr' });
    assert.strictEqual(d.lines()[0], 'POST 403 https://jsk1.com/api/front/get_highlight_open_data?etid=4 [xhr]');
});

test('a failure line shows FAILED and the reason', () => {
    const d = fresh();
    d.recordFailure({ method: 'GET', url: 'https://jsk1.com/api/y', resourceType: 'xhr', errorText: 'net::ERR_ABORTED' });
    assert.strictEqual(d.lines()[0], 'GET FAILED https://jsk1.com/api/y [xhr] (net::ERR_ABORTED)');
});

test('the summary block has the expected headings and counts', () => {
    const d = fresh();
    d.recordResponse({ method: 'POST', status: 403, url: TARGET, resourceType: 'xhr' });
    d.recordFailure({ method: 'GET', url: 'https://jsk1.com/api/y', resourceType: 'xhr', errorText: 'net::ERR_FAILED' });
    const r = d.report();
    assert.ok(/Network diagnostics/.test(r));
    assert.ok(/403 responses: 1/.test(r));
    assert.ok(/request failures: 1/.test(r));
    assert.ok(/Relevant failed requests:/.test(r));
});

test('a clean run says there was nothing to report', () => {
    assert.ok(/No failed requests recorded for jsk1.com/.test(fresh().report()));
});

test('the printed list is capped', () => {
    const d = fresh();
    for (let i = 0; i < 30; i++) {
        d.recordResponse({ method: 'GET', status: 404, url: 'https://jsk1.com/a/' + i, resourceType: 'image' });
    }
    assert.ok(/and 25 more distinct requests/.test(d.report(5)));
});

section('5. The flag');

test('--headful turns diagnostics on by itself', () => {
    assert.strictEqual(S.wantsNetDiagnostics(S.parseArgs(['--headful'])), true);
    assert.strictEqual(S.wantsNetDiagnostics(S.parseArgs(['--net-diagnostics'])), true);
    assert.strictEqual(S.wantsNetDiagnostics(S.parseArgs([])), false);
    assert.strictEqual(S.wantsNetDiagnostics(null), false);
});

test('--net-diagnostics is parsed, and --headful still works', () => {
    assert.strictEqual(S.parseArgs(['--net-diagnostics']).netDiagnostics, true);
    assert.strictEqual(S.parseArgs(['--headful']).headful, true);
    assert.strictEqual(S.parseArgs([]).netDiagnostics, false);
    assert.strictEqual(S.parseArgs([]).url, 'https://jsk1.com/');
});

console.log('\n==== ' + passed + ' passed, ' + failed + ' failed ====');
process.exit(failed ? 1 : 0);
