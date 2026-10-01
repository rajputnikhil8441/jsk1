/* ============================================================
   MINIDOM — just enough DOM to run the real renderer in Node
   ------------------------------------------------------------
   WHY THIS EXISTS. The published Page Builder content has to be in the
   HTML the server sends, or a crawler without JavaScript reads a different
   page from the one a visitor sees. Baking it at build time means turning a
   section array into markup in Node.

   THE TEMPTING MISTAKE is to write a second renderer: a string-building
   function in tools/ that produces "the same" markup as js/cms.js does in
   the browser. That is thirteen element types, each with its own rules
   about levels, alt text, target/rel, icons, accordions and skipped
   elements, duplicated in two places and expected to stay identical
   forever. docs/page-builder.md already names the principle this violates:
   there must be one interpretation of a section array, not two that could
   drift.

   So there is no second renderer. This file provides the handful of DOM
   methods js/cms.js's renderer actually uses, and tools/lib/pbbake.js runs
   THAT renderer -- the same code, the same file, the same functions the
   browser runs -- against it. The only thing written twice is
   serialisation, and tests/test_pb_bake.js asserts our serialisation is
   byte-identical to a real browser's innerHTML for every element type.

   WHAT IS DELIBERATELY NOT HERE. No layout, no CSS, no events that do
   anything, no querySelector beyond what the renderer needs. This is not a
   DOM implementation; it is the shape of one, sized to one caller.

   SERIALISATION RULES, matched to what browsers emit for innerHTML:
     text        & < >   ->  &amp; &lt; &gt;
     attributes  & "     ->  &amp; &quot;      (< and > are left alone)
     void tags   <img>, <hr>, <br>, <input>... with no closing tag
     hidden      a boolean attribute, serialised as hidden=""
   Attribute order is insertion order, which is why pbEl() setting
   className first puts class first.
   ============================================================ */
'use strict';

/* Elements that never have a closing tag. */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
                      'link', 'meta', 'param', 'source', 'track', 'wbr']);

/* Attributes the renderer sets as properties rather than through
   setAttribute, and which browsers serialise as boolean attributes. */
const BOOL_PROPS = new Set(['hidden']);

/* RAW TEXT ELEMENTS. In HTML, the contents of <script> and <style> are raw
   text: the parser does not resolve entities inside them, and a browser
   serialising one writes its text out unchanged. Escaping it the way
   ordinary text is escaped would be WRONG, not merely different -- a JSON-LD
   block whose quotes came out as &quot; is not JSON any more, and no crawler
   would parse it.

   This matters now because the section renderer emits a JSON-LD block of
   its own (the FAQPage schema). Whatever goes in one must therefore already
   be safe to write raw, which is why js/cms.js escapes < as \u003c on the
   way in: with no < in the text there is no way to close the element early,
   and the bytes match what a browser's innerHTML would give. */
const RAW_TEXT = new Set(['script', 'style']);

function escText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/* A CSSStyleDeclaration-shaped object. Deliberately NOT serialised: the
   section renderer never sets an inline style (every style key becomes a
   custom property in a generated <style> element), so anything written here
   is the engine painting its own variables during load. */
function makeStyle() {
    const props = new Map();
    return {
        cssText: '',
        setProperty(k, v) { props.set(String(k), String(v == null ? '' : v)); },
        removeProperty(k) { const v = props.get(String(k)); props.delete(String(k)); return v || ''; },
        getPropertyValue(k) { return props.get(String(k)) || ''; },
        get length() { return props.size; }
    };
}

class TextNode {
    constructor(data) { this.nodeType = 3; this.data = String(data); this.parentNode = null; }
    get textContent() { return this.data; }
    set textContent(v) { this.data = String(v); }
    get outerHTML() { return escText(this.data); }
}

class Element {
    constructor(tag) {
        this.nodeType = 1;
        this.tagName = String(tag).toUpperCase();
        this.localName = String(tag).toLowerCase();
        this.childNodes = [];
        this.parentNode = null;
        /* A Map so attribute order is insertion order, as a browser's
           serialiser emits it. */
        this.attrs = new Map();
        /* The engine writes CSS custom properties onto documentElement.style
           as it loads (paintVars). Inline styles are not part of a section's
           markup -- the renderer puts every style in a <style> element
           instead -- so these are accepted and kept out of serialisation. */
        this.style = makeStyle();
    }

