/* ===================================================================
   UPLOADED CMS MEDIA
   -------------------------------------------------------------------
   Two kinds of image live in this CMS and they are deliberately not the
   same thing:

     REPOSITORY ASSETS   committed under assets/, listed by
                         assets/asset-manifest.json. A developer adds
                         them; they ship with the site; the admin can
                         choose one but can never add or remove one.
     UPLOADED CMS MEDIA  what this file is about. An admin uploads a
                         picture from /admin, it lands in the site's own
                         Supabase Storage bucket, and the Page Builder
                         can use it immediately.

   The manifest system is untouched. Every image already on the site
   goes on working exactly as it did, and an uploaded file can never
   masquerade as a repository path or the other way round -- they are
   validated by two separate functions (CMS.sections.assetPath and
   CMS.sections.mediaPath) that share no code path.

   WHAT IS TRUSTED HERE: nothing the uploader supplies.
     - the file NAME is thrown away and a new one generated;
     - the file's claimed MIME TYPE must match its extension AND the
       bytes at the front of the file;
     - the file must actually DECODE as an image in this browser;
     - the size limit is checked before a byte is sent;
     - SVG is refused outright -- an SVG is a script host, and no
       amount of sanitising makes one safe to serve from your origin.

   The object name is generated here and re-checked inside cms.js
   against the single pattern this CMS ever writes, so even a bug in
   this file cannot place an object elsewhere in the bucket.
   =================================================================== */
