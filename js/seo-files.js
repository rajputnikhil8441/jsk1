/* ============================================================
   sitemap.xml AND robots.txt — ONE GENERATOR
   ------------------------------------------------------------
   Browser JavaScript cannot write a file into a deployed static
   site. It never could, and a CMS that pretends otherwise ships
   a sitemap that quietly describes a site nobody deployed.

   So the admin does not write these files. It writes SETTINGS
   into the brand record, and this module turns a brand record
   into the two files. It runs in two places:

     tools/build-seo-files.js   during the GitHub Pages deploy,
                                writing the real files into the
                                artifact that is published.
     /admin > SEO               in the browser, to show exactly
                                what that deploy will produce and
                                how it differs from what is live
                                right now.

   Both call the same function with the same record, so the
   preview is not an approximation of the deploy -- it is the
   deploy's own output, computed early.

   DETERMINISM
   Same record in, byte-identical files out. In particular the
   page order is derived from the URLs rather than from the key
   order of a JSON object, because two records holding identical
   information can enumerate their keys differently and a file
   that churns on every deploy is a file nobody can review.
   ============================================================ */
(function (root, factory) {
    if (typeof module === 'object' && module && module.exports) module.exports = factory();
    else root.SEOFiles = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function str(v) { return v == null ? '' : String(v).trim(); }

    function get(data, path, fallback) {
        var parts = String(path).split('.'), cur = data, i;
        for (i = 0; i < parts.length; i++) {
            if (cur == null || typeof cur !== 'object') return fallback;
            cur = cur[parts[i]];
        }
        return cur === undefined || cur === null || cur === '' ? fallback : cur;
    }

    /* Unreachable with the validators above in place: baseUrl() refuses a
       base containing a quote or an angle bracket, and pageFile() refuses
       any file name that is not [a-z0-9-]+.html, so nothing that reaches
       <loc> can carry a metacharacter. It is here because a sitemap is XML
       a stranger's parser will read, and the day either validator is
       relaxed this is what stops a malformed document going out. */
    function xmlEscape(v) {
        return String(v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    function baseUrl(data) {
        var b = str(get(data, 'seo.baseUrl', '')).replace(/\/+$/, '');
        return /^https?:\/\/[^\s"'<>\\]+$/.test(b) ? b : '';
    }

    /* A page's file name, as it appears in a URL. The homepage's is the
       empty string, which is why this returns '' rather than refusing it. */
    function pageFile(p) {
        var u = str(p && p.url);
        if (u === '') return '';
        return /^[a-z0-9][a-z0-9-]{0,80}\.html$/i.test(u) ? u : null;
    }

    /* ISO date only. A lastmod that is not a date is worse than none:
       a crawler that cannot parse it may distrust the whole entry. */
    function lastmod(p) {
        var d = str(p && p.updatedAt);
        return /^\d{4}-\d\d-\d\d$/.test(d) ? d : '';
    }

    /* Which pages belong in the sitemap.

       Left out, deliberately and always:
         - a page marked noindex (robots.index === false);
         - a page marked inSitemap: false;
         - a page whose url is not a plain .html file name;
         - /admin/, which is not a CMS page at all and has no entry.
       login.html and register.html are noindex in the shipped record,
       so they fall out by the first rule rather than by name -- a site
       that legitimately wants its sign-in page indexed only has to say
       so, and nothing here has to change. */
    function sitemapPages(data) {
        var pages = (data && data.pages) || {};
        var rows = [], seen = {}, k;
        for (k in pages) {
            if (!Object.prototype.hasOwnProperty.call(pages, k)) continue;
            var p = pages[k];
            if (!p || typeof p !== 'object') continue;
            var robots = p.robots || {};
            if (robots.index === false) continue;
            if (p.inSitemap === false) continue;
            var file = pageFile(p);
            if (file === null) continue;
            if (Object.prototype.hasOwnProperty.call(seen, file)) continue;
            seen[file] = 1;
            rows.push({ key: k, file: file, lastmod: lastmod(p) });
        }
        /* Homepage first, then alphabetical by file name. */
        rows.sort(function (a, b) {
            if (a.file === '') return -1;
            if (b.file === '') return 1;
            return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
        });
        return rows;
    }

    var SITEMAP_NOTE =
        '<!--\n' +
        '  GENERATED FILE - do not edit by hand.\n' +
        '  Written by tools/build-seo-files.js during the GitHub Pages deploy,\n' +
        '  from the pages and SEO settings in the CMS. Indexable pages only:\n' +
        '  anything set to noindex, anything excluded from the sitemap, and\n' +
        '  /admin/ are absent by construction.\n' +
        '  To change it, edit the pages in /admin > SEO and deploy.\n' +
        '-->\n';

    function sitemap(data) {
        var base = baseUrl(data);
        if (!base) return null;          /* no base URL = no honest sitemap */
        var out = '<?xml version="1.0" encoding="UTF-8"?>\n' + SITEMAP_NOTE +
                  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        sitemapPages(data).forEach(function (p) {
            out += '  <url>\n    <loc>' + xmlEscape(base + '/' + p.file) + '</loc>\n';
            if (p.lastmod) out += '    <lastmod>' + p.lastmod + '</lastmod>\n';
            out += '  </url>\n';
        });
        return out + '</urlset>\n';
    }

    /* Extra robots rules are typed by an admin, so they are filtered rather
       than trusted: one directive per line, from a fixed list of keywords,
       with a value that cannot contain a newline or a comment character.
       Without this, anything pasted in here becomes part of a file every
       crawler on the internet reads -- including a second "Allow: /" that
       silently undoes a Disallow above it. */
    var ROBOTS_DIRECTIVES = /^(user-agent|allow|disallow|crawl-delay|sitemap|clean-param|host)$/i;
    var ROBOTS_MAX_LINES = 40;

    function robotsExtra(data) {
        var raw = str(get(data, 'seo.robotsExtra', ''));
        if (!raw) return [];
        var lines = raw.split(/\r?\n/), out = [], i;
        for (i = 0; i < lines.length && out.length < ROBOTS_MAX_LINES; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            if (line.charAt(0) === '#') { out.push(line.slice(0, 200)); continue; }
            var m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
            if (!m) continue;
            if (!ROBOTS_DIRECTIVES.test(m[1])) continue;
            var value = m[2].replace(/[\u0000-\u001f#]/g, '').trim().slice(0, 200);
            if (!value) continue;
            out.push(m[1] + ': ' + value);
        }
        return out;
    }

    function robots(data) {
        var base = baseUrl(data);
        if (!base) return null;
        var out =
            '# GENERATED FILE - do not edit by hand.\n' +
            '# Written by tools/build-seo-files.js during the GitHub Pages deploy.\n' +
            '# To change it, edit /admin > SEO > Robots.txt and deploy.\n' +
            '\n# robots.txt for ' + base + '/\n' +
            '\nUser-agent: *\nAllow: /\n' +
            '\n# The admin panel is not a search landing page. This stops crawling;\n' +
            '# admin/index.html also carries <meta name="robots" content="noindex,nofollow">,\n' +
            '# because a Disallow alone cannot keep a linked URL out of the index.\n' +
            'Disallow: /admin/\n' +
            '\n# CSS, JavaScript and images are deliberately left crawlable - search\n' +
            '# engines need them to render the pages correctly.\n';
        var extra = robotsExtra(data);
        if (extra.length) out += '\n' + extra.join('\n') + '\n';
        out += '\nSitemap: ' + base + '/sitemap.xml\n';
        return out;
    }

    return {
        version: 1,
        sitemap: sitemap,
        robots: robots,
        sitemapPages: sitemapPages,
        robotsExtra: robotsExtra,
        baseUrl: baseUrl
    };
}));
