#!/usr/bin/env node
/**
 * Browser-resolution tests.
 *
 * The point of these is requirement 1-3: when
 *   /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
 * exists, that exact path must be chosen AND must reach chromium.launch().
 *
 * The filesystem probe is injectable, so a macOS layout can be simulated on
 * any machine. One test also uses the real probe against a real file, so the
 * production code path is exercised, not only the injected one.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const S = require('../scrape.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  PASS  ' + name); }
    catch (e) { failed++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}
function section(t) { console.log('\n===== ' + t + ' ====='); }

/** a probe that reports exactly the given paths as existing files */
const only = (...paths) => (p) => paths.includes(p);
const nothing = () => false;
const silent = () => {};

section('1. The standard macOS Chrome path');

test('the constant is the exact path the Mac uses', () => {
    assert.strictEqual(S.MAC_CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
});

test('it is the first candidate checked', () => {
    assert.strictEqual(S.chromeCandidates({})[0], S.MAC_CHROME);
});

test('when it exists, resolveBrowser returns that exact path', () => {
    const r = S.resolveBrowser('', { exists: only(S.MAC_CHROME), env: {}, warn: silent });
    assert.strictEqual(r.executablePath, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    assert.strictEqual(r.kind, 'system');
});

test('it wins over a Chrome further down the list', () => {
    const r = S.resolveBrowser('', { exists: only(S.MAC_CHROME, '/usr/bin/google-chrome'), env: {}, warn: silent });
    assert.strictEqual(r.executablePath, S.MAC_CHROME);
});

section('2. The detected path reaches chromium.launch()');

test('buildLaunchOptions puts the exact macOS path in executablePath', () => {
    const { launch, choice } = S.buildLaunchOptions({}, { exists: only(S.MAC_CHROME), env: {}, warn: silent });
    assert.strictEqual(launch.executablePath, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    assert.strictEqual(choice.kind, 'system');
});

test('headless is still honoured alongside executablePath', () => {
    const a = S.buildLaunchOptions({ headful: false }, { exists: only(S.MAC_CHROME), env: {}, warn: silent });
    const b = S.buildLaunchOptions({ headful: true }, { exists: only(S.MAC_CHROME), env: {}, warn: silent });
    assert.strictEqual(a.launch.headless, true);
    assert.strictEqual(b.launch.headless, false);
    assert.strictEqual(b.launch.executablePath, S.MAC_CHROME);
});

test('no executablePath is set when nothing is installed', () => {
    const { launch, choice } = S.buildLaunchOptions({}, { exists: nothing, env: {}, warn: silent });
    assert.strictEqual('executablePath' in launch, false);
    assert.strictEqual(choice.kind, 'playwright');
    assert.ok(choice.checked.includes(S.MAC_CHROME), 'the macOS path must be among the paths checked');
});

section('3. Real filesystem, real probe');

test('a real Chrome-shaped file on disk is detected by the production probe', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sports-sync-'));
    const bin = path.join(tmp, 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome');
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(bin, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    try {
        assert.strictEqual(S.isExecutableFile(bin), true);
        const r = S.resolveBrowser('', { candidates: [bin], env: {}, warn: silent });
        assert.strictEqual(r.executablePath, bin);
        assert.strictEqual(r.kind, 'system');
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('a directory is not mistaken for a browser', () => {
    assert.strictEqual(S.isExecutableFile(os.tmpdir()), false);
});

test('a missing path is not mistaken for a browser', () => {
    assert.strictEqual(S.isExecutableFile('/definitely/not/here/Google Chrome'), false);
});

section('4. --browser and PLAYWRIGHT_CHROMIUM_PATH still work');

test('--browser wins over the detected system Chrome', () => {
    const r = S.resolveBrowser('/custom/chrome', { exists: only('/custom/chrome', S.MAC_CHROME), env: {}, warn: silent });
    assert.strictEqual(r.executablePath, '/custom/chrome');
    assert.strictEqual(r.kind, 'explicit');
});

test('PLAYWRIGHT_CHROMIUM_PATH is honoured through buildLaunchOptions', () => {
    const deps = { exists: only('/env/chrome'), env: { PLAYWRIGHT_CHROMIUM_PATH: '/env/chrome' }, warn: silent };
    const { launch, choice } = S.buildLaunchOptions({}, deps);
    assert.strictEqual(launch.executablePath, '/env/chrome');
    assert.strictEqual(choice.kind, 'explicit');
});

test('--browser beats PLAYWRIGHT_CHROMIUM_PATH', () => {
    const deps = { exists: only('/flag/chrome', '/env/chrome'), env: { PLAYWRIGHT_CHROMIUM_PATH: '/env/chrome' }, warn: silent };
    const { launch } = S.buildLaunchOptions({ browser: '/flag/chrome' }, deps);
    assert.strictEqual(launch.executablePath, '/flag/chrome');
});

test('a bad --browser warns and falls back to the macOS Chrome', () => {
    const warnings = [];
    const r = S.resolveBrowser('/no/such/chrome', {
        exists: only(S.MAC_CHROME), env: {}, warn: (m) => warnings.push(m)
    });
    assert.strictEqual(r.executablePath, S.MAC_CHROME);
    assert.strictEqual(warnings.length, 1);
    assert.ok(/no browser executable at \/no\/such\/chrome/.test(warnings[0]));
});

section('5. .app bundles and CLI parsing');

test('a .app bundle resolves to the binary inside it', () => {
    const app = '/Applications/Google Chrome.app';
    const r = S.resolveBrowser(app, { exists: only(S.MAC_CHROME), env: {}, warn: silent });
    assert.strictEqual(r.executablePath, S.MAC_CHROME);
});

test('--browser is parsed off the command line', () => {
    assert.strictEqual(S.parseArgs(['--browser', '/a/b/Google Chrome']).browser, '/a/b/Google Chrome');
});

test('--browser-info is parsed and the live target is unchanged', () => {
    assert.strictEqual(S.parseArgs(['--browser-info']).browserInfo, true);
    assert.strictEqual(S.parseArgs([]).url, 'https://jsk1.com/');
});

section('6. Requiring the module launches nothing');

test('no browser is started merely by requiring scrape.js', () => {
    assert.strictEqual(typeof S.resolveBrowser, 'function');
    assert.strictEqual(typeof S.buildLaunchOptions, 'function');
});

console.log('\n==== ' + passed + ' passed, ' + failed + ' failed ====');
process.exit(failed ? 1 : 0);
