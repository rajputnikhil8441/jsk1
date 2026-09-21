/* ============================================================
   PAGE BUILDER — ADMIN UI
   ------------------------------------------------------------
   Extracted verbatim from js/admin.js. This file is a move, not a
   rewrite: the code below is byte-for-byte what it was, so that the
   extraction itself cannot change behaviour. Everything V2 adds to the
   builder lands here from now on, which is the point of the split —
   js/admin.js was 4,113 lines and owned fourteen unrelated panels as
   well as the whole builder.

   THE BOUNDARY
   The builder needs exactly four things from js/admin.js:

     $        querySelector helper
     esc      HTML escaping for the admin's own markup
     toast    the admin's notification strip
     commit   the admin's save path. commit(true) saves locally and
              skips CMS.remote.publish(); commit() publishes. That
              distinction is what keeps a draft off the live site, so it
              is deliberately NOT reimplemented here.

   It talks to the CMS through the global window.CMS, same as before.

   js/admin.js needs exactly four things back, and calls them through
   thin shims so every call site there reads exactly as it did:

     build()  rebuild the panel          (was buildBuilder)
     wire()   bind the toolbar once      (was wireBuilder)
     flush()  persist a pending edit     (was pbFlush)
     fit()    resize the preview frame   (was pbFitPreview)

   LOAD ORDER
   This file must load BEFORE js/admin.js. It only defines a factory and
   runs nothing at load time — no DOM access, no listeners — so defining
   it early is safe. js/admin.js then instantiates it at the point the
   builder code used to occupy, which keeps initialisation timing and
   ordering identical.
   ============================================================ */

