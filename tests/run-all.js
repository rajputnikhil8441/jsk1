#!/usr/bin/env node
/* Runs every suite in this folder against a throwaway static server on :8777.
   Each suite is unchanged from the version that produced the 390 baseline —
   this runner only boots a server, sequences them and totals the results. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 8777);
const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml',
  '.ttf':'font/ttf', '.xml':'application/xml', '.txt':'text/plain', '.webp':'image/webp' };


/* The server runs in its own process: a suite executing synchronously here
   would otherwise block the event loop and starve it of requests. */
const server = spawn(process.execPath, [path.join(__dirname, 'serve.js')],
  { env: Object.assign({}, process.env, { TEST_PORT: String(PORT) }), stdio: 'ignore' });

function waitForServer(tries) {
  try {
    execFileSync('node', ['-e',
      'require("http").get({host:"localhost",port:' + PORT + ',path:"/index.html"},r=>process.exit(r.statusCode===200?0:1))' +
      '.on("error",()=>process.exit(1));setTimeout(()=>process.exit(1),1500)'], { stdio: 'ignore' });
    return true;
  } catch (e) {
    if (tries <= 0) return false;
    execFileSync('node', ['-e', 'setTimeout(()=>{},400)']);
    return waitForServer(tries - 1);
  }
}

if (!waitForServer(20)) { console.error('static server did not come up on :' + PORT); server.kill(); process.exit(1); }

const SUITES = (process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(__dirname).filter(f => /^test_.*\.js$/.test(f)).sort());

let pass = 0, fail = 0; const failed = [];
for (const s of SUITES) {
  process.stdout.write('\n===== ' + s + ' =====\n');
  let out = '';
  try { out = execFileSync(process.execPath, [path.join(__dirname, s)], { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  const m = out.match(/====\s*(\d+)\s*passed,\s*(\d+)\s*failed/);
  if (m) {
    pass += +m[1]; fail += +m[2];
    if (+m[2] > 0) failed.push(s);
    console.log('  ' + m[1] + ' passed, ' + m[2] + ' failed');
    out.split('\n').filter(l => /FAIL/.test(l)).forEach(l => console.log(l));
  } else {
    fail++; failed.push(s + ' (no result line)');
    console.log(out.split('\n').slice(-12).join('\n'));
  }
}

console.log('\n=================================');
console.log('TOTAL: ' + pass + ' passed, ' + fail + ' failed');
if (failed.length) console.log('failing suites: ' + failed.join(', '));
console.log('=================================');
server.kill();
process.exit(fail ? 1 : 0);