(function () {
    'use strict';

    var CMS = window.CMS;
    if (!CMS) return;

    /* ---------- what may be uploaded ---------- */

    /* Extension -> the one MIME type that extension may claim.
       Note what is NOT here: svg, ico, bmp, tif, avif. Adding one means
       adding its signature below as well -- a type with no signature
       check would be trusted on its extension alone. */
    var TYPES = {
        png:  { mime: 'image/png',  label: 'PNG'  },
        jpg:  { mime: 'image/jpeg', label: 'JPEG' },
        jpeg: { mime: 'image/jpeg', label: 'JPEG' },
        webp: { mime: 'image/webp', label: 'WebP' },
        gif:  { mime: 'image/gif',  label: 'GIF'  }
    };

    /* The first bytes a real file of that type begins with. */
    var SIGNATURES = {
        'image/png':  function (b) {
            return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
                   b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A;
        },
        'image/jpeg': function (b) { return b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF; },
        'image/gif':  function (b) {
            return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
                   (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61;
        },
        'image/webp': function (b) {
            return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                   b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
        }
    };

    /* A document pretending to be a picture. The signature test above
       already refuses every one of these, and this stays because it names
       the attack out loud: if a signature test is ever loosened, this is
       the line that still says no. */
    var DOC_HEAD = /^\s*(<\?xml|<!doctype|<html|<svg|<script|%pdf|<!--)/i;

    var MAX_NAME = 200;

    function cfg() { return window.CMS_MEDIA || {}; }
    function maxBytes() {
        var n = parseInt(cfg().maxBytes, 10);
        return (n > 0 && n <= 52428800) ? n : 5242880;
    }

    function extensionOf(name) {
        var m = /\.([A-Za-z0-9]+)$/.exec(String(name || ''));
        return m ? m[1].toLowerCase() : '';
    }

    /* The uploader's file name is NEVER used as a path. It is reduced to
       letters, digits and hyphens, truncated, and a random suffix added --
       so a hostile name cannot traverse, cannot collide with an existing
       object, and cannot carry anything the URL would have to escape. */
    function objectKey(originalName, ext) {
        var base = String(originalName || '').replace(/\.[^.]*$/, '');
        base = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
        base = base.replace(/-+$/, '');
        if (!base) base = 'image';
        var rand = '';
        try {
            var buf = new Uint8Array(6);
            (window.crypto || window.msCrypto).getRandomValues(buf);
            for (var i = 0; i < buf.length; i++) rand += (buf[i] % 36).toString(36);
        } catch (e) {
            rand = Math.random().toString(36).slice(2, 10);
        }
        if (!/^[a-z0-9]{4,}$/.test(rand)) rand = String(Date.now()).slice(-10);
        return 'media/' + base + '-' + rand + '.' + ext;
    }

    function head(file, n) {
        return new Promise(function (resolve) {
            var slice = file.slice(0, n);
            if (slice.arrayBuffer) {
                slice.arrayBuffer().then(function (buf) { resolve(new Uint8Array(buf)); },
                                         function () { resolve(new Uint8Array(0)); });
                return;
            }
            var fr = new FileReader();
            fr.onload = function () { resolve(new Uint8Array(fr.result)); };
            fr.onerror = function () { resolve(new Uint8Array(0)); };
            fr.readAsArrayBuffer(slice);
        });
    }

    /* Does the browser agree this is a picture? A file can carry a correct
       signature and still be a truncated or malformed image; if it will not
       decode here it will not decode for a visitor either. This is also
       where the real dimensions come from -- never from the uploader. */
    function decode(file) {
        return new Promise(function (resolve) {
            var url = '';
            try { url = URL.createObjectURL(file); } catch (e) { resolve(null); return; }
            var img = new Image();
            var done = function (v) {
                try { URL.revokeObjectURL(url); } catch (e) {}
                resolve(v);
            };
            img.onload = function () {
                done(img.naturalWidth > 0 && img.naturalHeight > 0
                    ? { w: img.naturalWidth, h: img.naturalHeight } : null);
            };
            img.onerror = function () { done(null); };
            img.src = url;
        });
    }

    /* ---------- the gate ----------
       Resolves with { ok: true, ... } or { ok: false, reason: '...' }.
       It never throws and never rejects: every refusal is a message a
       non-technical admin can act on. */
    function validate(file) {
        var fail = function (reason) { return Promise.resolve({ ok: false, reason: reason }); };

        if (!file || typeof file.slice !== 'function') return fail('That is not a file.');

        var name = String(file.name || '');
        if (!name) return fail('That file has no name.');
        if (name.length > MAX_NAME) return fail('That file name is absurdly long.');

        var ext = extensionOf(name);
        if (!ext) return fail('That file has no extension, so there is no way to tell what it is.');
        if (!Object.prototype.hasOwnProperty.call(TYPES, ext))
            return fail('“.' + ext + '” is not an image format this site accepts. Use PNG, JPEG, WebP or GIF.');

        var want = TYPES[ext].mime;
        var claimed = String(file.type || '').toLowerCase().split(';')[0].trim();
        if (!claimed) return fail('Your browser could not say what kind of file that is, so it was not uploaded.');
        if (claimed !== want)
            return fail('That file is named “.' + ext + '” but your browser says it is ' + claimed +
                        '. A file has to be what it claims to be.');

        if (!file.size) return fail('That file is empty.');
        if (file.size > maxBytes())
            return fail('That image is ' + Math.round(file.size / 1048576 * 10) / 10 + ' MB. The limit is ' +
                        Math.round(maxBytes() / 1048576 * 10) / 10 + ' MB.');

        return head(file, 512).then(function (bytes) {
            if (bytes.length < 12) return { ok: false, reason: 'That file is too small to be an image.' };

            var text = '';
            for (var i = 0; i < Math.min(bytes.length, 64); i++) text += String.fromCharCode(bytes[i]);
            if (DOC_HEAD.test(text))
                return { ok: false, reason: 'That file is a document or a script with an image name. It was not uploaded.' };

            var sig = SIGNATURES[want];
            if (!sig || !sig(bytes))
                return { ok: false, reason: 'The inside of that file is not a real ' + TYPES[ext].label +
                                            '. Renaming a file does not change what it is.' };

            return decode(file).then(function (dim) {
                if (!dim) return { ok: false, reason: 'That image could not be opened. It may be damaged.' };
                return { ok: true, ext: ext, mime: want, bytes: file.size,
                         w: dim.w, h: dim.h, name: name };
            });
        });
    }

    /* ---------- the library ---------- */

    function store() {
        var d = CMS.data();
        if (!d.media || typeof d.media !== 'object') d.media = { items: [] };
        if (!Array.isArray(d.media.items)) d.media.items = [];
        return d.media;
    }

    /* Always read back through the CMS sanitiser: the record is public and
       an entry in it is data that arrived over the network. */
    function list() {
        try { return CMS.sections.mediaList(CMS.data().media); }
        catch (e) { return []; }
    }

    function enabled() {
        try { return !!(CMS.remote && CMS.remote.mediaEnabled && CMS.remote.mediaEnabled()); }
        catch (e) { return false; }
    }

    /* Validate, upload, then record. The metadata is only written once the
       bytes are actually in the bucket -- a library row for a file that
       does not exist is worse than no row. */
    function upload(file, onStage) {
        var stage = onStage || function () {};
        stage('checking', file && file.name);
        return validate(file).then(function (v) {
            if (!v.ok) throw new Error(v.reason);
            if (!enabled()) throw new Error('Uploads are not configured for this site yet. See js/cms-config.js.');

            var key = objectKey(v.name, v.ext);
            stage('uploading', v.name);
            return CMS.remote.uploadMedia(key, file, v.mime).then(function (url) {
                var entry = {
                    url: url, name: v.name.slice(0, 120), alt: '',
                    bytes: v.bytes, w: v.w, h: v.h,
                    uploadedAt: new Date().toISOString()
                };
                store().items.push(entry);
                stage('done', v.name);
                return entry;
            });
        });
    }

    function setAlt(url, alt) {
        var items = store().items, i;
        for (i = 0; i < items.length; i++) {
            if (items[i] && items[i].url === url) { items[i].alt = String(alt || '').slice(0, 200); return true; }
        }
        return false;
    }

    /* Removing takes the object out of the bucket first. If that fails the
       row stays, so the library never claims to have deleted something it
       has not. */
    function remove(url) {
        var safe = CMS.sections.mediaPath(url);
        if (!safe) return Promise.reject(new Error('That is not an uploaded image.'));
        var base = CMS.sections.mediaBase();
        return CMS.remote.removeMedia(safe.slice(base.length)).then(function () {
            var items = store().items, out = [], i;
            for (i = 0; i < items.length; i++) {
                if (!items[i] || items[i].url !== safe) out.push(items[i]);
            }
            store().items = out;
            return true;
        });
    }

    window.CMSMedia = {
        validate: validate,
        upload: upload,
        list: list,
        setAlt: setAlt,
        remove: remove,
        enabled: enabled,
        maxBytes: maxBytes,
        objectKey: objectKey,
        types: TYPES
    };
})();