window.PBAdmin = function (host) {
    'use strict';

    /* The four helpers, bound to the names the moved code already uses, so
       not one line of it had to change.

       These are captured BY VALUE when the factory runs. That is correct
       today -- in js/admin.js, $ is assigned once at the top of the file and
       esc, toast and commit are function declarations that are never
       reassigned -- but it is an invariant worth knowing about: if one of
       them ever became a reassigned binding, this file would go on holding
       the version that existed at instantiation. esc in particular is
       declared textually below the instantiation and works only because
       function declarations are initialised before any code in the scope
       runs. */
    var $ = host.$;
    var esc = host.esc;
    var toast = host.toast;
    var commit = host.commit;

    /* ========================================================
       PAGE BUILDER
       Sections are edited as a draft and only reach visitors when the
       admin presses Publish. Every draft write goes through commit(true),
       which saves locally and deliberately skips remote publishing, so
       saving a draft cannot change the live site. Publish is the one
       action here that calls commit() normally.

       The other panels are untouched: nothing below writes anything
       except builderDrafts[slug] and pages[slug].builder.
    ======================================================== */

    var PB_TYPES = [
        ['hero',      'Hero',         'fa-star'],
        ['text',      'Text',         'fa-align-left'],
        ['image',     'Image',        'fa-image'],
        ['imageText', 'Image + text', 'fa-table-columns'],
        ['cards',     'Cards',        'fa-grip'],
        ['columns',   'Columns',      'fa-table-columns'],
        ['banner',    'Banner',       'fa-bullhorn']
    ];

    var PB_TYPE_LABEL = {};
    PB_TYPES.forEach(function (t) { PB_TYPE_LABEL[t[0]] = t[1]; });

    var pbSlug = null;      /* slug being edited */
    var pbDraft = [];       /* the working sections */
    var pbOpen = null;      /* id of the expanded section */

    /* Which sub-tab / breakpoint each node is showing. Kept out of the
       section objects on purpose: those are serialised straight into the
       saved draft, and UI state has no business being published. */
    var pbView = {};
    var pbDevice = {};

    /* Ids address the generated CSS, so two must never collide. The counter
       covers the case that makes Date.now() alone unsafe: duplicating a
       section, which mints several ids inside one millisecond. */
    var pbSeq = 0;

    function pbUid(prefix) {
        pbSeq += 1;
        return prefix + '_' + Date.now().toString(36) + pbSeq.toString(36) +
               Math.floor(Math.random() * 1e6).toString(36);
    }

    /* Local save only. commit(true) skips CMS.remote.publish(), which is
       what keeps a draft off the live site. */
    function pbPersist() {
        CMS.sections.saveDraft(pbSlug, pbDraft);
        commit(true);
    }

    function pbSelect(slug) {
        pbFlush();
        pbSlug = slug;
        pbDraft = CMS.sections.draft(slug).sections;
        pbOpen = null;
        buildBuilder();
    }

    function pbBlankSection(type) {
        var sec = { id: pbUid('sec'), type: type, enabled: true,
                    visibility: { desktop: true, tablet: true, mobile: true },
                    style: {}, responsive: { tablet: {}, mobile: {} }, elements: [] };
        /* A new section starts with something visible, so the preview is
           never an empty box the admin has to guess at. */
        if (type === 'image') {
            sec.elements.push({ id: pbUid('el'), type: 'image',
                content: { src: '', alt: '' }, style: {} });
        } else if (type === 'cards') {
            sec.elements.push({ id: pbUid('el'), type: 'card',
                content: { title: 'Card title', text: 'Card text.' }, style: {} });
        } else if (type === 'columns') {
            sec.elements.push({ id: pbUid('el'), type: 'columns', style: {}, content: { columns: [
                { elements: [{ id: pbUid('el'), type: 'text', content: { text: 'Left column.' }, style: {} }] },
                { elements: [{ id: pbUid('el'), type: 'text', content: { text: 'Right column.' }, style: {} }] }
            ] } });
        } else {
            sec.elements.push({ id: pbUid('el'), type: 'heading',
                content: { text: PB_TYPE_LABEL[type] + ' heading', level: 'h2' }, style: {} });
            sec.elements.push({ id: pbUid('el'), type: 'text',
                content: { text: 'Write something here.' }, style: {} });
        }
        return sec;
    }

    function pbIndexOf(id) {
        for (var i = 0; i < pbDraft.length; i++) { if (pbDraft[i].id === id) return i; }
        return -1;
    }

    function pbAddSection(type) {
        var sec = pbBlankSection(type);
        pbDraft.push(sec);
        pbOpen = sec.id;
        pbPersist();
        buildBuilder();
        toast(PB_TYPE_LABEL[type] + ' section added to the draft.');
    }

    function pbMove(id, delta) {
        var i = pbIndexOf(id), j = i + delta;
        if (i < 0 || j < 0 || j >= pbDraft.length) return;
        var tmp = pbDraft[i]; pbDraft[i] = pbDraft[j]; pbDraft[j] = tmp;
        pbPersist();
        buildBuilder();
    }

    function pbDuplicate(id) {
        var i = pbIndexOf(id);
        if (i < 0) return;
        var copy = CMS.clone(pbDraft[i]);
        pbReid(copy);
        pbDraft.splice(i + 1, 0, copy);
        pbOpen = copy.id;
        pbPersist();
        buildBuilder();
    }

    /* A duplicated section must not reuse ids: they address the generated CSS. */
    function pbReid(sec) {
        sec.id = pbUid('sec');
        (function walk(list) {
            if (!list || !list.length) return;
            list.forEach(function (el) {
                el.id = pbUid('el');
                var cols = (el.content || {}).columns;
                if (cols && cols.length) cols.forEach(function (c) { walk(c.elements); });
            });
        })(sec.elements);
    }

    function pbRemove(id) {
        var i = pbIndexOf(id);
        if (i < 0) return;
        if (!window.confirm('Delete this section from the draft? The live page is not affected until you publish.')) return;
        pbDraft.splice(i, 1);
        if (pbOpen === id) pbOpen = null;
        pbPersist();
        buildBuilder();
    }

    function pbToggle(id, on) {
        var i = pbIndexOf(id);
        if (i < 0) return;
        pbDraft[i].enabled = !!on;
        pbPersist();
        buildBuilder();
    }

    /* ---------- rendering ---------- */

    function pbBtn(icon, title, cls) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pb-ico' + (cls ? ' ' + cls : '');
        b.title = title;
        b.setAttribute('aria-label', title);
        b.innerHTML = '<i class="fas ' + icon + '"></i>';
        return b;
    }

    function pbCount(sec) {
        var n = (sec.elements || []).length;
        return n === 1 ? '1 element' : n + ' elements';
    }

    function buildBuilder() {
        var tabs = $('#pbTabs');
        if (!tabs) return;

        var slugs = CMS.sections.pages();
        if (!slugs.length) {
            tabs.innerHTML = '';
            $('#pbList').innerHTML = '<p class="hint">No page in this site has a builder mount yet.</p>';
            return;
        }
        if (slugs.indexOf(pbSlug) === -1) {
            pbSlug = slugs[0];
            pbDraft = CMS.sections.draft(pbSlug).sections;
        }

        /* page tabs */
        tabs.innerHTML = '';
        slugs.forEach(function (s) {
            var page = CMS.data().pages[s] || {};
            var st = CMS.sections.status(s);
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pagetab' + (s === pbSlug ? ' active' : '');
            b.setAttribute('data-slug', s);
            b.textContent = page.label || s;
            if (st.live) {
                var dot = document.createElement('span');
                dot.className = 'pb-dot' + (st.dirty ? ' dirty' : '');
                dot.title = st.dirty ? 'Published, with unpublished changes' : 'Published';
                b.appendChild(dot);
            }
            b.addEventListener('click', function () { pbSelect(s); });
            tabs.appendChild(b);
        });

        pbPaintState();
        pbPaintAdd();
        pbPaintList();
        pbPaintDevices();
        pbPaintPreview();
        pbFitPreview();
    }

    function pbPaintState() {
        var st = CMS.sections.status(pbSlug);
        var page = CMS.data().pages[pbSlug] || {};
        var el = $('#pbState');
        var label, cls;
        if (!st.live && !pbDraft.length)      { label = 'Not built — the page shows its shipped content'; cls = 'off'; }
        else if (!st.live)                    { label = 'Draft only — nothing is live for this page'; cls = 'draft'; }
        else if (st.dirty)                    { label = 'Live, with unpublished draft changes'; cls = 'dirty'; }
        else                                  { label = 'Live and up to date'; cls = 'live'; }
        el.className = 'pb-state ' + cls;
        el.textContent = label;

        $('#pbPublish').disabled  = !pbDraft.length;
        $('#pbDiscard').disabled  = !CMS.sections.dirty(pbSlug);
        $('#pbUnpublish').disabled = !st.live;

        var open = $('#pbOpen');
        if (page.url) { open.href = '../' + page.url; open.hidden = false; }
        else { open.hidden = true; }
    }

    function pbPaintAdd() {
        var host = $('#pbAdd');
        host.innerHTML = '';
        PB_TYPES.forEach(function (t) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pb-addbtn';
            b.setAttribute('data-type', t[0]);
            b.innerHTML = '<i class="fas ' + t[2] + '"></i><span>' + esc(t[1]) + '</span>';
            b.addEventListener('click', function () { pbAddSection(t[0]); });
            host.appendChild(b);
        });
    }

    function pbPaintList() {
        var host = $('#pbList');
        host.innerHTML = '';
        if (!pbDraft.length) {
            host.innerHTML = '<p class="hint">This draft has no sections. Add one above. ' +
                'Until you publish, visitors keep seeing the content that ships in the page’s HTML file.</p>';
            return;
        }

        pbDraft.forEach(function (sec, i) {
            var row = document.createElement('div');
            row.className = 'pb-sec' + (sec.enabled === false ? ' off' : '') +
                            (pbOpen === sec.id ? ' open' : '');
            row.setAttribute('data-sec-id', sec.id);

            var head = document.createElement('div');
            head.className = 'pb-sec-head';

            var expand = document.createElement('button');
            expand.type = 'button';
            expand.className = 'pb-sec-title';
            expand.innerHTML = '<i class="fas fa-chevron-' + (pbOpen === sec.id ? 'down' : 'right') + '"></i>' +
                '<strong>' + esc(PB_TYPE_LABEL[sec.type] || sec.type) + '</strong>' +
                '<span class="pb-sec-sum">' + esc(pbCount(sec)) + '</span>';
            expand.addEventListener('click', function () {
                pbOpen = (pbOpen === sec.id) ? null : sec.id;
                buildBuilder();
            });
            head.appendChild(expand);

            var tools = document.createElement('div');
            tools.className = 'pb-sec-tools';

            var on = document.createElement('label');
            on.className = 'pb-onoff';
            on.title = 'Show this section';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = sec.enabled !== false;
            cb.setAttribute('data-act', 'enable');
            cb.addEventListener('change', function () { pbToggle(sec.id, cb.checked); });
            on.appendChild(cb);
            on.appendChild(document.createTextNode('On'));
            tools.appendChild(on);

            var up = pbBtn('fa-arrow-up', 'Move up');
            up.disabled = i === 0;
            up.setAttribute('data-act', 'up');
            up.addEventListener('click', function () { pbMove(sec.id, -1); });
            tools.appendChild(up);

            var down = pbBtn('fa-arrow-down', 'Move down');
            down.disabled = i === pbDraft.length - 1;
            down.setAttribute('data-act', 'down');
            down.addEventListener('click', function () { pbMove(sec.id, 1); });
            tools.appendChild(down);

            var dup = pbBtn('fa-clone', 'Duplicate');
            dup.setAttribute('data-act', 'dup');
            dup.addEventListener('click', function () { pbDuplicate(sec.id); });
            tools.appendChild(dup);

            var del = pbBtn('fa-trash', 'Delete', 'danger');
            del.setAttribute('data-act', 'del');
            del.addEventListener('click', function () { pbRemove(sec.id); });
            tools.appendChild(del);

            head.appendChild(tools);
            row.appendChild(head);

            if (pbOpen === sec.id) {
                var body = document.createElement('div');
                body.className = 'pb-sec-body';
                pbSectionBody(body, sec);
                row.appendChild(body);
            }
            host.appendChild(row);
        });
    }

    function pbSectionBody(host, sec) {
        var tabs = document.createElement('div');
        tabs.className = 'pb-subtabs';
        var body = document.createElement('div');
        body.className = 'pb-subbody';

        var VIEWS = [['content', 'Content'], ['design', 'Design'], ['visibility', 'Visibility']];
        function show(view) {
            pbView[sec.id] = view;
            Array.prototype.forEach.call(tabs.children, function (b) {
                b.classList.toggle('active', b.getAttribute('data-view') === view);
            });
            body.innerHTML = '';
            if (view === 'content') {
                if (!sec.elements) sec.elements = [];
                pbElementList(body, sec.elements, 0);
            } else if (view === 'design') {
                pbDesignEditor(body, sec, null);
            } else {
                pbVisibilityEditor(body, sec);
            }
        }
        VIEWS.forEach(function (v) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pb-subtab';
            b.setAttribute('data-view', v[0]);
            b.textContent = v[1];
            b.addEventListener('click', function () { show(v[0]); });
            tabs.appendChild(b);
        });
        host.appendChild(tabs);
        host.appendChild(body);
        show(pbView[sec.id] || 'content');
    }

    /* ---------- element + style editors ---------- */

    var PB_EL_TYPES = [
        ['heading', 'Heading'],
        ['text',    'Text'],
        ['image',   'Image'],
        ['button',  'Button'],
        ['card',    'Card'],
        ['columns', 'Columns']
    ];
    var PB_EL_LABEL = {};
    PB_EL_TYPES.forEach(function (t) { PB_EL_LABEL[t[0]] = t[1]; });

    /* [key, label, kind, options] -- kind maps onto the input built below.
       Every key here is one the renderer in js/cms.js already understands. */
    var PB_CONTENT_FIELDS = {
        heading: [['text', 'Text', 'text'],
                  ['level', 'Level', 'select', ['h1', 'h2', 'h3', 'h4']]],
        text:    [['text', 'Text', 'area']],
        image:   [['src', 'Image URL', 'url'], ['alt', 'Alt text', 'text'],
                  ['width', 'Width (px)', 'num'], ['height', 'Height (px)', 'num'],
                  ['href', 'Links to', 'url'], ['newTab', 'Open in a new tab', 'bool']],
        button:  [['text', 'Label', 'text'], ['href', 'Links to', 'url'],
                  ['newTab', 'Open in a new tab', 'bool']],
        card:    [['title', 'Title', 'text'], ['text', 'Text', 'area'],
                  ['image', 'Image URL', 'url'], ['imageAlt', 'Image alt', 'text'],
                  ['buttonText', 'Button label', 'text'], ['buttonHref', 'Button links to', 'url'],
                  ['buttonNewTab', 'Open in a new tab', 'bool']]
    };

    var PB_STYLE_FIELDS = [
        ['bg',         'Background',        'color'],
        ['color',      'Text colour',       'color'],
        ['bgImage',    'Background image',  'url'],
        ['fontSize',   'Font size (px)',    'num'],
        ['fontWeight', 'Font weight',       'select', ['', '300', '400', '500', '600', '700', '800']],
        ['align',      'Align',             'select', ['', 'left', 'center', 'right']],
        ['padding',    'Padding (px)',      'num'],
        ['margin',     'Outer space (px)',  'num'],
        ['gap',        'Gap (px)',          'num'],
        ['maxWidth',   'Max width (px)',    'num'],
        ['height',     'Min height (px)',   'num'],
        ['radius',     'Corner radius (px)', 'num'],
        ['border',     'Border',            'text'],
        ['shadow',     'Shadow',            'text']
    ];

    /* Which controls an element type actually reacts to. Owned by
       js/cms.js so the admin cannot offer a control the renderer ignores. */
    function pbStyleKeysFor(type) {
        return (CMS.sections.elementStyleKeys || {})[type] || [];
    }

    /* "Min height" reads wrong on an image, which takes a fixed height. */
    var PB_LABEL_OVERRIDE = { image: { height: 'Height (px)', maxWidth: 'Max width (px)' } };

    var PB_DEVICES = [['base', 'Desktop'], ['tablet', 'Tablet'], ['mobile', 'Mobile']];

    /* Where a device's overrides live on a section or element. */
    function pbStyleBag(node, device) {
        if (device === 'base') { return node.style || (node.style = {}); }
        if (!node.responsive) node.responsive = {};
        return node.responsive[device] || (node.responsive[device] = {});
    }

    /* A field edit never rebuilds the list -- that would steal focus mid-typing.
       Typing repaints the preview at once and saves the draft shortly after,
       so work is not lost if the admin leaves the panel without blurring. */
    var pbSaveTimer = null;

    function pbFlush() {
        if (!pbSaveTimer) return;
        clearTimeout(pbSaveTimer);
        pbSaveTimer = null;
        pbPersist();
    }

    function pbEdited(live) {
        pbPaintPreview();
        if (pbSaveTimer) { clearTimeout(pbSaveTimer); pbSaveTimer = null; }
        if (live) {
            pbSaveTimer = setTimeout(function () {
                pbSaveTimer = null;
                pbPersist();
                pbPaintState();
            }, 250);
            return;
        }
        pbPersist();
        pbPaintState();
    }

    function pbRow(label, control, note) {
        var w = document.createElement('label');
        w.className = 'pb-field';
        var s = document.createElement('span');
        s.className = 'pb-field-label';
        s.textContent = label;
        w.appendChild(s);
        w.appendChild(control);
        if (note) {
            var n = document.createElement('em');
            n.className = 'pb-field-note';
            n.textContent = note;
            w.appendChild(n);
        }
        return w;
    }

    /* One bound input. `get`/`set` keep the widget away from the data shape. */
    function pbInput(kind, opts, get, set, hintEl) {
        var el;
        if (kind === 'area') {
            el = document.createElement('textarea');
            el.rows = 4;
            el.spellcheck = true;
        } else if (kind === 'select') {
            el = document.createElement('select');
            (opts || []).forEach(function (o) {
                var op = document.createElement('option');
                op.value = o;
                op.textContent = o === '' ? '(inherit)' : o;
                el.appendChild(op);
            });
        } else if (kind === 'bool') {
            el = document.createElement('input');
            el.type = 'checkbox';
        } else if (kind === 'color') {
            el = document.createElement('input');
            el.type = 'text';
            el.placeholder = '#rrggbb or empty';
        } else if (kind === 'num') {
            el = document.createElement('input');
            el.type = 'number';
            el.step = '1';
        } else {
            el = document.createElement('input');
            el.type = 'text';
        }
        el.className = 'pb-in pb-in-' + kind;

        var v = get();
        if (kind === 'bool') el.checked = !!v;
        else el.value = v == null ? '' : String(v);

        function warn() {
            if (!hintEl) return;
            var raw = String(el.value || '').trim();
            if (kind === 'url' && raw && !CMS.sections.safeUrl(raw)) {
                hintEl.textContent = 'That address is not allowed and will be dropped. ' +
                    'Use https://, /, #, mailto: or a file name.';
                hintEl.hidden = false;
            } else {
                hintEl.hidden = true;
            }
        }

        function read() { return kind === 'bool' ? el.checked : el.value; }
        el.addEventListener('input', function () { set(read()); warn(); pbEdited(true); });
        el.addEventListener('change', function () { set(read()); warn(); pbEdited(false); });
        warn();

        /* A colour text box gets a swatch next to it. */
        if (kind === 'color') {
            var wrap = document.createElement('span');
            wrap.className = 'pb-color';
            var sw = document.createElement('input');
            sw.type = 'color';
            sw.className = 'pb-swatch';
            sw.value = /^#[0-9a-f]{6}$/i.test(el.value) ? el.value : '#ffffff';
            sw.addEventListener('input', function () {
                el.value = sw.value;
                set(sw.value);
                pbEdited(true);
            });
            sw.addEventListener('change', function () { set(sw.value); pbEdited(false); });
            el.addEventListener('input', function () {
                if (/^#[0-9a-f]{6}$/i.test(el.value)) sw.value = el.value;
            });
            wrap.appendChild(el);
            wrap.appendChild(sw);
            return wrap;
        }
        return el;
    }

    function pbFieldFor(spec, bag, key) {
        var hint = document.createElement('em');
        hint.className = 'pb-warn';
        hint.hidden = true;
        var input = pbInput(spec[2], spec[3],
            function () { return bag[key]; },
            function (v) {
                if (v === '' || v === false) delete bag[key];
                else bag[key] = v;
            }, hint);
        var row = pbRow(spec[1], input);
        row.appendChild(hint);
        return row;
    }

    /* ---------- design + responsive ---------- */

    function pbDesignEditor(host, node, keys, labels) {
        var device = pbDevice[node.id] || 'base';

        var tabs = document.createElement('div');
        tabs.className = 'pb-devtabs';
        PB_DEVICES.forEach(function (d) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pb-devtab' + (d[0] === device ? ' active' : '');
            b.setAttribute('data-device', d[0]);
            b.textContent = d[1];
            b.addEventListener('click', function () {
                pbDevice[node.id] = d[0];
                host.innerHTML = '';
                pbDesignEditor(host, node, keys, labels);
            });
            tabs.appendChild(b);
        });
        host.appendChild(tabs);

        var note = document.createElement('p');
        note.className = 'hint';
        note.textContent = device === 'base'
            ? 'These apply everywhere unless a narrower screen overrides them.'
            : (device === 'tablet'
                ? 'Applied at 1024px and below. Leave a box empty to keep the desktop value.'
                : 'Applied at 768px and below. Leave a box empty to keep the wider value.');
        host.appendChild(note);

        var bag = pbStyleBag(node, device);
        var grid = document.createElement('div');
        grid.className = 'pb-grid';
        PB_STYLE_FIELDS.forEach(function (spec) {
            if (keys && keys.indexOf(spec[0]) === -1) return;
            if (labels && labels[spec[0]]) {
                spec = [spec[0], labels[spec[0]], spec[2], spec[3]];
            }
            grid.appendChild(pbFieldFor(spec, bag, spec[0]));
        });
        if (!grid.children.length) {
            var none = document.createElement('p');
            none.className = 'hint';
            none.textContent = 'This element type has no design controls at this breakpoint.';
            grid.appendChild(none);
        }
        host.appendChild(grid);

        if (device !== 'base') {
            var clr = document.createElement('button');
            clr.type = 'button';
            clr.className = 'adm-btn ghost pb-clear';
            clr.setAttribute('data-act', 'clear-device');
            clr.innerHTML = '<i class="fas fa-eraser"></i> Clear ' + (device === 'tablet' ? 'tablet' : 'mobile') + ' overrides';
            clr.addEventListener('click', function () {
                node.responsive[device] = {};
                pbPersist();
                host.innerHTML = '';
                pbDesignEditor(host, node, keys, labels);
                pbPaintPreview();
            });
            host.appendChild(clr);
        }
    }

    function pbVisibilityEditor(host, sec) {
        var box = document.createElement('div');
        box.className = 'pb-vis';
        var lead = document.createElement('p');
        lead.className = 'hint';
        lead.textContent = 'Hide this section on a screen size without deleting it.';
        box.appendChild(lead);
        if (!sec.visibility) sec.visibility = { desktop: true, tablet: true, mobile: true };
        [['desktop', 'Show on desktop'], ['tablet', 'Show on tablet'], ['mobile', 'Show on mobile']]
            .forEach(function (v) {
                var l = document.createElement('label');
                l.className = 'pb-check';
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.setAttribute('data-vis', v[0]);
                cb.checked = sec.visibility[v[0]] !== false;
                cb.addEventListener('change', function () {
                    sec.visibility[v[0]] = cb.checked;
                    pbPersist();
                    pbPaintPreview();
                });
                l.appendChild(cb);
                l.appendChild(document.createTextNode(v[1]));
                box.appendChild(l);
            });
        host.appendChild(box);
    }

    /* ---------- elements ---------- */

    function pbBlankElement(type) {
        var el = { id: pbUid('el'), type: type, style: {}, responsive: {}, content: {} };
        if (type === 'heading') el.content = { text: 'Heading', level: 'h2' };
        else if (type === 'text') el.content = { text: 'Write something here.' };
        else if (type === 'button') el.content = { text: 'Button', href: '#' };
        else if (type === 'image') el.content = { src: '', alt: '' };
        else if (type === 'card') el.content = { title: 'Card title', text: 'Card text.' };
        else if (type === 'columns') el.content = { columns: [
            { elements: [{ id: pbUid('el'), type: 'text', content: { text: 'Left column.' }, style: {} }] },
            { elements: [{ id: pbUid('el'), type: 'text', content: { text: 'Right column.' }, style: {} }] }
        ] };
        return el;
    }

    function pbElementList(host, list, depth) {
        var wrap = document.createElement('div');
        wrap.className = 'pb-els';
        host.appendChild(wrap);

        function repaint() {
            wrap.innerHTML = '';
            list.forEach(function (el, i) {
                wrap.appendChild(pbElementCard(el, i, list, depth, repaint));
            });
            if (!list.length) {
                var e = document.createElement('p');
                e.className = 'hint';
                e.textContent = 'Nothing in here yet.';
                wrap.appendChild(e);
            }
        }
        repaint();

        var add = document.createElement('div');
        add.className = 'pb-add pb-add-el';
        PB_EL_TYPES.forEach(function (t) {
            /* columns inside columns is the one nesting the renderer refuses */
            if (t[0] === 'columns' && depth > 0) return;
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pb-addbtn small';
            b.setAttribute('data-el-type', t[0]);
            b.innerHTML = '<i class="fas fa-plus"></i><span>' + esc(t[1]) + '</span>';
            b.addEventListener('click', function () {
                list.push(pbBlankElement(t[0]));
                pbPersist();
                repaint();
                pbPaintPreview();
                pbRefreshSummary();
            });
            add.appendChild(b);
        });
        host.appendChild(add);
    }

    function pbElementCard(el, i, list, depth, repaint) {
        var card = document.createElement('div');
        card.className = 'pb-elcard';
        card.setAttribute('data-el-id', el.id);

        var head = document.createElement('div');
        head.className = 'pb-elcard-head';
        var name = document.createElement('strong');
        name.textContent = PB_EL_LABEL[el.type] || el.type;
        head.appendChild(name);

        var tools = document.createElement('div');
        tools.className = 'pb-sec-tools';

        var on = document.createElement('label');
        on.className = 'pb-onoff';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = el.enabled !== false;
        cb.setAttribute('data-act', 'el-enable');
        cb.addEventListener('change', function () {
            el.enabled = cb.checked;
            card.classList.toggle('off', !cb.checked);
            pbPersist();
            pbPaintPreview();
        });
        on.appendChild(cb);
        on.appendChild(document.createTextNode('On'));
        tools.appendChild(on);

        var up = pbBtn('fa-arrow-up', 'Move up');
        up.disabled = i === 0;
        up.setAttribute('data-act', 'el-up');
        up.addEventListener('click', function () {
            var t = list[i - 1]; list[i - 1] = list[i]; list[i] = t;
            pbPersist(); repaint(); pbPaintPreview();
        });
        tools.appendChild(up);

        var down = pbBtn('fa-arrow-down', 'Move down');
        down.disabled = i === list.length - 1;
        down.setAttribute('data-act', 'el-down');
        down.addEventListener('click', function () {
            var t = list[i + 1]; list[i + 1] = list[i]; list[i] = t;
            pbPersist(); repaint(); pbPaintPreview();
        });
        tools.appendChild(down);

        var dup = pbBtn('fa-clone', 'Duplicate');
        dup.setAttribute('data-act', 'el-dup');
        dup.addEventListener('click', function () {
            var copy = CMS.clone(el);
            (function walk(e) {
                e.id = pbUid('el');
                var cols = (e.content || {}).columns;
                if (cols) cols.forEach(function (c) { (c.elements || []).forEach(walk); });
            })(copy);
            list.splice(i + 1, 0, copy);
            pbPersist(); repaint(); pbPaintPreview(); pbRefreshSummary();
        });
        tools.appendChild(dup);

        var del = pbBtn('fa-trash', 'Delete', 'danger');
        del.setAttribute('data-act', 'el-del');
        del.addEventListener('click', function () {
            list.splice(i, 1);
            pbPersist(); repaint(); pbPaintPreview(); pbRefreshSummary();
        });
        tools.appendChild(del);

        head.appendChild(tools);
        card.appendChild(head);
        if (el.enabled === false) card.className += ' off';

        var body = document.createElement('div');
        body.className = 'pb-elcard-body';

        if (el.type === 'columns') {
            var cols = (el.content && el.content.columns) || (el.content = { columns: [] }).columns;
            var bar = document.createElement('div');
            bar.className = 'pb-colbar';
            var addCol = document.createElement('button');
            addCol.type = 'button';
            addCol.className = 'adm-btn ghost';
            addCol.setAttribute('data-act', 'add-col');
            addCol.innerHTML = '<i class="fas fa-plus"></i> Add column';
            addCol.addEventListener('click', function () {
                cols.push({ elements: [] });
                pbPersist(); repaint(); pbPaintPreview();
            });
            bar.appendChild(addCol);
            body.appendChild(bar);

            cols.forEach(function (col, ci) {
                var box = document.createElement('div');
                box.className = 'pb-col';
                box.setAttribute('data-col', String(ci));
                var h = document.createElement('div');
                h.className = 'pb-col-head';
                h.innerHTML = '<strong>Column ' + (ci + 1) + '</strong>';
                var rm = pbBtn('fa-trash', 'Remove column', 'danger');
                rm.setAttribute('data-act', 'del-col');
                rm.addEventListener('click', function () {
                    cols.splice(ci, 1);
                    pbPersist(); repaint(); pbPaintPreview();
                });
                h.appendChild(rm);
                box.appendChild(h);
                if (!col.elements) col.elements = [];
                pbElementList(box, col.elements, depth + 1);
                body.appendChild(box);
            });
        } else {
            if (!el.content) el.content = {};
            var grid = document.createElement('div');
            grid.className = 'pb-grid';
            (PB_CONTENT_FIELDS[el.type] || []).forEach(function (spec) {
                grid.appendChild(pbFieldFor(spec, el.content, spec[0]));
            });
            body.appendChild(grid);

            /* Images without alt text cost the page in search and in
               screen readers, so the admin is told while editing. */
            if (el.type === 'image' || el.type === 'card') {
                var altKey = el.type === 'image' ? 'src' : 'image';
                var altVal = el.type === 'image' ? 'alt' : 'imageAlt';
                var w = document.createElement('p');
                w.className = 'pb-warn';
                w.setAttribute('data-warn', 'alt');
                function sync() {
                    var has = String(el.content[altKey] || '').trim();
                    var alt = String(el.content[altVal] || '').trim();
                    w.hidden = !(has && !alt);
                    w.textContent = 'This image has no alt text. Search engines and screen readers cannot read it.';
                }
                sync();
                body.addEventListener('input', sync);
                body.addEventListener('change', sync);
                body.appendChild(w);
            }
        }

        var design = document.createElement('details');
        design.className = 'pb-details';
        design.innerHTML = '<summary>Design</summary>';
        var dhost = document.createElement('div');
        pbDesignEditor(dhost, el, pbStyleKeysFor(el.type), PB_LABEL_OVERRIDE[el.type]);
        design.appendChild(dhost);
        body.appendChild(design);

        card.appendChild(body);
        return card;
    }

    /* Keeps the "n elements" line in the collapsed header honest without
       rebuilding the list and losing the cursor. */
    function pbRefreshSummary() {
        if (!pbOpen) return;
        var i = pbIndexOf(pbOpen);
        if (i < 0) return;
        var row = document.querySelector('.pb-sec[data-sec-id="' + pbOpen + '"] .pb-sec-sum');
        if (row) row.textContent = pbCount(pbDraft[i]);
    }

    /* ---------- live preview ----------
       The preview is the real page in an iframe, painted with the draft
       through CMS.sections.paint({slug, sections}). That override renders
       sections the public gate would refuse, so the admin sees the draft
       while visitors keep seeing what is published. Nothing is written. */

    var PB_VIEWPORTS = [['desktop', 'Desktop', 1280, 'fa-desktop'],
                        ['tablet',  'Tablet',   900, 'fa-tablet-screen-button'],
                        ['mobile',  'Mobile',   390, 'fa-mobile-screen-button']];
    var pbViewport = 'desktop';
    var PB_FRAME_H = 900;

    function pbViewportWidth() {
        for (var i = 0; i < PB_VIEWPORTS.length; i++) {
            if (PB_VIEWPORTS[i][0] === pbViewport) return PB_VIEWPORTS[i][2];
        }
        return 1280;
    }

    function pbPaintDevices() {
        var host = $('#pbDevices');
        if (!host) return;
        host.innerHTML = '';
        PB_VIEWPORTS.forEach(function (v) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pb-devtab' + (v[0] === pbViewport ? ' active' : '');
            b.setAttribute('data-viewport', v[0]);
            b.innerHTML = '<i class="fas ' + v[3] + '"></i> ' + esc(v[1]) +
                          ' <em>' + v[2] + '</em>';
            b.addEventListener('click', function () {
                pbViewport = v[0];
                pbPaintDevices();
                pbFitPreview();
            });
            host.appendChild(b);
        });
    }

    /* Scale the real viewport width down to whatever room the column has,
       so the section really is laid out at 390px on the mobile setting
       rather than just squeezed. */
    function pbFitPreview() {
        var stage = $('#pbStage'), f = $('#pbFrame');
        if (!stage || !f) return;
        var w = pbViewportWidth();
        var avail = stage.clientWidth - 20;
        var k = avail > 0 ? Math.min(1, avail / w) : 1;
        f.style.width = w + 'px';
        f.style.height = PB_FRAME_H + 'px';
        f.style.transform = 'scale(' + k + ')';
        f.style.transformOrigin = 'top left';
        f.setAttribute('data-viewport', pbViewport);
        stage.style.height = Math.round(PB_FRAME_H * k) + 'px';
    }

    function pbFrameWin() {
        var f = $('#pbFrame');
        try { return f && f.contentWindow ? f.contentWindow : null; } catch (e) { return null; }
    }

    function pbPaintFrame() {
        var w = pbFrameWin();
        if (!w || !w.CMS || !w.CMS.sections) return;
        try { w.CMS.sections.paint({ slug: pbSlug, sections: pbDraft }); } catch (e) {}
    }

    /* Links in the preview must not navigate the admin away from the panel. */
    function pbTameFrame() {
        var w = pbFrameWin();
        if (!w || !w.document) return;
        try {
            w.document.addEventListener('click', function (e) {
                var a = e.target && e.target.closest ? e.target.closest('a') : null;
                if (a) e.preventDefault();
            }, true);
            /* A remote refresh repaints from what is published; put the
               draft back afterwards. */
            w.document.addEventListener('cms:remote-loaded', pbPaintFrame);
        } catch (e) {}
    }

    function pbPaintPreview() {
        var f = $('#pbFrame');
        if (!f) return;
        var page = CMS.data().pages[pbSlug] || {};
        var tag = $('#pbPrevTag');
        if (tag) {
            var st = CMS.sections.status(pbSlug);
            tag.textContent = (!st.live || st.dirty) ? 'Draft' : 'Live';
            tag.className = 'pill' + ((!st.live || st.dirty) ? ' warn' : '');
        }
        if (!page.url) { f.removeAttribute('src'); return; }
        var url = '../' + page.url;
        if (f.getAttribute('data-page') !== url) {
            f.setAttribute('data-page', url);
            f.onload = function () { pbTameFrame(); pbPaintFrame(); pbFitPreview(); };
            f.src = url;
            return;
        }
        pbPaintFrame();
    }


    /* ---------- draft / publish buttons ---------- */
    function wireBuilder() {
        var b;
        if ((b = $('#pbSaveDraft'))) b.addEventListener('click', function () {
            pbFlush();
            pbPersist();
            buildBuilder();
            toast('Draft saved on this device. The live site is unchanged.');
        });

        if ((b = $('#pbPublish'))) b.addEventListener('click', function () {
            pbFlush();
            CMS.sections.saveDraft(pbSlug, pbDraft);
            CMS.sections.publish(pbSlug);
            commit();                 /* the one action here that goes live */
            buildBuilder();
            if (!CMS.remote.enabled) toast('Published. This page now shows your sections.');
        });

        if ((b = $('#pbDiscard'))) b.addEventListener('click', function () {
            pbFlush();
            if (!window.confirm('Throw away the draft and start again from what is published?')) return;
            CMS.sections.discard(pbSlug);
            pbDraft = CMS.sections.draft(pbSlug).sections;
            commit(true);
            buildBuilder();
            toast('Draft discarded.');
        });

        if ((b = $('#pbUnpublish'))) b.addEventListener('click', function () {
            if (!window.confirm('Take these sections off the live page? It goes back to the content in its HTML file. The draft is kept.')) return;
            CMS.sections.unpublish(pbSlug);
            commit();
            buildBuilder();
        });
    }

    return {
        build: buildBuilder,
        wire:  wireBuilder,
        flush: pbFlush,
        fit:   pbFitPreview
    };
};