    /* ---- attributes ---- */
    setAttribute(name, value) { this.attrs.set(String(name), String(value)); }
    getAttribute(name) { return this.attrs.has(String(name)) ? this.attrs.get(String(name)) : null; }
    hasAttribute(name) { return this.attrs.has(String(name)); }
    removeAttribute(name) { this.attrs.delete(String(name)); }

    /* className is a property in the DOM and the renderer both assigns it
       and appends to it (node.className += ' pb-hide-mobile'), so it has to
       read back what was written. */
    get className() { return this.attrs.get('class') || ''; }
    set className(v) { this.attrs.set('class', String(v)); }

    get id() { return this.attrs.get('id') || ''; }
    set id(v) { this.attrs.set('id', String(v)); }

    /* hidden is assigned as a property by the faq element. */
    get hidden() { return this.attrs.get('hidden') === ''; }
    set hidden(v) { if (v) this.attrs.set('hidden', ''); else this.attrs.delete('hidden'); }

    /* ---- tree ---- */
    appendChild(node) {
        if (!node) return node;
        /* A fragment contributes its children, not itself. */
        if (node.nodeType === 11) {
            node.childNodes.slice().forEach(c => this.appendChild(c));
            node.childNodes.length = 0;
            return node;
        }
        if (node.parentNode) node.parentNode.removeChild(node);
        node.parentNode = this;
        this.childNodes.push(node);
        return node;
    }

    removeChild(node) {
        const i = this.childNodes.indexOf(node);
        if (i > -1) { this.childNodes.splice(i, 1); node.parentNode = null; }
        return node;
    }

    insertBefore(node, ref) {
        if (!ref) return this.appendChild(node);
        const i = this.childNodes.indexOf(ref);
        if (i === -1) return this.appendChild(node);
        if (node.parentNode) node.parentNode.removeChild(node);
        node.parentNode = this;
        this.childNodes.splice(i, 0, node);
        return node;
    }

    get children() { return this.childNodes.filter(n => n.nodeType === 1); }
    get firstChild() { return this.childNodes[0] || null; }
    get nextSibling() {
        if (!this.parentNode) return null;
        const s = this.parentNode.childNodes;
        return s[s.indexOf(this) + 1] || null;
    }

    /* ---- content ---- */
    get textContent() {
        return this.childNodes.map(n => n.textContent).join('');
    }
    set textContent(v) {
        this.childNodes.forEach(n => { n.parentNode = null; });
        this.childNodes.length = 0;
        /* Assigning '' empties the node and adds no text node, which is what
           renderSectionsInto() relies on to clear its host. */
        const s = String(v);
        if (s !== '') this.appendChild(new TextNode(s));
    }

    get innerHTML() {
        if (RAW_TEXT.has(this.localName)) {
            return this.childNodes.map(n => n.nodeType === 3 ? n.data : n.outerHTML).join('');
        }
        return this.childNodes.map(n => n.outerHTML).join('');
    }

    get outerHTML() {
        let out = '<' + this.localName;
        for (const [k, v] of this.attrs) {
            out += BOOL_PROPS.has(k) && v === '' ? ' ' + k + '=""' : ' ' + k + '="' + escAttr(v) + '"';
        }
        out += '>';
        if (VOID.has(this.localName)) return out;
        return out + this.innerHTML + '</' + this.localName + '>';
    }

    /* The renderer attaches a click handler to faq buttons. Baked markup has
       no behaviour -- js/cms.js re-renders and attaches the real listeners on
       load -- so this accepts and discards. It must exist, or rendering a faq
       throws in Node. */
    addEventListener() {}
    removeEventListener() {}

    /* Present because paintSections() and its neighbours call them on hosts.
       A build-time host has no descendants worth finding. */
    querySelector() { return null; }
    querySelectorAll() { return []; }
}

class Fragment extends Element {
    constructor() { super('#fragment'); this.nodeType = 11; }
    get outerHTML() { return this.innerHTML; }
}

class MiniDocument {
    constructor() {
        this.readyState = 'complete';
        this.documentElement = new Element('html');
        this.head = new Element('head');
        this.body = new Element('body');
        this.documentElement.appendChild(this.head);
        this.documentElement.appendChild(this.body);
        this.title = '';
    }
    createElement(tag) { return new Element(tag); }
    createTextNode(t) { return new TextNode(t); }
    createDocumentFragment() { return new Fragment(); }
    getElementById() { return null; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
}

module.exports = {
    Element: Element,
    TextNode: TextNode,
    Fragment: Fragment,
    MiniDocument: MiniDocument,
    escText: escText,
    escAttr: escAttr,
    VOID: VOID
};
