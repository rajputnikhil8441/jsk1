#!/usr/bin/env node
/* Builds assets/asset-manifest.json — the list of images the Page Builder's
   asset picker may offer.

   WHY A FILE. This is a static site: there is no directory listing to ask
   at runtime, and the alternative — letting the admin type any path — is
   what the picker exists to avoid. So the list is generated from what is
   actually on disk and committed alongside it.

   WHAT GOES IN. Only files under the roots below, only real image
   extensions, and only dimensions read out of the file's own header. A
   file whose header this cannot read gets no dimensions rather than
   invented ones.

   Run it after adding or removing an image:

       node tools/build-asset-manifest.js

   It is deterministic: same files in, same bytes out, so a stale manifest
   shows up as a diff rather than as a surprise. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'asset-manifest.json');

/* Directories whose contents are already public on the live site. Anything
   outside these is not offered, whatever it is. */
const ROOTS = [
    { dir: 'assets/images',       group: 'Site images', recurse: false },
    { dir: 'assets/images/games', group: 'Games',       recurse: false },
    { dir: 'assets/icons',        group: 'Icons',       recurse: false }
];

const EXT = /\.(png|jpe?g|gif|svg|webp)$/i;

/* ---- dimensions, read from the file's own header ---- */

function pngSize(b) {
    if (b.length < 24) return null;
    if (b.readUInt32BE(0) !== 0x89504e47) return null;
    if (b.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function gifSize(b) {
    if (b.length < 10 || b.toString('ascii', 0, 3) !== 'GIF') return null;
    return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
}

/* Walks the JPEG marker chain to the first start-of-frame. */
function jpegSize(b) {
    if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return null;
    let i = 2;
    while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i += 1; continue; }
        const marker = b[i + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            i += 2; continue;
        }
        const len = b.readUInt16BE(i + 2);
        /* SOF0..SOF15, minus the two that are not frames */
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
        }
        i += 2 + len;
    }
    return null;
}

function webpSize(b) {
    if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' ||
        b.toString('ascii', 8, 12) !== 'WEBP') return null;
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { w: (b.readUIntLE(24, 3) + 1), h: (b.readUIntLE(27, 3) + 1) };
    if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
        const n = b.readUInt32LE(21);
        return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
    }
    return null;
}

/* An SVG states its size, or states a viewBox, or states neither. Only the
   first two produce a number; the third produces none. */
function svgSize(b) {
    const head = b.toString('utf8', 0, Math.min(b.length, 2048));
    const num = (re) => { const m = re.exec(head); return m ? parseFloat(m[1]) : NaN; };
    const w = num(/\bwidth\s*=\s*["']([0-9.]+)/i);
    const h = num(/\bheight\s*=\s*["']([0-9.]+)/i);
    if (w > 0 && h > 0) return { w: Math.round(w), h: Math.round(h) };
    const vb = /\bviewBox\s*=\s*["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)/i.exec(head);
    if (vb) return { w: Math.round(parseFloat(vb[1])), h: Math.round(parseFloat(vb[2])) };
    return null;
}

function sizeOf(file, buf) {
    const ext = path.extname(file).toLowerCase();
    try {
        if (ext === '.png') return pngSize(buf);
        if (ext === '.gif') return gifSize(buf);
        if (ext === '.jpg' || ext === '.jpeg') return jpegSize(buf);
        if (ext === '.webp') return webpSize(buf);
        if (ext === '.svg') return svgSize(buf);
    } catch (e) { /* an unreadable header means no dimensions, not a guess */ }
    return null;
}

/* ---- build ---- */

const assets = [];
let noSize = 0;

ROOTS.forEach(function (spec) {
    const abs = path.join(ROOT, spec.dir);
    if (!fs.existsSync(abs)) return;
    fs.readdirSync(abs).sort().forEach(function (name) {
        const full = path.join(abs, name);
        if (!fs.statSync(full).isFile()) return;
        if (!EXT.test(name)) return;
        const rel = spec.dir + '/' + name;
        const buf = fs.readFileSync(full);
        const size = sizeOf(name, buf);
        if (!size) noSize += 1;
        const entry = {
            path: rel,
            name: name.replace(/\.[^.]+$/, ''),
            group: spec.group,
            bytes: buf.length
        };
        if (size) { entry.w = size.w; entry.h = size.h; }
        assets.push(entry);
    });
});

/* Sorted, so the file is stable whatever order the filesystem returns. */
assets.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });

const manifest = {
    kind: 'jsk1-asset-manifest',
    version: 1,
    roots: ROOTS.map(function (r) { return r.dir + '/'; }),
    assets: assets
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1) + '\n');
console.log('wrote ' + path.relative(ROOT, OUT) + ': ' + assets.length + ' assets, ' +
            noSize + ' without readable dimensions, ' +
            Math.round(fs.statSync(OUT).size / 1024) + ' KB');
