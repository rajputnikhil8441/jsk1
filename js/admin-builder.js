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
   The builder needs exactly five things from js/admin.js:

     $        querySelector helper
     esc      HTML escaping for the admin's own markup
     toast    the admin's notification strip
     commit   the admin's save path. commit(true) saves locally and
              skips CMS.remote.publish(); commit() publishes. That
              distinction is what keeps a draft off the live site, so it
              is deliberately NOT reimplemented here.
     download the admin's file-save helper, used by the reusable-section
              export so there is one download path, not two.

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
    /* Fifth, added for milestone A: the admin's file-save helper, so the
       reusable-section export reuses the same download path the sitemap
       and the image exports already use. */
    var download = host.download;

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

    /* ==========================================================
       TEMPLATES AND THE REUSABLE SECTION LIBRARY (milestone A)
       ----------------------------------------------------------
       Both are thin: the renderer owns the registry, the sanitiser and
       the copying, and everything here is the UI over it. Nothing in this
       file decides what is safe to insert.
       ========================================================== */

    function pbPaintTemplates() {
        var host = $('#pbTemplates');
        if (!host) return;
        host.innerHTML = '';
        CMS.sections.templates().forEach(function (t) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pb-template';
            b.setAttribute('data-template', t.id);
            b.innerHTML = '<strong>' + esc(t.name) + '</strong>' +
                '<em>' + esc(t.description) + '</em>' +
                '<span class="pb-template-meta">' + t.sections + ' section' +
                (t.sections === 1 ? '' : 's') + ' \u00b7 ' + t.elements + ' element' +
                (t.elements === 1 ? '' : 's') + '</span>';
            b.addEventListener('click', function () { pbApplyTemplate(t); });
            host.appendChild(b);
        });
    }

    function pbApplyTemplate(t) {
        if (pbDraft.length && !window.confirm(
                'Replace the ' + pbDraft.length + ' section' + (pbDraft.length === 1 ? '' : 's') +
                ' in this draft with the "' + t.name + '" template?\n\n' +
                'The live page is not affected until you publish.')) return;
        var secs = CMS.sections.fromTemplate(t.id);
        if (!secs || !secs.length) { toast('That template could not be read.', true); return; }
        /* Replaced in place: pbDraft is the array the rest of the panel holds. */
        pbDraft.length = 0;
        secs.forEach(function (x) { pbDraft.push(x); });
        pbOpen = null;
        /* Provenance, not a link. The sections above are a copy, so a later
           change to the template cannot reach this page. */
        var page = CMS.data().pages[pbSlug];
        if (page) page.builderTemplate = { id: t.id, version: t.version };
        pbPersist();
        buildBuilder();
        toast('Started from the "' + t.name + '" template. Nothing is published yet.');
    }

    function pbSaveReusable(id) {
        var i = pbIndexOf(id);
        if (i < 0) return;
        var suggested = PB_TYPE_LABEL[pbDraft[i].type] || 'Section';
        var name = window.prompt('Name this reusable section:', suggested);
        if (name === null) return;
        var libId = CMS.sections.library.save(name, pbDraft[i]);
        if (!libId) { toast('That section could not be saved.', true); return; }
        commit(true);
        pbPaintLibrary();
        toast('Saved to reusable sections, in this browser only.');
    }

    function pbInsertLibrary(libId) {
        var sec = CMS.sections.library.instance(libId);
        if (!sec) { toast('That saved section could not be read.', true); return; }
        pbDraft.push(sec);
        pbOpen = sec.id;
        pbPersist();
        buildBuilder();
        toast('Inserted a copy. Editing it will not change what is saved.');
    }

    /* The preview renders through the public factories into a plain node,
       with the same generated CSS the page would carry. It is what would be
       published, not an approximation of it. */
    function pbPreviewLibrary(libId, box) {
        if (box.firstChild) { box.innerHTML = ''; box.hidden = true; return; }
        var sec = CMS.sections.library.instance(libId);
        if (!sec) { toast('That saved section could not be read.', true); return; }
        var tag = $('#pbLibCss');
        if (!tag) {
            tag = document.createElement('style');
            tag.id = 'pbLibCss';
            document.head.appendChild(tag);
        }
        tag.textContent = CMS.sections.css([sec]);
        CMS.sections.renderInto(box, [sec]);
        box.hidden = false;
    }

    function pbPaintLibrary() {
        var host = $('#pbLibrary');
        if (!host) return;
        host.innerHTML = '';
        var items = CMS.sections.library.list();
        if (!items.length) {
            host.innerHTML = '<p class="hint">Nothing saved yet. Use <em>Save as reusable</em> ' +
                'on any section above.</p>';
            return;
        }
        items.forEach(function (it) {
            var row = document.createElement('div');
            row.className = 'pb-lib-item';
            row.setAttribute('data-lib-id', it.id);

            var head = document.createElement('div');
            head.className = 'pb-lib-head';
            head.innerHTML = '<strong>' + esc(it.name) + '</strong>' +
                '<span class="pb-lib-meta">' + esc(PB_TYPE_LABEL[it.type] || it.type) +
                ' \u00b7 ' + it.elements + ' element' + (it.elements === 1 ? '' : 's') + '</span>';
            row.appendChild(head);

            var prev = document.createElement('div');
            prev.className = 'pb-lib-preview';
            prev.hidden = true;

            var tools = document.createElement('div');
            tools.className = 'pb-lib-tools';
            [['insert', 'Insert', 'fa-plus', function () { pbInsertLibrary(it.id); }],
             ['preview', 'Preview', 'fa-eye', function () { pbPreviewLibrary(it.id, prev); }],
             ['rename', 'Rename', 'fa-pen', function () {
                 var n = window.prompt('Rename this reusable section:', it.name);
                 if (n === null) return;
                 CMS.sections.library.rename(it.id, n);
                 commit(true); pbPaintLibrary();
             }],
             ['duplicate', 'Duplicate', 'fa-clone', function () {
                 CMS.sections.library.duplicate(it.id);
                 commit(true); pbPaintLibrary();
             }],
             ['delete', 'Delete', 'fa-trash', function () {
                 if (!window.confirm('Delete "' + it.name + '" from your reusable sections? ' +
                     'Pages that already use it are not affected.')) return;
                 CMS.sections.library.remove(it.id);
                 commit(true); pbPaintLibrary();
             }]].forEach(function (b) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'adm-btn ghost' + (b[0] === 'delete' ? ' danger' : '');
                btn.setAttribute('data-act', 'lib-' + b[0]);
                btn.innerHTML = '<i class="fas ' + b[2] + '"></i> ' + b[1];
                btn.addEventListener('click', b[3]);
                tools.appendChild(btn);
            });
            row.appendChild(tools);
            row.appendChild(prev);
            host.appendChild(row);
        });
    }

    function pbWireLibrary() {
        var ex = $('#pbLibExport'), im = $('#pbLibImport'), file = $('#pbLibFile');
        if (ex) ex.addEventListener('click', function () {
            var items = CMS.sections.library.list();
            if (!items.length) { toast('There is nothing saved to export.', true); return; }
            download('page-builder-sections.json', CMS.sections.library.exportJSON(),
                     'application/json');
            toast('Exported ' + items.length + ' reusable section' +
                  (items.length === 1 ? '' : 's') + '.');
        });
        if (im && file) {
            im.addEventListener('click', function () { file.value = ''; file.click(); });
            file.addEventListener('change', function () {
                var f = file.files && file.files[0];
                if (!f) return;
                var fr = new FileReader();
                fr.onload = function () {
                    var res = CMS.sections.library.importJSON(fr.result);
                    if (res.error) { toast(res.error, true); return; }
                    commit(true);
                    pbPaintLibrary();
                    toast(res.added + ' imported' +
                          (res.skipped ? ', ' + res.skipped + ' skipped as unreadable' : '') + '.');
                };
                fr.onerror = function () { toast('That file could not be read.', true); };
                fr.readAsText(f);
            });
        }
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
        pbPaintTemplates();
        pbPaintAdd();
        pbPaintList();
        pbPaintLibrary();
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

            var lib = pbBtn('fa-bookmark', 'Save as reusable');
            lib.setAttribute('data-act', 'save-reusable');
            lib.addEventListener('click', function () { pbSaveReusable(sec.id); });
            tools.appendChild(lib);

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
                /* Same invariant the element cards hold to: the section
                   renderer owns which keys do something, so the admin cannot
                   offer a control the section would ignore. Passing null used
                   to mean "everything", which offered a section the divider
                   and column controls that only elements react to. */
                pbDesignEditor(body, sec, pbSectionStyleKeys());
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
        ['columns', 'Columns'],
        /* V2 */
        ['divider',     'Divider'],
        ['spacer',      'Spacer'],
        ['icon',        'Icon'],
        ['notice',      'Notice'],
        ['featureBox',  'Feature box'],
        ['faq',         'FAQ'],
        ['socialLinks', 'Social links']
    ];

    /* Choice lists come from the renderer's own allow-lists, so the admin
       can never offer an icon or platform the renderer would drop. */
    function pbIconNames() { return Object.keys(CMS.sections.icons || {}).sort(); }
    function pbSocialNames() { return Object.keys(CMS.sections.social || {}).sort(); }
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
                  ['buttonNewTab', 'Open in a new tab', 'bool']],

        /* V2. Divider and Spacer are pure styling and carry no content, so
           they are absent here on purpose; the editor says so rather than
           showing an empty panel. */
        icon:    [['icon', 'Icon', 'iconSelect'],
                  ['label', 'Accessible label', 'text'],
                  ['href', 'Links to', 'url'], ['newTab', 'Open in a new tab', 'bool']],
        notice:  [['text', 'Text', 'area'],
                  ['variant', 'Type', 'select', ['info', 'success', 'warning', 'danger']],
                  ['icon', 'Icon', 'iconSelect'],
                  ['linkText', 'Link text', 'text'], ['href', 'Links to', 'url'],
                  ['newTab', 'Open in a new tab', 'bool']],
        featureBox: [['icon', 'Icon', 'iconSelect'],
                  ['image', 'Image URL (used when no icon)', 'url'],
                  ['imageAlt', 'Image alt', 'text'],
                  ['title', 'Heading', 'text'],
                  ['titleLevel', 'Heading level', 'select', ['h2', 'h3', 'h4', 'h5', 'h6']],
                  ['text', 'Description', 'area'],
                  ['linkText', 'Link text', 'text'], ['href', 'Links to', 'url'],
                  ['newTab', 'Open in a new tab', 'bool']],
        faq:     [['single', 'Only one answer open at a time', 'bool']],
        socialLinks: []
    };

    /* Repeating sub-items: which element types have them, what one blank
       row looks like, and the fields shown per row. */
    var PB_ITEM_FIELDS = {
        faq: {
            key: 'items', label: 'Questions', addLabel: 'Add question',
            blank: function () { return { question: 'New question', answer: 'Answer', open: false }; },
            title: function (it) { return String((it && it.question) || 'Question'); },
            fields: [['question', 'Question', 'text'], ['answer', 'Answer', 'area'],
                     ['open', 'Open by default', 'bool']]
        },
        socialLinks: {
            key: 'items', label: 'Links', addLabel: 'Add link',
            /* "#" for the same reason as the element default above: a row
               that renders the moment it is added, without inventing a
               link to somewhere real. */
            blank: function () { return { platform: 'whatsapp', url: '#' }; },
            title: function (it) { return String((it && it.platform) || 'Link'); },
            fields: [['platform', 'Platform', 'socialSelect'], ['url', 'URL', 'url'],
                     ['label', 'Accessible label (optional)', 'text']]
        }
    };

    var PB_STYLE_FIELDS = [
        /* V2: column tracks. First in the list because it is the control
           that decides what the element looks like. */
        ['columns',    'Column layout',     'colsSelect'],
        /* Stage 6: a role or a custom value, in one control. */
        ['typography', 'Typography role',   'typoRef'],
        ['bg',         'Background colour', 'colorRef'],
        ['color',      'Text colour',       'colorRef'],
        ['bgImage',    'Background image',  'url'],
        ['fontSize',   'Text size (px)',    'num'],
        ['fontWeight', 'Text weight',       'select',
            [['', '(inherit)'], ['300', 'Light'], ['400', 'Normal'], ['500', 'Medium'],
             ['600', 'Semi-bold'], ['700', 'Bold'], ['800', 'Extra bold']]],
        ['lineHeight',    'Line spacing',   'select',
            [['', '(inherit)'], ['1', 'Tight (1.0)'], ['1.2', 'Snug (1.2)'],
             ['1.5', 'Normal (1.5)'], ['1.8', 'Roomy (1.8)'], ['2', 'Airy (2.0)']]],
        ['letterSpacing', 'Letter spacing (px)', 'num'],
        ['align',      'Alignment',         'select',
            [['', '(inherit)'], ['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]],
        ['padding',    'Space inside (px)', 'num'],
        ['margin',     'Space outside (px)', 'num'],
        ['gap',        'Space between items (px)', 'num'],
        ['maxWidth',   'Max width (px)',    'num'],
        ['height',     'Min height (px)',   'num'],
        /* One stored shorthand behind three friendly inputs -- see
           pbBorderField. The wire format is unchanged. Ordered before the
           radius so the Border group reads border-then-corners. */
        ['border',     'Border',            'borderParts'],
        ['radius',     'Corner radius (px)', 'num'],
        ['shadow',     'Shadow',            'shadowPreset'],
        /* V2: a divider draws a rule, which is three controls rather than
           one free-text border string. */
        ['lineWidth',  'Line thickness (px)', 'num'],
        ['lineStyle',  'Line style',        'select',
            [['', '(inherit)'], ['solid', 'Solid'], ['dashed', 'Dashed'],
             ['dotted', 'Dotted'], ['double', 'Double']]],
        ['lineColor',  'Line colour',       'colorRef']
    ];

    /* ---------- Stage 5: the seven control groups ----------
       Order here is the order they appear. A key may belong to exactly one
       group; anything not listed falls into "More" so a new control can
       never become invisible, and a test asserts that "More" is empty. */
    var PB_STYLE_GROUPS = [
        ['layout',     'Layout',     ['columns', 'align', 'maxWidth', 'height', 'gap']],
        ['spacing',    'Spacing',    ['padding', 'margin']],
        ['typography', 'Typography', ['typography', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']],
        ['colors',     'Colors',     ['color', 'bg']],
        ['border',     'Border',     ['border', 'lineWidth', 'lineStyle', 'lineColor', 'radius']],
        ['shadow',     'Shadow',     ['shadow']],
        ['background', 'Background', ['bgImage']]
    ];

    function pbGroupOf(key) {
        for (var i = 0; i < PB_STYLE_GROUPS.length; i++) {
            if (PB_STYLE_GROUPS[i][2].indexOf(key) > -1) return PB_STYLE_GROUPS[i][0];
        }
        return 'more';
    }

    /* Which groups are expanded. Kept per group rather than per element, so
       an author who opens Typography keeps it open as they move down the
       page instead of reopening it on every card. */
    var pbGroupOpen = { layout: true };

    /* Shadow presets. Same approach as the column layouts: the value stored
       is one of these constants, never something typed into a CSS box --
       but a value that is already stored and is not a preset still shows,
       in the custom field, so nothing an author wrote is ever lost. */
    var PB_SHADOWS = [
        ['0 1px 3px rgba(0,0,0,.12)',  'Soft'],
        ['0 4px 12px rgba(0,0,0,.15)', 'Medium'],
        ['0 10px 30px rgba(0,0,0,.22)', 'Strong'],
        ['none',                        'None']
    ];

    /* Human wording for the column presets. The list of presets itself is
       owned by js/cms.js -- this only supplies the words, and a preset with
       no wording here still appears, labelled by its key, so the two can
       never silently fall out of step. */
    var PB_COL_WORDS = {
        '1':          'Single column',
        '2':          '2 columns \u2014 equal',
        '2-30-70':    '2 columns \u2014 30 / 70',
        '2-70-30':    '2 columns \u2014 70 / 30',
        '2-40-60':    '2 columns \u2014 40 / 60',
        '2-60-40':    '2 columns \u2014 60 / 40',
        '2-25-75':    '2 columns \u2014 25 / 75',
        '2-75-25':    '2 columns \u2014 75 / 25',
        '3':          '3 columns \u2014 equal',
        '3-25-50-25': '3 columns \u2014 25 / 50 / 25',
        '3-50-25-25': '3 columns \u2014 50 / 25 / 25',
        '3-25-25-50': '3 columns \u2014 25 / 25 / 50',
        '4':          '4 columns \u2014 equal'
    };

    function pbColLayoutMap() { return CMS.sections.colLayouts || {}; }

    /* Option list for the layout select. The empty option is worded for the
       breakpoint it sits on, because "automatic" and "inherit" are not the
       same promise. */
    function pbColOptions(device) {
        var map = pbColLayoutMap();
        var opts = [['', device === 'base'
            ? 'Automatic \u2014 fit to width (default)'
            : (device === 'mobile'
                ? 'Stacked \u2014 one column (default)'
                : 'Inherit the desktop layout')]];
        for (var k in map) {
            if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
            opts.push([k, PB_COL_WORDS[k] || k]);
        }
        return opts;
    }

    /* How many tracks a preset draws, for the mismatch hint below. */
    function pbColCount(name) {
        var map = pbColLayoutMap();
        var k = String(name || '');
        if (!k || !Object.prototype.hasOwnProperty.call(map, k)) return 0;
        return (map[k] && map[k][1]) || 0;
    }

    /* Which controls an element type actually reacts to. Owned by
       js/cms.js so the admin cannot offer a control the renderer ignores. */
    function pbStyleKeysFor(type) {
        return (CMS.sections.elementStyleKeys || {})[type] || [];
    }

    function pbSectionStyleKeys() {
        return CMS.sections.sectionStyleKeys || [];
    }

    /* The shared field list carries one label per key, but the same key can
       mean something different on a different element -- "Min height" is
       wrong on an image and on a spacer, both of which take an exact
       height, and "Font size" is an odd way to ask for the size of an icon.
       These overrides are per element type and affect V2 elements only. */
    var PB_LABEL_OVERRIDE = {
        image:       { height: 'Height (px)', maxWidth: 'Max width (px)' },
        spacer:      { height: 'Height (px)', maxWidth: 'Max width (px)' },
        divider:     { maxWidth: 'Width (px)' },
        icon:        { fontSize: 'Icon size (px)' },
        socialLinks: { fontSize: 'Icon size (px)', gap: 'Space between icons (px)' }
    };

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

    /* Which element cards have their Design panel open, keyed by element id. */
    var pbDesignOpen = {};

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
                /* An option is either a bare value or a [value, label] pair,
                   which the column layouts need because "2-30-70" is not a
                   sentence anyone should have to read. */
                var pair = Object.prototype.toString.call(o) === '[object Array]';
                var val = pair ? o[0] : o;
                var txt = pair ? o[1] : o;
                var op = document.createElement('option');
                op.value = val;
                op.textContent = (!pair && val === '') ? '(inherit)' : txt;
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

    /* ---------- Stage 6: global design references ----------

       A colour control offers the global roles and a custom value in one
       place. Choosing a role stores "@primary"; choosing Custom reveals
       the colour box and leaves whatever was stored alone until something
       is actually typed, so flipping between the two does not throw the
       reference away.

       The role names come from the renderer, so this list cannot drift
       from the one the stylesheet will accept. */

    function pbColorRoles() {
        var m = CMS.sections.colorRoles || {}, out = [];
        for (var k in m) { if (Object.prototype.hasOwnProperty.call(m, k)) out.push(k); }
        return out;
    }

    function pbTypoRoleNames() {
        var m = CMS.sections.typoRoles || {}, out = [];
        for (var k in m) { if (Object.prototype.hasOwnProperty.call(m, k)) out.push(k); }
        return out;
    }

    function pbTitle(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

    /* Words for the roles. A role with no wording here still appears under
       its own name, so the two can never quietly fall out of step. */
    var PB_ROLE_WORDS = {
        primary: 'Primary', secondary: 'Secondary', text: 'Text', muted: 'Muted text',
        border: 'Border', background: 'Page background', surface: 'Surface',
        success: 'Success', warning: 'Warning', danger: 'Danger'
    };
    var PB_TYPO_WORDS = {
        body: 'Body text', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3',
        h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6', button: 'Button'
    };

    /* Select + colour box, writing one value: either "@role" or a literal. */
    function pbColorControl(get, set, emptyLabel) {
        var box = document.createElement('span');
        box.className = 'pb-parts';
        var custom = null;               /* assigned below; referenced early */

        var isRef = function () { return String(get() || '').charAt(0) === '@'; };
        /* Remembered so switching to a role and back offers the colour the
           author had, rather than an empty box. */
        var lastCustom = isRef() ? '' : String(get() || '');

        var opts = [['', emptyLabel || '(inherit)']]
            .concat(pbColorRoles().map(function (r) {
                return ['@' + r, 'Global: ' + (PB_ROLE_WORDS[r] || pbTitle(r))];
            }))
            .concat([['custom', 'Custom\u2026']]);

        var sel = pbInput('select', opts,
            function () {
                var v = String(get() || '');
                if (!v) return '';
                return v.charAt(0) === '@' ? v : 'custom';
            },
            function (v) {
                if (v === 'custom') {
                    custom.hidden = false;
                    /* Deliberately not clearing the stored reference: until
                       a colour is typed there is nothing better to show. */
                    if (lastCustom) { set(lastCustom); custom.value = lastCustom; }
                    custom.focus();
                    return;
                }
                custom.hidden = true;
                set(v);
            }, null);
        sel.setAttribute('data-part', 'role');
        box.appendChild(sel);

        custom = pbInput('color', null,
            function () { return isRef() ? '' : get(); },
            function (v) { lastCustom = v; set(v); }, null);
        custom.setAttribute('data-part', 'value');
        custom.hidden = isRef() || !String(get() || '');
        box.appendChild(custom);

        return box;
    }

    function pbColorRefField(spec, bag, key, ctx) {
        var box = pbColorControl(
            function () { return bag[key]; },
            function (v) {
                if (v === '' || v == null) delete bag[key];
                else bag[key] = v;
                if (ctx && ctx.onChange) ctx.onChange(key, v);
            },
            (ctx && ctx.device && ctx.device !== 'base') ? '(inherit)' : '(default)');
        return pbRow(spec[1], box);
    }

    /* The typography role: one select, no custom half. An author who wants
       exact numbers uses the size and weight controls below it, which are
       written after the role in the same rule and therefore win. */
    function pbTypoRefField(spec, bag, key, ctx) {
        var opts = [['', '(none)']].concat(pbTypoRoleNames().map(function (r) {
            return ['@' + r, 'Global: ' + (PB_TYPO_WORDS[r] || pbTitle(r))];
        }));
        var input = pbInput('select', opts,
            function () { return bag[key]; },
            function (v) {
                if (v === '') delete bag[key]; else bag[key] = v;
                if (ctx && ctx.onChange) ctx.onChange(key, v);
            }, null);
        input.setAttribute('data-part', 'typo');
        return pbRow(spec[1], input,
            'Sets size, weight and spacing together. Anything you set below wins over it.');
    }

    /* ---------- Stage 5: composite controls over an existing key ----------    /* ---------- Stage 5: composite controls over an existing key ----------

       Both of these keep the stored wire format exactly as it was -- one
       string under `border`, one under `shadow` -- and only change how that
       string is put together. Nothing is migrated, and a value that was
       already stored keeps working whether or not this UI can take it
       apart again. */

    var PB_BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double', 'none',
                            'groove', 'ridge', 'inset', 'outset'];

    /* "2px dashed #ccc" -> {width:'2', style:'dashed', color:'#ccc'}, or null
       when the stored value is something this UI would not be able to put
       back together. */
    function pbBorderParse(v) {
        var m = /^\s*(-?[0-9.]+)(?:px)?\s+([a-z]+)\s+(\S.*?)\s*$/i.exec(String(v == null ? '' : v));
        if (!m) return null;
        if (PB_BORDER_STYLES.indexOf(m[2].toLowerCase()) === -1) return null;
        return { width: m[1], style: m[2].toLowerCase(), color: m[3] };
    }

    function pbBorderCompose(parts) {
        if (!parts.width && !parts.style && !parts.color) return '';
        return (parts.width === '' ? '1' : parts.width) + 'px ' +
               (parts.style || 'solid') + ' ' +
               (parts.color || 'currentColor');
    }

    /* Width / style / colour, writing the one `border` string the renderer
       has always read. A stored value this cannot parse is offered as text
       instead, so an author never loses what they wrote. */
    function pbBorderField(spec, bag, key, ctx) {
        var raw = bag[key];
        var parts = pbBorderParse(raw);
        if (raw != null && raw !== '' && !parts) {
            return pbFieldFor([spec[0], spec[1] + ' (custom value)', 'text'], bag, key, ctx);
        }
        parts = parts || { width: '', style: '', color: '' };

        var box = document.createElement('span');
        box.className = 'pb-parts';

        function write() {
            var v = pbBorderCompose(parts);
            if (v) bag[key] = v; else delete bag[key];
            if (ctx && ctx.onChange) ctx.onChange(key, v);
        }
        function sub(kind, opts, which, ph) {
            var el = pbInput(kind, opts,
                function () { return parts[which]; },
                function (val) { parts[which] = val; write(); }, null);
            var node = el;
            if (ph && node.tagName === 'INPUT') node.placeholder = ph;
            node.setAttribute('data-part', which);
            box.appendChild(node);
            return node;
        }
        sub('num', null, 'width', 'px');
        sub('select', [['', 'Solid']].concat(PB_BORDER_STYLES.map(function (x) {
            return [x, x.charAt(0).toUpperCase() + x.slice(1)];
        })), 'style');
        /* The colour half takes a global role too, so a border can follow
           the palette like any other colour. */
        var colorBox = pbColorControl(
            function () { return parts.color; },
            function (v) { parts.color = v; write(); }, '(default)');
        colorBox.setAttribute('data-part', 'color');
        box.appendChild(colorBox);

        return pbRow(spec[1], box, 'Thickness, style and colour.');
    }

    /* A short list of shadows rather than a box-shadow builder. Choosing one
       stores that exact constant; a stored value that is not on the list
       still appears, in the custom box beneath. */
    function pbShadowField(spec, bag, key, ctx) {
        var box = document.createElement('span');
        box.className = 'pb-parts pb-parts-col';
        var known = PB_SHADOWS.some(function (o) { return o[0] === bag[key]; });

        var sel = pbInput('select',
            [['', '(inherit)']].concat(PB_SHADOWS).concat([['custom', 'Custom\u2026']]),
            function () { return (bag[key] == null || bag[key] === '') ? '' : (known ? bag[key] : 'custom'); },
            function (v) {
                if (v === 'custom') { custom.hidden = false; custom.focus(); return; }
                custom.hidden = true;
                if (v === '') delete bag[key]; else bag[key] = v;
                if (ctx && ctx.onChange) ctx.onChange(key, v);
            }, null);
        sel.setAttribute('data-part', 'preset');
        box.appendChild(sel);

        var custom = pbInput('text', null,
            function () { return known ? '' : bag[key]; },
            function (v) {
                if (v === '') delete bag[key]; else bag[key] = v;
                if (ctx && ctx.onChange) ctx.onChange(key, v);
            }, null);
        custom.setAttribute('data-part', 'custom');
        custom.placeholder = '0 4px 12px rgba(0,0,0,.15)';
        custom.hidden = known || bag[key] == null || bag[key] === '';
        box.appendChild(custom);

        return pbRow(spec[1], box);
    }

    function pbFieldFor(spec, bag, key, ctx) {
        /* iconSelect and socialSelect are ordinary selects whose options
           come from the renderer, resolved here so the two lists can never
           drift apart. A blank option is offered for icons because an icon
           is optional on a notice and a feature box. */
        if (spec[2] === 'iconSelect')   spec = [spec[0], spec[1], 'select', [''].concat(pbIconNames())];
        if (spec[2] === 'socialSelect') spec = [spec[0], spec[1], 'select', pbSocialNames()];
        if (spec[2] === 'colsSelect') {
            spec = [spec[0], spec[1], 'select', pbColOptions((ctx && ctx.device) || 'base')];
        }
        if (spec[2] === 'colorRef')     return pbColorRefField(spec, bag, key, ctx);
        if (spec[2] === 'typoRef')      return pbTypoRefField(spec, bag, key, ctx);
        if (spec[2] === 'borderParts')  return pbBorderField(spec, bag, key, ctx);
        if (spec[2] === 'shadowPreset') return pbShadowField(spec, bag, key, ctx);

        var hint = document.createElement('em');
        hint.className = 'pb-warn';
        hint.hidden = true;
        var input = pbInput(spec[2], spec[3],
            function () { return bag[key]; },
            function (v) {
                if (v === '' || v === false) delete bag[key];
                else bag[key] = v;
                if (ctx && ctx.onChange) ctx.onChange(key, v);
            }, hint);
        var row = pbRow(spec[1], input);
        row.appendChild(hint);
        return row;
    }

    /* ---------- design + responsive ---------- */

    /* `onLayout` is called when a columns element's base layout changes and
       the element has fewer column containers than the layout has tracks.
       Supplied by the element card, which is the only place that can bring
       the content list back in step with the data. */
    function pbDesignEditor(host, node, keys, labels, onLayout) {
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
                pbDesignEditor(host, node, keys, labels, onLayout);
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
        var ctx = {
            device: device,
            onChange: function (key) {
                if (key !== 'columns') return;
                /* Containers first, then the warning: adding a container is
                   what decides whether there is anything left to warn about. */
                if (onLayout) onLayout(device);
                syncColsWarn();
            }
        };

        /* ---- Stage 5: the controls, sorted into groups ----
           One pass over the field list fills a grid per group, then the
           groups are rendered in their declared order. A group with nothing
           in it is not rendered at all, which is what keeps section-only and
           element-only controls where they belong without a second list to
           maintain. */
        var grids = {}, total = 0;
        PB_STYLE_FIELDS.forEach(function (spec) {
            if (keys && keys.indexOf(spec[0]) === -1) return;
            if (labels && labels[spec[0]]) {
                spec = [spec[0], labels[spec[0]], spec[2], spec[3]];
            }
            var g = pbGroupOf(spec[0]);
            if (!grids[g]) {
                grids[g] = document.createElement('div');
                grids[g].className = 'pb-grid';
            }
            grids[g].appendChild(pbFieldFor(spec, bag, spec[0], ctx));
            total++;
        });

        PB_STYLE_GROUPS.concat([['more', 'More', []]]).forEach(function (g) {
            var grid = grids[g[0]];
            if (!grid) return;
            var box = document.createElement('details');
            box.className = 'pb-group';
            box.setAttribute('data-group', g[0]);
            box.open = !!pbGroupOpen[g[0]];
            var sum = document.createElement('summary');
            sum.textContent = g[1];
            var count = document.createElement('span');
            count.className = 'pb-group-count';
            count.textContent = String(grid.children.length);
            sum.appendChild(count);
            box.appendChild(sum);
            box.appendChild(grid);
            box.addEventListener('toggle', function () { pbGroupOpen[g[0]] = box.open; });
            host.appendChild(box);
        });

        if (!total) {
            var none = document.createElement('p');
            none.className = 'hint';
            none.textContent = 'This element type has no design controls at this breakpoint.';
            host.appendChild(none);
        }

        /* A layout draws a fixed number of tracks; the columns themselves
           are content. Saying so beats leaving an author to work out why a
           quarter of the row is empty. The paragraph is created once and
           kept in step by syncColsWarn, because picking a layout with fewer
           tracks than there are columns adds nothing and so rebuilds
           nothing -- which is exactly the case worth warning about. */
        var colsWarn = null;
        if (keys && keys.indexOf('columns') > -1) {
            colsWarn = document.createElement('p');
            colsWarn.className = 'pb-warn';
            colsWarn.setAttribute('data-warn', 'cols');
            host.appendChild(colsWarn);
            syncColsWarn();
        }

        function syncColsWarn() {
            if (!colsWarn) return;
            var tracks = pbColCount(bag.columns);
            var have = (((node.content || {}).columns) || []).length;
            colsWarn.hidden = !tracks || tracks === have;
            if (colsWarn.hidden) { colsWarn.textContent = ''; return; }
            colsWarn.textContent = tracks > have
                ? 'This layout draws ' + tracks + ' columns but the element has ' +
                  have + '. Add ' + (tracks - have) + ' more above, or the extra space stays empty.'
                : 'This layout draws ' + tracks + ' columns and the element has ' +
                  have + '. The rest wrap onto a new row.';
        }

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
                pbDesignEditor(host, node, keys, labels, onLayout);
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

    /* What a newly added element starts with.

       Every entry here has to make the element render something the moment
       it is added. Several of the V2 factories refuse to draw anything at
       all without content -- an icon with no icon name, a FAQ with no
       question and a social row with no usable URL each return null by
       design -- so shipping them with {} meant adding one and seeing
       nothing, with every design control apparently dead.

       The placeholder values are deliberately plain, and are chosen from
       the renderer's own allow-lists (PB_ICONS, PB_SOCIAL,
       PB_NOTICE_VARIANTS) rather than invented here, so a default can
       never be a value the renderer would refuse. The social link points
       at "#" rather than a real profile: it is visibly a placeholder and
       cannot send a visitor anywhere. None of this changes what the
       renderer accepts -- stored content that is empty or malformed still
       fails exactly as safely as before. */
    var PB_BLANK_CONTENT = {
        heading: function () { return { text: 'Heading', level: 'h2' }; },
        text:    function () { return { text: 'Write something here.' }; },
        button:  function () { return { text: 'Button', href: '#' }; },
        image:   function () { return { src: '', alt: '' }; },
        card:    function () { return { title: 'Card title', text: 'Card text.' }; },
        columns: function () {
            return { columns: [
                { elements: [{ id: pbUid('el'), type: 'text', content: { text: 'Left column.' }, style: {} }] },
                { elements: [{ id: pbUid('el'), type: 'text', content: { text: 'Right column.' }, style: {} }] }
            ] };
        },

        /* V2. Divider and Spacer are pure styling: they draw themselves with
           no content at all, so they stay empty. */
        icon:        function () { return { icon: 'star', label: 'Icon' }; },
        notice:      function () { return { text: 'Notice', variant: 'info', icon: 'info' }; },
        featureBox:  function () {
            return { icon: 'star', title: 'Feature title', text: 'Feature description' };
        },
        faq:         function () {
            return { items: [{ question: 'Frequently asked question', answer: 'Answer', open: false }] };
        },
        socialLinks: function () { return { items: [{ platform: 'whatsapp', url: '#' }] }; }
    };

    function pbBlankElement(type) {
        var make = Object.prototype.hasOwnProperty.call(PB_BLANK_CONTENT, type)
            ? PB_BLANK_CONTENT[type] : null;
        return { id: pbUid('el'), type: type, style: {}, responsive: {},
                 content: make ? make() : {} };
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

            var itemCfg = PB_ITEM_FIELDS[el.type];
            if (itemCfg) pbItemsEditor(body, el, itemCfg);

            if (!grid.children.length && !itemCfg) {
                var nc = document.createElement('p');
                nc.className = 'hint';
                nc.textContent = 'This element has no content to set \u2014 use Design to style it.';
                body.appendChild(nc);
            }

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
        /* Remembered across a repaint: choosing a column layout rebuilds the
           card to show the new columns, and the panel it was chosen in
           should still be open afterwards. */
        design.open = !!pbDesignOpen[el.id];
        design.addEventListener('toggle', function () { pbDesignOpen[el.id] = design.open; });
        var dhost = document.createElement('div');
        pbDesignEditor(dhost, el, pbStyleKeysFor(el.type), PB_LABEL_OVERRIDE[el.type],
            function (device) {
                /* Only the desktop choice owns how many containers exist;
                   tablet and mobile re-flow the containers that are there.
                   Containers are only ever added -- removing one would throw
                   away whatever an author had put in it. */
                if (el.type !== 'columns' || device !== 'base') { pbPaintPreview(); return; }
                var want = pbColCount((el.style || {}).columns);
                var list = (el.content && el.content.columns) || (el.content = { columns: [] }).columns;
                var added = false;
                while (want > list.length) { list.push({ elements: [] }); added = true; }
                pbPersist();
                if (added) repaint();
                pbPaintPreview();
            });
        design.appendChild(dhost);
        body.appendChild(design);

        card.appendChild(body);
        return card;
    }

    /* ---------- repeating sub-items (FAQ questions, social links) ----------
       Deliberately the same shape as the section and element lists above:
       add, move, delete, and a per-row field grid. Rows are rebuilt on every
       structural change, so listeners cannot accumulate, and field edits go
       through pbEdited() like every other control. */
    function pbItemsEditor(host, el, cfg) {
        if (!el.content) el.content = {};
        if (!Array.isArray(el.content[cfg.key])) el.content[cfg.key] = [];
        var list = el.content[cfg.key];

        var wrap = document.createElement('div');
        wrap.className = 'pb-items';
        wrap.setAttribute('data-items', cfg.key);
        host.appendChild(wrap);

        function repaint() {
            wrap.innerHTML = '';
            if (!list.length) {
                var e = document.createElement('p');
                e.className = 'hint';
                e.textContent = 'No ' + cfg.label.toLowerCase() + ' yet.';
                wrap.appendChild(e);
            }
            list.forEach(function (it, i) {
                var row = document.createElement('div');
                row.className = 'pb-item';
                row.setAttribute('data-item', String(i));

                var head = document.createElement('div');
                head.className = 'pb-item-head';
                var name = document.createElement('strong');
                name.textContent = cfg.title(it);
                head.appendChild(name);

                var tools = document.createElement('div');
                tools.className = 'pb-sec-tools';
                var up = pbBtn('fa-arrow-up', 'Move up');
                up.disabled = i === 0;
                up.setAttribute('data-act', 'item-up');
                up.addEventListener('click', function () {
                    var t = list[i - 1]; list[i - 1] = list[i]; list[i] = t;
                    pbPersist(); repaint(); pbPaintPreview();
                });
                tools.appendChild(up);
                var down = pbBtn('fa-arrow-down', 'Move down');
                down.disabled = i === list.length - 1;
                down.setAttribute('data-act', 'item-down');
                down.addEventListener('click', function () {
                    var t = list[i + 1]; list[i + 1] = list[i]; list[i] = t;
                    pbPersist(); repaint(); pbPaintPreview();
                });
                tools.appendChild(down);
                var del = pbBtn('fa-trash', 'Delete', 'danger');
                del.setAttribute('data-act', 'item-del');
                del.addEventListener('click', function () {
                    list.splice(i, 1);
                    pbPersist(); repaint(); pbPaintPreview();
                });
                tools.appendChild(del);
                head.appendChild(tools);
                row.appendChild(head);

                var g = document.createElement('div');
                g.className = 'pb-grid';
                cfg.fields.forEach(function (spec) {
                    g.appendChild(pbFieldFor(spec, it, spec[0]));
                });
                row.appendChild(g);
                wrap.appendChild(row);
            });
        }
        repaint();

        var add = document.createElement('button');
        add.type = 'button';
        add.className = 'adm-btn ghost pb-item-add';
        add.setAttribute('data-act', 'item-add');
        add.innerHTML = '<i class="fas fa-plus"></i> ' + esc(cfg.addLabel);
        add.addEventListener('click', function () {
            list.push(cfg.blank());
            pbPersist(); repaint(); pbPaintPreview();
        });
        host.appendChild(add);
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
        pbWireLibrary();
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
