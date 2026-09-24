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

    /* ---------- save state (milestone C) ----------

       The builder writes the draft on a short debounce, so "unsaved" is
       normally a window of a quarter of a second. What matters is telling
       the truth about it:

         idle    nothing waiting, nothing to report
         unsaved an edit is typed and the debounce has not fired yet
         saved   the draft is on disk
         failed  the write was REFUSED and the edit is only in memory

       The second one used to read "Saving...", which was not true: the
       write is synchronous, so during that window nothing is being
       saved -- the edit is simply not on disk yet. It says so now.

       The last one is the reason this exists. CMS.save() returns false
       when localStorage refuses -- a full quota is the usual cause -- and
       until now pbPersist() threw that answer away and the admin said
       "Saved". The draft was still in memory and still correct, but a
       reload would have lost it and nothing said so. */

    var pbSaveState = 'idle';
    var pbSaveError = '';

    function pbSetSaveState(state, message) {
        pbSaveState = state;
        pbSaveError = message || '';
        pbPaintSaveState();
    }

    function pbPaintSaveState() {
        var el = $('#pbSaveState');
        if (!el) return;
        var text = '', cls = '';
        if (pbSaveState === 'unsaved') { text = 'Unsaved changes'; cls = 'unsaved'; }
        else if (pbSaveState === 'saved') { text = 'Draft saved on this device'; cls = 'saved'; }
        else if (pbSaveState === 'failed') { text = pbSaveError || 'Could not save'; cls = 'failed'; }
        el.textContent = text;
        el.className = 'pb-savestate ' + cls;
        el.hidden = !text;
        el.setAttribute('data-state', text ? pbSaveState : 'idle');
    }

    /* Local save only. commit(true) skips CMS.remote.publish(), which is
       what keeps a draft off the live site. Returns whether the draft
       actually reached storage, and says so either way. */
    function pbPersist() {
        var ok = CMS.sections.saveDraft(pbSlug, pbDraft);
        if (ok) ok = commit(true);
        if (ok) {
            pbSetSaveState('saved');
        } else {
            /* Deliberately NOT clearing pbDraft: the edit is still correct
               in memory, and the next save may well succeed. */
            pbSetSaveState('failed',
                'Not saved \u2014 this browser refused to store it. Your changes are ' +
                'still here; free some space and press Save draft.');
        }
        return ok;
    }

    function pbSelect(slug) {
        pbFlush();
        pbSlug = slug;
        pbDraft = CMS.sections.draft(slug).sections;
        pbOpen = null;
        /* Sub-tab and breakpoint choices are keyed by node id. The nodes of
           the page being left are gone, so their entries are too -- they
           would otherwise accumulate for the lifetime of the tab and, worse,
           could be re-adopted by a node that happened to be minted with a
           matching id. */
        pbView = {};
        pbDevice = {};
        pbDesignOpen = {};
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
        /* The list is rebuilt, so the button that was pressed is gone.
           Focus goes to the same button on the section that moved. */
        pbWishFocus(function () {
            var row = pbNodeFor(null, '#pbList > .pb-sec', 'data-sec-id', id);
            return row && pbFocusIn(row, delta < 0 ? ['up', 'down'] : ['down', 'up']);
        });
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

    /* ==========================================================
       DRAG AND DROP  (milestone D)
       ----------------------------------------------------------
       THERE IS ONE TREE. pbDraft is it, and dragging does not get a
       second one. A drag carries an ADDRESS into that tree and nothing
       else:

         { kind:'section' }                        -> pbDraft
         { kind:'element', sec, el:'', col:-1 }    -> section.elements
         { kind:'element', sec, el:ID, col:N }     -> that column's elements
         { kind:'column',  sec, el:ID }            -> that element's columns

       Addresses come out of data-* attributes, which is to say they come
       from the DOM, which is to say anyone with the page open can write
       them. So an address is never trusted: it is RE-RESOLVED against
       the live tree when the drop is validated and again when it is
       applied. An id that was never real, is no longer real, or names
       the wrong kind of node fails to resolve and the drop is refused.
       The DOM says where the pointer is. It never says what the page is.

       The move itself is a splice of the SAME OBJECT out of one array
       and into another. Nothing is cloned, re-serialised or rebuilt, so
       content, styles, responsive overrides, @role references, asset
       paths, column ratios, nesting and ids all survive for the simplest
       possible reason: they are never touched.
       ========================================================== */

    /* Real ids are minted by pbUid() and look like sec_l3k9f2a1x. An id
       that cannot have come from there is refused before it is used --
       not because the lookups below could be poisoned (they scan arrays
       and compare strings; they never index an object by a caller's
       name) but because refusing it is free and leaves nothing to argue
       about. */
    var PB_BAD_IDS = ['__proto__', 'constructor', 'prototype'];

    function pbSafeId(v) {
        if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(v)) return false;
        return PB_BAD_IDS.indexOf(v) === -1;
    }

    function pbSectionById(id) {
        if (!pbSafeId(id)) return null;
        for (var i = 0; i < pbDraft.length; i++) {
            if (pbDraft[i] && pbDraft[i].id === id) return pbDraft[i];
        }
        return null;
    }

    /* A columns element, by id, at the only depth the renderer allows one
       to exist: directly inside a section. Anything else -- wrong type, no
       content, columns that are not an array -- is not a container. */
    function pbColumnsIn(sec, id) {
        if (!sec || !pbSafeId(id) || !Array.isArray(sec.elements)) return null;
        for (var i = 0; i < sec.elements.length; i++) {
            var e = sec.elements[i];
            if (!e || e.id !== id) continue;
            if (e.type !== 'columns') return null;
            if (!e.content || typeof e.content !== 'object') return null;
            return Array.isArray(e.content.columns) ? e : null;
        }
        return null;
    }

    function pbIndexIn(list, id) {
        if (!pbSafeId(id) || !Array.isArray(list)) return -1;
        for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === id) return i; }
        return -1;
    }

    /* Is `id` this element or anything under it? One call answers both
       "dropped into itself" and "dropped into its own descendant". */
    function pbContainsId(el, id) {
        var found = false;
        (function walk(node) {
            if (found || !node || typeof node !== 'object') return;
            if (node.id === id) { found = true; return; }
            var cols = (node.content || {}).columns;
            if (!Array.isArray(cols)) return;
            cols.forEach(function (c) {
                if (c && Array.isArray(c.elements)) c.elements.forEach(walk);
            });
        })(el);
        return found;
    }

    /* An address in, the actual array out -- or null, which is the only
       thing an unusable address ever produces. */
    function pbListAt(addr) {
        if (!addr || typeof addr !== 'object') return null;
        if (addr.kind === 'section') return pbDraft;
        var sec = pbSectionById(addr.sec);
        if (!sec) return null;
        if (!Array.isArray(sec.elements)) sec.elements = [];
        if (addr.kind === 'element' && !addr.el) return sec.elements;
        var owner = pbColumnsIn(sec, addr.el);
        if (!owner) return null;
        var cols = owner.content.columns;
        if (addr.kind === 'column') return cols;
        if (addr.kind !== 'element') return null;
        var ci = addr.col;
        if (typeof ci !== 'number' || !isFinite(ci) || ci !== Math.floor(ci) ||
            ci < 0 || ci >= cols.length) return null;
        var col = cols[ci];
        if (!col || typeof col !== 'object') return null;
        if (!Array.isArray(col.elements)) col.elements = [];
        return col.elements;
    }

    /* Where the dragged thing is RIGHT NOW, not where it was when the
       pointer went down. If it has been deleted, or something else now
       sits at that place, there is nothing to move. */
    function pbDragItem(drag) {
        if (!drag || typeof drag !== 'object') return null;
        var from = pbListAt(drag.addr);
        if (!from) return null;
        var i;
        if (drag.kind === 'column') {
            i = drag.index;
            if (typeof i !== 'number' || !isFinite(i) || i !== Math.floor(i) ||
                i < 0 || i >= from.length) return null;
        } else {
            i = pbIndexIn(from, drag.id);
            if (i < 0) return null;
        }
        if (drag.ref && from[i] !== drag.ref) return null;
        return { list: from, index: i, node: from[i] };
    }

    /* Every reason a drop is refused, in one place. */
    function pbDropOk(drag, target) {
        if (!drag || !target) return false;
        if (drag.kind !== target.kind) return false;          /* no section-into-element, ever */
        var at = pbDragItem(drag);
        if (!at) return false;                                 /* unknown, stale or malformed */
        var to = pbListAt(target.addr);
        if (!to) return false;
        if (drag.kind === 'column') {
            /* Columns reorder inside the element that owns them. Moving one
               to a different columns element would leave the source short of
               the container count its layout preset asks for, and the layout
               control deliberately never removes a container. */
            return target.addr.sec === drag.addr.sec && target.addr.el === drag.addr.el;
        }
        if (drag.kind === 'element' && target.addr.el) {
            /* Landing inside a column. Two questions, cheapest first.

               The type check is the one that does the work today: columns
               is the only container the schema has, so the only element
               that can contain a column is a columns element, and a
               columns element may not go into a column at all. The
               descendant walk below it is therefore REDUNDANT as the
               schema stands -- no mutation test can reach it, and that is
               reported rather than hidden. It is kept because it states
               the invariant itself ("never into yourself, never into what
               you contain") rather than a fact about which types exist,
               and a second container type would make it the one that
               matters. */
            if (at.node.type === 'columns') return false;
            if (pbContainsId(at.node, target.addr.el)) return false;
        }
        var want = target.index;
        if (typeof want !== 'number' || !isFinite(want) || want !== Math.floor(want) ||
            want < 0 || want > to.length) return false;
        return true;
    }

    /* How many nodes of each kind and type SURVIVE the sanitiser.

       Sorted, so order -- the thing a move is for -- is not looked at.
       Counted by type rather than by id, because the sanitiser MINTS a
       fresh id for any node whose own id it cannot use (pbCssId in
       cms.js), and a freshly minted id is different every call. Keying on
       ids would therefore make two sanitiser runs over the same tree
       disagree, and every drag on a draft containing one hand-written id
       would be refused for no reason.

       Counting is enough for the question being asked. The sanitiser only
       ever DROPS nodes; it never adds one. So if the count for a type
       falls, the move made it drop something, and that is the whole
       claim. (That ids survive a move is a separate property, asserted
       directly in the tests.) */
    function pbSurvivors(secs) {
        var out = [];
        (Array.isArray(secs) ? secs : []).forEach(function (s) {
            if (!s) return;
            out.push('s|' + s.type);
            (function walk(els) {
                (Array.isArray(els) ? els : []).forEach(function (e) {
                    if (!e) return;
                    out.push('e|' + e.type);
                    var cols = (e.content || {}).columns;
                    if (Array.isArray(cols)) cols.forEach(function (c) { walk(c && c.elements); });
                });
            })(s.elements);
        });
        return out.sort().join('\n');
    }

    /* The one function that changes the tree.

       Refuses first, moves second, and then checks its own work against
       the sanitiser, which is the thing that decides what the renderer
       will accept. The check is not "the tree is clean" -- a draft that
       arrived by hand or by import may already contain something the
       sanitiser drops, and freezing every drag because of it would be
       both useless and confusing, since the move buttons beside the
       handle would still work. The check is narrower and exactly the
       question a move raises: DID THIS MOVE MAKE THE SANITISER THROW
       SOMETHING AWAY THAT IT WAS KEEPING BEFORE? If so, the move created
       a structure the schema does not allow and it is put back.

       Runs once, on drop. Never while the pointer moves. */
    function pbCommitMove(drag, target) {
        if (!pbDropOk(drag, target)) return false;
        var at = pbDragItem(drag);
        var to = pbListAt(target.addr);
        var i = at.index, from = at.list, item = at.node;
        var want = Math.max(0, Math.min(Math.floor(target.index), to.length));
        /* Dropping something back where it already is is not a change, so
           it is not a save and not a dirty draft either. */
        if (from === to && (want === i || want === i + 1)) return false;

        var kept = pbSurvivors(CMS.sections.sanitize(pbDraft));

        from.splice(i, 1);
        var put = (from === to && want > i) ? want - 1 : want;
        to.splice(put, 0, item);

        if (pbSurvivors(CMS.sections.sanitize(pbDraft)) !== kept) {
            to.splice(put, 1);
            from.splice(i, 0, item);
            return false;
        }
        return true;
    }

    /* ---------- the pointer layer ---------- */

    var PB_DRAG_BOX  = { section: '#pbList', element: '.pb-els', column: '.pb-cols' };
    var PB_DRAG_ITEM = { section: '.pb-sec', element: '.pb-elcard', column: '.pb-col' };
    var PB_DRAG_WORD = { section: 'section', element: 'element', column: 'column' };

    /* The DOM half of an address. Nothing is read from it that is not
       fed straight back through pbListAt(). */
    function pbAddrOfBox(node) {
        if (!node || !node.getAttribute) return null;
        if (node.id === 'pbList') return { kind: 'section' };
        if (node.classList.contains('pb-els')) {
            var el = node.getAttribute('data-list-el') || '';
            return { kind: 'element',
                     sec: node.getAttribute('data-list-sec') || '',
                     el:  el,
                     col: el ? parseInt(node.getAttribute('data-list-col'), 10) : -1 };
        }
        if (node.classList.contains('pb-cols')) {
            return { kind: 'column',
                     sec: node.getAttribute('data-cols-sec') || '',
                     el:  node.getAttribute('data-cols-el') || '' };
        }
        return null;
    }

    var pbDrag = null;      /* the live drag, or null -- there is only ever one */
    var pbDragLine = null;  /* the single drop indicator, reused */

    function pbLine() {
        if (!pbDragLine || !pbDragLine.parentNode) {
            pbDragLine = document.createElement('div');
            pbDragLine.className = 'pb-dropline';
            pbDragLine.id = 'pbDropLine';
            pbDragLine.setAttribute('aria-hidden', 'true');
            document.body.appendChild(pbDragLine);
        }
        return pbDragLine;
    }

    /* Said out loud, for anyone not watching the indicator. */
    function pbSay(msg) {
        var el = $('#pbDragStatus');
        if (el) el.textContent = msg || '';
    }

    var PB_HANDLE_LABEL = { section: 'Drag section', element: 'Drag element', column: 'Drag column' };

    function pbHandle(kind) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pb-handle';
        b.setAttribute('data-pb-drag', kind);
        b.setAttribute('aria-label', PB_HANDLE_LABEL[kind]);
        b.title = PB_HANDLE_LABEL[kind] + ' — or use the move buttons, which work from the keyboard';
        b.innerHTML = '<i class="fas fa-grip-vertical"></i>';
        b.addEventListener('pointerdown', pbDragDown);
        /* The handle is a real button so it can be tabbed to, but pressing
           it does nothing: reordering from the keyboard is the move
           buttons' job, and two ways to do it from one control is how
           people end up with neither working. */
        b.addEventListener('click', function (e) { e.preventDefault(); });
        return b;
    }

    function pbDragDown(e) {
        if (pbDrag) return;
        /* Touch is NOT a drag here. The section list is the thing the
           finger scrolls, and taking the gesture away from scrolling to
           give it to reordering trades a control people need constantly
           for one they need occasionally. Touch reorders with the move
           buttons, which are on every row. */
        if (e.pointerType === 'touch') return;
        if (!e.isPrimary || (e.button !== 0 && e.button !== -1)) return;

        var handle = e.currentTarget;
        var kind = handle.getAttribute('data-pb-drag');
        if (!PB_DRAG_ITEM[kind]) return;
        var item = handle.closest(PB_DRAG_ITEM[kind]);
        var box = item && item.parentNode && item.parentNode.closest
            ? item.parentNode.closest(PB_DRAG_BOX[kind]) : null;
        var addr = pbAddrOfBox(box);
        if (!addr || addr.kind !== kind) return;

        var drag = { kind: kind, addr: addr, node: item, box: box, handle: handle,
                     pointerId: e.pointerId, x: e.clientX, y: e.clientY,
                     live: false, target: null };
        if (kind === 'column') drag.index = parseInt(item.getAttribute('data-col'), 10);
        else drag.id = item.getAttribute(kind === 'section' ? 'data-sec-id' : 'data-el-id');

        var at = pbDragItem(drag);
        if (!at) return;
        /* Noted so a tree that changes under the drag can be detected
           rather than acted on. */
        drag.ref = at.node;
        pbDrag = drag;

        e.preventDefault();
        try { handle.setPointerCapture(e.pointerId); } catch (err) { /* not fatal */ }
        document.addEventListener('pointermove', pbDragMove, true);
        document.addEventListener('pointerup', pbDragUp, true);
        document.addEventListener('pointercancel', pbDragBail, true);
        document.addEventListener('keydown', pbDragKey, true);
        /* Deliberately not capturing: with capture this would also fire
           for an inner element losing focus, and a drag begun while a
           text box was focused would cancel itself. */
        window.addEventListener('blur', pbDragBail);
    }

    function pbDragMove(e) {
        if (!pbDrag) return;
        if (!pbDrag.live) {
            /* A few pixels of slop, so a click on the handle is a click. */
            if (Math.abs(e.clientX - pbDrag.x) + Math.abs(e.clientY - pbDrag.y) < 5) return;
            pbDrag.live = true;
            document.body.classList.add('pb-dragging');
            pbDrag.node.classList.add('pb-drag-src');
            pbSay('Moving this ' + PB_DRAG_WORD[pbDrag.kind] + '. Escape cancels.');
        }
        e.preventDefault();
        /* A list taller than the window would otherwise be a trap: you can
           pick a row up at the bottom and have nowhere to put it. Scrolling
           is tied to the pointer MOVING rather than to a timer, so a still
           hand never drifts. */
        var edge = 48;
        if (e.clientY < edge) window.scrollBy(0, -Math.min(24, edge - e.clientY));
        else if (e.clientY > window.innerHeight - edge)
            window.scrollBy(0, Math.min(24, e.clientY - (window.innerHeight - edge)));
        pbDragAim(e.clientX, e.clientY);
    }

    /* Everything that happens per pointermove happens here, and all of it
       is reading rectangles and moving ONE absolutely positioned line.
       No part of the page is rebuilt and no part of the tree is touched
       until the pointer comes up. */
    function pbDragAim(x, y) {
        var under = document.elementFromPoint(x, y);
        var box = under && under.closest ? under.closest(PB_DRAG_BOX[pbDrag.kind]) : null;
        var target = null;
        if (box) {
            var items = box.querySelectorAll(':scope > ' + PB_DRAG_ITEM[pbDrag.kind]);
            var at = items.length, i, r;
            for (i = 0; i < items.length; i++) {
                r = items[i].getBoundingClientRect();
                if (y < r.top + r.height / 2) { at = i; break; }
            }
            target = { kind: pbDrag.kind, addr: pbAddrOfBox(box), index: at, box: box, items: items };
        }
        var ok = !!(target && pbDropOk(pbDrag, target));
        pbDrag.target = ok ? target : null;
        pbDragPaint(target, ok);
    }

    function pbDragPaint(target, ok) {
        var line = pbLine();
        if (!target) {
            line.style.display = 'none';
            line.removeAttribute('data-ok');
            return;
        }
        var items = target.items, bx = target.box.getBoundingClientRect(), top;
        if (!items.length) {
            top = bx.top + 4;
        } else if (target.index >= items.length) {
            top = items[items.length - 1].getBoundingClientRect().bottom;
        } else {
            top = items[target.index].getBoundingClientRect().top;
        }
        line.style.display = 'block';
        line.style.left = bx.left + 'px';
        line.style.width = Math.max(8, bx.width) + 'px';
        line.style.top = (top - 1) + 'px';
        line.className = 'pb-dropline' + (ok ? '' : ' bad');
        line.setAttribute('data-ok', ok ? '1' : '0');
    }

    function pbDragUp() {
        if (!pbDrag) return;
        var drag = pbDrag, target = drag.target, live = drag.live;
        pbDragEnd();
        if (!live) return;                       /* a click on the handle, not a drag */
        if (!target) { pbSay('Not a place this can go. Nothing changed.'); return; }
        if (!pbCommitMove(drag, target)) { pbSay('Nothing moved.'); return; }
        pbPersist();
        buildBuilder();
        pbSay('Moved the ' + PB_DRAG_WORD[drag.kind] + '.');
    }

    function pbDragKey(e) {
        if (!pbDrag || e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        pbDragCancel();
    }

    function pbDragBail() { pbDragCancel(); }

    /* Ends the gesture. Touches no data, on purpose: a cancelled drag and
       a drag that never started have to be indistinguishable in the
       draft, because to the author they are the same thing. */
    function pbDragEnd() {
        var d = pbDrag;
        if (!d) return;
        pbDrag = null;
        document.removeEventListener('pointermove', pbDragMove, true);
        document.removeEventListener('pointerup', pbDragUp, true);
        document.removeEventListener('pointercancel', pbDragBail, true);
        document.removeEventListener('keydown', pbDragKey, true);
        window.removeEventListener('blur', pbDragBail);
        try { d.handle.releasePointerCapture(d.pointerId); } catch (err) { /* already gone */ }
        if (d.node) d.node.classList.remove('pb-drag-src');
        document.body.classList.remove('pb-dragging');
        if (pbDragLine) { pbDragLine.style.display = 'none'; pbDragLine.removeAttribute('data-ok'); }
    }

    function pbDragCancel() {
        if (!pbDrag) return false;
        var live = pbDrag.live;
        pbDragEnd();
        if (live) pbSay('Move cancelled. Nothing changed.');
        return true;
    }

    /* ---------- keyboard reordering ----------

       Drag is never the only way to move something. The move buttons on
       every row do the same reorder through the same save path, and the
       only thing that needed fixing for them was focus: the list is
       rebuilt after a move, so the button that was pressed no longer
       exists. Focus follows the NODE to its new row, and falls back to
       the opposite button when the one that was used has just become
       disabled at the end of the list. */

    var pbFocusWish = null;

    /* Deferred by one turn on purpose. A move rebuilds a list, and the
       lists nest: rebuilding a section's elements rebuilds the columns
       inside them, each of which finishes before the card that holds it
       is attached. Anything that looked for the moved node DURING that
       would look for it while it is still in pieces. */
    function pbWishFocus(fn) {
        pbFocusWish = fn;
        setTimeout(pbTakeFocus, 0);
    }

    function pbTakeFocus() {
        var fn = pbFocusWish;
        pbFocusWish = null;
        if (!fn) return;
        var n = null;
        try { n = fn(); } catch (e) { n = null; }
        if (n && !n.disabled) { try { n.focus(); } catch (e) { /* detached */ } }
    }

    /* Ids can be anything an imported draft put there, so they are matched
       by comparison rather than interpolated into a selector. */
    function pbNodeFor(root, sel, attr, value) {
        var all = (root || document).querySelectorAll(sel), i;
        for (i = 0; i < all.length; i++) {
            if (all[i].getAttribute(attr) === value) return all[i];
        }
        return null;
    }

    /* acts are literals from this file, never user data. */
    function pbFocusIn(host, acts) {
        for (var i = 0; i < acts.length; i++) {
            var n = host.querySelector('[data-act="' + acts[i] + '"]');
            if (n && !n.disabled) return n;
        }
        return null;
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
       RECOVERY (milestone C)
       ----------------------------------------------------------
       Two actions replace a draft outright: applying a template over it
       and discarding it. Both now take a snapshot first, and the banner
       below offers it back until it is used or dismissed.

       This is deliberately not an undo stack -- see the note in
       docs/page-builder.md. One snapshot per page, sections only.
       ========================================================== */

    function pbSnapshot(reason) {
        if (!pbDraft.length) return;
        CMS.sections.recovery.snapshot(pbSlug, pbDraft, reason);
    }

    var PB_RECOVERY_WORDS = {
        template: 'before you applied a template',
        discard: 'before you discarded the draft',
        replace: 'before the draft was replaced'
    };

    function pbPaintRecovery() {
        var host = $('#pbRecovery');
        if (!host) return;
        host.innerHTML = '';
        var snap = CMS.sections.recovery.get(pbSlug);
        if (!snap) { host.hidden = true; return; }
        host.hidden = false;

        var msg = document.createElement('span');
        msg.className = 'pb-recovery-msg';
        msg.innerHTML = '<i class="fas fa-clock-rotate-left"></i> ' +
            'The previous draft for this page was kept \u2014 ' +
            esc(snap.sections.length) + ' section' + (snap.sections.length === 1 ? '' : 's') +
            ', saved ' + esc(PB_RECOVERY_WORDS[snap.reason] || PB_RECOVERY_WORDS.replace) + '.';
        host.appendChild(msg);

        var restore = document.createElement('button');
        restore.type = 'button';
        restore.className = 'adm-btn';
        restore.setAttribute('data-act', 'recover-restore');
        restore.innerHTML = '<i class="fas fa-rotate-left"></i> Restore it';
        restore.addEventListener('click', function () {
            if (pbDraft.length && !window.confirm(
                    'Put the previous draft back? What is in the builder now will be replaced.\n\n' +
                    'The live page is not affected until you publish.')) return;
            /* Swapped, not dropped: whatever is being replaced becomes the
               snapshot, so Restore is itself reversible. */
            var current = pbDraft.slice();
            pbDraft.length = 0;
            snap.sections.forEach(function (x) { pbDraft.push(x); });
            pbOpen = null;
            if (current.length) CMS.sections.recovery.snapshot(pbSlug, current, 'replace');
            else CMS.sections.recovery.clear(pbSlug);
            pbPersist();
            buildBuilder();
            toast('Previous draft restored. Nothing is published yet.');
        });
        host.appendChild(restore);

        var drop = document.createElement('button');
        drop.type = 'button';
        drop.className = 'adm-btn ghost';
        drop.setAttribute('data-act', 'recover-discard');
        drop.innerHTML = 'Discard it';
        drop.addEventListener('click', function () {
            if (!window.confirm('Forget the kept draft? This cannot be undone.')) return;
            CMS.sections.recovery.clear(pbSlug);
            commit(true);
            pbPaintRecovery();
            toast('Kept draft discarded.');
        });
        host.appendChild(drop);
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
        /* Kept before it is overwritten, so the confirmation is not the only
           thing standing between an author and their work. */
        pbSnapshot('template');
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
            if (s === pbSlug) b.setAttribute('aria-current', 'page');
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

        /* A full rebuild may be a different page, so the two cards that
           skip their own repaint when nothing changed are told to forget
           what they last said. */
        pbHeadSig = null;
        pbWhereSig = null;

        pbPaintState();
        pbPaintSaveState();
        pbPaintMigrate();
        pbPaintRecovery();
        pbPaintTemplates();
        pbPaintAdd();
        pbPaintList();
        pbPaintHeadings();
        pbPaintLibrary();
        pbPaintDevices();
        pbPaintPreview();
        pbFitPreview();
    }

    /* A disabled button that does not say why is just a button that looks
       broken, so each one carries its own reason. */
    function pbDisable(sel, off, why, ready) {
        var b = $(sel);
        if (!b) return;
        b.disabled = !!off;
        b.title = off ? why : (ready || '');
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
        el.setAttribute('data-state', cls);

        pbDisable('#pbPublish', !pbDraft.length,
            'There are no sections to publish yet.',
            st.dirty || !st.live ? 'Put this draft on the live page.'
                                 : 'Publish again — the live page already matches this draft.');
        pbDisable('#pbDiscard', !CMS.sections.dirty(pbSlug),
            'This draft already matches what is published — there is nothing to discard.',
            'Throw the draft away and start again from what is published.');
        pbDisable('#pbUnpublish', !st.live,
            'Nothing is published for this page.',
            'Take these sections off the live page. The draft is kept.');

        var open = $('#pbOpen');
        if (page.url) { open.href = '../' + page.url; open.hidden = false; }
        else { open.hidden = true; }

        pbPaintWhere(page);
    }

    /* ---------- which page am I editing? (milestone E) ----------
       The tabs said it, but only by being the highlighted one, and the
       tab strip scrolls. The answer is written out in full instead, from
       the same pages entry every other panel reads. */
    /* ----------------------------------------------------------
       MOVE THE SHIPPED PAGE COPY INTO THE BUILDER

       An informational page's copy lives in pages.<slug>.body and renders
       above the mount. This offers to bring it across as sections, once,
       so the builder becomes the source of truth for that page.

       It is offered ONLY when there is something to move and nothing to
       lose: the page has body copy and no builder block at all. Once a
       builder exists -- draft or published -- the offer is gone, because
       running it then would overwrite work.

       It says plainly what the conversion costs before it runs, and it
       does not delete pages.<slug>.body. Unpublishing brings the original
       copy straight back.
    ---------------------------------------------------------- */
    function pbCanMigrate() {
        if (!pbSlug) return false;
        /* draft() always hands back a block and live() always an array --
           neither is ever null -- so the question is whether either holds
           anything, not whether it exists. Testing the objects themselves
           made this always false, and the offer never appeared. */
        var draft = CMS.sections.draft(pbSlug);
        if (draft && draft.sections && draft.sections.length) return false;
        if (CMS.sections.live(pbSlug).length) return false;
        /* And nothing published, not even an empty canvas: that is a
           deliberate state and must not be overwritten by an offer. */
        var page = CMS.data().pages[pbSlug] || {};
        if (page.builder) return false;
        /* Finally, there has to be copy worth moving. */
        return CMS.sections.fromPageBody(pbSlug).length > 0;
    }

    function pbPaintMigrate() {
        var host = $('#pbMigrate');
        if (!host) return;
        if (!pbCanMigrate()) { host.hidden = true; host.innerHTML = ''; return; }

        var preview = CMS.sections.fromPageBody(pbSlug);
        var n = (preview[0] && preview[0].elements || []).length;

        host.hidden = false;
        host.innerHTML = '';

        var msg = document.createElement('p');
        msg.className = 'pb-migrate-msg';
        msg.textContent = 'This page still shows the copy it shipped with. ' +
            'Move it into the builder as ' + n +
            (n === 1 ? ' element' : ' elements') +
            ' and the builder takes over the page body.';
        host.appendChild(msg);

        var warn = document.createElement('p');
        warn.className = 'pb-migrate-warn';
        warn.textContent = 'Headings and paragraphs come across as text. ' +
            'Links inside a paragraph do not — they become plain words, ' +
            'and you can add them back as buttons or link elements. ' +
            'The original copy is kept and returns if you unpublish.';
        host.appendChild(warn);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'adm-btn ghost';
        btn.id = 'pbMigrateBtn';
        btn.innerHTML = '<i class="fas fa-down-left-and-up-right-to-center"></i> ' +
                        'Move page copy into the builder';
        btn.addEventListener('click', function () {
            if (!pbCanMigrate()) return;
            var sections = CMS.sections.fromPageBody(pbSlug);
            if (!sections.length) { toast('There was no copy to move.', true); return; }
            /* Snapshotted first, like every other action that replaces the
               draft wholesale. */
            pbSnapshot('migrate');
            pbDraft.length = 0;
            sections.forEach(function (x) { pbDraft.push(x); });
            pbOpen = null;
            pbPersist();
            buildBuilder();
            /* A DRAFT. Nothing on the live page changes until Publish, the
               same as every other edit in this panel. */
            toast('Page copy moved into the builder as a draft. ' +
                  'Review it, then Publish.');
        });
        host.appendChild(btn);
    }

    var pbWhereSig = null;

    function pbPaintWhere(page) {
        var el = $('#pbWhere');
        if (!el) return;
        page = page || CMS.data().pages[pbSlug] || {};
        var n = pbCountAll(pbDraft);
        /* Rebuilt only when what it says would differ. This runs from
           pbPaintPreview(), which every keystroke goes through. */
        var sig = pbSlug + '|' + (page.label || '') + '|' + (page.url || '') +
                  '|' + pbDraft.length + '|' + n;
        if (sig === pbWhereSig) return;
        pbWhereSig = sig;
        el.innerHTML = '';
        var lab = document.createElement('strong');
        lab.textContent = page.label || pbSlug || '—';
        el.appendChild(lab);
        if (page.url) {
            var url = document.createElement('span');
            url.className = 'pb-where-url';
            url.textContent = '/' + page.url;
            el.appendChild(url);
        }
        var sum = document.createElement('span');
        sum.className = 'pb-where-sum';
        sum.textContent = pbDraft.length + (pbDraft.length === 1 ? ' section' : ' sections') +
            ', ' + n + (n === 1 ? ' element' : ' elements');
        el.appendChild(sum);
    }

    function pbCountAll(sections) {
        var n = 0;
        (sections || []).forEach(function (sec) {
            (function walk(list) {
                (list || []).forEach(function (e) {
                    n += 1;
                    var cols = (e.content || {}).columns;
                    if (cols && cols.length) cols.forEach(function (c) { walk(c && c.elements); });
                });
            })(sec && sec.elements);
        });
        return n;
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
            head.appendChild(pbHandle('section'));

            var expand = document.createElement('button');
            expand.type = 'button';
            expand.className = 'pb-sec-title';
            expand.setAttribute('aria-expanded', pbOpen === sec.id ? 'true' : 'false');
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

    /* ==========================================================
       HEADINGS AND THE PAGE H1  (milestone E)
       ----------------------------------------------------------
       Every page the builder can mount ships its own
       <h1 data-cms-text="pages.<slug>.heading"> ABOVE the mount, so the
       sections in this draft are never the page's first heading. That is
       a fact about the HTML, and it is the one thing an author cannot
       see from inside the builder.

       So it is said out loud, and when the draft adds an h1 of its own
       the cost is said out loud too -- with the author's own heading
       text, so there is no guessing which one is meant.

       Nothing here rewrites anything. A heading only changes level when
       someone presses the button that says it will, and that change goes
       through the same save path as any other edit. The renderer still
       honours h1; this is the admin telling the truth about what that
       does, not the schema taking the choice away.
       ========================================================== */

    function pbFindEl(id) {
        var hit = null;
        if (typeof id !== 'string' || !id) return null;
        (pbDraft || []).forEach(function (sec) {
            (function walk(list) {
                (list || []).forEach(function (e) {
                    if (!e) return;
                    if (e.id === id) hit = e;          /* compared, never indexed */
                    var cols = (e.content || {}).columns;
                    if (cols && cols.length) cols.forEach(function (c) { walk(c && c.elements); });
                });
            })(sec && sec.elements);
        });
        return hit;
    }

    function pbDemote(ids) {
        var changed = 0;
        ids.forEach(function (id) {
            var el = pbFindEl(id);
            if (!el || el.type !== 'heading') return;
            if (!el.content) el.content = {};
            if (String(el.content.level || '').toLowerCase() !== 'h1') return;
            el.content.level = 'h2';
            changed += 1;
        });
        if (!changed) return;
        pbPersist();
        buildBuilder();
        toast(changed === 1 ? 'That heading is now an H2.'
                            : changed + ' headings are now H2.');
    }

    /* Called from pbPaintPreview(), which every edit and every structural
       change already goes through. The signature keeps it free when the
       headings have not moved: typing in a paragraph should not rebuild
       this card on every keystroke. */
    var pbHeadSig = null;

    function pbHeadingsMaybe() {
        var page = CMS.data().pages[pbSlug] || {};
        var o = CMS.sections.outline(pbDraft);
        var sig = pbSlug + '|' + String(page.heading || '') + '|' +
            o.items.map(function (i) { return i.level + ':' + i.id + ':' + i.text; }).join('~');
        if (sig === pbHeadSig) return;
        pbHeadSig = sig;
        pbPaintHeadings();
    }

    function pbPaintHeadings() {
        var host = $('#pbHeadings');
        if (!host) return;
        host.innerHTML = '';

        var page = CMS.data().pages[pbSlug] || {};
        var mounted = !!(CMS.sections.mounted[pbSlug] || page.builderMount);
        var outline = CMS.sections.outline(pbDraft);
        var ones = outline.items.filter(function (i) { return i.level === 'h1'; });

        /* 1. where the visible H1 comes from */
        var where = document.createElement('p');
        where.className = 'hint';
        if (!mounted) {
            where.textContent = 'This page has no builder mount in its HTML, so nothing here reaches it.';
        } else if (String(page.heading || '').trim()) {
            where.innerHTML = 'The page\u2019s main heading is <strong>' +
                esc(String(page.heading).trim()) + '</strong>. It is set in ' +
                '<strong>Pages \u203a H1 heading</strong> and is written above these sections, ' +
                'so the builder is not what controls it.';
        } else {
            where.innerHTML = '<strong>Pages \u203a H1 heading</strong> is empty for this page, ' +
                'so its H1 renders blank. Set it there \u2014 the builder cannot supply it.';
        }
        host.appendChild(where);

        /* 2. what this draft adds */
        var box = document.createElement('p');
        if (!ones.length) {
            box.className = 'pb-h1note ok';
            box.textContent = outline.items.length
                ? 'No section heading is set to H1, so this page has exactly one.'
                : 'This draft has no headings yet.';
            host.appendChild(box);
            return;
        }

        box.className = 'pb-h1note warn';
        box.innerHTML = '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ' +
            (ones.length === 1
                ? 'One heading in this draft is set to <strong>H1</strong>.'
                : ones.length + ' headings in this draft are set to <strong>H1</strong>.') +
            ' The page would then show ' + (mounted ? ones.length + 1 : ones.length) +
            ' in total. Search engines expect one, and it is already set in Pages.';
        host.appendChild(box);

        var list = document.createElement('div');
        list.className = 'pb-h1list';
        ones.forEach(function (it) {
            var row = document.createElement('div');
            row.className = 'pb-h1row';
            row.setAttribute('data-h1-id', it.id);
            var name = document.createElement('span');
            name.className = 'pb-h1text';
            name.textContent = it.text || '(no text)';
            row.appendChild(name);
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'adm-btn ghost';
            b.setAttribute('data-act', 'h1-demote');
            b.textContent = 'Make it H2';
            b.addEventListener('click', function () { pbDemote([it.id]); });
            row.appendChild(b);
            list.appendChild(row);
        });
        host.appendChild(list);

        if (ones.length > 1) {
            var all = document.createElement('button');
            all.type = 'button';
            all.className = 'adm-btn ghost';
            all.setAttribute('data-act', 'h1-demote-all');
            all.textContent = 'Make them all H2';
            all.addEventListener('click', function () {
                pbDemote(ones.map(function (i) { return i.id; }));
            });
            host.appendChild(all);
        }

        var keep = document.createElement('p');
        keep.className = 'hint';
        keep.textContent = 'Nothing changes unless you press one of these. ' +
            'An H1 in a section is allowed \u2014 this only says what it costs.';
        host.appendChild(keep);
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
                pbElementList(body, sec.elements, 0, { sec: sec.id, el: '', col: -1 });
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
        image:   [['src', 'Image', 'asset'], ['alt', 'Alt text', 'text'],
                  ['width', 'Width (px)', 'num'], ['height', 'Height (px)', 'num'],
                  ['href', 'Links to', 'url'], ['newTab', 'Open in a new tab', 'bool']],
        button:  [['text', 'Label', 'text'], ['href', 'Links to', 'url'],
                  ['newTab', 'Open in a new tab', 'bool']],
        card:    [['title', 'Title', 'text'], ['text', 'Text', 'area'],
                  ['image', 'Image', 'asset'], ['imageAlt', 'Image alt', 'text'],
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
                  ['image', 'Image (used when no icon)', 'asset'],
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
    /* Where an asset's real dimensions go, per element type. A type absent
       here has nowhere to put them, so they are simply not written. */
    var PB_ASSET_DIMS = {
        image: ['width', 'height'],
        card:  ['imageWidth', 'imageHeight']
    };

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
        /* Something is typed and not yet written. Said plainly rather than
           left to look identical to saved. */
        if (pbSaveState !== 'failed') pbSetSaveState('unsaved');
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

    /* ==========================================================
       ASSET PICKER (milestone B)
       ----------------------------------------------------------
       The list comes from assets/asset-manifest.json, a file generated
       from what is actually in the repository
       (tools/build-asset-manifest.js). It is fetched once, lazily, and
       rebuilt by CMS.sections.assetList() before anything is shown --
       so an entry whose path is not one of ours never reaches the grid,
       whatever the file says.

       Nothing is uploaded and nothing is encoded: choosing an image
       stores its path. Dimensions come from the manifest when the
       generator could read them from the file's own header, and are
       simply absent when it could not.
       ========================================================== */

    var pbAssets = null;        /* null = not fetched yet */
    var pbAssetsError = '';
    var pbAssetPending = null;  /* the promise, so two opens share one fetch */

    function pbLoadAssets() {
        if (pbAssets) return Promise.resolve(pbAssets);
        if (pbAssetPending) return pbAssetPending;
        pbAssetPending = fetch('../assets/asset-manifest.json', { cache: 'no-cache' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (raw) {
                pbAssets = CMS.sections.assetList(raw);
                pbAssetsError = '';
                pbAssetPending = null;
                return pbAssets;
            })
            .catch(function (e) {
                pbAssetsError = 'The image list could not be loaded (' + e.message + ').';
                pbAssets = [];
                pbAssetPending = null;
                return pbAssets;
            });
        return pbAssetPending;
    }

    function pbAssetByPath(path) {
        var p = CMS.sections.assetPath(path);
        if (!p || !pbAssets) return null;
        for (var i = 0; i < pbAssets.length; i++) {
            if (pbAssets[i].path === p) return pbAssets[i];
        }
        return null;
    }

    /* ---------- uploaded CMS media in the picker ----------
       The two tabs answer two different questions and are kept apart all
       the way down: a repository asset is a path under assets/ validated
       by CMS.sections.assetPath, an uploaded image is a URL in this site's
       own bucket validated by CMS.sections.mediaPath. Neither validator
       will ever accept the other's input, and nothing in this file widens
       either of them. What the picker HANDS BACK is the same shape in both
       cases -- a `path` the image field can store -- because everything
       downstream, cms.js included, re-validates it anyway. */
    function pbMediaItems() {
        if (!window.CMSMedia) return [];
        try { return window.CMSMedia.list(); } catch (e) { return []; }
    }

    function pbMediaByUrl(url) {
        var u = CMS.sections.mediaPath ? CMS.sections.mediaPath(url) : '';
        if (!u) return null;
        var items = pbMediaItems();
        for (var i = 0; i < items.length; i++) if (items[i].url === u) return items[i];
        return null;
    }

    /* Either kind, whichever one this reference is. */
    function pbPickedByRef(ref) {
        var a = pbAssetByPath(ref);
        if (a) return a;
        var m = pbMediaByUrl(ref);
        if (!m) return null;
        return { path: m.url, name: m.name, group: 'Uploaded',
                 w: m.w, h: m.h, bytes: m.bytes, alt: m.alt, uploaded: true };
    }

    /* The admin lives one folder down, so a repository path needs the step
       up; an uploaded image is already an absolute URL and must not get
       one. */
    function pbThumbSrc(ref) {
        return /^https:\/\//i.test(ref) ? ref : '../' + ref;
    }

    function pbAssetTabs() {
        return Array.prototype.slice.call(document.querySelectorAll('#pbAssetTabs .pagetab'));
    }

    function pbKb(n) { return n ? Math.max(1, Math.round(n / 1024)) + ' KB' : ''; }

    /* The picker is modal and resolves through a callback: it either hands
       back a chosen asset or it hands back nothing, and "nothing" must
       leave whatever was there alone. */
    var pbAssetState = { open: false, current: '', selected: '', onPick: null,
                         wired: false, tab: 'repo', busy: false, note: '' };

    function pbAssetOpen(currentPath, onPick) {
        var modal = $('#pbAssetModal');
        if (!modal) return;
        pbAssetWire();
        pbAssetState.open = true;
        pbAssetState.current = CMS.sections.imageRef(currentPath) || '';
        /* Open on the tab the current image actually came from. */
        pbAssetState.tab = (pbAssetState.current && CMS.sections.mediaPath(pbAssetState.current))
            ? 'media' : 'repo';
        pbAssetState.note = '';
        /* Reopening keeps the image the element is already using selected,
           so the picker opens on what the author last chose. */
        pbAssetState.selected = pbAssetState.current;
        pbAssetState.onPick = onPick;
        var search = $('#pbAssetSearch');
        if (search) search.value = '';
        modal.hidden = false;
        pbAssetPaint();
        pbLoadAssets().then(function () { if (pbAssetState.open) pbAssetPaint(); });
    }

    function pbAssetClose() {
        var modal = $('#pbAssetModal');
        pbAssetState.open = false;
        pbAssetState.onPick = null;
        if (modal) modal.hidden = true;
    }

    function pbAssetPaint() {
        var grid = $('#pbAssetGrid');
        if (!grid) return;
        grid.innerHTML = '';

        var chosen = $('#pbAssetChosen');
        var use = $('#pbAssetUse');
        if (use) use.disabled = !pbAssetState.selected;
        if (chosen) {
            chosen.textContent = pbAssetState.selected
                ? 'Selected: ' + pbAssetState.selected
                : (pbAssetState.current ? 'Currently using: ' + pbAssetState.current : '');
        }

        pbAssetTabs().forEach(function (t) {
            var on = t.getAttribute('data-assettab') === pbAssetState.tab;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
        });

        var hint = $('#pbAssetHint');
        var upRow = $('#pbAssetUpload');
        if (pbAssetState.tab === 'media') {
            if (hint) {
                hint.innerHTML = 'Pictures uploaded in <strong>Media Library</strong>. They live in ' +
                    'this site&rsquo;s own storage, not in the repository.';
            }
            if (upRow) upRow.hidden = false;
            pbAssetPaintMedia(grid);
            return;
        }
        if (hint) {
            hint.textContent = 'Images already published with this site. Nothing is uploaded — ' +
                'choosing one stores its path, not the picture.';
        }
        if (upRow) upRow.hidden = true;

        if (pbAssets === null) {
            grid.innerHTML = '<p class="pb-asset-empty">Loading images\u2026</p>';
            return;
        }
        if (pbAssetsError) {
            grid.innerHTML = '<p class="pb-asset-empty">' + esc(pbAssetsError) +
                ' You can still type a path into the field.</p>';
            return;
        }

        var q = String(($('#pbAssetSearch') || {}).value || '').trim().toLowerCase();
        var shown = 0;
        pbAssets.forEach(function (a) {
            if (q && (a.name + ' ' + a.group + ' ' + a.path).toLowerCase().indexOf(q) === -1) return;
            shown += 1;
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pb-asset' + (a.path === pbAssetState.selected ? ' selected' : '');
            b.setAttribute('data-asset', a.path);
            if (a.path === pbAssetState.selected) b.setAttribute('aria-pressed', 'true');

            var thumb = document.createElement('span');
            thumb.className = 'pb-asset-thumb';
            var img = document.createElement('img');
            /* The admin lives one folder down, so its own preview needs the
               step up; what gets STORED is always the plain path. */
            img.src = '../' + a.path;
            img.alt = '';
            img.loading = 'lazy';
            img.decoding = 'async';
            thumb.appendChild(img);
            b.appendChild(thumb);

            var name = document.createElement('span');
            name.className = 'pb-asset-name';
            name.textContent = a.name;
            b.appendChild(name);

            var meta = document.createElement('span');
            meta.className = 'pb-asset-meta';
            meta.textContent = (a.w ? a.w + '\u00d7' + a.h : 'size unknown') +
                               (a.bytes ? ' \u00b7 ' + pbKb(a.bytes) : '');
            b.appendChild(meta);

            b.addEventListener('click', function () {
                pbAssetState.selected = a.path;
                pbAssetPaint();
            });
            b.addEventListener('dblclick', function () { pbAssetConfirm(); });
            grid.appendChild(b);
        });

        if (!shown) {
            grid.innerHTML = '<p class="pb-asset-empty">' +
                (pbAssets.length ? 'No image matches that search.' : 'No images are listed.') +
                '</p>';
        }
    }

    function pbAssetPaintMedia(grid) {
        var note = document.createElement('p');
        note.className = 'pb-asset-empty';

        if (!window.CMSMedia || !window.CMSMedia.enabled()) {
            note.innerHTML = 'Uploads are not switched on for this site yet. A developer has to ' +
                'create the storage bucket &mdash; see <code>docs/media-library.md</code>. ' +
                'The <strong>Site images</strong> tab still works.';
            grid.appendChild(note);
            return;
        }

        var items = pbMediaItems();
        var q = String(($('#pbAssetSearch') || {}).value || '').trim().toLowerCase();
        var shown = 0;

        items.forEach(function (m) {
            if (q && (m.name + ' ' + m.key).toLowerCase().indexOf(q) === -1) return;
            shown += 1;
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pb-asset' + (m.url === pbAssetState.selected ? ' selected' : '');
            b.setAttribute('data-asset', m.url);
            if (m.url === pbAssetState.selected) b.setAttribute('aria-pressed', 'true');

            var thumb = document.createElement('span');
            thumb.className = 'pb-asset-thumb';
            var img = document.createElement('img');
            img.src = m.url;
            img.alt = '';
            img.loading = 'lazy';
            img.decoding = 'async';
            thumb.appendChild(img);
            b.appendChild(thumb);

            var name = document.createElement('span');
            name.className = 'pb-asset-name';
            name.textContent = m.name;
            b.appendChild(name);

            var meta = document.createElement('span');
            meta.className = 'pb-asset-meta';
            meta.textContent = (m.w ? m.w + '×' + m.h : 'size unknown') +
                               (m.bytes ? ' · ' + pbKb(m.bytes) : '');
            b.appendChild(meta);

            b.addEventListener('click', function () {
                pbAssetState.selected = m.url;
                pbAssetPaint();
            });
            b.addEventListener('dblclick', function () { pbAssetConfirm(); });
            grid.appendChild(b);
        });

        if (!shown) {
            note.innerHTML = items.length
                ? 'No uploaded image matches that search.'
                : 'Nothing uploaded yet. Use <strong>Upload image</strong> above, or the ' +
                  '<strong>Media Library</strong> panel.';
            grid.appendChild(note);
        }
    }

    function pbAssetUploadNote(msg, kind) {
        var n = $('#pbAssetUploadNote');
        if (n) n.innerHTML = msg ? '<span class="chk-' + (kind || 'ok') + '">' + msg + '</span>' : '';
    }

    /* Uploading from inside the picker is the same call the Media Library
       panel makes, so there is exactly one place that decides what may be
       uploaded. On success the new picture is selected, because that is
       obviously what the author was trying to do. */
    function pbAssetUploadFile(file) {
        if (!file || pbAssetState.busy || !window.CMSMedia) return;
        pbAssetState.busy = true;
        var btn = $('#pbAssetUploadBtn');
        if (btn) btn.disabled = true;
        pbAssetUploadNote('Checking ' + esc(file.name || '') + '…', 'warn');
        window.CMSMedia.upload(file, function (phase) {
            pbAssetUploadNote((phase === 'uploading' ? 'Uploading ' : 'Checking ') +
                              esc(file.name || '') + '…', 'warn');
        }).then(function (entry) {
            pbAssetState.busy = false;
            if (btn) btn.disabled = false;
            pbAssetState.selected = entry.url;
            pbAssetUploadNote('Uploaded. Press <strong>Use this image</strong>.', 'ok');
            pbAssetPaint();
            /* The bytes are in the bucket; the row that remembers them has
               to reach the server too, or another device will never see it. */
            commit();
        }).catch(function (err) {
            pbAssetState.busy = false;
            if (btn) btn.disabled = false;
            pbAssetUploadNote(esc(err.message), 'bad');
        });
    }

    function pbAssetConfirm() {
        var a = pbPickedByRef(pbAssetState.selected);
        var cb = pbAssetState.onPick;
        if (!a || !cb) { pbAssetClose(); return; }
        pbAssetClose();
        cb(a);
    }

    function pbAssetWire() {
        if (pbAssetState.wired) return;
        pbAssetState.wired = true;
        var modal = $('#pbAssetModal');
        if (!modal) return;
        var close = function () { pbAssetClose(); };
        [$('#pbAssetClose'), $('#pbAssetCancel')].forEach(function (b) {
            if (b) b.addEventListener('click', close);
        });
        /* Clicking the backdrop cancels, the same as Cancel does. */
        modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && pbAssetState.open) close();
        });
        var use = $('#pbAssetUse');
        if (use) use.addEventListener('click', pbAssetConfirm);
        var search = $('#pbAssetSearch');
        if (search) search.addEventListener('input', pbAssetPaint);

        pbAssetTabs().forEach(function (t) {
            t.addEventListener('click', function () {
                pbAssetState.tab = t.getAttribute('data-assettab') === 'media' ? 'media' : 'repo';
                pbAssetUploadNote('');
                pbAssetPaint();
                if (pbAssetState.tab === 'repo') pbLoadAssets().then(function () {
                    if (pbAssetState.open) pbAssetPaint();
                });
            });
        });

        var upBtn = $('#pbAssetUploadBtn'), upFile = $('#pbAssetUploadFile');
        if (upBtn && upFile) {
            upBtn.addEventListener('click', function () { upFile.click(); });
            upFile.addEventListener('change', function () {
                pbAssetUploadFile(upFile.files && upFile.files[0]);
                upFile.value = '';
            });
        }
    }

    /* The field: the existing text input, with a button beside it and a
       thumbnail of whatever is currently set. The text input stays because
       a page may already name an image the picker does not list, and that
       must remain editable. */
    function pbImagePickField(spec, bag, key, ctx) {
        var row = pbFieldFor([spec[0], spec[1], 'url'], bag, key, ctx);
        var input = row.querySelector('.pb-in');

        var strip = document.createElement('span');
        strip.className = 'pb-imgpick';

        var thumb = document.createElement('img');
        thumb.className = 'pb-imgpick-thumb';
        thumb.alt = '';
        thumb.loading = 'lazy';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'adm-btn ghost';
        btn.setAttribute('data-act', 'pick-asset');
        btn.innerHTML = '<i class="fas fa-images"></i> Choose image';

        var path = document.createElement('span');
        path.className = 'pb-imgpick-path';

        function sync() {
            var v = CMS.sections.imageRef(bag[key]);
            if (v) {
                thumb.src = pbThumbSrc(v);
                thumb.hidden = false;
                path.textContent = '';
            } else {
                thumb.hidden = true;
                path.textContent = bag[key] ? 'Not one of this site\u2019s images' : 'No image chosen';
            }
        }

        btn.addEventListener('click', function () {
            pbAssetOpen(bag[key], function (asset) {
                bag[key] = asset.path;
                if (input) input.value = asset.path;
                /* Real numbers from the manifest, never invented ones: an
                   asset whose header could not be read simply leaves the
                   dimension fields alone. */
                var dims = ctx && ctx.dimensionKeys;
                if (dims && asset.w && asset.h) {
                    bag[dims[0]] = asset.w;
                    bag[dims[1]] = asset.h;
                }
                sync();
                if (ctx && ctx.onChange) ctx.onChange(key, asset.path);
                pbEdited(false);
                if (ctx && ctx.repaint) ctx.repaint();
            });
        });

        if (input) {
            input.addEventListener('input', sync);
            input.addEventListener('change', sync);
        }
        strip.appendChild(btn);
        strip.appendChild(thumb);
        strip.appendChild(path);
        row.appendChild(strip);
        sync();
        return row;
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
        if (spec[2] === 'asset')        return pbImagePickField(spec, bag, key, ctx);
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
    /* ---------- responsive editing (milestone C) ----------

       The data model already stores only real overrides: a breakpoint that
       has not been given a value has no key, and the renderer's var()
       chain does the inheriting. What was missing was saying so. A tablet
       box looked empty whether it inherited 32px or the value simply was
       not set anywhere, and there was no way to take an override back
       other than selecting the text and deleting it.

       So each control on a narrower breakpoint now knows three things:
       what it would inherit, whether it is overriding that, and how to
       stop. Nothing about what gets STORED changed. */

    /* What this key resolves to at `device` if nothing overrides it here:
       mobile falls back to tablet, tablet to desktop. Mirrors the CSS. */
    function pbInheritedValue(node, device, key) {
        var r = node.responsive || {};
        if (device === 'mobile') {
            var t = (r.tablet || {})[key];
            if (t !== undefined && t !== '') return { value: t, from: 'Tablet' };
        }
        var b = (node.style || {})[key];
        if (b !== undefined && b !== '') return { value: b, from: 'Desktop' };
        return null;
    }

    /* Adds the inherited-or-overridden line to one control, and the reset
       that takes an override back to inheriting. Reuses the control the
       field already built -- it does not replace it, so every kind
       (colour, layout, border, shadow) keeps working unchanged. */
    function pbMarkInherited(row, node, device, key, bag, ctx, host, keys, labels, onLayout) {
        var line = document.createElement('em');
        line.className = 'pb-inherit-note';
        row.appendChild(line);

        var reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'pb-reset';
        reset.setAttribute('data-act', 'reset-override');
        reset.setAttribute('data-key', key);
        reset.title = 'Go back to the inherited value';
        reset.innerHTML = '<i class="fas fa-rotate-left"></i>';
        reset.addEventListener('click', function () {
            /* Deleting the key, not writing a duplicate: inheritance is the
               absence of a value, so that is what going back has to mean. */
            delete bag[key];
            pbPersist();
            if (ctx && ctx.onChange) ctx.onChange(key, '');
            /* A reset empties the control, so this one DOES rebuild -- there
               is no focus to protect and the box has to come back blank. */
            host.innerHTML = '';
            pbDesignEditor(host, node, keys, labels, onLayout);
            pbPaintPreview();
        });
        row.appendChild(reset);

        /* Recomputed on every edit rather than only at build time. Typing a
           tablet value has to turn the row from inherited into overriding
           there and then -- and it cannot do that by rebuilding the panel,
           because that would take the focus out of the box being typed in. */
        function sync() {
            var overridden = Object.prototype.hasOwnProperty.call(bag, key) &&
                             bag[key] !== '' && bag[key] != null;
            var inherited = pbInheritedValue(node, device, key);

            row.className = row.className.replace(/ pb-(inherited|overridden)/g, '') +
                            (overridden ? ' pb-overridden' : ' pb-inherited');
            row.setAttribute('data-state', overridden ? 'overridden' : 'inherited');

            if (overridden) {
                line.textContent = inherited
                    ? 'Overriding ' + inherited.from + ' (' + inherited.value + ')'
                    : 'Set for this screen only';
            } else {
                line.textContent = inherited
                    ? 'Inherited from ' + inherited.from + ' (' + inherited.value + ')'
                    : 'Not set anywhere';
            }
            line.setAttribute('data-inherit', overridden ? 'overridden' : 'inherited');
            reset.hidden = !overridden;

            /* An empty box says what it would be rather than nothing. */
            var input = row.querySelector('input.pb-in');
            if (input && input.type !== 'checkbox') {
                input.placeholder = (!overridden && inherited) ? String(inherited.value) : '';
            }
        }
        sync();
        return sync;
    }

    /* Refreshes the little count on each breakpoint tab without rebuilding
       the tabs, for the same focus reason as sync() above. */
    function pbPaintDeviceCounts(tabs, node) {
        if (!tabs) return;
        PB_DEVICES.forEach(function (d) {
            var b = tabs.querySelector('.pb-devtab[data-device="' + d[0] + '"]');
            if (!b) return;
            var old = b.querySelector('.pb-devtab-count');
            if (old) old.parentNode.removeChild(old);
            if (d[0] === 'base') return;
            var n = pbOverrideCount(node, d[0]);
            if (!n) return;
            var dot = document.createElement('em');
            dot.className = 'pb-devtab-count';
            dot.textContent = String(n);
            b.appendChild(dot);
        });
    }

    function pbOverrideCount(node, device) {
        var bag = ((node.responsive || {})[device]) || {};
        var n = 0;
        for (var k in bag) {
            if (Object.prototype.hasOwnProperty.call(bag, k) && bag[k] !== '' && bag[k] != null) n += 1;
        }
        return n;
    }

    function pbDesignEditor(host, node, keys, labels, onLayout) {
        var device = pbDevice[node.id] || 'base';

        var tabs = document.createElement('div');
        tabs.className = 'pb-devtabs';
        PB_DEVICES.forEach(function (d) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pb-devtab' + (d[0] === device ? ' active' : '');
            b.setAttribute('data-device', d[0]);
            b.setAttribute('aria-pressed', d[0] === device ? 'true' : 'false');
            b.textContent = d[1];
            /* How many values this breakpoint overrides, so an author can
               see there IS something on the tablet tab without opening it. */
            var n = d[0] === 'base' ? 0 : pbOverrideCount(node, d[0]);
            if (n) {
                var dot = document.createElement('em');
                dot.className = 'pb-devtab-count';
                dot.textContent = String(n);
                b.appendChild(dot);
            }
            b.addEventListener('click', function () {
                /* Choosing which breakpoint to EDIT. It writes nothing --
                   the value only changes when a control is used. */
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
            ? 'The value used everywhere, unless a narrower screen overrides it below.'
            : (device === 'tablet'
                ? 'Used at 1024px and below. A box left alone keeps the desktop value \u2014 ' +
                  'the placeholder shows what that is.'
                : 'Used at 768px and below. A box left alone keeps the wider value \u2014 ' +
                  'the placeholder shows what that is.');
        host.appendChild(note);

        var bag = pbStyleBag(node, device);
        /* One sync per marked control, so an edit can refresh exactly the
           row it touched without rebuilding anything around it. */
        var marks = {};
        /* Assigned once the clear button exists, below. Everything that can
           change an override count has to refresh it, or it goes stale the
           same way the inheritance note would. */
        var syncClear = function () {};
        var ctx = {
            device: device,
            onChange: function (key) {
                if (Object.prototype.hasOwnProperty.call(marks, key)) marks[key]();
                pbPaintDeviceCounts(tabs, node);
                syncClear();
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
            var row = pbFieldFor(spec, bag, spec[0], ctx);
            /* Only where a narrower breakpoint can actually inherit: the
               desktop tab has nothing above it to inherit from. */
            if (device !== 'base') {
                marks[spec[0]] = pbMarkInherited(row, node, device, spec[0], bag, ctx, host,
                                                 keys, labels, onLayout);
            }
            grids[g].appendChild(row);
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
            syncClear = function () {
                var n = pbOverrideCount(node, device);
                clr.innerHTML = '<i class="fas fa-eraser"></i> Clear all ' +
                    (device === 'tablet' ? 'tablet' : 'mobile') + ' overrides' +
                    (n ? ' (' + n + ')' : '');
                clr.disabled = !n;
            };
            syncClear();
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

    function pbElementList(host, list, depth, addr) {
        var wrap = document.createElement('div');
        wrap.className = 'pb-els';
        /* The container's address, written where the pointer layer can
           read it back. Nothing here is trusted on the way in: it goes
           through pbListAt(), which resolves it against the live tree. */
        wrap.setAttribute('data-list-sec', addr.sec);
        wrap.setAttribute('data-list-el', addr.el || '');
        wrap.setAttribute('data-list-col', addr.el ? String(addr.col) : '');
        host.appendChild(wrap);

        function repaint() {
            wrap.innerHTML = '';
            list.forEach(function (el, i) {
                wrap.appendChild(pbElementCard(el, i, list, depth, repaint, addr));
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

    function pbElementCard(el, i, list, depth, repaint, addr) {
        var card = document.createElement('div');
        card.className = 'pb-elcard';
        card.setAttribute('data-el-id', el.id);

        var head = document.createElement('div');
        head.className = 'pb-elcard-head';
        head.appendChild(pbHandle('element'));
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

        /* The same swap the drag layer performs, through the same save
           path, reachable from the keyboard. Focus follows the element
           to its new row rather than being dropped on the floor. */
        function moveEl(delta) {
            var j = i + delta;
            if (j < 0 || j >= list.length) return;
            var t = list[j]; list[j] = list[i]; list[i] = t;
            var id = el.id;
            pbWishFocus(function () {
                var c = pbNodeFor(null, '.pb-elcard', 'data-el-id', id);
                return c && pbFocusIn(c, delta < 0 ? ['el-up', 'el-down'] : ['el-down', 'el-up']);
            });
            pbPersist(); repaint(); pbPaintPreview();
        }

        var up = pbBtn('fa-arrow-up', 'Move up');
        up.disabled = i === 0;
        up.setAttribute('data-act', 'el-up');
        up.addEventListener('click', function () { moveEl(-1); });
        tools.appendChild(up);

        var down = pbBtn('fa-arrow-down', 'Move down');
        down.disabled = i === list.length - 1;
        down.setAttribute('data-act', 'el-down');
        down.addEventListener('click', function () { moveEl(1); });
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

            /* One wrapper around the column boxes, so the pointer layer has
               a container to aim at and an address to read off it. */
            var colsHost = document.createElement('div');
            colsHost.className = 'pb-cols';
            colsHost.setAttribute('data-cols-sec', addr.sec);
            colsHost.setAttribute('data-cols-el', el.id);
            body.appendChild(colsHost);

            /* Columns carry no id -- they are positions in an array -- so
               keyboard focus follows the position the column moved to. */
            function moveCol(ci, delta) {
                var j = ci + delta;
                if (j < 0 || j >= cols.length) return;
                var t = cols[j]; cols[j] = cols[ci]; cols[ci] = t;
                var id = el.id, want = String(j);
                pbWishFocus(function () {
                    var owner = pbNodeFor(null, '.pb-elcard', 'data-el-id', id);
                    var boxn = owner && pbNodeFor(owner, '.pb-col', 'data-col', want);
                    return boxn && pbFocusIn(boxn,
                        delta < 0 ? ['col-up', 'col-down'] : ['col-down', 'col-up']);
                });
                pbPersist(); repaint(); pbPaintPreview();
            }

            cols.forEach(function (col, ci) {
                var box = document.createElement('div');
                box.className = 'pb-col';
                box.setAttribute('data-col', String(ci));
                var h = document.createElement('div');
                h.className = 'pb-col-head';
                h.appendChild(pbHandle('column'));
                var lbl = document.createElement('strong');
                lbl.textContent = 'Column ' + (ci + 1);
                h.appendChild(lbl);

                var cup = pbBtn('fa-arrow-up', 'Move column up');
                cup.disabled = ci === 0;
                cup.setAttribute('data-act', 'col-up');
                cup.addEventListener('click', function () { moveCol(ci, -1); });
                h.appendChild(cup);

                var cdn = pbBtn('fa-arrow-down', 'Move column down');
                cdn.disabled = ci === cols.length - 1;
                cdn.setAttribute('data-act', 'col-down');
                cdn.addEventListener('click', function () { moveCol(ci, 1); });
                h.appendChild(cdn);

                var rm = pbBtn('fa-trash', 'Remove column', 'danger');
                rm.setAttribute('data-act', 'del-col');
                rm.addEventListener('click', function () {
                    cols.splice(ci, 1);
                    pbPersist(); repaint(); pbPaintPreview();
                });
                h.appendChild(rm);
                box.appendChild(h);
                if (!col.elements) col.elements = [];
                pbElementList(box, col.elements, depth + 1,
                    { sec: addr.sec, el: el.id, col: ci });
                colsHost.appendChild(box);
            });
        } else {
            if (!el.content) el.content = {};
            var grid = document.createElement('div');
            grid.className = 'pb-grid';
            var cctx = {
                dimensionKeys: PB_ASSET_DIMS[el.type],
                /* Choosing an image can fill in the width and height boxes
                   beside it, so those inputs have to be rebuilt. */
                repaint: function () { pbPersist(); repaint(); pbPaintPreview(); }
            };
            (PB_CONTENT_FIELDS[el.type] || []).forEach(function (spec) {
                grid.appendChild(pbFieldFor(spec, el.content, spec[0], cctx));
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

    /* The widths are device widths chosen to sit inside the site's OWN
       breakpoints, which are 1024px and 768px (css/sections.css,
       css/responsive.css). Nothing here invents a breakpoint:

         desktop 1280  ->  above 1024, so the desktop rules apply
         tablet   900  ->  769..1024, the tablet band
         mobile   390  ->  at or below 768, the mobile band

       The band is shown on the button so an author can see which set of
       rules they are looking at rather than having to know. */
    var PB_VIEWPORTS = [
        ['desktop', 'Desktop', 1280, 'fa-desktop',                 'over 1024px'],
        ['tablet',  'Tablet',   900, 'fa-tablet-screen-button',    '769\u20131024px'],
        ['mobile',  'Mobile',   390, 'fa-mobile-screen-button',    'up to 768px']
    ];
    var pbViewport = 'desktop';

    /* Taller on a phone than on a desktop, because the same content is
       three times longer there and a fixed height would cut it off. */
    var PB_FRAME_H = { desktop: 900, tablet: 1000, mobile: 1100 };

    function pbViewportWidth() {
        for (var i = 0; i < PB_VIEWPORTS.length; i++) {
            if (PB_VIEWPORTS[i][0] === pbViewport) return PB_VIEWPORTS[i][2];
        }
        return 1280;
    }

    function pbViewportHeight() {
        return PB_FRAME_H[pbViewport] || 900;
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
            b.setAttribute('aria-pressed', v[0] === pbViewport ? 'true' : 'false');
            b.title = esc(v[1]) + ' \u2014 ' + v[2] + 'px, the ' + v[4] + ' rules';
            b.innerHTML = '<i class="fas ' + v[3] + '"></i> ' + esc(v[1]) +
                          ' <em>' + v[2] + '</em>';
            b.addEventListener('click', function () {
                /* A viewing mode and nothing else: this changes which width
                   the frame is rendered at and writes nothing to the draft,
                   the page or the responsive overrides. */
                /* Switching the preview rebuilds nothing in the list, but
                   a drag in flight loses the rectangles it was aiming at,
                   so it ends here -- without touching the draft. */
                pbDragCancel();
                pbViewport = v[0];
                pbPaintDevices();
                pbFitPreview();
            });
            host.appendChild(b);
        });
    }

    /* Lay the frame out at the real viewport width and then scale the whole
       thing down to fit the column, rather than squeezing it: the page
       inside is genuinely 390px wide on the mobile setting, so it takes the
       mobile rules and the columns really do stack.

       Scaling down never distorts, because it is a uniform transform on an
       already-correct layout. Scaling UP would, so it does not happen --
       a narrow viewport in a wide column is centred at its own size. */
    function pbFitPreview() {
        var stage = $('#pbStage'), f = $('#pbFrame');
        if (!stage || !f) return;
        var w = pbViewportWidth();
        var h = pbViewportHeight();
        var avail = stage.clientWidth - 20;
        var k = avail > 0 ? Math.min(1, avail / w) : 1;
        f.style.width = w + 'px';
        f.style.height = h + 'px';
        f.style.transform = 'scale(' + k + ')';
        f.style.transformOrigin = 'top left';
        f.setAttribute('data-viewport', pbViewport);
        /* The transform does not change layout size, so the stage is told
           what the scaled frame actually occupies, and the frame is nudged
           to the middle of whatever is left over. */
        var shown = Math.round(w * k);
        stage.style.height = Math.round(h * k) + 'px';
        f.style.marginLeft = Math.max(0, Math.round((stage.clientWidth - 20 - shown) / 2)) + 'px';
        var tag = $('#pbViewportTag');
        if (tag) {
            for (var i = 0; i < PB_VIEWPORTS.length; i++) {
                if (PB_VIEWPORTS[i][0] !== pbViewport) continue;
                tag.textContent = PB_VIEWPORTS[i][2] + 'px \u00b7 ' + PB_VIEWPORTS[i][4] +
                    (k < 1 ? ' \u00b7 shown at ' + Math.round(k * 100) + '%' : '');
            }
        }
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
        pbHeadingsMaybe();
        pbPaintWhere();
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
            /* Reports what actually happened. A refused write already said
               so through the save-state line, so this only speaks on
               success -- it must never claim a save that did not happen. */
            if (pbPersist()) {
                buildBuilder();
                toast('Draft saved on this device. The live site is unchanged.');
            } else {
                buildBuilder();
                toast('Could not save the draft. Your changes are still here.', true);
            }
        });

        /* Publish reaches the network, so a second click while the first is
           in flight would publish twice. The button is held until the round
           trip finishes, whichever way it goes. */
        var publishing = false;
        if ((b = $('#pbPublish'))) b.addEventListener('click', function () {
            if (publishing) return;
            publishing = true;
            var btn = b;
            btn.disabled = true;
            var release = function () {
                publishing = false;
                buildBuilder();       /* re-enables from the draft's own state */
            };
            var res;
            try {
                pbFlush();
                CMS.sections.saveDraft(pbSlug, pbDraft);
                CMS.sections.publish(pbSlug);
                res = commit();       /* the one action here that goes live */
                buildBuilder();
                if (!CMS.remote.enabled) toast('Published. This page now shows your sections.');
            } catch (e) {
                release();
                throw e;
            }
            /* Held until the network round trip finishes, not just until
               this handler returns -- otherwise a second click lands while
               the first is still in flight and publishes twice. */
            if (res && typeof res.then === 'function') res.then(release, release);
            else release();
        });

        if ((b = $('#pbDiscard'))) b.addEventListener('click', function () {
            pbFlush();
            if (!window.confirm('Throw away the draft and start again from what is published?\n\n' +
                    'It is kept on this device so you can put it back.')) return;
            pbSnapshot('discard');
            CMS.sections.discard(pbSlug);
            pbDraft = CMS.sections.draft(pbSlug).sections;
            pbOpen = null;
            commit(true);
            buildBuilder();
            toast('Draft discarded. You can still restore it above.');
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
        fit:   pbFitPreview,
        /* The Pages panel needs an image chooser for the Open Graph and
           X/Twitter fields. It is THIS picker -- same manifest, same
           pbAsset() rules, same modal -- rather than a second one that
           would have to be kept honest separately. */
        pickAsset: function (current, onPick) { pbAssetOpen(current, onPick); },
        /* The drag layer's own entry points. cancel() is what the admin
           shell calls when the panel changes underneath a drag; check()
           and move() are the exact functions the pointer handlers call,
           exposed so the refusals can be driven with addresses the UI
           cannot produce -- unknown ids, prototype keys, stale nodes --
           instead of only the ones a mouse can reach. */
        drag: {
            check:  function (drag, target) { return pbDropOk(drag, target); },
            move:   function (drag, target) {
                if (!pbCommitMove(drag, target)) return false;
                pbPersist();
                buildBuilder();
                return true;
            },
            cancel: pbDragCancel,
            active: function () { return !!(pbDrag && pbDrag.live); }
        }
    };
};
