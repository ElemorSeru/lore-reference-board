console.log("[lore-reference-board] Loading...");

if (typeof window.Panzoom === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@panzoom/panzoom/dist/panzoom.min.js";
    script.onload = () => (window.PanzoomLoaded = true);
    document.head.appendChild(script);
} else {
    window.PanzoomLoaded = true;
}

// Markdown to HTML for Document tabs with .md files.
if (typeof window.marked === "undefined") {
    const _ms = document.createElement("script");
    _ms.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    document.head.appendChild(_ms);
}

// Document to HTML for Document tabs with .docx files.
if (typeof window.mammoth === "undefined") {
    const _mm = document.createElement("script");
    _mm.src = "https://cdn.jsdelivr.net/npm/mammoth/mammoth.browser.min.js";
    document.head.appendChild(_mm);
}

const MODULE_SCOPE = "lore-reference-board";

Hooks.once("init", () => {
    game.settings.register(MODULE_SCOPE, "tabs",       { name: "Lore Board Tabs",        scope: "world", config: false, type: Object, default: [] });
    game.settings.register(MODULE_SCOPE, "pins",       { name: "Lore Board Pins",        scope: "world", config: false, type: Object, default: {} });
    game.settings.register(MODULE_SCOPE, "image-lore", { name: "Lore Board Image Links", scope: "world", config: false, type: Object, default: {} });
    game.settings.register(MODULE_SCOPE, "imageJournals", { name: "Image Journal Links", scope: "world", config: false, type: Object, default: {} });
    game.settings.register(MODULE_SCOPE, "tabViews",   { name: "Tab Views (legacy)",     scope: "world", config: false, type: Object, default: {} });

    // Maximum number of tab rows before the tab bar starts scrolling.
    game.settings.register(MODULE_SCOPE, "maxTabRows", {
        name: game.i18n.localize("lore-reference-board.Settings.MaxTabRows.Name"),
        hint: game.i18n.localize("lore-reference-board.Settings.MaxTabRows.Hint"),
        scope:   "client",
        config:  true,
        type:    Number,
        default: 4,
        range:   { min: 0, max: 30, step: 1 },
    });

    if (typeof Handlebars !== "undefined" && !Handlebars.helpers?.eq) {
        Handlebars.registerHelper("eq", (a, b) => a === b);
    }
});

Hooks.once("ready", () => {
    if (document.getElementById("lr-svg-filter-defs")) return; 
    const ns  = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.id    = "lr-svg-filter-defs";
    svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = `
      <defs>
        <!-- lr-pin-svg-outline: crisp two-ring halo for SVG map pins. -->
        <filter id="lr-pin-svg-outline"
                x="-20%" y="-20%" width="140%" height="140%"
                color-interpolation-filters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="dilated-outer"/>
          <feComposite in="dilated-outer" in2="SourceAlpha" operator="out" result="ring-shape-outer"/>
          <feFlood flood-color="#000000" flood-opacity="0.9" result="flood-black"/>
          <feComposite in="flood-black" in2="ring-shape-outer" operator="in" result="ring-black"/>
          <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="dilated-inner"/>
          <feComposite in="dilated-inner" in2="SourceAlpha" operator="out" result="ring-shape-inner"/>
          <feFlood flood-color="#ffffff" flood-opacity="0.65" result="flood-white"/>
          <feComposite in="flood-white" in2="ring-shape-inner" operator="in" result="ring-white"/>
          <feMerge>
            <feMergeNode in="ring-black"/>
            <feMergeNode in="ring-white"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
    `;
    document.body.appendChild(svg);
});

// Helpers
function _getSetting(key, fallback) {
    try { return game.settings.get(MODULE_SCOPE, key) ?? fallback; }
    catch { return fallback; }
}

async function loadTabs() {
    const tabs = _getSetting("tabs", []);
    return Array.isArray(tabs) ? tabs : [];
}

async function saveTabs(tabs) {
    await game.settings.set(MODULE_SCOPE, "tabs", Array.isArray(tabs) ? tabs : []);
    return true;
}

let _pinsWriteCache  = null;   
let _pinsDebounceId  = null;

// Ensure the cache is populated from the settings store.
function _initPinsCache() {
    if (_pinsWriteCache !== null) return;
    const stored = _getSetting("pins", {});
    _pinsWriteCache = (stored && typeof stored === "object") ? { ...stored } : {};
}

async function _flushPins() {
    if (_pinsDebounceId !== null) {
        clearTimeout(_pinsDebounceId);
        _pinsDebounceId = null;
    }
    if (_pinsWriteCache !== null) {
        await game.settings.set(MODULE_SCOPE, "pins", { ..._pinsWriteCache });
    }
}

function _invalidatePinsCache() {
    if (_pinsDebounceId !== null) { clearTimeout(_pinsDebounceId); _pinsDebounceId = null; }
    _pinsWriteCache = null;
}

async function loadPinsForTab(tabId) {
    _initPinsCache();
    return Array.isArray(_pinsWriteCache[tabId]) ? _pinsWriteCache[tabId] : [];
}

async function savePinsForTab(tabId, pinsForTab) {
    _initPinsCache();
    _pinsWriteCache[tabId] = Array.isArray(pinsForTab) ? pinsForTab : [];

    // Debounce
    if (_pinsDebounceId !== null) clearTimeout(_pinsDebounceId);
    _pinsDebounceId = setTimeout(async () => {
        _pinsDebounceId = null;
        await game.settings.set(MODULE_SCOPE, "pins", { ..._pinsWriteCache });
    }, 300);

    return true;
}

async function deletePinsForTab(tabId) {
    _initPinsCache();
    delete _pinsWriteCache[tabId];

    if (_pinsDebounceId !== null) clearTimeout(_pinsDebounceId);
    _pinsDebounceId = setTimeout(async () => {
        _pinsDebounceId = null;
        await game.settings.set(MODULE_SCOPE, "pins", { ..._pinsWriteCache });
    }, 300);
}

// Image Storage Helpers
async function loadImageLore() {
    const lore = _getSetting("image-lore", {});
    return (lore && typeof lore === "object") ? lore : {};
}

async function saveLoreForImage(src, journalId) {
    const lore = await loadImageLore();
    await game.settings.set(MODULE_SCOPE, "image-lore", { ...lore, [src]: journalId });
}

async function clearLoreForImage(src) {
    const lore = await loadImageLore();
    const updated = { ...lore };
    delete updated[src];
    await game.settings.set(MODULE_SCOPE, "image-lore", updated);
}

async function clearLoreForImages(srcArray) {
    if (!srcArray?.length) return;
    const lore = await loadImageLore();
    const updated = { ...lore };
    let changed = false;
    for (const src of srcArray) {
        if (src in updated) { delete updated[src]; changed = true; }
    }
    if (changed) await game.settings.set(MODULE_SCOPE, "image-lore", updated);
}

function collectPinImages(pin) {
    return (pin?.gallery?.folders ?? []).flatMap(f => f.images ?? []);
}

// Image Journal
function getImageJournalMap() {
    try {
        const data = game.settings.get(MODULE_SCOPE, "imageJournals");
        return (data && typeof data === "object") ? data : {};
    } catch { return {}; }
}

async function saveImageJournalLink(pinId, src, journalId) {
    const map    = getImageJournalMap();
    const pinMap = map[pinId] ?? {};
    await game.settings.set(MODULE_SCOPE, "imageJournals", {
        ...map,
        [pinId]: { ...pinMap, [src]: journalId },
    });
}

async function clearImageJournalLink(pinId, src) {
    const map = getImageJournalMap();
    if (!map[pinId]?.[src]) return;
    const pinMap  = { ...map[pinId] };
    delete pinMap[src];
    const updated = { ...map };
    if (Object.keys(pinMap).length === 0) delete updated[pinId];
    else updated[pinId] = pinMap;
    await game.settings.set(MODULE_SCOPE, "imageJournals", updated);
}

async function clearAllImageJournalLinksForPin(pinId) {
    const map = getImageJournalMap();
    if (!map[pinId]) return;
    const updated = { ...map };
    delete updated[pinId];
    await game.settings.set(MODULE_SCOPE, "imageJournals", updated);
}


const escapeHtml = (s) =>
    String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

// Multi-Page Journal helpers
function getJournalPages(entry) {
    return entry.pages.contents.slice().sort((a, b) => a.sort - b.sort);
}

async function enrichJournalPage(page, entry) {
    if (!page) {
        return '<p style="color:#888;font-style:italic;padding:8px 0">No pages found.</p>';
    }

    if (page.type === "image") {
        const src     = page.src ?? "";
        const caption = page.image?.caption ?? "";
        if (!src) return '<p style="color:#888;font-style:italic;padding:8px 0">No image source set.</p>';
        return `<div class="lrt-doc-image-page">
            <img class="lrt-doc-page-img" src="${escapeHtml(src)}" alt="${escapeHtml(page.name ?? "")}" />
            ${caption ? `<p class="lrt-doc-page-caption">${escapeHtml(caption)}</p>` : ""}
        </div>`;
    }

    // Other non-text types (PDF, video, etc
    if (page.type !== "text") {
        const iconMap = { pdf: "fa-file-pdf", video: "fa-film" };
        const icon    = iconMap[page.type] ?? "fa-file";
        return `<div style="text-align:center;padding:24px 12px;color:#888">
            <i class="fas ${icon}" style="font-size:2em;display:block;margin-bottom:10px;color:#555"></i>
            <span style="font-style:italic">This page is type <strong>${escapeHtml(page.type)}</strong>.</span><br>
            <span style="font-size:11px">Open the full journal to view it.</span>
        </div>`;
    }
    const raw = page.text?.content ?? "";
    if (!raw.trim()) {
        return '<p style="color:#888;font-style:italic;padding:8px 0">No content yet,  click Edit to start writing.</p>';
    }
    try {
        return await TextEditor.enrichHTML(raw, { relativeTo: entry, rollData: {} });
    } catch {
        return raw;
    }
}

async function wirePageNav(contentEl, journalId) {
    if (!contentEl || !journalId) return;

    let entry = null;

    if (journalId.includes(".")) {
        try { entry = await fromUuid(journalId); } catch { entry = null; }
    }

    // Fall back to bare-ID lookup in the world journal collection.
    if (!entry) entry = game.journal.get(journalId) ?? null;

    // Construct a world UUID from a bare ID.
    if (!entry) {
        try { entry = await fromUuid(`JournalEntry.${journalId}`); } catch { entry = null; }
    }

    if (!entry) return;

    const pages = getJournalPages(entry);
    if (pages.length <= 1) return;   

    // Build nav bar
    const nav = document.createElement("div");
    nav.className = "lrb-page-nav";
    nav.innerHTML = `
        <button class="lrb-pg-prev" title="Previous page" disabled>&#8249;</button>
        <select class="lrb-pg-select">
            ${pages.map((p, i) =>
                `<option value="${escapeHtml(p.id)}">${i + 1}. ${escapeHtml(p.name)}</option>`
            ).join("")}
        </select>
        <button class="lrb-pg-next" title="Next page">&#8250;</button>
    `;
    contentEl.parentElement.insertBefore(nav, contentEl);

    const prevBtn  = nav.querySelector(".lrb-pg-prev");
    const nextBtn  = nav.querySelector(".lrb-pg-next");
    const selectEl = nav.querySelector(".lrb-pg-select");

    let currentIdx = 0;

    const loadPage = async (idx) => {
        currentIdx        = idx;
        prevBtn.disabled  = (idx === 0);
        nextBtn.disabled  = (idx === pages.length - 1);
        selectEl.value    = pages[idx].id;
        contentEl.innerHTML =
            "<p style='color:#888;font-style:italic;padding:8px'>Loading…</p>";
        contentEl.innerHTML = await enrichJournalPage(pages[idx], entry);
    };

    selectEl.addEventListener("change", ev => {
        const idx = pages.findIndex(p => p.id === ev.target.value);
        if (idx !== -1) loadPage(idx);
    });
    prevBtn.addEventListener("click", () => {
        if (currentIdx > 0) loadPage(currentIdx - 1);
    });
    nextBtn.addEventListener("click", () => {
        if (currentIdx < pages.length - 1) loadPage(currentIdx + 1);
    });

    prevBtn.disabled = true;
    nextBtn.disabled = (pages.length <= 1);
}

// Render Rolltable/Results
function _renderRollTableHtml(doc) {
    const results = doc.results?.contents ?? [];
    const sorted  = results.slice().sort((a, b) => (a.range?.[0] ?? 0) - (b.range?.[0] ?? 0));
    const formula = (doc.formula ?? "").trim();
    const desc    = (doc.description ?? "").replace(/<[^>]*>/g, "").trim();

    if (!sorted.length) {
        return '<p class="lrt-rt-empty">No results defined.</p>';
    }

    const formulaHtml = formula
        ? `<div class="lrt-rt-formula"><i class="fas fa-dice-d20"></i> ${escapeHtml(formula)}</div>`
        : "";
    const descHtml = desc
        ? `<div class="lrt-rt-desc">${escapeHtml(desc)}</div>`
        : "";

    const rows = sorted.map(r => {
        const rangeMin = r.range?.[0] ?? 0;
        const rangeMax = r.range?.[1] ?? 0;
        const rangeStr = rangeMin === rangeMax ? `${rangeMin}` : `${rangeMin}–${rangeMax}`;
        const imgHtml  = r.img
            ? `<img class="lrt-rt-result-img" src="${escapeHtml(r.img)}" alt="" />`
            : "";
        const drawnClass = r.drawn ? " lrt-rt-row--drawn" : "";
        return `<tr class="lrt-rt-row${drawnClass}">
            <td class="lrt-rt-range">${escapeHtml(rangeStr)}</td>
            <td class="lrt-rt-text"><span class="lrt-rt-text-inner">${imgHtml}${escapeHtml(r.text ?? "")}</span></td>
        </tr>`;
    }).join("");

    return `${formulaHtml}${descHtml}<table class="lrt-rt-table"><tbody>${rows}</tbody></table>`;
}

const isSvgIcon = (icon) => typeof icon === "string" && icon.endsWith(".svg");

const _svgIconCache = new Map();

async function fetchSvgData(url) {
    if (_svgIconCache.has(url)) return _svgIconCache.get(url);
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        const parser = new DOMParser();
        const doc    = parser.parseFromString(text, "image/svg+xml");
        const svgEl  = doc.querySelector("svg");
        if (!svgEl) throw new Error("No <svg> element found");
        const viewBox = svgEl.getAttribute("viewBox") || "0 0 512 512";
        svgEl.querySelectorAll("[fill]").forEach(el => {
            el.removeAttribute("fill");
            el.removeAttribute("fill-opacity");
        });
        const result = { viewBox, inner: svgEl.innerHTML };
        _svgIconCache.set(url, result);
        return result;
    } catch (err) {
        console.warn(`[lore-reference-board] Could not load SVG icon "${url}":`, err);
        _svgIconCache.set(url, null);
        return null;
    }
}

function pickImagePath(current = "modules/") {
    return new Promise((resolve) => {
        new FilePicker({
            type: "image",
            current: current || "modules/",
            callback: (path) => resolve(path),
        }).render(true);
    });
}

const LRB_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"]);

function _lrbDocTypeForExt(ext) {
    const e = (ext ?? "").toLowerCase();
    if (e === "pdf")               return "pdf";
    if (e === "txt")               return "txt";
    if (e === "md")                return "md";
    if (e === "html" || e === "htm") return "html";
    if (e === "docx")              return "docx";
    if (LRB_IMAGE_EXTS.has(e))    return "image";
    return null;
}

function pickDocFilePath(current = "modules/") {
    return new Promise((resolve) => {
        new FilePicker({
            type: "any",
            extensions: [".pdf", ".txt", ".md", ".html", ".htm", ".docx"],
            current: current || "modules/",
            callback: (path) => resolve(path),
        }).render(true);
    });
}

// Open FilePicker for Reference grid file cells,  only PDF, TXT, and Markdown.
function pickRefFilePath(current = "modules/") {
    return new Promise((resolve) => {
        new FilePicker({
            type: "any",
            extensions: [".pdf", ".txt", ".md"],
            current: current || "modules/",
            callback: (path) => resolve(path),
        }).render(true);
    });
}

function _lrbIsUrl(path) {
    return /^https?:\/\//i.test(path ?? "");
}

function normalizeLrbPath(raw) {
    const trimmed = (raw ?? "").trim();
    if (_lrbIsUrl(trimmed)) return trimmed;     
    let p = trimmed.replace(/\\/g, "/");
    p = p.replace(/^\/+/, "");                 
    p = p.replace(/^[Dd]ata\//, "");           
    return p;
}


function attachDialogValidation(anchorId, actionName, requiredIds) {
    let tries = 0;
    const tick = () => {
        const anchor = document.getElementById(anchorId);
        if (!anchor) { if (++tries < 60) requestAnimationFrame(tick); return; }

        const dialogEl = anchor.closest(".dialog, .app, [data-appid]");
        const btn = dialogEl?.querySelector(`[data-button="${CSS.escape(actionName)}"]`);
        const form = anchor.closest("form");
        if (!btn || !form) { if (++tries < 60) requestAnimationFrame(tick); return; }

        const inputs = requiredIds
            .map(id => form.elements[id] ?? document.getElementById(id))
            .filter(Boolean);

        const update = () => {
            const allFilled = inputs.every(el => el.value.trim() !== "");
            btn.disabled = !allFilled;
            btn.style.opacity = allFilled ? "" : "0.4";
            btn.style.cursor  = allFilled ? "" : "not-allowed";
        };

        update();
        inputs.forEach(el => el.addEventListener("input", update));
    };
    requestAnimationFrame(tick);
}

class LoreReferenceBoardApp extends Application {
    constructor(options = {}) {
        super(options);
        this.placingPin = false;
        this._panzoom = null;
        this._mapWrapEl = null;
        this._htmlRef = null;
        this._maximized = false;
        this.activeTab = null;

        this._pinDrag = {
            active: false,
            pinId: null,
            startX: 0,
            startY: 0,
            didDrag: false,
            offsetXPct: 0,
            offsetYPct: 0,
        };
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "lore-reference-board",
            template: "modules/lore-reference-board/templates/lore-reference-board-mapboard.html",
            width: 1020,
            height: 680,
            resizable: true,
        });
    }

    get title() { return game.i18n.localize("lore-reference-board.App.Title"); }

    async getData(options = {}) {
        const tabs = await loadTabs();

        if (!tabs.length) {
            const def = { id: "default", name: game.i18n.localize("lore-reference-board.Tab.Default"), img: "" };
            await saveTabs([def]);
            tabs.push(def);
        }

        if (!this.activeTab) this.activeTab = tabs[0].id;
        if (!tabs.find((t) => t.id === this.activeTab)) this.activeTab = tabs[0].id;

        // Cache the active tab's image
        const currentTab = tabs.find(t => t.id === this.activeTab) ?? null;
        this._cachedActiveTabImg = currentTab?.img ?? "";
        this._cachedCurrentTab   = currentTab;

        return {
            tabs,
            activeTab: this.activeTab,
            isDocumentTab:  currentTab?.type === "document",
            isReferenceTab: currentTab?.type === "reference",
        };
    }

    async _pinDialog({ pin, isNew }) {
        const L = key => game.i18n.localize(`lore-reference-board.Pin.Icons.${key}`);
        const faIcons = [
            { value: "fas fa-location-dot",      label: L("LocationDot") },
            { value: "fas fa-dragon",             label: L("Dragon") },
            { value: "fas fa-book",               label: L("Book") },
            { value: "fas fa-shield-alt",         label: L("Shield") },
            { value: "fas fa-scroll",             label: L("Scroll") },
            { value: "fas fa-treasure-chest",     label: L("TreasureChest") },
            { value: "fas fa-map-pin",            label: L("MapPin") },
            { value: "fas fa-skull",              label: L("Skull") },
            { value: "fas fa-dungeon",            label: L("Dungeon") },
            { value: "fas fa-tower-observation",  label: L("TowerObservation") },
        ];
        const svgIcons = [
            "anchor", "angel", "aura", "cancel", "card-hand", "castle", "cave",
            "city", "clockwork", "daze", "door-closed", "door-steel", "explosion",
            "eye", "falling", "hazard", "house", "item-bag", "mountain", "oak",
            "obelisk", "padlock", "pawprint", "pill", "poison", "radiation",
            "ruins", "sleep", "sword", "teleport", "temple", "tower", "tower-flag",
            "trap", "village", "waterfall", "whale", "windmill",
        ].map(name => ({
            value: `icons/svg/${name}.svg`,
            label: L(name.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join("")),
        }));

        const current = {
            icon: pin?.icon ?? "fas fa-location-dot",
            color: pin?.color ?? "#e74c3c",
            title: pin?.title ?? "",
            description: pin?.description ?? "",
            journal: pin?.journal ?? "",
        };

        let pinJournalId = current.journal || null;

        const uid           = foundry.utils.randomID();
        const idColor       = `lr-pin-color-${uid}`;
        const idIcon        = `lr-pin-icon-${uid}`;
        const idPreview     = `lr-pin-preview-${uid}`;
        const idUnlinked    = `lr-pin-ju-${uid}`;
        const idLinked      = `lr-pin-jl-${uid}`;
        const idJTitle      = `lr-pin-jt-${uid}`;
        const idJContent    = `lr-pin-jc-${uid}`;
        const idBtnCreate   = `lr-pin-bc-${uid}`;
        const idBtnEdit     = `lr-pin-be-${uid}`;
        const idBtnUnlink   = `lr-pin-bu-${uid}`;

        const content = `
      <form>
        <div class="pd-layout">

          <!-- ===== Left column: pin fields ===== -->
          <div class="pd-left">

            <div class="pd-preview-wrap">
              <div id="${idPreview}" class="pd-preview-icon"></div>
            </div>

            <div class="pd-row">
              <div class="pd-field pd-field-flex">
                <label>Title</label>
                <input type="text" name="pTitle" value="${escapeHtml(current.title)}"
                       style="width:100%;box-sizing:border-box" />
              </div>
              <div class="pd-field pd-field-color">
                <label>Color</label>
                <input id="${idColor}" type="color" name="pColor"
                       value="${escapeHtml(current.color)}" />
              </div>
            </div>

            <div class="pd-field">
              <label>Icon</label>
              <select id="${idIcon}" name="pIcon" style="width:100%;box-sizing:border-box">
                ${[...faIcons, ...svgIcons].map(ic =>
                    `<option value="${escapeHtml(ic.value)}"${ic.value === current.icon ? " selected" : ""}>${escapeHtml(ic.label)}</option>`
                ).join("")}
              </select>
            </div>

            <div class="pd-field">
              <label>Description</label>
              <textarea name="pDesc" rows="5"
                        style="width:100%;box-sizing:border-box;resize:vertical">${escapeHtml(current.description)}</textarea>
            </div>

          </div><!-- /pd-left -->

          <!-- ===== Right column: journal linking panel ===== -->
          <div class="pd-right">

            <div class="pd-journal-label">
              <i class="fas fa-book"></i> Linked Lore Journal
            </div>

            <!-- Unlinked state -->
            <div class="pd-journal-unlinked" id="${idUnlinked}">
              <div class="pd-journal-dropzone">
                <i class="fas fa-book pd-drop-icon"></i>
                <p class="pd-drop-primary">
                  ${game.i18n.localize("lore-reference-board.Pin.DropText")}
                </p>
                <div class="pd-drop-or">,  or, </div>
                <button type="button" class="pd-btn-create" id="${idBtnCreate}">
                  <i class="fas fa-plus"></i> ${game.i18n.localize("lore-reference-board.Pin.CreateLoreEntry")}
                </button>
              </div>
            </div>

            <!-- Linked state (hidden until a journal is linked) -->
            <div class="pd-journal-linked" id="${idLinked}" style="display:none">
              <div class="pd-linked-bar">
                <i class="fas fa-book-open"></i>
                <span class="pd-journal-title" id="${idJTitle}"></span>
                <button type="button" class="pd-btn-edit" id="${idBtnEdit}">
                  <i class="fas fa-edit"></i> ${game.i18n.localize("lore-reference-board.Lore.BtnEditLabel")}
                </button>
                <button type="button" class="pd-btn-unlink" id="${idBtnUnlink}">
                  <i class="fas fa-unlink"></i> ${game.i18n.localize("lore-reference-board.Common.Unlink")}
                </button>
              </div>
              <div class="pd-linked-content" id="${idJContent}">
                <em style="color:#666;font-size:12px">Loading…</em>
              </div>
            </div>

          </div><!-- /pd-right -->

        </div><!-- /pd-layout -->
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let buttonClicked = false;
            const buttons = {
                save: {
                    label: game.i18n.localize("lore-reference-board.Common.Save"),
                    callback: (html) => {
                        buttonClicked = true;
                        const form = html[0].querySelector("form")?.elements;
                        resolve({
                            action: "save",
                            data: {
                                icon:        form?.pIcon?.value  ?? current.icon,
                                color:       form?.pColor?.value ?? current.color,
                                title:       (form?.pTitle?.value ?? "").trim(),
                                description: (form?.pDesc?.value  ?? "").trim(),
                                journal:     pinJournalId,
                            },
                        });
                    },
                },
                cancel: {
                    label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                    callback: () => { buttonClicked = true; resolve("cancel"); },
                },
            };
            if (!isNew) {
                buttons.delete = {
                    label: game.i18n.localize("lore-reference-board.Common.Delete"),
                    callback: () => { buttonClicked = true; resolve({ action: "delete" }); },
                };
            }
            new Dialog({
                title: game.i18n.localize(isNew ? "lore-reference-board.Pin.DialogTitleNew" : "lore-reference-board.Pin.DialogTitleEdit"),
                content,
                buttons,
                default: "save",
                close: () => { if (!buttonClicked) reject(new Error("Dialog closed")); },
            }, { width: 760, height: 540, classes: ["app", "window-app", "dialog", "lore-rb-dialog", "lore-rb-pin-dialog"] }).render(true);
        });

        const setupDialog = async () => {
            const colorInput = document.getElementById(idColor);
            if (!colorInput) return false;  // not rendered yet

            const iconSelect   = document.getElementById(idIcon);
            const preview      = document.getElementById(idPreview);
            const unlinkedEl   = document.getElementById(idUnlinked);
            const linkedEl     = document.getElementById(idLinked);
            const journalTitle = document.getElementById(idJTitle);
            const journalCont  = document.getElementById(idJContent);
            const btnCreate    = document.getElementById(idBtnCreate);
            const btnEdit      = document.getElementById(idBtnEdit);
            const btnUnlink    = document.getElementById(idBtnUnlink);
            if (!iconSelect || !preview || !unlinkedEl || !linkedEl) return false;

            const pdLeft   = preview.closest(".pd-left");
            const pdRight  = preview.closest(".pd-layout")?.querySelector(".pd-right");
            const pdLayout = preview.closest(".pd-layout");
            if (pdLeft && pdRight && pdLayout) {
                const capColumns = () => {
                    const wc   = pdLayout.closest(".window-content");
                    if (!wc) return;
                    const wcCS = getComputedStyle(wc);
                    const plCS = getComputedStyle(pdLayout);
                    
                    const btnBar  = wc.closest(".app")?.querySelector(".dialog-buttons");
                    const btnBarH = btnBar ? btnBar.offsetHeight : 0;
                    const colH = wc.clientHeight
                        - parseFloat(wcCS.paddingTop)    - parseFloat(wcCS.paddingBottom)
                        - parseFloat(plCS.paddingTop)    - parseFloat(plCS.paddingBottom)
                        - btnBarH - 25;
                    pdLeft.style.height     = colH + "px";
                    pdRight.style.maxHeight = colH + "px";
                };
                capColumns();
                // Re-run whenever the dialog is resized
                const ro = new ResizeObserver(capColumns);
                ro.observe(pdLayout.closest(".window-content") ?? pdLeft);
            }

            // Live Pin Preview
            const updatePreview = () => {
                const iconVal  = iconSelect.value;
                const colorVal = colorInput.value;
                if (isSvgIcon(iconVal)) {
                    preview.style.color = "";
                    preview.innerHTML = `<span class="pd-preview-svg-mask" style="background-color:${colorVal};-webkit-mask-image:url('${iconVal}');mask-image:url('${iconVal}')"></span>`;
                } else {
                    preview.style.color = colorVal;
                    preview.innerHTML = `<i class="${iconVal}"></i>`;
                }
            };
            iconSelect.addEventListener("change", updatePreview);
            colorInput.addEventListener("input",  updatePreview);
            updatePreview();

            // Journal state helpers
            const showLinked = async (journalId) => {
                let entry = game.journal.get(journalId);
                if (!entry) {
                    try { entry = await fromUuid(`JournalEntry.${journalId}`); }
                    catch { entry = null; }
                }
                unlinkedEl.style.display = "none";
                linkedEl.style.display   = "flex";
                journalTitle.textContent = entry?.name ?? "(Unknown Journal)";

                linkedEl.querySelectorAll(".lrb-page-nav").forEach(el => el.remove());

                if (entry) {
                    // Render first page
                    const pages     = getJournalPages(entry);
                    const firstPage = pages[0] ?? null;
                    journalCont.innerHTML = await enrichJournalPage(firstPage, entry);

                    await wirePageNav(journalCont, journalId);
                } else {
                    journalCont.innerHTML =
                        '<em style="color:#666;font-size:12px">Journal entry not found.</em>';
                }
            };

            const showUnlinked = () => {
                pinJournalId             = null;
                linkedEl.style.display   = "none";
                unlinkedEl.style.display = "flex";
            };

            if (pinJournalId) {
                await showLinked(pinJournalId);
            }

            let dragDepth = 0;
            unlinkedEl.addEventListener("dragenter", (ev) => {
                ev.preventDefault();
                dragDepth++;
                unlinkedEl.classList.add("pd-drop-active");
            });
            unlinkedEl.addEventListener("dragleave", () => {
                dragDepth = Math.max(0, dragDepth - 1);
                if (dragDepth === 0) unlinkedEl.classList.remove("pd-drop-active");
            });
            unlinkedEl.addEventListener("dragover", (ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "link";
            });
            unlinkedEl.addEventListener("drop", async (ev) => {
                ev.preventDefault();
                dragDepth = 0;
                unlinkedEl.classList.remove("pd-drop-active");

                let data;
                try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                catch { ui.notifications.warn(game.i18n.localize("lore-reference-board.Pin.DropReadFail")); return; }

                let journalId = null;
                if (data.type === "JournalEntry") {
                    const entry = await fromUuid(data.uuid ?? "").catch(() => null);
                    journalId = entry?.id ?? null;
                } else if (data.type === "JournalEntryPage") {
                    const page = await fromUuid(data.uuid ?? "").catch(() => null);
                    journalId = page?.parent?.id ?? null;
                }

                if (!journalId) {
                    ui.notifications.warn(game.i18n.localize("lore-reference-board.Pin.DropWarn"));
                    return;
                }

                pinJournalId = journalId;
                await showLinked(journalId);
            });

            // Create New Lore Entry
            btnCreate?.addEventListener("click", async () => {
                const titleFieldVal = btnCreate.closest("form")?.elements?.pTitle?.value?.trim();
                const defaultName   = titleFieldVal || current.title || game.i18n.localize("lore-reference-board.Pin.LoreEntryDefault");
                const nameUid       = foundry.utils.randomID();
                const nameInputId   = `pd-name-${nameUid}`;

                let chosenName;
                try {
                    chosenName = await new Promise((resolve, reject) => {
                        let clicked = false;
                        new Dialog({
                            title: game.i18n.localize("lore-reference-board.Lore.NameEntryTitle"),
                            content: `<form>
                                <div style="padding:6px 0">
                                    <label style="display:block;margin-bottom:4px;font-weight:bold">
                                        ${game.i18n.localize("lore-reference-board.Lore.JournalEntryName")}
                                    </label>
                                    <input id="${nameInputId}" name="${nameInputId}" type="text"
                                           value="${escapeHtml(defaultName)}"
                                           style="width:100%" autofocus />
                                </div>
                            </form>`,
                            buttons: {
                                create: {
                                    label: game.i18n.localize("lore-reference-board.Common.Create"),
                                    callback: (html) => {
                                        clicked = true;
                                        resolve(html[0].querySelector(`#${nameInputId}`)?.value?.trim() || defaultName);
                                    },
                                },
                                cancel: {
                                    label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                                    callback: () => { clicked = true; resolve("cancel"); },
                                },
                            },
                            default: "create",
                            close: () => { if (!clicked) reject(new Error("closed")); },
                        }).render(true);
                    });
                } catch { return; }
                if (chosenName === "cancel") return;

                const entry = await JournalEntry.create({
                    name: chosenName,
                    pages: [{
                        name: chosenName,
                        type: "text",
                        text: { content: "", format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML },
                    }],
                });
                if (!entry) return;

                pinJournalId = entry.id;
                await showLinked(entry.id);
                entry.sheet.render(true);
            });

            // Edit linked journal
            btnEdit?.addEventListener("click", () => {
                const entry = game.journal.get(pinJournalId);
                if (entry) entry.sheet.render(true);
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.Pin.JournalNotFound"));
            });

            // Unlink journal
            btnUnlink?.addEventListener("click", async () => {
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize("lore-reference-board.Pin.UnlinkTitle"),
                    content: `<p>${game.i18n.localize("lore-reference-board.Pin.UnlinkPinContent")}</p>`,
                });
                if (!confirmed) return;
                showUnlinked();
            });

            return true; 
        };

        let tries = 0;
        const tick = () => {
            setupDialog().then(done => {
                if (done) return;
                if (++tries < 60) requestAnimationFrame(tick);
            });
        };
        requestAnimationFrame(tick);

        // Disable Save until Title has a value.
        attachDialogValidation(idColor, "save", ["pTitle"]);

        try {
            return await waitPromise;
        } catch {
            return "cancel";
        }
    }


    // Add Tab & Settings

    async _addTabDialog() {
        const type = await this._addTabTypeDialog();
        if (type === "cancel") return "cancel";
        if (type === "image")     return await this._addImageTabDialog();
        if (type === "document")  return await this._addDocumentTabDialog();
        if (type === "reference") return await this._addReferenceTabDialog();
        return "cancel";
    }

    // 3 Options Picker
    async _addTabTypeDialog() {
        const uid      = foundry.utils.randomID();
        const imgBtnId = `lrt-type-img-${uid}`;
        const docBtnId = `lrt-type-doc-${uid}`;
        const refBtnId = `lrt-type-ref-${uid}`;
        let selectedType = "cancel";
        let dialogRef    = null;

        const content = `
          <div class="lrt-type-picker">
            <p class="lrt-type-prompt">${game.i18n.localize("lore-reference-board.AddTab.ChooseType")}</p>
            <div class="lrt-type-buttons">
              <button type="button" id="${imgBtnId}" class="lrt-type-btn">
                <i class="fas fa-image lrt-type-icon"></i>
                <span class="lrt-type-label">${game.i18n.localize("lore-reference-board.AddTab.TypeImage")}</span>
                <em class="lrt-type-desc">${game.i18n.localize("lore-reference-board.AddTab.TypeImageDesc")}</em>
              </button>
              <button type="button" id="${docBtnId}" class="lrt-type-btn">
                <i class="fas fa-book-open lrt-type-icon"></i>
                <span class="lrt-type-label">${game.i18n.localize("lore-reference-board.AddTab.TypeDocument")}</span>
                <em class="lrt-type-desc">${game.i18n.localize("lore-reference-board.AddTab.TypeDocumentDesc")}</em>
              </button>
              <button type="button" id="${refBtnId}" class="lrt-type-btn">
                <i class="fas fa-link lrt-type-icon"></i>
                <span class="lrt-type-label">${game.i18n.localize("lore-reference-board.AddTab.TypeReference")}</span>
                <em class="lrt-type-desc">${game.i18n.localize("lore-reference-board.AddTab.TypeReferenceDesc")}</em>
              </button>
            </div>
          </div>
        `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            dialogRef = new Dialog({
                title: game.i18n.localize("lore-reference-board.AddTab.Title"),
                content,
                buttons: {
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "cancel",
                close: () => { if (!clicked) resolve(selectedType); },
            }, { width: 600, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] });
            dialogRef.render(true);
        });

        let tries = 0;
        const attach = () => {
            const imgBtn = document.getElementById(imgBtnId);
            const docBtn = document.getElementById(docBtnId);
            const refBtn = document.getElementById(refBtnId);
            if (!imgBtn || !docBtn || !refBtn) return false;
            imgBtn.addEventListener("click", () => { selectedType = "image";     dialogRef?.close(); });
            docBtn.addEventListener("click", () => { selectedType = "document";  dialogRef?.close(); });
            refBtn.addEventListener("click", () => { selectedType = "reference"; dialogRef?.close(); });
            return true;
        };
        const tick = () => { if (!attach() && ++tries < 60) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);

        return await waitPromise;
    }

    // Image tab creation dialog
    async _addImageTabDialog() {
        const uid         = foundry.utils.randomID();
        const nameInputId = `at-name-${uid}`;
        const browseBtnId = `at-browse-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:12px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="tabName" value=""
                   placeholder="${game.i18n.localize("lore-reference-board.AddTab.ImageNamePlaceholder")}"
                   style="width:100%" autofocus />
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelImage")}
            </label>
            <div style="display:flex;gap:6px;align-items:center">
              <input type="text" name="tabImg" value=""
                     placeholder="${game.i18n.localize("lore-reference-board.AddTab.ImagePathPlaceholder")}"
                     style="flex:1;min-width:0;box-sizing:border-box" />
              <button type="button" id="${browseBtnId}"
                style="width:auto;padding:4px 10px;background:#2a3f2a;border:1px solid #4a6a4a;border-radius:4px;
                       color:#cfc;cursor:pointer;white-space:nowrap;flex-shrink:0;font-size:12px;display:inline-flex;align-items:center">
                ${game.i18n.localize("lore-reference-board.Common.Browse")}
              </button>
            </div>
            <div style="margin-top:6px;color:#888;font-size:11px">
              ${game.i18n.localize("lore-reference-board.AddTab.Hint")}
            </div>
          </div>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.AddTab.ImageTabTitle"),
                content,
                buttons: {
                    add: {
                        label: game.i18n.localize("lore-reference-board.Common.Add"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({
                                action: "add",
                                name: (form?.tabName?.value ?? "").trim(),
                                img:  (form?.tabImg?.value  ?? "").trim(),
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "add",
                close: () => { if (!clicked) reject(new Error("Dialog closed")); },
            }, { width: 420, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        const attachBrowse = () => {
            const btn = document.getElementById(browseBtnId);
            if (!btn) return false;
            btn.addEventListener("click", async () => {
                const imgInput = btn.closest("form")?.elements?.tabImg;
                const picked = await pickImagePath(imgInput?.value || "modules/");
                if (picked && imgInput) {
                    imgInput.value = picked;
                    imgInput.dispatchEvent(new Event("input"));
                }
            });
            return true;
        };
        let tries = 0;
        const tick = () => { if (!attachBrowse() && ++tries < 60) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);

        // Both name and image path required
        attachDialogValidation(nameInputId, "add", ["tabName", "tabImg"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "image", name: result.name, img: result.img };
        return "cancel";
    }

    // Document tab creation dialog
    async _addDocumentTabDialog() {
        const uid         = foundry.utils.randomID();
        const nameInputId = `adt-name-${uid}`;
        const pathInputId = `adt-path-${uid}`;
        const browseBtnId = `adt-browse-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:12px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="tabName" value=""
                   placeholder="${game.i18n.localize("lore-reference-board.AddTab.DocumentNamePlaceholder")}"
                   style="width:100%" autofocus />
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelDocPath")}
            </label>
            <div style="display:flex;gap:6px;align-items:center">
              <input type="text" id="${pathInputId}" name="tabDocPath" value=""
                     placeholder="${game.i18n.localize("lore-reference-board.AddTab.DocPathPlaceholder")}"
                     style="flex:1;min-width:0;box-sizing:border-box" />
              <button type="button" id="${browseBtnId}"
                style="width:auto;padding:4px 10px;background:#2a3f2a;border:1px solid #4a6a4a;border-radius:4px;
                       color:#cfc;cursor:pointer;white-space:nowrap;flex-shrink:0;font-size:12px;display:inline-flex;align-items:center">
                ${game.i18n.localize("lore-reference-board.AddTab.BrowseDoc")}
              </button>
            </div>
            <div style="margin-top:6px;color:#888;font-size:11px">
              ${game.i18n.localize("lore-reference-board.AddTab.DocPathHint")}
            </div>
          </div>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.AddTab.DocumentTabTitle"),
                content,
                buttons: {
                    add: {
                        label: game.i18n.localize("lore-reference-board.Common.Add"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({
                                action: "add",
                                name:    (form?.tabName?.value    ?? "").trim(),
                                docPath: (form?.tabDocPath?.value ?? "").trim(),
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "add",
                close: () => { if (!clicked) reject(new Error("Dialog closed")); },
            }, { width: 420, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        const attachBrowse = () => {
            const btn = document.getElementById(browseBtnId);
            if (!btn) return false;
            btn.addEventListener("click", async () => {
                const pathInput = document.getElementById(pathInputId);
                const picked = await pickDocFilePath(pathInput?.value || "modules/");
                if (picked && pathInput) {
                    pathInput.value = picked;
                    pathInput.dispatchEvent(new Event("input"));
                }
            });
            return true;
        };
        let tries = 0;
        const tick = () => { if (!attachBrowse() && ++tries < 60) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);

        attachDialogValidation(nameInputId, "add", ["tabName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "document", name: result.name, docPath: result.docPath };
        return "cancel";
    }

    // Reference tab creation dialog
    async _addReferenceTabDialog() {
        const uid         = foundry.utils.randomID();
        const nameInputId = `art-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:12px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="tabName" value=""
                   placeholder="${game.i18n.localize("lore-reference-board.AddTab.ReferenceNamePlaceholder")}"
                   style="width:100%" autofocus />
          </div>
          <p style="margin:0;font-size:11px;color:#888">
            ${game.i18n.localize("lore-reference-board.AddTab.TypeReferenceDesc")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.AddTab.ReferenceTabTitle"),
                content,
                buttons: {
                    add: {
                        label: game.i18n.localize("lore-reference-board.Common.Add"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({ action: "add", name: (form?.tabName?.value ?? "").trim() });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "add",
                close: () => { if (!clicked) reject(new Error("Dialog closed")); },
            }, { width: 420, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        attachDialogValidation(nameInputId, "add", ["tabName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "reference", name: result.name };
        return "cancel";
    }

    async _tabSettingsDialog(tab) {
        if (tab.type === "document")  return await this._documentTabSettingsDialog(tab);
        if (tab.type === "reference") return await this._referenceTabSettingsDialog(tab);

        let name = tab?.name ?? "";
        let img = tab?.img ?? "";

        const uid = foundry.utils.randomID();
        const browseBtnId = `ts-browse-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}</label>
            <input type="text" name="tsName" value="${escapeHtml(name)}" style="width:100%" autofocus />
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.TabSettings.LabelImage")}</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input type="text" name="tsImg" value="${escapeHtml(img)}" style="flex:1;min-width:0;box-sizing:border-box" />
              <button type="button" id="${browseBtnId}"
                style="width:auto;padding:4px 10px;background:#3a3a3a;border:1px solid #555;border-radius:4px;
                       color:#ccc;cursor:pointer;white-space:nowrap;flex-shrink:0;font-size:12px;display:inline-flex;align-items:center">
                ${game.i18n.localize("lore-reference-board.Common.Browse")}
              </button>
            </div>
            <p style="margin:6px 0 0;font-size:11px;color:#aaa">
              ${game.i18n.localize("lore-reference-board.TabSettings.ImageWarning")}
            </p>
          </div>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let buttonClicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.TabSettings.Title"),
                content,
                buttons: {
                    save: {
                        label: game.i18n.localize("lore-reference-board.Common.Save"),
                        callback: (html) => {
                            buttonClicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({
                                action: "save",
                                name: (form?.tsName?.value ?? "").trim(),
                                img:  (form?.tsImg?.value  ?? "").trim(),
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { buttonClicked = true; resolve("cancel"); },
                    },
                    delete: {
                        label: game.i18n.localize("lore-reference-board.TabSettings.BtnDeleteTab"),
                        callback: () => { buttonClicked = true; resolve({ action: "delete" }); },
                    },
                },
                default: "save",
                close: () => { if (!buttonClicked) reject(new Error("Dialog closed")); },
            }, { width: 440, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        // Attach the Browse button click handler
        const attachBrowse = () => {
            const btn = document.getElementById(browseBtnId);
            if (!btn) return false;
            btn.addEventListener("click", async () => {
                const imgInput = btn.closest("form")?.elements?.tsImg;
                const picked = await pickImagePath(imgInput?.value || "modules/");
                if (picked && imgInput) {
                    imgInput.value = picked;
                    imgInput.dispatchEvent(new Event("input"));
                }
            });
            return true;
        };
        let tries = 0;
        const tick = () => {
            if (attachBrowse()) return;
            if (++tries < 60) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        attachDialogValidation(browseBtnId, "save", ["tsName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }

        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "delete") return { action: "delete" };
        if (result?.action === "save")   return { name: result.name, img: result.img };
        return "cancel";
    }

    // Settings dialog for document type tabs
    async _documentTabSettingsDialog(tab) {
        const uid         = foundry.utils.randomID();
        const nameInputId = `dts-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="dtsName"
                   value="${escapeHtml(tab?.name ?? "")}" style="width:100%" autofocus />
          </div>
          <p style="margin:4px 0 0;font-size:11px;color:#aaa">
            ${game.i18n.localize("lore-reference-board.TabSettings.DocumentHint")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.TabSettings.Title"),
                content,
                buttons: {
                    save: {
                        label: game.i18n.localize("lore-reference-board.Common.Save"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({ action: "save", name: (form?.dtsName?.value ?? "").trim() });
                        },
                    },
                    delete: {
                        label: game.i18n.localize("lore-reference-board.TabSettings.BtnDeleteTab"),
                        callback: () => { clicked = true; resolve({ action: "delete" }); },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "save",
                close: () => { if (!clicked) reject(new Error("Dialog closed")); },
            }, { width: 440, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        attachDialogValidation(nameInputId, "save", ["dtsName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "delete") return { action: "delete" };
        if (result?.action === "save")   return { name: result.name };
        return "cancel";
    }

    // Settings dialog for reference type tabs
    async _referenceTabSettingsDialog(tab) {
        const uid         = foundry.utils.randomID();
        const nameInputId = `rts-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="rtsName"
                   value="${escapeHtml(tab?.name ?? "")}" style="width:100%" autofocus />
          </div>
          <p style="margin:4px 0 0;font-size:11px;color:#aaa">
            ${game.i18n.localize("lore-reference-board.AddTab.TypeReferenceDesc")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.TabSettings.Title"),
                content,
                buttons: {
                    save: {
                        label: game.i18n.localize("lore-reference-board.Common.Save"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({ action: "save", name: (form?.rtsName?.value ?? "").trim() });
                        },
                    },
                    delete: {
                        label: game.i18n.localize("lore-reference-board.TabSettings.BtnDeleteTab"),
                        callback: () => { clicked = true; resolve({ action: "delete" }); },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "save",
                close: () => { if (!clicked) reject(new Error("Dialog closed")); },
            }, { width: 440, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        attachDialogValidation(nameInputId, "save", ["rtsName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "delete") return { action: "delete" };
        if (result?.action === "save")   return { name: result.name };
        return "cancel";
    }

    activateListeners(html) {
        super.activateListeners(html);
        this._htmlRef = html;

        // Apply maxTabRows setting to the tab strip.
        const maxRows = (() => {
            try { return game.settings.get(MODULE_SCOPE, "maxTabRows") ?? 4; } catch { return 4; }
        })();
        const tabsEl = html.find(".lr-tabs")[0];
        if (tabsEl) {
            if (maxRows > 0) {
                tabsEl.style.maxHeight = `${maxRows * 36}px`;
                tabsEl.style.overflowY = "auto";
            } else {
                tabsEl.style.maxHeight = "";
                tabsEl.style.overflowY = "";
            }
        }

        // Tabs
        html.find(".lr-tab[data-tabid]").off("click").on("click", async (ev) => {
            const tabId = ev.currentTarget.dataset.tabid;
            if (!tabId || tabId === this.activeTab) return;
            this.activeTab = tabId;
            await this.render(true);
        });

        // New tab
        html.find("#lr-new-tab").off("click").on("click", async () => {
            const res = await this._addTabDialog();
            if (!res || res === "cancel") return;

            const name = (res.name ?? "").trim();
            if (!name) return ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.NameRequired"));

            const all = await loadTabs();
            const id  = foundry.utils.randomID();

            if (res.type === "document") {
                let docType = null;
                let docRef  = null;
                if (res.docPath) {
                    const cleanPath = normalizeLrbPath(res.docPath);
                    if (_lrbIsUrl(cleanPath)) {
                        docType = "url";
                        docRef  = cleanPath;
                    } else {
                        const detectedType = _lrbDocTypeForExt(cleanPath.split(".").pop());
                        if (detectedType) { docType = detectedType; docRef = cleanPath; }
                    }
                }
                all.push({ id, name, type: "document", docType, docRef });
            } else if (res.type === "reference") {
                // Reference tab,  no document linked yet
                all.push({ id, name, type: "reference", docUuid: null, docType: null });
            } else {
                // image tab
                const img = (res.img ?? "").trim();
                if (!img) return ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.ImageRequired"));
                all.push({ id, name, type: "image", img });
            }

            await saveTabs(all);
            this.activeTab = id;
            await this.render(true);
        });

        // Toolbar
        html.find("#lr-toggle-pin").off("click").on("click", (ev) => {
            this.placingPin = !this.placingPin;
            $(ev.currentTarget).toggleClass("active", this.placingPin);
            ui.notifications.info(game.i18n.localize(this.placingPin ? "lore-reference-board.Tab.PinModeOn" : "lore-reference-board.Tab.PinModeOff"));
        });
        html.find("#lr-toggle-pin").toggleClass("active", this.placingPin);

        html.find("#lr-maximize").off("click").on("click", (ev) => {
            this._maximized = !this._maximized;
            $(ev.currentTarget).toggleClass("active", this._maximized);
            // v12: this.element is already jQuery
            this.element.toggleClass("lr-maximized", this._maximized);
        });
        html.find("#lr-maximize").toggleClass("active", !!this._maximized);

        html.find("#lr-reset-view").off("click").on("click", () => {
            if (this._panzoom) this._panzoom.reset();
        });

        // Tab settings
        html.find("#lr-tab-settings").off("click").on("click", async () => {
            const allTabs = await loadTabs();
            const tab = allTabs.find((t) => t.id === this.activeTab);
            if (!tab) return;

            const res = await this._tabSettingsDialog(tab);
            if (!res || res === "cancel") return;

            // Delete Tab
            if (res?.action === "delete") {
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize("lore-reference-board.TabSettings.DeleteTitle"),
                    content: `<p>${game.i18n.format("lore-reference-board.TabSettings.DeleteContent", { name: escapeHtml(tab.name) })}</p>`,
                });
                if (!confirmed) return;

                const tabPins = await loadPinsForTab(this.activeTab);
                await clearLoreForImages(tabPins.flatMap(p => collectPinImages(p)));
                if (tabPins.length) {
                    const journalMap = getImageJournalMap();
                    const updatedMap = { ...journalMap };
                    for (const p of tabPins) delete updatedMap[p.id];
                    await game.settings.set(MODULE_SCOPE, "imageJournals", updatedMap);
                }
                await deletePinsForTab(this.activeTab);
                const remaining = (await loadTabs()).filter(t => t.id !== this.activeTab);
                await saveTabs(remaining);

                this.activeTab = remaining[0]?.id ?? null;
                await this.render(true);
                return;
            }

            const newName = (res.name ?? "").trim();
            const newImg = (res.img ?? "").trim();
            if (!newName) return ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.NameRequired"));

            const imageChanged = newImg && newImg !== (tab.img ?? "");
            if (imageChanged) {
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize("lore-reference-board.TabSettings.ReplaceMapTitle"),
                    content: `<p>${game.i18n.localize("lore-reference-board.TabSettings.ReplaceMapContent")}</p>`,
                });
                if (!confirmed) return;
                const oldPins = await loadPinsForTab(this.activeTab);
                await clearLoreForImages(oldPins.flatMap(p => collectPinImages(p)));
                await deletePinsForTab(this.activeTab);
            }

            const latest = await loadTabs();
            const idx = latest.findIndex((t) => t.id === this.activeTab);
            if (idx !== -1) {
                latest[idx].name = newName;
                if (imageChanged) latest[idx].img = newImg;
                await saveTabs(latest);
            }
            await this.render(true);
        });

        // Document & Reference tabs
        const currentTab = this._cachedCurrentTab;
        if (currentTab?.type === "document") {
            this._setupDocumentTab(html, currentTab).catch(err =>
                console.error("[lore-reference-board] _setupDocumentTab failed", err)
            );
            return;
        }
        if (currentTab?.type === "reference") {
            this._setupReferenceTab(html, currentTab).catch(err =>
                console.error("[lore-reference-board] _setupReferenceTab failed", err)
            );
            return;
        }

        // Map image
        if (this._cachedActiveTabImg) {
            html.find("#lr-map-image").css({
                "background-image": `url('${this._cachedActiveTabImg}')`,
                "background-size": "contain",
                "background-position": "center",
                "background-repeat": "no-repeat",
            });
        } else {
            html.find("#lr-map-image").css({ "background-image": "" });
        }

        // Panzoom destroy/recreate
        if (this._panzoom) {
            try {
                this._mapWrapEl?.removeEventListener("wheel", this._panzoom.zoomWithWheel);
            } catch { }
            try {
                this._panzoom.destroy();
            } catch { }
            this._panzoom = null;
            this._mapWrapEl = null;
        }

        const mapWrapEl = html.find("#lr-map-wrap")[0];
        if (mapWrapEl && window.PanzoomLoaded && window.Panzoom) {
            this._mapWrapEl = mapWrapEl;
            this._panzoom = Panzoom(mapWrapEl, {
                maxScale: 5,
                minScale: 0.5,
                contain: "outside",
                excludeClass: "lr-pin",
            });
            mapWrapEl.addEventListener("wheel", this._panzoom.zoomWithWheel);
            mapWrapEl.addEventListener("panzoomchange", () => {
                const zoom = this._panzoom?.getScale?.() ?? 1;
                $(this._mapWrapEl).find(".lr-pin").css(
                    "transform", `translate(-50%, -100%) scale(${1 / zoom})`
                );
            });
        }

        // Clear handlers
        html.find("#lr-map-wrap").off(".lrMap");
        $(document).off(".lrMapDrag");

        const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

        const mapWrap = html.find("#lr-map-wrap")[0];
        const clientToMapPct = (clientX, clientY) => {
            const r = mapWrap.getBoundingClientRect();
            return {
                xPct: clamp(((clientX - r.left) / r.width)  * 100, 0, 100),
                yPct: clamp(((clientY - r.top)  / r.height) * 100, 0, 100),
            };
        };

        // Open gallery when placement is OFF and user clicks an existing pin
        html.find("#lr-map-wrap").on("click.lrMap", ".lr-pin", async (ev) => {
            if (this.placingPin) return;
            ev.stopPropagation();
            const pinId = $(ev.currentTarget).data("pinid");
            const pins = await loadPinsForTab(this.activeTab);
            const pin = pins.find(p => p.id === pinId);
            if (!pin) return;
            new PinGalleryApp({ pin, tabId: this.activeTab, boardApp: this }).render(true);
        });

        // Add pin - placement ON, click on empty map space
        html.find("#lr-map-wrap").on("click.lrMap", async (ev) => {
            if (!this.placingPin) return;
            if ($(ev.target).closest(".lr-pin").length) return;

            const { xPct, yPct } = clientToMapPct(ev.clientX, ev.clientY);
            const res = await this._pinDialog({ pin: { xPct, yPct }, isNew: true });
            if (!res || res === "cancel") return;
            if (res?.action !== "save") return;

            const pins = await loadPinsForTab(this.activeTab);
            pins.push({ id: foundry.utils.randomID(), xPct, yPct, ...res.data });
            await savePinsForTab(this.activeTab, pins);
            await this.renderPins(this._htmlRef);
        });

        // Drag / edit pin
        html.find("#lr-map-wrap").on("pointerdown.lrMap", ".lr-pin", (ev) => {
            if (!this.placingPin) return;
            if (ev.button !== 0) return;

            ev.preventDefault();
            ev.stopPropagation();

            const pinEl = ev.currentTarget;
            const $pinEl = $(pinEl);
            const pinId = $pinEl.data("pinid");
            const pointerId = ev.pointerId;

            try {
                pinEl.setPointerCapture(pointerId);
            } catch { }

            this._pinDrag.active = true;
            this._pinDrag.pinId = pinId;
            this._pinDrag.startX = ev.clientX;
            this._pinDrag.startY = ev.clientY;
            this._pinDrag.didDrag = false;

            {
                const r = mapWrap.getBoundingClientRect();
                const pinXPct = parseFloat(pinEl.style.left)  || 0;
                const pinYPct = parseFloat(pinEl.style.top)   || 0;
                const curX = ((ev.clientX - r.left) / r.width)  * 100;
                const curY = ((ev.clientY - r.top)  / r.height) * 100;
                this._pinDrag.offsetXPct = pinXPct - curX;
                this._pinDrag.offsetYPct = pinYPct - curY;
            }

            $pinEl.css("opacity", "0.6");

            const onMove = (ev2) => {
                if (!this._pinDrag.active) return;
                if (ev2.pointerId !== pointerId) return;

                const dx = ev2.clientX - this._pinDrag.startX;
                const dy = ev2.clientY - this._pinDrag.startY;
                if (!this._pinDrag.didDrag && Math.hypot(dx, dy) > 3) this._pinDrag.didDrag = true;

                const r = mapWrap.getBoundingClientRect();
                const xPct = clamp(((ev2.clientX - r.left) / r.width)  * 100 + this._pinDrag.offsetXPct, 0, 100);
                const yPct = clamp(((ev2.clientY - r.top)  / r.height) * 100 + this._pinDrag.offsetYPct, 0, 100);
                $pinEl.css({ left: `${xPct}%`, top: `${yPct}%` });
            };

            const onUp = async (ev2) => {
                if (ev2.pointerId !== pointerId) return;

                $(document).off("pointermove.lrMapDrag", onMove);
                $(document).off("pointerup.lrMapDrag pointercancel.lrMapDrag", onUp);

                try {
                    pinEl.releasePointerCapture(pointerId);
                } catch { }

                $pinEl.css("opacity", "");

                const didDrag = this._pinDrag.didDrag;
                const r = mapWrap.getBoundingClientRect();
                const xPct = clamp(((ev2.clientX - r.left) / r.width)  * 100 + this._pinDrag.offsetXPct, 0, 100);
                const yPct = clamp(((ev2.clientY - r.top)  / r.height) * 100 + this._pinDrag.offsetYPct, 0, 100);

                this._pinDrag.active = false;
                this._pinDrag.pinId = null;

                const pins = await loadPinsForTab(this.activeTab);
                const idx = pins.findIndex((p) => p.id === pinId);
                if (idx === -1) return;

                if (didDrag) {
                    pins[idx].xPct = xPct;
                    pins[idx].yPct = yPct;
                    await savePinsForTab(this.activeTab, pins);
                    await this.renderPins(this._htmlRef);
                    return;
                }

                const pin = pins[idx];
                const res = await this._pinDialog({ pin, isNew: false });
                if (!res || res === "cancel") return;

                if (res?.action === "delete") {
                    const ok = await Dialog.confirm({
                        title: game.i18n.localize("lore-reference-board.Pin.RemoveTitle"),
                        content: `<p>${game.i18n.localize("lore-reference-board.Pin.RemoveContent")}</p>`,
                    });
                    if (!ok) return;

                    await clearLoreForImages(collectPinImages(pin));
                    await clearAllImageJournalLinksForPin(pin.id);
                    pins.splice(idx, 1);
                    await savePinsForTab(this.activeTab, pins);
                    await this.renderPins(this._htmlRef);
                    return;
                }

                if (res?.action === "save") {
                    pins[idx] = { ...pins[idx], ...res.data };
                    await savePinsForTab(this.activeTab, pins);
                    await this.renderPins(this._htmlRef);
                }
            };

            $(document).on("pointermove.lrMapDrag", onMove);
            $(document).on("pointerup.lrMapDrag pointercancel.lrMapDrag", onUp);
        });

        // Right-click delete
        html.find("#lr-map-wrap").on("contextmenu.lrMap", ".lr-pin", async (ev) => {
            if (!this.placingPin) return;

            ev.preventDefault();
            ev.stopPropagation();

            const pinId = $(ev.currentTarget).data("pinid");
            const ok = await Dialog.confirm({
                title:   game.i18n.localize("lore-reference-board.Pin.RemoveTitle"),
                content: game.i18n.localize("lore-reference-board.Pin.RemoveContent"),
            });
            if (!ok) return;

            const pins = await loadPinsForTab(this.activeTab);
            const pinToDelete = pins.find(p => p.id === pinId);
            if (pinToDelete) await clearLoreForImages(collectPinImages(pinToDelete));
            if (pinToDelete) await clearAllImageJournalLinksForPin(pinToDelete.id);
            await savePinsForTab(this.activeTab, pins.filter((p) => p.id !== pinId));
            await this.renderPins(this._htmlRef);
        });

        this.renderPins(html).catch(err =>
            console.error("[lore-reference-board] renderPins failed", err)
        );
    }

    // Document tab rendering
    async _setupDocumentTab(html, tab) {
        const pane = html.find("#lr-doc-pane")[0];
        if (!pane) return;

        const tabId   = tab.id;
        const docType = tab.docType ?? null;
        const docRef  = tab.docRef  ?? null;

        const saveDocToTab = async (newDocType, newDocRef) => {
            const all = await loadTabs();
            const idx = all.findIndex(t => t.id === tabId);
            if (idx === -1) return;
            all[idx].docType = newDocType;
            all[idx].docRef  = newDocRef;
            await saveTabs(all);
        };

        // STATE 1: Unlinked
        if (!docType) {
            pane.innerHTML = `
              <div class="lrt-doc-dropzone" id="lrt-doc-dz-${tabId}">
                <div class="lrt-doc-dz-section lrt-doc-dz-journal">
                  <i class="fas fa-book-open lrt-doc-drop-icon"></i>
                  <p class="lrt-doc-drop-primary">${game.i18n.localize("lore-reference-board.DocumentTab.DropText")}</p>
                </div>
                <div class="lrt-doc-section-divider">
                  <span>${game.i18n.localize("lore-reference-board.DocumentTab.OrCreate")}</span>
                </div>
                <div class="lrt-doc-dz-section">
                  <button type="button" class="lrt-doc-create-btn" id="lrt-doc-create-${tabId}">
                    <i class="fas fa-plus"></i>
                    ${game.i18n.localize("lore-reference-board.DocumentTab.CreateEntry")}
                  </button>
                </div>
                <div class="lrt-doc-section-divider">
                  <span>${game.i18n.localize("lore-reference-board.DocumentTab.OrBrowse")}</span>
                </div>
                <div class="lrt-doc-dz-section">
                  <p class="lrt-doc-browse-label">${game.i18n.localize("lore-reference-board.DocumentTab.LoadFileLabel")}</p>
                  <p class="lrt-doc-browse-types">${game.i18n.localize("lore-reference-board.DocumentTab.SupportedTypes")}</p>
                  <button type="button" class="lrt-doc-browse-btn" id="lrt-doc-browse-${tabId}">
                    <i class="fas fa-folder-open"></i>
                    ${game.i18n.localize("lore-reference-board.DocumentTab.BrowseFile")}
                  </button>
                  <p class="lrt-doc-paste-hint">${game.i18n.localize("lore-reference-board.DocumentTab.PastePathHint")}</p>
                  <div class="lrt-doc-path-row">
                    <input type="text" class="lrt-doc-path-input" id="lrt-doc-path-${tabId}"
                           placeholder="${game.i18n.localize("lore-reference-board.DocumentTab.PathPlaceholder")}" />
                    <button type="button" class="lrt-doc-load-btn" id="lrt-doc-load-${tabId}">
                      ${game.i18n.localize("lore-reference-board.DocumentTab.BtnLoad")}
                    </button>
                  </div>
                </div>
              </div>
            `;

            const dz = pane.querySelector(`#lrt-doc-dz-${tabId}`);

            // Journal drag-drop with depth counter
            let dragDepth = 0;
            dz.addEventListener("dragenter", ev => { ev.preventDefault(); dragDepth++; dz.classList.add("lrt-drop-active"); });
            dz.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dz.classList.remove("lrt-drop-active"); });
            dz.addEventListener("dragover",  ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = "link"; });
            dz.addEventListener("drop", async ev => {
                ev.preventDefault();
                dragDepth = 0;
                dz.classList.remove("lrt-drop-active");

                let data;
                try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                catch { ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.DropReadFail")); return; }

                let journalId = null;
                if (data.type === "JournalEntry") {
                    const entry = await fromUuid(data.uuid ?? "").catch(() => null);
                    journalId = entry?.id ?? null;
                } else if (data.type === "JournalEntryPage") {
                    const page = await fromUuid(data.uuid ?? "").catch(() => null);
                    journalId = page?.parent?.id ?? null;
                }

                if (!journalId) { ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.DropWarn")); return; }
                await saveDocToTab("journal", journalId);
                await this.render(true);
            });

            // Create new journal entry button.
            pane.querySelector(`#lrt-doc-create-${tabId}`)?.addEventListener("click", async () => {
                const defaultName = tab.name || game.i18n.localize("lore-reference-board.Pin.LoreEntryDefault");
                const nameUid     = foundry.utils.randomID();
                const nameInputId = `lrt-dn-${nameUid}`;

                let chosenName;
                try {
                    chosenName = await new Promise((resolve, reject) => {
                        let clicked = false;
                        new Dialog({
                            title: game.i18n.localize("lore-reference-board.Lore.NameEntryTitle"),
                            content: `<form>
                                <div style="padding:6px 0">
                                    <label style="display:block;margin-bottom:4px;font-weight:bold">
                                        ${game.i18n.localize("lore-reference-board.Lore.JournalEntryName")}
                                    </label>
                                    <input id="${nameInputId}" name="${nameInputId}" type="text"
                                           value="${escapeHtml(defaultName)}"
                                           style="width:100%" autofocus />
                                </div>
                            </form>`,
                            buttons: {
                                create: {
                                    label: game.i18n.localize("lore-reference-board.Common.Create"),
                                    callback: (dlgHtml) => {
                                        clicked = true;
                                        resolve(dlgHtml[0].querySelector(`#${nameInputId}`)?.value?.trim() || defaultName);
                                    },
                                },
                                cancel: {
                                    label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                                    callback: () => { clicked = true; resolve("cancel"); },
                                },
                            },
                            default: "create",
                            close: () => { if (!clicked) reject(new Error("closed")); },
                        }).render(true);
                    });
                } catch { return; }
                if (chosenName === "cancel") return;

                const entry = await JournalEntry.create({
                    name: chosenName,
                    pages: [{
                        name: chosenName,
                        type: "text",
                        text: { content: "", format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML },
                    }],
                });
                if (!entry) return;

                await saveDocToTab("journal", entry.id);
                await this.render(true);
                entry.sheet.render(true);
            });

            // File browse button
            pane.querySelector(`#lrt-doc-browse-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath();
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) {
                    await saveDocToTab(newType, picked);
                    await this.render(true);
                } else {
                    ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
                }
            });

            // Manual path input, handles all types including HTML, DOCX, and URLs.
            const loadPath = async () => {
                const input = pane.querySelector(`#lrt-doc-path-${tabId}`);
                const rawPath = normalizeLrbPath(input?.value ?? "");
                if (!rawPath) return;
                const newType = _lrbIsUrl(rawPath) ? "url" : _lrbDocTypeForExt(rawPath.split(".").pop());
                if (newType) {
                    await saveDocToTab(newType, rawPath);
                    await this.render(true);
                } else {
                    ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
                }
            };
            pane.querySelector(`#lrt-doc-load-${tabId}`)?.addEventListener("click", loadPath);
            pane.querySelector(`#lrt-doc-path-${tabId}`)?.addEventListener("keydown", ev => {
                if (ev.key === "Enter") { ev.preventDefault(); loadPath(); }
            });

            return;
        }

        // STATE 2: Journal linked
        if (docType === "journal") {
            let entry = game.journal.get(docRef);
            if (!entry) {
                try { entry = await fromUuid(`JournalEntry.${docRef}`); } catch { entry = null; }
            }

            if (!entry) {
                pane.innerHTML = `
                  <div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${game.i18n.localize("lore-reference-board.DocumentTab.NotFound")}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-unlink-${tabId}">
                      <i class="fas fa-unlink"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Unlink")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-unlink-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await this.render(true);
                });
                return;
            }

            // Render first page, type sorted
            const pages     = getJournalPages(entry);
            const firstPage = pages[0] ?? null;
            let enriched;
            try { enriched = await enrichJournalPage(firstPage, entry); }
            catch { enriched = '<p style="color:#888;font-style:italic">Could not render page.</p>'; }

            const pageNavHtml = pages.length > 1 ? `
              <div class="lrt-doc-page-nav">
                <i class="fas fa-book-open" style="color:#888;font-size:11px;flex-shrink:0"></i>
                <select class="lrt-doc-page-sel" id="lrt-doc-psel-${tabId}">
                  ${pages.map((p, i) => `<option value="${i}">${escapeHtml(p.name || `Page ${i + 1}`)}</option>`).join("")}
                </select>
              </div>` : "";

            pane.innerHTML = `
              <div class="lrt-doc-linked-bar">
                <i class="fas fa-book lrt-doc-linked-icon"></i>
                <span class="lrt-doc-linked-title">${escapeHtml(entry.name)}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--edit" id="lrt-doc-edit-${tabId}">
                  <i class="fas fa-edit"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Edit")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-unlink-${tabId}">
                  <i class="fas fa-unlink"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Unlink")}
                </button>
              </div>
              ${pageNavHtml}
              <div class="lrt-doc-journal-content" id="lrt-doc-content-${tabId}">${enriched}</div>`;

            pane.querySelector(`#lrt-doc-edit-${tabId}`)?.addEventListener("click", () => entry.sheet.render(true));
            pane.querySelector(`#lrt-doc-unlink-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await this.render(true);
            });

            // enrichJournal Page switcher
            let currentPageIndex = 0;
            pane.querySelector(`#lrt-doc-psel-${tabId}`)?.addEventListener("change", async ev => {
                currentPageIndex = parseInt(ev.target.value) || 0;
                const page = pages[currentPageIndex];
                let enriched2;
                try { enriched2 = await enrichJournalPage(page, entry); }
                catch { enriched2 = '<p style="color:#888;font-style:italic">Could not render page.</p>'; }
                const contentEl = pane.querySelector(`#lrt-doc-content-${tabId}`);
                if (contentEl) contentEl.innerHTML = enriched2;
            });

            // Live update when any page in this journal changes
            const hookId = Hooks.on("updateJournalEntryPage", async (updatedPage) => {
                if (updatedPage.parent?.id !== docRef) return;
                if (updatedPage.id !== pages[currentPageIndex]?.id) return;
                let enriched3;
                try { enriched3 = await enrichJournalPage(updatedPage, entry); }
                catch { enriched3 = '<p style="color:#888;font-style:italic">Could not render page.</p>'; }
                const contentEl = pane.querySelector(`#lrt-doc-content-${tabId}`);
                if (contentEl) contentEl.innerHTML = enriched3;
            });
            // Clean up hook when board re-renders.
            Hooks.once("renderLoreReferenceBoardApp", () => Hooks.off("updateJournalEntryPage", hookId));
            return;
        }

        // STATE 3: PDF embedded
        if (docType === "pdf") {
            let blobUrl = null;
            try {
                const resp = await fetch(docRef);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const blob = await resp.blob();
                blobUrl = URL.createObjectURL(blob);
            } catch {
                pane.innerHTML = `<div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${game.i18n.localize("lore-reference-board.DocumentTab.LoadFail")}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                      <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await this.render(true);
                });
                return;
            }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-file-pdf lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-pdf-wrapper">
                <iframe class="lrt-doc-pdf-frame" src="${blobUrl}" title="${escapeHtml(docRef.split("/").pop())}"></iframe>
              </div>`;

            // Revoke the blob URL when the board re-renders
            Hooks.once("renderLoreReferenceBoardApp", () => {
                if (blobUrl) URL.revokeObjectURL(blobUrl);
            });

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 4: embedded txt
        if (docType === "txt") {
            let fileContent = "";
            try {
                const resp = await fetch(docRef);
                if (!resp.ok) throw new Error("fetch failed");
                fileContent = await resp.text();
            } catch {
                pane.innerHTML = `<div class="lrt-doc-not-found"><p>${game.i18n.localize("lore-reference-board.DocumentTab.LoadFail")}</p></div>`;
                return;
            }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-file-alt lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-txt-wrapper">
                <pre class="lrt-doc-txt-content">${escapeHtml(fileContent)}</pre>
              </div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 5: Standalone image
        if (docType === "image") {
            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-image lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-image-wrapper">
                <img class="lrt-doc-standalone-img" src="${escapeHtml(docRef)}" alt="${escapeHtml(docRef.split("/").pop())}" />
              </div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 6: Markdown
        if (docType === "md") {
            let mdText = "";
            try {
                const resp = await fetch(docRef);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                mdText = await resp.text();
            } catch {
                pane.innerHTML = `<div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${game.i18n.localize("lore-reference-board.DocumentTab.LoadFail")}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                      <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await this.render(true);
                });
                return;
            }

            let htmlContent;
            try { htmlContent = window.marked?.parse(mdText) ?? `<pre>${escapeHtml(mdText)}</pre>`; }
            catch { htmlContent = `<pre>${escapeHtml(mdText)}</pre>`; }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-file-lines lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-journal-content lrt-doc-md-content">${htmlContent}</div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 7: HTML file
        if (docType === "html") {
            let blobUrl = null;
            try {
                const resp = await fetch(docRef);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const htmlText = await resp.text();
                const blob = new Blob([htmlText], { type: "text/html" });
                blobUrl = URL.createObjectURL(blob);
            } catch {
                pane.innerHTML = `<div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${game.i18n.localize("lore-reference-board.DocumentTab.LoadFail")}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                      <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await this.render(true);
                });
                return;
            }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-code lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-pdf-wrapper">
                <iframe class="lrt-doc-pdf-frame" src="${blobUrl}" title="${escapeHtml(docRef.split("/").pop())}"></iframe>
              </div>`;

            Hooks.once("renderLoreReferenceBoardApp", () => { if (blobUrl) URL.revokeObjectURL(blobUrl); });

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { if (blobUrl) URL.revokeObjectURL(blobUrl); await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 8: DOCX
        if (docType === "docx") {
            let htmlContent = "";
            try {
                const resp = await fetch(docRef);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const arrayBuffer = await resp.arrayBuffer();
                if (!window.mammoth) throw new Error("mammoth.js not yet loaded,  reload Foundry and try again");
                const result = await window.mammoth.convertToHtml({ arrayBuffer });
                htmlContent = result.value || '<p style="color:#888;font-style:italic">Document appears to be empty.</p>';
            } catch (err) {
                const msg = err?.message ?? game.i18n.localize("lore-reference-board.DocumentTab.LoadFail");
                pane.innerHTML = `<div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${escapeHtml(msg)}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                      <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await this.render(true);
                });
                return;
            }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-file-word lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-journal-content lrt-doc-docx-content">${htmlContent}</div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 9: Web URL,  iframe
        if (docType === "url") {
            const shortUrl = docRef.length > 60 ? docRef.slice(0, 57) + "…" : docRef;
            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-globe lrt-doc-file-icon"></i>
                <span class="lrt-doc-url-label" title="${escapeHtml(docRef)}">${escapeHtml(shortUrl)}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--open-url" id="lrt-doc-openurl-${tabId}">
                  <i class="fas fa-external-link-alt"></i>
                  ${game.i18n.localize("lore-reference-board.DocumentTab.BtnOpenInBrowser")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <iframe class="lrt-doc-url-frame" src="${escapeHtml(docRef)}"
                      title="${escapeHtml(docRef)}"></iframe>`;

            pane.querySelector(`#lrt-doc-openurl-${tabId}`)?.addEventListener("click", () => {
                window.open(docRef, "_blank");
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null);
                await this.render(true);
            });
            return;
        }
    }

    // Reference Tab Render
    static REF_DOC_CFG = {
        Actor:        { icon: "fa-person",     badgeKey: "TypeBadgeActor",     imgFn: d => d.img,                        buttons: ["open"] },
        Cards:        { icon: "fa-layer-group",badgeKey: "TypeBadgeCards",     imgFn: d => d.img,                        buttons: ["open", "shuffle", "deal"] },
        Item:         { icon: "fa-suitcase",   badgeKey: "TypeBadgeItem",      imgFn: d => d.img,                        buttons: ["open"] },
        JournalEntry: { icon: "fa-book-open",  badgeKey: "TypeBadgeJournal",   imgFn: d => null,                         buttons: ["open"] },
        Macro:        { icon: "fa-code",       badgeKey: "TypeBadgeMacro",     imgFn: d => d.img,                        buttons: ["open", "execute"] },
        Playlist:     { icon: "fa-music",      badgeKey: "TypeBadgePlaylist",  imgFn: d => null,                         buttons: ["open"] },
        RollTable:    { icon: "fa-table-list", badgeKey: "TypeBadgeRollTable", imgFn: d => d.img,                        buttons: ["open", "roll"] },
        Scene:        { icon: "fa-map",        badgeKey: "TypeBadgeScene",     imgFn: d => d.thumb ?? d.background?.src, buttons: ["open", "activate"] },
    };

    static REF_ACCEPTED_TYPES = new Set(["Actor", "Cards", "Item", "JournalEntry", "JournalEntryPage", "Macro", "Playlist", "RollTable", "Scene"]);

    async _setupReferenceTab(html, tab) {
        const pane = html.find("#lr-ref-pane")[0];
        if (!pane) return;

        const COLS  = 4;
        const tabId = tab.id;
        const L  = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);
        const LG = key => game.i18n.localize(`lore-reference-board.ReferenceGrid.${key}`);

        let cells = Array.isArray(tab.cells) ? tab.cells : [];
        if (cells.length === 0 && tab.docUuid) {
            cells = [{
                id: foundry.utils.randomID(),
                row: 1, col: 1, rowSpan: 1, colSpan: 1,
                docUuid: tab.docUuid, docType: tab.docType,
            }];
            const all = await loadTabs();
            const idx = all.findIndex(t => t.id === tabId);
            if (idx !== -1) {
                all[idx].cells = cells;
                delete all[idx].docUuid;
                delete all[idx].docType;
                await saveTabs(all);
            }
        }

        // Resolve all docs in parallel
        const resolved = await Promise.all(cells.map(async cell => {
            if (!cell.docUuid) return { cell, doc: null };
            let doc = null;
            try { doc = await fromUuid(cell.docUuid); } catch {}
            return { cell, doc };
        }));
        const docMap = new Map(resolved.map(({ cell, doc }) => [cell.id, doc]));

        // Calculate grid dimensions
        let maxRow = 0;
        for (const c of cells) maxRow = Math.max(maxRow, c.row + c.rowSpan - 1);
        const gridRows = maxRow + 3; // three extra empty rows at bottom

        // Build occupied-position set
        const buildOccupied = (cellList, excludeId = null) => {
            const set = new Set();
            for (const c of cellList) {
                if (c.id === excludeId) continue;
                for (let r = c.row; r < c.row + c.rowSpan; r++)
                    for (let cc = c.col; cc < c.col + c.colSpan; cc++)
                        set.add(`${r},${cc}`);
            }
            return set;
        };
        const occupied = buildOccupied(cells);

        // Empty positions
        const emptyPositions = [];
        for (let r = 1; r <= gridRows; r++)
            for (let c = 1; c <= COLS; c++)
                if (!occupied.has(`${r},${c}`)) emptyPositions.push({ row: r, col: c });

        // Render occupied cells
        const INLINE_TYPES = new Set(["JournalEntry", "RollTable"]);

        const cellsHtml = resolved.map(({ cell, doc }) => {
            const gs = `grid-column:${cell.col}/span ${cell.colSpan};grid-row:${cell.row}/span ${cell.rowSpan};`;

            // PDF / TXT / Markdown
            if (cell.docType === "file") {
                const fileName  = (cell.filePath ?? "").split("/").pop() || "File";
                const fType     = cell.fileType ?? "txt";
                const typeKey   = `file-${fType}`;
                const badgeLabel = fType === "pdf" ? LG("FileCellBadgePdf")
                                 : fType === "md"  ? LG("FileCellBadgeMd")
                                 :                   LG("FileCellBadgeTxt");
                return `
                <div class="lrt-ref-cell lrt-ref-cell--inline-content" style="${gs}" data-cell-id="${cell.id}">
                  <div class="lrt-ref-cell-header">
                    <span class="lrt-ref-type-badge lrt-ref-badge--${escapeHtml(typeKey)}">${escapeHtml(badgeLabel)}</span>
                    <span class="lrt-ref-cell-hdr-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</span>
                    <div class="lrt-ref-cell-hdr-btns"></div>
                    <button type="button" class="lrt-ref-cell-edit-btn" data-cell-id="${cell.id}" title="${LG("EditCellTitle")}">
                      <i class="fas fa-pencil-alt"></i>
                    </button>
                  </div>
                  <div class="lrt-ref-cell-content lrt-ref-cell-content--file" data-cell-id="${cell.id}" data-file-type="${escapeHtml(fType)}">
                    <p style="color:#555;font-style:italic;font-size:11px;padding:4px 0">Loading…</p>
                  </div>
                </div>`;
            }

            if (!cell.docUuid || !doc) {
                return `
                <div class="lrt-ref-cell lrt-ref-cell--error" style="${gs}" data-cell-id="${cell.id}">
                  <div class="lrt-ref-cell-header">
                    <i class="fas fa-exclamation-triangle lrt-ref-cell-warn"></i>
                    <button type="button" class="lrt-ref-cell-edit-btn" data-cell-id="${cell.id}" title="${LG("EditCellTitle")}">
                      <i class="fas fa-pencil-alt"></i>
                    </button>
                  </div>
                  <div class="lrt-ref-cell-body">
                    <p class="lrt-ref-cell-error-msg">${L("NotFound")}</p>
                  </div>
                </div>`;
            }

            const cfg     = LoreReferenceBoardApp.REF_DOC_CFG[cell.docType] ??
                { icon: "fa-link", badgeKey: "TypeBadgeActor", imgFn: () => null, buttons: ["open"] };
            const badge   = L(cfg.badgeKey);
            const typeKey = cell.docType ?? "unknown";

            // Inline-content variant: Journal + RollTable
            if (INLINE_TYPES.has(cell.docType)) {
                let hdrBtnsHtml = "";
                if (cell.docType === "JournalEntry") {
                    hdrBtnsHtml = `<button type="button" class="lrt-ref-hdr-btn lrt-ref-hdr-btn--open" data-cell-id="${cell.id}" title="${L("BtnOpen")}"><i class="fas fa-external-link-alt"></i> ${L("BtnOpen")}</button>`;
                } else if (cell.docType === "RollTable") {
                    hdrBtnsHtml = `
                        <button type="button" class="lrt-ref-hdr-btn lrt-ref-hdr-btn--roll" data-cell-id="${cell.id}" title="${L("BtnRoll")}"><i class="fas fa-dice-d20"></i> ${L("BtnRoll")}</button>
                        <button type="button" class="lrt-ref-hdr-btn lrt-ref-hdr-btn--open" data-cell-id="${cell.id}" title="${L("BtnOpen")}"><i class="fas fa-external-link-alt"></i></button>`;
                }
                return `
                <div class="lrt-ref-cell lrt-ref-cell--inline-content" style="${gs}" data-cell-id="${cell.id}">
                  <div class="lrt-ref-cell-header">
                    <span class="lrt-ref-type-badge lrt-ref-badge--${typeKey}">${escapeHtml(badge)}</span>
                    <span class="lrt-ref-cell-hdr-name" title="${escapeHtml(doc.name ?? "")}">${escapeHtml(doc.name ?? "")}</span>
                    <div class="lrt-ref-cell-hdr-btns">${hdrBtnsHtml}</div>
                    <button type="button" class="lrt-ref-cell-edit-btn" data-cell-id="${cell.id}" title="${LG("EditCellTitle")}">
                      <i class="fas fa-pencil-alt"></i>
                    </button>
                  </div>
                  <div class="lrt-ref-cell-content" data-cell-id="${cell.id}" data-doc-type="${typeKey}">
                    <p style="color:#555;font-style:italic;font-size:11px;padding:4px 0">Loading…</p>
                  </div>
                </div>`;
            }

            // Standard card variant: Actor, Item, Macro, Playlist, Scene, Cards
            const imgSrc  = cfg.imgFn(doc);
            const showImg = !!imgSrc && cell.rowSpan >= 2;

            const btnHtml = cfg.buttons.map(b => {
                switch (b) {
                    case "open":     return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--open"     data-cell-id="${cell.id}"><i class="fas fa-external-link-alt"></i> ${L("BtnOpen")}</button>`;
                    case "execute":  return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--exec"     data-cell-id="${cell.id}"><i class="fas fa-play"></i> ${L("BtnExecute")}</button>`;
                    case "roll":     return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--roll"     data-cell-id="${cell.id}"><i class="fas fa-dice-d20"></i> ${L("BtnRoll")}</button>`;
                    case "activate": return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--activate" data-cell-id="${cell.id}"><i class="fas fa-eye"></i> ${L("BtnActivateScene")}</button>`;
                    case "shuffle":  return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--shuffle lrt-ref-cell-btn--icon" data-cell-id="${cell.id}" title="${L("BtnShuffle")}"><i class="fas fa-shuffle"></i></button>`;
                    case "deal":     return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--deal    lrt-ref-cell-btn--icon" data-cell-id="${cell.id}" title="${L("BtnDeal")}"><i class="fas fa-hand-holding"></i></button>`;
                    default: return "";
                }
            }).join("");

            return `
            <div class="lrt-ref-cell" style="${gs}" data-cell-id="${cell.id}">
              <div class="lrt-ref-cell-header">
                <span class="lrt-ref-type-badge lrt-ref-badge--${typeKey}">${escapeHtml(badge)}</span>
                <button type="button" class="lrt-ref-cell-edit-btn" data-cell-id="${cell.id}" title="${LG("EditCellTitle")}">
                  <i class="fas fa-pencil-alt"></i>
                </button>
              </div>
              <div class="lrt-ref-cell-body">
                ${showImg ? `<div class="lrt-ref-cell-img-wrap"><img class="lrt-ref-cell-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(doc.name ?? "")}" /></div>` : ""}
                <div class="lrt-ref-cell-info">
                  <div class="lrt-ref-cell-name">${escapeHtml(doc.name ?? "")}</div>
                  <div class="lrt-ref-cell-actions">${btnHtml}</div>
                </div>
              </div>
            </div>`;
        }).join("");

        // Render empty placeholder cells
        const emptyCellsHtml = emptyPositions.map(pos =>
            `<div class="lrt-ref-empty-cell" style="grid-column:${pos.col};grid-row:${pos.row};" data-row="${pos.row}" data-col="${pos.col}">
               <button type="button" class="lrt-ref-add-btn" data-row="${pos.row}" data-col="${pos.col}">
                 <i class="fas fa-plus"></i>
               </button>
             </div>`
        ).join("");

        pane.innerHTML = `<div class="lrt-ref-grid" id="lrt-ref-grid-${tabId}">${cellsHtml}${emptyCellsHtml}</div>`;

        // Async: inject inline content for Journal, RollTable, and file cells
        for (const { cell, doc } of resolved) {
            // File cells have no doc,  handle before the doc guard below.
            if (cell.docType === "file") {
                const contentEl = pane.querySelector(`.lrt-ref-cell-content[data-cell-id="${cell.id}"]`);
                if (!contentEl) continue;
                const fPath = cell.filePath ?? "";
                const fType = cell.fileType ?? "txt";
                (async () => {
                    try {
                        const resp = await fetch(fPath);
                        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                        if (fType === "pdf") {
                            const blob   = await resp.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            contentEl.innerHTML = `<iframe class="lrt-ref-cell-iframe" src="${blobUrl}" title="${escapeHtml(fPath.split("/").pop())}"></iframe>`;
                            Hooks.once("renderLoreReferenceBoardApp", () => URL.revokeObjectURL(blobUrl));
                        } else if (fType === "md") {
                            const mdText = await resp.text();
                            let html;
                            try   { html = window.marked?.parse(mdText) ?? `<pre>${escapeHtml(mdText)}</pre>`; }
                            catch { html = `<pre>${escapeHtml(mdText)}</pre>`; }
                            contentEl.innerHTML = html;
                        } else {
                            // txt (and any other unrecognised type)
                            const text = await resp.text();
                            contentEl.innerHTML = `<pre class="lrt-doc-txt-content">${escapeHtml(text)}</pre>`;
                        }
                    } catch {
                        contentEl.innerHTML = `<p class="lrt-ref-cell-load-fail">${LG("FileCellLoadFail")}</p>`;
                    }
                })().catch(err =>
                    console.error("[lore-reference-board] File cell render error:", err));
                continue;
            }

            if (!doc) continue;
            const contentEl = pane.querySelector(`.lrt-ref-cell-content[data-cell-id="${cell.id}"]`);
            if (!contentEl) continue;   // not an inline-content cell

            if (cell.docType === "JournalEntry") {
                (async () => {
                    const pages     = getJournalPages(doc);
                    const firstPage = pages[0] ?? null;
                    contentEl.innerHTML = await enrichJournalPage(firstPage, doc);
                    // Inject page-nav bar above the content area if the journal has multiple pages.
                    // Pass doc.uuid so compendium journals (e.g. Compendium.pf2e.journals.JournalEntry.xxx)
                    // are resolved correctly,  game.journal.get() only finds world entries.
                    await wirePageNav(contentEl, doc.uuid);
                })().catch(err =>
                    console.error("[lore-reference-board] Journal cell render error:", err));
            } else if (cell.docType === "RollTable") {
                contentEl.innerHTML = _renderRollTableHtml(doc);
            }
        }

        // Wire action buttons (standard card cells)
        pane.querySelectorAll(".lrt-ref-cell-btn--open").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.sheet.render(true));
        });
        pane.querySelectorAll(".lrt-ref-cell-btn--exec").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.execute?.({}));
        });
        pane.querySelectorAll(".lrt-ref-cell-btn--roll").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.draw?.());
        });
        pane.querySelectorAll(".lrt-ref-cell-btn--activate").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.activate?.());
        });
        pane.querySelectorAll(".lrt-ref-cell-btn--shuffle").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.shuffle?.());
        });
        pane.querySelectorAll(".lrt-ref-cell-btn--deal").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => this._dealCardsDialog(doc));
        });

        // Wire inline header buttons (Journal / RollTable cells)
        pane.querySelectorAll(".lrt-ref-hdr-btn--open").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.sheet.render(true));
        });
        pane.querySelectorAll(".lrt-ref-hdr-btn--roll").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", async () => {
                await doc.draw?.();
                // Refresh the table display to reflect newly drawn entries
                const contentEl = pane.querySelector(`.lrt-ref-cell-content[data-cell-id="${btn.dataset.cellId}"]`);
                if (contentEl) contentEl.innerHTML = _renderRollTableHtml(doc);
            });
        });

        // Wire edit buttons
        pane.querySelectorAll(".lrt-ref-cell-edit-btn").forEach(btn => {
            btn.addEventListener("click", () =>
                this._editRefCellDialog(tabId, btn.dataset.cellId));
        });

        // Wire add buttons
        pane.querySelectorAll(".lrt-ref-add-btn").forEach(btn => {
            btn.addEventListener("click", () =>
                this._addRefCellDialog(tabId, parseInt(btn.dataset.row), parseInt(btn.dataset.col)));
        });
    }

    // Helper: build span-picker HTML,  shows the actual 4-column grid
    // existingCells: current cells array (to mark occupied positions)
    // maxRows: number of rows to show in the picker
    // excludeId: cell id to treat as free (used in edit dialog for the cell being edited)
    _buildSpanPickerHtml(existingCells, maxRows, excludeId = null) {
        const COLS = 4;
        const occupied = new Set();
        for (const c of existingCells) {
            if (c.id === excludeId) continue;
            for (let r = c.row; r < c.row + c.rowSpan; r++)
                for (let cc = c.col; cc < c.col + c.colSpan; cc++)
                    occupied.add(`${r},${cc}`);
        }
        let html = "";
        for (let r = 1; r <= maxRows; r++)
            for (let c = 1; c <= COLS; c++) {
                const occ = occupied.has(`${r},${c}`) ? " lrt-span-cell--occupied" : "";
                html += `<div class="lrt-span-cell${occ}" data-row="${r}" data-col="${c}"></div>`;
            }
        return html;
    }

    // Helper: wire span-picker interaction
    // Two-click: first click sets the anchor corner, second click sets the opposite corner.
    // Any free rectangle can be drawn,  not anchored to the "+" cell position.
    // Returns { getSpan() } → { row, col, rowSpan, colSpan } | null
    _initSpanPicker(pickerEl, sizeEl, existingCells, initialRow, initialCol, excludeId = null) {
        const occupied = new Set();
        for (const c of existingCells) {
            if (c.id === excludeId) continue;
            for (let r = c.row; r < c.row + c.rowSpan; r++)
                for (let cc = c.col; cc < c.col + c.colSpan; cc++)
                    occupied.add(`${r},${cc}`);
        }

        const isFreeRect = (r1, c1, r2, c2) => {
            for (let r = r1; r <= r2; r++)
                for (let c = c1; c <= c2; c++)
                    if (occupied.has(`${r},${c}`)) return false;
            return true;
        };

        const allCells = Array.from(pickerEl.querySelectorAll(".lrt-span-cell"));
        const freeCells = allCells.filter(c => !c.classList.contains("lrt-span-cell--occupied"));

        let anchorRow = null, anchorCol = null;
        // Default selection: 1×1 at the suggested position (if free), else null
        let sel = (!occupied.has(`${initialRow},${initialCol}`))
            ? { row: initialRow, col: initialCol, rowSpan: 1, colSpan: 1 }
            : null;

        const updateLabel = () => {
            if (!sizeEl) return;
            if (!sel) { sizeEl.textContent = ""; return; }
            const { colSpan: cs, rowSpan: rs } = sel;
            sizeEl.textContent = `${cs} col${cs > 1 ? "s" : ""} × ${rs} row${rs > 1 ? "s" : ""}`;
        };

        const repaint = (hoverRow = null, hoverCol = null) => {
            allCells.forEach(cell => {
                const r = +cell.dataset.row, c = +cell.dataset.col;
                if (cell.classList.contains("lrt-span-cell--occupied")) return;
                cell.classList.remove("lrt-span-selected", "lrt-span-preview",
                                      "lrt-span-anchor", "lrt-span-invalid");

                // Confirmed selection
                if (sel && r >= sel.row && r < sel.row + sel.rowSpan &&
                           c >= sel.col && c < sel.col + sel.colSpan) {
                    cell.classList.add("lrt-span-selected");
                }

                // Hover preview (only while anchor is set)
                if (anchorRow !== null && hoverRow !== null) {
                    const r1 = Math.min(anchorRow, hoverRow), r2 = Math.max(anchorRow, hoverRow);
                    const c1 = Math.min(anchorCol, hoverCol), c2 = Math.max(anchorCol, hoverCol);
                    if (r >= r1 && r <= r2 && c >= c1 && c <= c2) {
                        cell.classList.remove("lrt-span-selected");
                        cell.classList.add(isFreeRect(r1, c1, r2, c2)
                            ? "lrt-span-preview" : "lrt-span-invalid");
                    }
                }

                // Anchor dot (on top of everything)
                if (anchorRow !== null && r === anchorRow && c === anchorCol) {
                    cell.classList.remove("lrt-span-preview", "lrt-span-invalid",
                                          "lrt-span-selected");
                    cell.classList.add("lrt-span-anchor");
                }
            });
        };

        freeCells.forEach(cell => {
            const r = +cell.dataset.row, c = +cell.dataset.col;
            cell.addEventListener("mouseenter", () => repaint(r, c));
            cell.addEventListener("click", () => {
                if (anchorRow === null) {
                    // First click → set anchor, default to 1×1 selection here
                    anchorRow = r; anchorCol = c;
                    sel = { row: r, col: c, rowSpan: 1, colSpan: 1 };
                    updateLabel();
                    repaint(r, c);
                } else {
                    // Second click → confirm rectangle
                    const r1 = Math.min(anchorRow, r), r2 = Math.max(anchorRow, r);
                    const c1 = Math.min(anchorCol, c), c2 = Math.max(anchorCol, c);
                    anchorRow = null; anchorCol = null;
                    if (isFreeRect(r1, c1, r2, c2)) {
                        sel = { row: r1, col: c1, rowSpan: r2 - r1 + 1, colSpan: c2 - c1 + 1 };
                    }
                    updateLabel();
                    repaint();
                }
            });
        });

        pickerEl.addEventListener("mouseleave", () => repaint());

        repaint();
        updateLabel();

        return { getSpan: () => sel };
    }

    // Helper: collision check
    _refCellCollides(cells, excludeId, row, col, rowSpan, colSpan) {
        const COLS = 4;
        if (col + colSpan - 1 > COLS) return "overflow";
        for (const c of cells) {
            if (c.id === excludeId) continue;
            for (let r = c.row; r < c.row + c.rowSpan; r++)
                for (let cc = c.col; cc < c.col + c.colSpan; cc++)
                    for (let tr = row; tr < row + rowSpan; tr++)
                        for (let tc = col; tc < col + colSpan; tc++)
                            if (r === tr && cc === tc) return "collision";
        }
        return null;
    }

    // Add Cell Dialog
    async _addRefCellDialog(tabId, startRow, startCol) {
        const uid  = foundry.utils.randomID();
        const L  = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);
        const LG = key => game.i18n.localize(`lore-reference-board.ReferenceGrid.${key}`);

        // Load current cells to show occupancy in the picker
        const allTabsInit = await loadTabs();
        const tabIdxInit  = allTabsInit.findIndex(t => t.id === tabId);
        const initCells   = tabIdxInit !== -1 ? (allTabsInit[tabIdxInit].cells ?? []) : [];

        // Calculate picker rows: current grid height + 2 empty rows for expansion
        let maxRow = 0;
        for (const c of initCells) maxRow = Math.max(maxRow, c.row + c.rowSpan - 1);
        const pickerRows = Math.max(maxRow + 3, startRow + 1);

        let pendingUuid     = null;
        let pendingType     = null;
        let pendingFilePath = null;
        let pendingFileType = null;
        let picker          = null;

        const content = `
          <div class="lrt-ref-cell-dialog">
            <div class="lrt-ref-cell-dz" id="lrt-rcd-dz-${uid}">
              <i class="fas fa-link lrt-ref-dz-icon" id="lrt-rcd-icon-${uid}"></i>
              <p class="lrt-ref-dz-primary" id="lrt-rcd-name-${uid}">${LG("DropToLink")}</p>
              <p class="lrt-ref-dz-sub"    id="lrt-rcd-sub-${uid}">${L("DropSubtext")}</p>
            </div>
            <div class="lrt-ref-file-section">
              <div class="lrt-ref-file-divider">${LG("FileCellDivider")}</div>
              <p class="lrt-ref-file-instruct">${LG("FileCellInstruct")}</p>
              <div class="lrt-ref-file-row">
                <input type="text" class="lrt-ref-file-path" id="lrt-rcd-fpath-${uid}"
                       placeholder="${LG("FileCellPathPlaceholder")}" />
                <button type="button" class="lrt-ref-file-browse-btn" id="lrt-rcd-fbrowse-${uid}">
                  <i class="fas fa-folder-open"></i> ${LG("FileCellBrowse")}
                </button>
              </div>
            </div>
            <div class="lrt-ref-span-section">
              <p class="lrt-ref-span-label">${LG("SpanPickerLabel")}</p>
              <p class="lrt-ref-span-hint">${LG("SpanPickerHint")}</p>
              <div class="lrt-span-picker" id="lrt-span-picker-${uid}">${this._buildSpanPickerHtml(initCells, pickerRows)}</div>
              <p class="lrt-span-size-label" id="lrt-span-size-${uid}"></p>
            </div>
          </div>`;

        const result = await new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title:   LG("AddCellTitle"),
                content,
                buttons: {
                    add:    { label: game.i18n.localize("lore-reference-board.Common.Add"),    callback: () => { clicked = true; resolve("add");    } },
                    cancel: { label: game.i18n.localize("lore-reference-board.Common.Cancel"), callback: () => { clicked = true; resolve("cancel"); } },
                },
                default: "add",
                close:  () => { if (!clicked) reject(); },
                render: (jqHtml) => {
                    const root = jqHtml[0];
                    picker = this._initSpanPicker(
                        root.querySelector(`#lrt-span-picker-${uid}`),
                        root.querySelector(`#lrt-span-size-${uid}`),
                        initCells, startRow, startCol
                    );

                    // Drop zone
                    const dz = root.querySelector(`#lrt-rcd-dz-${uid}`);
                    let depth = 0;
                    dz.addEventListener("dragenter",  ev => { ev.preventDefault(); depth++; dz.classList.add("lrt-drop-active"); });
                    dz.addEventListener("dragleave",  () => { if (!--depth) dz.classList.remove("lrt-drop-active"); });
                    dz.addEventListener("dragover",   ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = "link"; });
                    dz.addEventListener("drop", async ev => {
                        ev.preventDefault(); depth = 0; dz.classList.remove("lrt-drop-active");
                        let data;
                        try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                        catch { ui.notifications.warn(L("DropReadFail")); return; }
                        if (!LoreReferenceBoardApp.REF_ACCEPTED_TYPES.has(data.type)) { ui.notifications.warn(L("DropWarn")); return; }
                        let doc; try { doc = await fromUuid(data.uuid ?? ""); } catch { doc = null; }
                        if (!doc) { ui.notifications.warn(L("DropWarn")); return; }
                        const rd = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
                        const rt = rd?.documentName ?? null;
                        if (!rt || !LoreReferenceBoardApp.REF_DOC_CFG[rt]) { ui.notifications.warn(L("DropWarn")); return; }
                        pendingUuid = rd.uuid; pendingType = rt;
                        // Clear any pending file when a doc is linked
                        pendingFilePath = null; pendingFileType = null;
                        const fpathElDrop = root.querySelector(`#lrt-rcd-fpath-${uid}`);
                        if (fpathElDrop) fpathElDrop.value = "";
                        const cfg = LoreReferenceBoardApp.REF_DOC_CFG[rt];
                        dz.classList.add("lrt-ref-dz--linked");
                        root.querySelector(`#lrt-rcd-icon-${uid}`).className = `fas ${cfg.icon} lrt-ref-dz-icon lrt-ref-dz-icon--linked`;
                        root.querySelector(`#lrt-rcd-name-${uid}`).textContent = rd.name ?? "";
                        root.querySelector(`#lrt-rcd-sub-${uid}`).textContent  = L(cfg.badgeKey);
                    });

                    // File section wiring
                    const fpathEl   = root.querySelector(`#lrt-rcd-fpath-${uid}`);
                    const fbrowseEl = root.querySelector(`#lrt-rcd-fbrowse-${uid}`);

                    const applyFilePath = (path) => {
                        if (!path) return;
                        const ext  = path.split(".").pop().toLowerCase();
                        const type = ext === "pdf" ? "pdf" : ext === "md" ? "md" : "txt";
                        fpathEl.value   = path;
                        pendingFilePath  = path;
                        pendingFileType  = type;
                        // Unlink drop zone when a file is chosen
                        pendingUuid = null; pendingType = null;
                        dz.classList.remove("lrt-ref-dz--linked");
                        root.querySelector(`#lrt-rcd-icon-${uid}`).className = "fas fa-link lrt-ref-dz-icon";
                        root.querySelector(`#lrt-rcd-name-${uid}`).textContent = LG("DropToLink");
                        root.querySelector(`#lrt-rcd-sub-${uid}`).textContent  = L("DropSubtext");
                    };

                    fpathEl?.addEventListener("change", () => {
                        const path = normalizeLrbPath(fpathEl.value);
                        if (path) applyFilePath(path);
                        else { pendingFilePath = null; pendingFileType = null; }
                    });
                    fbrowseEl?.addEventListener("click", async () => {
                        const picked = await pickRefFilePath(fpathEl?.value || "modules/");
                        if (picked) applyFilePath(normalizeLrbPath(picked));
                    });
                },
            }, { width: 400, classes: ["app","window-app","dialog","lore-rb-dialog"] }).render(true);
        }).catch(() => "cancel");

        if (result !== "add" || (!pendingUuid && !pendingFilePath)) return;

        const span = picker?.getSpan();
        if (!span) { ui.notifications.warn(LG("SpanNotSelected")); return; }

        const { row, col, rowSpan, colSpan } = span;
        const allTabs = await loadTabs();
        const idx     = allTabs.findIndex(t => t.id === tabId);
        if (idx === -1) return;
        const cells   = allTabs[idx].cells ?? [];
        const problem = this._refCellCollides(cells, null, row, col, rowSpan, colSpan);
        if (problem === "overflow")   { ui.notifications.warn(LG("OverflowError"));   return; }
        if (problem === "collision")  { ui.notifications.warn(LG("CollisionError"));  return; }

        const newCell = pendingFilePath
            ? { id: foundry.utils.randomID(), row, col, rowSpan, colSpan, docType: "file", filePath: pendingFilePath, fileType: pendingFileType }
            : { id: foundry.utils.randomID(), row, col, rowSpan, colSpan, docUuid: pendingUuid, docType: pendingType };
        allTabs[idx].cells = [...cells, newCell];
        await saveTabs(allTabs);
        await this.render(true);
    }

    // Edit Cell Dialog
    async _editRefCellDialog(tabId, cellId) {
        const COLS = 4;
        const uid  = foundry.utils.randomID();
        const L  = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);
        const LG = key => game.i18n.localize(`lore-reference-board.ReferenceGrid.${key}`);

        // Load fresh data
        const allTabs = await loadTabs();
        const tabIdx  = allTabs.findIndex(t => t.id === tabId);
        if (tabIdx === -1) return;
        const cells = allTabs[tabIdx].cells ?? [];
        const cell  = cells.find(c => c.id === cellId);
        if (!cell) return;

        // Resolve current doc (file cells have no docUuid)
        const isFileCell = cell.docType === "file";
        let currentDoc = null;
        try { if (cell.docUuid) currentDoc = await fromUuid(cell.docUuid); } catch {}

        let pendingUuid     = cell.docUuid ?? null;
        let pendingType     = isFileCell ? null : (cell.docType ?? null);
        let pendingFilePath = isFileCell ? (cell.filePath ?? null) : null;
        let pendingFileType = isFileCell ? (cell.fileType ?? "txt") : null;
        let picker          = null;

        // Calculate picker rows: at least current cell's bottom + 2 extra rows
        let maxRow = 0;
        for (const c of cells) maxRow = Math.max(maxRow, c.row + c.rowSpan - 1);
        const pickerRows = maxRow + 3;

        // Initial drop-zone display
        const initLinked = !!currentDoc && !isFileCell;
        const initCfg    = LoreReferenceBoardApp.REF_DOC_CFG[cell.docType] ?? { icon: "fa-link", badgeKey: "TypeBadgeActor" };

        const content = `
          <div class="lrt-ref-cell-dialog">
            <div class="lrt-ref-cell-dz${initLinked ? " lrt-ref-dz--linked" : ""}" id="lrt-rcd-dz-${uid}">
              <i class="fas ${initCfg.icon} lrt-ref-dz-icon${initLinked ? " lrt-ref-dz-icon--linked" : ""}" id="lrt-rcd-icon-${uid}"></i>
              <p class="lrt-ref-dz-primary" id="lrt-rcd-name-${uid}">${initLinked ? escapeHtml(currentDoc.name ?? "") : LG("DropToLink")}</p>
              <p class="lrt-ref-dz-sub"    id="lrt-rcd-sub-${uid}">${initLinked ? escapeHtml(L(initCfg.badgeKey)) : L("DropSubtext")}</p>
            </div>
            <div class="lrt-ref-file-section">
              <div class="lrt-ref-file-divider">${LG("FileCellDivider")}</div>
              <p class="lrt-ref-file-instruct">${LG("FileCellInstruct")}</p>
              <div class="lrt-ref-file-row">
                <input type="text" class="lrt-ref-file-path" id="lrt-rcd-fpath-${uid}"
                       value="${escapeHtml(pendingFilePath ?? "")}"
                       placeholder="${LG("FileCellPathPlaceholder")}" />
                <button type="button" class="lrt-ref-file-browse-btn" id="lrt-rcd-fbrowse-${uid}">
                  <i class="fas fa-folder-open"></i> ${LG("FileCellBrowse")}
                </button>
              </div>
            </div>
            <div class="lrt-ref-span-section">
              <p class="lrt-ref-span-label">${LG("SpanPickerLabel")}</p>
              <p class="lrt-ref-span-hint">${LG("SpanPickerHint")}</p>
              <div class="lrt-span-picker" id="lrt-span-picker-${uid}">${this._buildSpanPickerHtml(cells, pickerRows, cellId)}</div>
              <p class="lrt-span-size-label" id="lrt-span-size-${uid}"></p>
            </div>
          </div>`;

        const result = await new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title:   LG("EditCellTitle"),
                content,
                buttons: {
                    save:   { label: game.i18n.localize("lore-reference-board.Common.Save"),   callback: () => { clicked = true; resolve("save");   } },
                    delete: { label: LG("DeleteCell"),                                          callback: () => { clicked = true; resolve("delete"); } },
                    cancel: { label: game.i18n.localize("lore-reference-board.Common.Cancel"), callback: () => { clicked = true; resolve("cancel"); } },
                },
                default: "save",
                close:  () => { if (!clicked) reject(); },
                render: (jqHtml) => {
                    const root = jqHtml[0];
                    // Exclude current cell from occupancy so the user can resize it freely
                    picker = this._initSpanPicker(
                        root.querySelector(`#lrt-span-picker-${uid}`),
                        root.querySelector(`#lrt-span-size-${uid}`),
                        cells, cell.row, cell.col, cellId
                    );

                    const dz = root.querySelector(`#lrt-rcd-dz-${uid}`);
                    let depth = 0;
                    dz.addEventListener("dragenter",  ev => { ev.preventDefault(); depth++; dz.classList.add("lrt-drop-active"); });
                    dz.addEventListener("dragleave",  () => { if (!--depth) dz.classList.remove("lrt-drop-active"); });
                    dz.addEventListener("dragover",   ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = "link"; });
                    dz.addEventListener("drop", async ev => {
                        ev.preventDefault(); depth = 0; dz.classList.remove("lrt-drop-active");
                        let data;
                        try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                        catch { ui.notifications.warn(L("DropReadFail")); return; }
                        if (!LoreReferenceBoardApp.REF_ACCEPTED_TYPES.has(data.type)) { ui.notifications.warn(L("DropWarn")); return; }
                        let doc; try { doc = await fromUuid(data.uuid ?? ""); } catch { doc = null; }
                        if (!doc) { ui.notifications.warn(L("DropWarn")); return; }
                        const rd = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
                        const rt = rd?.documentName ?? null;
                        if (!rt || !LoreReferenceBoardApp.REF_DOC_CFG[rt]) { ui.notifications.warn(L("DropWarn")); return; }
                        pendingUuid = rd.uuid; pendingType = rt;
                        // Clear file when a doc is linked
                        pendingFilePath = null; pendingFileType = null;
                        const fpathElDrop = root.querySelector(`#lrt-rcd-fpath-${uid}`);
                        if (fpathElDrop) fpathElDrop.value = "";
                        const cfg = LoreReferenceBoardApp.REF_DOC_CFG[rt];
                        dz.classList.add("lrt-ref-dz--linked");
                        root.querySelector(`#lrt-rcd-icon-${uid}`).className = `fas ${cfg.icon} lrt-ref-dz-icon lrt-ref-dz-icon--linked`;
                        root.querySelector(`#lrt-rcd-name-${uid}`).textContent = rd.name ?? "";
                        root.querySelector(`#lrt-rcd-sub-${uid}`).textContent  = L(cfg.badgeKey);
                    });

                    // File section wiring
                    const fpathEl   = root.querySelector(`#lrt-rcd-fpath-${uid}`);
                    const fbrowseEl = root.querySelector(`#lrt-rcd-fbrowse-${uid}`);

                    const applyFilePath = (path) => {
                        if (!path) return;
                        const ext  = path.split(".").pop().toLowerCase();
                        const type = ext === "pdf" ? "pdf" : ext === "md" ? "md" : "txt";
                        fpathEl.value   = path;
                        pendingFilePath  = path;
                        pendingFileType  = type;
                        // Unlink drop zone when a file is chosen
                        pendingUuid = null; pendingType = null;
                        dz.classList.remove("lrt-ref-dz--linked");
                        root.querySelector(`#lrt-rcd-icon-${uid}`).className = "fas fa-link lrt-ref-dz-icon";
                        root.querySelector(`#lrt-rcd-name-${uid}`).textContent = LG("DropToLink");
                        root.querySelector(`#lrt-rcd-sub-${uid}`).textContent  = L("DropSubtext");
                    };

                    fpathEl?.addEventListener("change", () => {
                        const path = normalizeLrbPath(fpathEl.value);
                        if (path) applyFilePath(path);
                        else { pendingFilePath = null; pendingFileType = null; }
                    });
                    fbrowseEl?.addEventListener("click", async () => {
                        const picked = await pickRefFilePath(fpathEl?.value || "modules/");
                        if (picked) applyFilePath(normalizeLrbPath(picked));
                    });
                },
            }, { width: 400, classes: ["app","window-app","dialog","lore-rb-dialog"] }).render(true);
        }).catch(() => "cancel");

        if (result === "cancel") return;

        if (result === "delete") {
            allTabs[tabIdx].cells = cells.filter(c => c.id !== cellId);
            await saveTabs(allTabs);
            await this.render(true);
            return;
        }

        if (result === "save") {
            if (!pendingUuid && !pendingFilePath) return;
            const span = picker?.getSpan();
            if (!span) { ui.notifications.warn(LG("SpanNotSelected")); return; }
            const { row, col, rowSpan, colSpan } = span;
            const problem = this._refCellCollides(cells, cellId, row, col, rowSpan, colSpan);
            if (problem === "overflow")  { ui.notifications.warn(LG("OverflowError"));  return; }
            if (problem === "collision") { ui.notifications.warn(LG("CollisionError")); return; }
            const updatedCell = pendingFilePath
                ? { id: cell.id, row, col, rowSpan, colSpan, docType: "file", filePath: pendingFilePath, fileType: pendingFileType }
                : { id: cell.id, row, col, rowSpan, colSpan, docUuid: pendingUuid, docType: pendingType };
            allTabs[tabIdx].cells = cells.map(c => c.id === cellId ? updatedCell : c);
            await saveTabs(allTabs);
            await this.render(true);
        }
    }

    // Deal Cards Dialog
    async _dealCardsDialog(deck) {
        const L  = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);

        // Collect all card hands in the world
        const hands = game.cards.filter(c => c.type === "hand");
        if (!hands.length) {
            ui.notifications.warn(L("DealNoHands"));
            return;
        }

        const maxCards = deck.cards?.size ?? 1;

        const content = `
          <form>
            <div style="display:flex;flex-direction:column;gap:12px;padding:6px 0">
              <div>
                <label style="display:block;margin-bottom:4px;font-weight:bold">${L("DealHandLabel")}</label>
                <select name="targetHand" style="width:100%;color-scheme:dark">
                  ${hands.map(h => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.name)}</option>`).join("")}
                </select>
              </div>
              <div>
                <label style="display:block;margin-bottom:4px;font-weight:bold">${L("DealCountLabel")}</label>
                <input type="number" name="dealCount" value="1" min="1" max="${maxCards}"
                       style="width:100%;box-sizing:border-box" />
              </div>
            </div>
          </form>`;

        const result = await new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: L("DealTitle"),
                content,
                buttons: {
                    deal: {
                        label: L("DealBtn"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({
                                handId: form?.targetHand?.value ?? null,
                                count:  Math.max(1, parseInt(form?.dealCount?.value) || 1),
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "deal",
                close: () => { if (!clicked) reject(); },
            }, { width: 340, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        }).catch(() => "cancel");

        if (result === "cancel" || !result?.handId) return;

        const targetHand = game.cards.get(result.handId);
        if (!targetHand) return;

        await deck.deal([targetHand], result.count);
    }

    // Pin Rendering
    async buildPinElement(pin, zoom = 1) {
        const PIN_PX = 15;
        const $el = $(`<div class="lr-pin" data-pinid="${pin.id}"></div>`);
        $el.css({
            left: `${pin.xPct}%`,
            top: `${pin.yPct}%`,
            position: "absolute",
            width: `${PIN_PX}px`,
            height: `${PIN_PX}px`,
            "font-size": `${PIN_PX}px`,
            "line-height": `${PIN_PX}px`,
            "text-align": "center",
            "transform-origin": "50% 100%",
            transform: `translate(-50%, -100%) scale(${1 / zoom})`,
            cursor: "pointer",
            color: pin.color || "#e74c3c",
            "z-index": 40,
            "pointer-events": "auto",
            "user-select": "none",
        });

        if (pin.icon) {
            if (isSvgIcon(pin.icon)) {
                const OLD_SVG_PREFIX = "modules/lore-reference-board/assets/ui-icons/";
                const iconUrl = pin.icon.startsWith(OLD_SVG_PREFIX)
                    ? `icons/svg/${pin.icon.slice(OLD_SVG_PREFIX.length)}`
                    : pin.icon;

                const svgData = await fetchSvgData(iconUrl);
                if (svgData) {
                    $el.html(`<span class="lr-pin-svg-wrap"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${svgData.viewBox}" class="lr-pin-svg-icon">${svgData.inner}</svg></span>`);
                }
            } else if (String(pin.icon).startsWith("fas")) {
                $el.html(`<i class="${pin.icon}"></i>`);
            }
        }
        $el.attr("title", `${pin.title || ""}\n${pin.description || ""}`.trim());
        return $el;
    }

    async renderPins(html) {
        if (!html || typeof html.find !== "function") return;

        const pins = await loadPinsForTab(this.activeTab);

        let pinLayer = html.find("#lr-pin-layer");
        if (!pinLayer.length) {
            pinLayer = $(`
        <div id="lr-pin-layer"
             style="position:absolute;top:0;left:0;width:100%;height:100%;
                    pointer-events:auto;z-index:30;">
        </div>
      `);
            html.find("#lr-map-wrap").append(pinLayer);
        }

        pinLayer.find(".lr-pin").remove();

        const zoom = this._panzoom?.getScale?.() ?? 1;
        for (const pin of pins) {
            pinLayer.append(await this.buildPinElement(pin, zoom));
        }
    }
}

// Pin Gallery
class PinGalleryApp extends Application {
    constructor({ pin, tabId, boardApp }, options = {}) {
        super(options);
        this._pin = pin;
        this._tabId = tabId;
        this._boardApp = boardApp;
        this._gallery = PinGalleryApp._cloneGallery(pin);
        this._journalId    = undefined;
        this._updateHookId = null;
    }

    static _cloneGallery(pin) {
        const g = pin.gallery ?? {};
        return {
            name: g.name ?? pin.title ?? "",
            folders: (g.folders ?? []).map(f => ({
                id: f.id ?? foundry.utils.randomID(),
                name: f.name ?? "",
                path: f.path ?? "",
                images: Array.isArray(f.images) ? [...f.images] : [],
            })),
        };
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "lore-reference-board-gallery",
            template: "modules/lore-reference-board/templates/pin-gallery.html",
            width: 960,
            height: 600,
            resizable: true,
        });
    }

    get title() { return game.i18n.localize("lore-reference-board.Gallery.WindowTitle"); }

    async getData(_options = {}) {
        //  Gallery (left pane) 
        const galleryCtx = {
            galleryName: this._gallery.name,
            folders: this._gallery.folders,
        };

        //  Pin journal (right pane) 
        if (this._journalId === undefined) {
            this._journalId = this._pin.journal || null;
        }

        let journalLinked  = false;
        let journalName    = "";
        let journalContent = "";

        if (this._journalId) {
            let entry = game.journal.get(this._journalId);
            if (!entry) {
                try { entry = await fromUuid(`JournalEntry.${this._journalId}`); } catch { entry = null; }
            }
            if (entry) {
                journalLinked = true;
                journalName   = entry.name;
                // Render the first page (sorted order);
                const pages    = getJournalPages(entry);
                const firstPage = pages[0] ?? null;
                journalContent = await enrichJournalPage(firstPage, entry);
            }
        }

        return {
            ...galleryCtx,
            journalLinked,
            journalName,
            journalContent,
        };
    }

    async activateListeners(html) {
        super.activateListeners(html);

        //  Folder name (top field) 
        html.find("#pg-name").on("input", ev => {
            this._gallery.name = ev.target.value;
        });

        //  Add folder button 
        html.find("#pg-add-folder").on("click", async () => {
            const name = await PinGalleryApp._promptText(game.i18n.localize("lore-reference-board.Gallery.NewFolderTitle"), game.i18n.localize("lore-reference-board.Gallery.FolderNamePrompt"));
            if (!name) return;
            const folderPick = await PinGalleryApp._promptFolderPath();

            const newFolder = {
                id:     foundry.utils.randomID(),
                name:   name.trim(),
                path:   folderPick?.path   ?? "",
                source: folderPick?.source ?? "data",
                images: [],
            };

            if (newFolder.path) {
                const IMAGE_EXT = /\.(apng|avif|bmp|gif|jpe?g|png|svg|tiff?|webp)$/i;
                try {
                    // FilePicker is a global
                    const browseResult = await FilePicker.browse(newFolder.source, newFolder.path);
                    const imgs = (browseResult.files ?? []).filter(f => IMAGE_EXT.test(f));
                    newFolder.images = imgs;
                    if (imgs.length) {
                        ui.notifications.info(
                            imgs.length === 1
                                ? game.i18n.format("lore-reference-board.Gallery.ImportedSingle", { path: newFolder.path })
                                : game.i18n.format("lore-reference-board.Gallery.ImportedMany", { count: imgs.length, path: newFolder.path })
                        );
                    } else {
                        ui.notifications.warn(game.i18n.format("lore-reference-board.Gallery.NoImagesFound", { path: newFolder.path }));
                    }
                } catch (err) {
                    ui.notifications.warn(
                        game.i18n.format("lore-reference-board.Gallery.ImportNewFolderFailed", { path: newFolder.path })
                    );
                    console.error("[lore-reference-board] FilePicker.browse failed on new folder", err);
                }
            }

            this._gallery.folders.push(newFolder);
            await this._save();
            await this.render(true);
        });

        //  Per-folder rename/delete
        html.find(".pg-folder-rename").on("click", async ev => {
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            if (!folder) return;

            const result = await PinGalleryApp._promptFolderRename(folder);
            if (!result) return;

            if (result.action === "delete") {
                const imgCount = folder.images.length;
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize("lore-reference-board.Gallery.DeleteFolder"),
                    content: `<p>${game.i18n.format("lore-reference-board.Gallery.DeleteFolderContent", { name: escapeHtml(folder.name), count: imgCount })}</p>`,
                });
                if (!confirmed) return;

                await clearLoreForImages(folder.images ?? []);
                this._gallery.folders = this._gallery.folders.filter(f => f.id !== folderId);
                await this._save();
                await this.render(true);
                return;
            }

            if (result.action === "save" && result.name) {
                folder.name = result.name;
                await this._save();
                await this.render(true);
            }
        });

        //  Per-folder path edit 
        html.find(".pg-folder-path").on("click", async ev => {
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            if (!folder) return;
            const picked = await PinGalleryApp._pickFolder(folder.path, folder.source);
            if (picked === null) return;
            folder.path = picked.path;
            folder.source = picked.source;
            await this._save();
            await this.render(true);
        });

        //  Add single image to folder
        html.find(".pg-folder-add-images").on("click", async ev => {
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            if (!folder) return;
            const path = await pickImagePath(folder.path || "modules/");
            if (!path) return;
            if (!folder.images.includes(path)) folder.images.push(path);
            await this._save();
            await this.render(true);
        });

        //  Import all images from the folder's path
        html.find(".pg-folder-import").on("click", async ev => {
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            if (!folder) return;

            const picked = await PinGalleryApp._pickFolder(folder.path, folder.source);
            if (!picked) return;
            folder.path = picked.path;
            folder.source = picked.source;
            const importPath = picked.path;
            const importSource = picked.source;

            let browseResult;
            try {
                // FilePicker is a global
                browseResult = await FilePicker.browse(importSource, importPath);
            } catch (err) {
                ui.notifications.error(
                    game.i18n.format("lore-reference-board.Gallery.ImportFailed", { path: importPath })
                );
                console.error(`[lore-reference-board] FilePicker.browse failed`, err);
                return;
            }

            const IMAGE_EXT = /\.(apng|avif|bmp|gif|jpe?g|png|svg|tiff?|webp)$/i;
            const newImages = (browseResult.files ?? []).filter(f => IMAGE_EXT.test(f));

            if (!newImages.length) {
                ui.notifications.warn(game.i18n.format("lore-reference-board.Gallery.NoImagesFound", { path: importPath }));
                return;
            }

            let added = 0;
            for (const img of newImages) {
                if (!folder.images.includes(img)) {
                    folder.images.push(img);
                    added++;
                }
            }

            ui.notifications.info(
                added === 0
                    ? game.i18n.format("lore-reference-board.Gallery.ImportedAlready", { path: importPath })
                    : added === 1
                        ? game.i18n.format("lore-reference-board.Gallery.ImportedSingle", { path: importPath })
                        : game.i18n.format("lore-reference-board.Gallery.ImportedMany", { count: added, path: importPath })
            );

            await this._save();
            await this.render(true);
        });

        //  Remove image (right-click)
        html.find(".pg-thumb").on("contextmenu", async ev => {
            ev.preventDefault();
            const src = $(ev.currentTarget).data("src");
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            if (!folder) return;

            const ok = await Dialog.confirm({
                title: game.i18n.localize("lore-reference-board.Gallery.RemoveImage"),
                content: `<p>${game.i18n.format("lore-reference-board.Gallery.RemoveImageContent", { src: escapeHtml(src) })}</p>`,
            });
            if (!ok) return;
            folder.images = folder.images.filter(i => i !== src);
            await clearLoreForImage(src);
            await this._save();
            await this.render(true);
        });

        //  Click thumbnail to open the custom image viewer
        html.find(".pg-thumb").on("click", ev => {
            const src = $(ev.currentTarget).data("src");
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            new PinImageViewer({
                src,
                folderName: folder?.name ?? this._gallery.name,
                folderPath: folder?.path ?? "",
                pinId: this._pin.id,
                tabId: this._tabId,
            }).render(true);
        });

        //  Save Name button in header
        html.find("#pg-save-name").on("click", async () => {
            await this._save();
        });

        //  Pin journal pane (right column) 
        const journalCol = html.find(".pg-journal-col")[0];
        if (this._journalId) {
            html.find(".pgj-btn-edit").on("click", () => this._openPinJournalSheet());
            html.find(".pgj-btn-unlink").on("click", () => this._unlinkPinJournal());
            const contentEl = html.find(".pgj-content")[0];
            wirePageNav(contentEl, this._journalId);
        } else if (journalCol) {
            let dragDepth = 0;
            journalCol.addEventListener("dragenter", (ev) => {
                ev.preventDefault();
                dragDepth++;
                journalCol.classList.add("pgj-drop-active");
            });
            journalCol.addEventListener("dragleave", () => {
                dragDepth = Math.max(0, dragDepth - 1);
                if (dragDepth === 0) journalCol.classList.remove("pgj-drop-active");
            });
            journalCol.addEventListener("dragover", (ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "link";
            });
            journalCol.addEventListener("drop", async (ev) => {
                ev.preventDefault();
                dragDepth = 0;
                journalCol.classList.remove("pgj-drop-active");
                await this._onPinJournalDrop(ev);
            });

            html.find(".pgj-btn-create").on("click", () => this._createPinJournal());
        }

        // Register live-update so the journal pane refreshes when the entry is edited
        this._registerPinJournalUpdateHook();
    }

    async _save() {
        const pins = await loadPinsForTab(this._tabId);
        const idx = pins.findIndex(p => p.id === this._pin.id);
        if (idx === -1) return;

        pins[idx].gallery = {
            name: this._gallery.name,
            folders: this._gallery.folders.map(f => ({ ...f })),
        };
        if (this._gallery.name) pins[idx].title = this._gallery.name;

        await savePinsForTab(this._tabId, pins);
        this._pin = pins[idx];

        if (this._boardApp) await this._boardApp.renderPins(this._boardApp._htmlRef);
    }

    // Pin journal pane helpers
    async _saveJournal(journalId) {
        const pins = await loadPinsForTab(this._tabId);
        const idx  = pins.findIndex(p => p.id === this._pin.id);
        if (idx === -1) return;
        pins[idx].journal = journalId || "";
        this._journalId   = journalId || null;
        await savePinsForTab(this._tabId, pins);
        this._pin = pins[idx];
    }

    async _onPinJournalDrop(ev) {
        let data;
        try {
            data = JSON.parse(ev.dataTransfer.getData("text/plain"));
        } catch {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Lore.DropReadFail"));
            return;
        }

        let journalId = null;
        if (data.type === "JournalEntry") {
            const entry = await fromUuid(data.uuid ?? "").catch(() => null);
            journalId   = entry?.id ?? null;
        } else if (data.type === "JournalEntryPage") {
            const page  = await fromUuid(data.uuid ?? "").catch(() => null);
            journalId   = page?.parent?.id ?? null;
        }

        if (!journalId) {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Lore.DropWarn"));
            return;
        }

        try {
            await this._saveJournal(journalId);
        } catch (err) {
            console.error("LoreReferenceBoard | failed to save pin journal on drop:", err);
            ui.notifications.error(game.i18n.localize("lore-reference-board.Lore.SaveLinkFail"));
            return;
        }
        await this.render(true);
    }

    async _createPinJournal() {
        const uid       = foundry.utils.randomID();
        const inputId   = `pgj-name-${uid}`;
        const defaultName = this._gallery.name || game.i18n.localize("lore-reference-board.Pin.LoreEntryDefault");

        let chosenName;
        try {
            chosenName = await new Promise((resolve, reject) => {
                let clicked = false;
                new Dialog({
                    title: game.i18n.localize("lore-reference-board.Lore.NameEntryTitle"),
                    content: `<form>
                        <div style="padding:6px 0">
                            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.Lore.JournalEntryName")}</label>
                            <input id="${inputId}" name="${inputId}" type="text"
                                   value="${escapeHtml(defaultName)}"
                                   style="width:100%" autofocus />
                        </div>
                    </form>`,
                    buttons: {
                        create: {
                            label: game.i18n.localize("lore-reference-board.Common.Create"),
                            callback: (html) => {
                                clicked = true;
                                resolve(html[0].querySelector(`#${inputId}`)?.value?.trim() || defaultName);
                            },
                        },
                        cancel: {
                            label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                            callback: () => { clicked = true; resolve("cancel"); },
                        },
                    },
                    default: "create",
                    close: () => { if (!clicked) reject(new Error("closed")); },
                }).render(true);
            });
        } catch { return; }
        if (chosenName === "cancel") return;

        const entry = await JournalEntry.create({
            name: chosenName,
            pages: [{
                name: chosenName,
                type: "text",
                text: {
                    content: "",
                    format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,
                },
            }],
        });
        if (!entry) return;

        await this._saveJournal(entry.id);
        await this.render(true);
        entry.sheet.render(true);
    }

    _openPinJournalSheet() {
        const entry = game.journal.get(this._journalId);
        if (entry) {
            entry.sheet.render(true);
        } else {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Lore.JournalNotFound"));
        }
    }

    async _unlinkPinJournal() {
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("lore-reference-board.Lore.UnlinkTitle"),
            content: `<p>${game.i18n.localize("lore-reference-board.Pin.UnlinkPinContent")}</p>`,
        });
        if (!confirmed) return;
        await this._saveJournal(null);
        await this.render(true);
    }

    _registerPinJournalUpdateHook() {
        if (this._updateHookId !== null) {
            Hooks.off("updateJournalEntryPage", this._updateHookId);
            this._updateHookId = null;
        }
        if (!this._journalId) return;
        const watchedId = this._journalId;
        this._updateHookId = Hooks.on("updateJournalEntryPage", (page) => {
            if (page.parent?.id === watchedId) this.render(true);
        });
    }

    async close(options) {
        if (this._updateHookId !== null) {
            Hooks.off("updateJournalEntryPage", this._updateHookId);
            this._updateHookId = null;
        }
        return super.close(options);
    }

    // File / folder picker helpers
    static _pickFolder(startPath = "", startSource = "data") {
        return new Promise((resolve) => {
            let resolved = false;
            const fp = new FilePicker({
                type: "folder",
                current: startPath,
                activeSource: startSource,
                callback: (path) => {
                    resolved = true;
                    resolve({ path, source: fp.activeSource ?? startSource });
                },
            });
            const origClose = fp.close.bind(fp);
            fp.close = async (...args) => {
                if (!resolved) resolve(null);
                return origClose(...args);
            };
            fp.render(true);
        });
    }

    static async _promptFolderRename(folder) {
        const uid     = foundry.utils.randomID();
        const inputId = `pg-rename-${uid}`;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.Gallery.EditFolder"),
                content: `<form>
                    <div style="padding:6px 0">
                        <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.Gallery.FolderNameLabel")}</label>
                        <input id="${inputId}" name="${inputId}" type="text" value="${escapeHtml(folder.name)}"
                               style="width:100%" autofocus />
                    </div>
                </form>`,
                buttons: {
                    save: {
                        label: game.i18n.localize("lore-reference-board.Common.Save"),
                        callback: (html) => {
                            clicked = true;
                            resolve({
                                action: "save",
                                name: html[0].querySelector(`#${inputId}`)?.value?.trim() ?? folder.name,
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                    delete: {
                        label: game.i18n.localize("lore-reference-board.Gallery.DeleteFolder"),
                        callback: () => { clicked = true; resolve({ action: "delete" }); },
                    },
                },
                default: "save",
                close: () => { if (!clicked) reject(new Error("closed")); },
            }, { width: 380, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        attachDialogValidation(inputId, "save", [inputId]);

        let result;
        try { result = await waitPromise; } catch { return null; }
        if (result === "cancel") return null;
        return result;
    }

    static async _promptFolderPath(defaultPath = "", defaultSource = "data") {
        const uid = foundry.utils.randomID();
        const inputId   = `pg-fp-input-${uid}`;
        const browseBtnId = `pg-fp-browse-${uid}`;
        let currentSource = defaultSource;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.Gallery.FolderPath"),
                content: `<form>
                    <div style="padding:6px 0">
                        <label style="display:block;margin-bottom:4px;font-weight:bold">
                            ${game.i18n.localize("lore-reference-board.Gallery.FolderPathLabel")}
                            <span style="font-weight:normal;color:#999;font-size:11px">${game.i18n.localize("lore-reference-board.Gallery.FolderPathOptional")}</span>
                        </label>
                        <div style="display:flex;gap:6px;align-items:center">
                            <input id="${inputId}" type="text" value="${escapeHtml(defaultPath)}"
                                   style="flex:1;min-width:0;box-sizing:border-box"
                                   placeholder="${game.i18n.localize("lore-reference-board.Gallery.FolderPathPlaceholder")}" />
                            <button type="button" id="${browseBtnId}"
                                style="width:auto;padding:4px 10px;background:#3a3a3a;border:1px solid #555;
                                       border-radius:4px;color:#ccc;cursor:pointer;
                                       white-space:nowrap;flex-shrink:0;font-size:12px;display:inline-flex;align-items:center">
                                ${game.i18n.localize("lore-reference-board.Common.Browse")}
                            </button>
                        </div>
                        <p style="margin:6px 0 0;font-size:11px;color:#aaa">
                            ${game.i18n.localize("lore-reference-board.Gallery.FolderPathNote")}
                        </p>
                    </div>
                </form>`,
                buttons: {
                    ok: {
                        label: game.i18n.localize("lore-reference-board.Common.OK"),
                        callback: (html) => {
                            clicked = true;
                            resolve({
                                path:   html[0].querySelector(`#${inputId}`)?.value?.trim() ?? "",
                                source: currentSource,
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "ok",
                close: () => { if (!clicked) reject(new Error("closed")); },
            }, { width: 440, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        // Attach the folder picker to the Browse button.
        let tries = 0;
        const tick = () => {
            const btn = document.getElementById(browseBtnId);
            if (!btn) { if (++tries < 60) requestAnimationFrame(tick); return; }
            btn.addEventListener("click", async () => {
                const pathInput = document.getElementById(inputId);
                const picked = await PinGalleryApp._pickFolder(
                    pathInput?.value ?? "", currentSource
                );
                if (picked) {
                    currentSource = picked.source;
                    if (pathInput) pathInput.value = picked.path;
                }
            });
        };
        requestAnimationFrame(tick);

        let result;
        try { result = await waitPromise; } catch { return null; }
        if (result === "cancel") return null;
        return result;
    }

    static async _promptText(title, label, defaultVal = "", required = true) {
        const uid = foundry.utils.randomID();
        const inputId = `pg-prompt-${uid}`;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title,
                content: `<form><div style="padding:6px 0">
                    <label style="display:block;margin-bottom:4px;font-weight:bold">${escapeHtml(label)}</label>
                    <input id="${inputId}" type="text" value="${escapeHtml(defaultVal)}" style="width:100%" autofocus />
                </div></form>`,
                buttons: {
                    ok: {
                        label: game.i18n.localize("lore-reference-board.Common.OK"),
                        callback: (html) => {
                            clicked = true;
                            resolve(html[0].querySelector(`#${inputId}`)?.value ?? "");
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "ok",
                close: () => { if (!clicked) reject(new Error("closed")); },
            }, { width: 380, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        if (required) attachDialogValidation(inputId, "ok", [inputId]);

        let result;
        try { result = await waitPromise; } catch { return null; }
        if (result === "cancel") return null;
        return result ?? null;
    }
}


// Pin Image Viewer
class PinImageViewer extends Application {

    constructor({ src, folderName, folderPath, pinId, tabId }, options = {}) {
        options.id = options.id ?? `lore-image-viewer-${foundry.utils.randomID()}`;
        super(options);
        this._src = src;
        this._folderName = folderName ?? "";
        this._folderPath = folderPath ?? "";
        this._pinId = pinId ?? null;
        this._tabId = tabId ?? null;
    }

    get title() { return this._folderName || game.i18n.localize("lore-reference-board.ImageViewer.WindowTitle"); }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/lore-reference-board/templates/pin-image-viewer.html",
            width: 520,
            height: 660,
            resizable: true,
        });
    }

    async getData(_options = {}) {
        const fileName = this._src.split("/").pop();
        const locationFolder = this._src.includes("/")
            ? this._src.substring(0, this._src.lastIndexOf("/"))
            : this._src;
        return { src: this._src, fileName, locationFolder };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Resolve image dimensions asynchronously
        const img = new Image();
        img.onload = () => {
            html.find(".piv-dimensions").text(`${img.naturalWidth} × ${img.naturalHeight}`);
        };
        img.onerror = () => {
            html.find(".piv-dimensions").text("unknown");
        };
        img.src = this._src;

        // Right-click on the preview image context menu
        html.find(".piv-preview").on("contextmenu", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this._showContextMenu(ev.clientX, ev.clientY);
        });

        // Footer buttons.
        html.find(".piv-btn-lore").on("click", () => this._openLore());
        html.find(".piv-btn-clipboard").on("click", () => this._copyUrl());
        html.find(".piv-btn-token").on("click", () => this._createToken());
        html.find(".piv-btn-scene").on("click", () => this._createScene());
    }

    // Context Menu

    _showContextMenu(x, y) {
        $(".piv-ctx-menu").remove();

        const menu = $(`
            <ul class="piv-ctx-menu">
                <li class="piv-ctx-show"><i class="fas fa-eye"></i> Show Players</li>
                <li class="piv-ctx-chat"><i class="fas fa-comments"></i> Send to Chat</li>
                <li class="piv-ctx-divider"></li>
                <li class="piv-ctx-copy"><i class="fas fa-link"></i> Copy URL</li>
            </ul>
        `);

        $("body").append(menu);
        const mw = menu.outerWidth();
        const mh = menu.outerHeight();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        menu.css({
            left: Math.min(x, vw - mw - 4) + "px",
            top:  Math.min(y, vh - mh - 4) + "px",
        });

        menu.find(".piv-ctx-show").on("click", () => { menu.remove(); this._showToPlayers(); });
        menu.find(".piv-ctx-chat").on("click", () => { menu.remove(); this._sendToChat(); });
        menu.find(".piv-ctx-copy").on("click", () => { menu.remove(); this._copyUrl(); });

        const dismiss = (ev) => {
            if (!$(ev.target).closest(".piv-ctx-menu").length) {
                menu.remove();
                $(document).off("mousedown", dismiss);
            }
        };
        setTimeout(() => $(document).on("mousedown", dismiss), 0);
    }

    // Actions
    _openLore() {
        new PinLoreApp({
            src: this._src,
            imageName: this._src.split("/").pop().replace(/\.[^.]+$/, ""),
            pinId: this._pinId,
            tabId: this._tabId,
        }).render(true);
    }

    _copyUrl() {
        navigator.clipboard.writeText(this._src)
            .then(() => ui.notifications.info(game.i18n.localize("lore-reference-board.ImageViewer.CopiedToClipboard")))
            .catch(() => {
                const ta = document.createElement("textarea");
                ta.value = this._src;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                ui.notifications.info(game.i18n.localize("lore-reference-board.ImageViewer.CopiedToClipboard"));
            });
    }

    _showToPlayers() {
        game.socket.emit("shareImage", {
            image: this._src,
            title: "",
            uuid: null,
        });

        new ImagePopout(this._src, { title: "" }).render(true);
    }

    _sendToChat() {
        const fileName = this._src.split("/").pop();
        ChatMessage.create({
            content: `<figure style="margin:0;text-align:center">
                <img src="${this._src}" alt="${escapeHtml(fileName)}"
                     style="max-width:100%;border-radius:4px" />
                <figcaption style="font-size:11px;color:#aaa;margin-top:4px">
                    ${escapeHtml(fileName)}
                </figcaption>
            </figure>`,
        });
    }

    async _createToken() {
        const fileName = this._src.split("/").pop();
        const defaultName = fileName.replace(/\.[^.]+$/, "");
        const uid = foundry.utils.randomID();

        let result;
        try {
            result = await new Promise((resolve, reject) => {
                let clicked = false;
                new Dialog({
                    title: game.i18n.localize("lore-reference-board.ImageViewer.CreateTokenTitle"),
                    content: `<form>
                        <div style="padding:6px 0">
                            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.ImageViewer.ActorNameLabel")}</label>
                            <input id="piv-actor-${uid}" type="text"
                                   value="${escapeHtml(defaultName)}" style="width:100%" autofocus />
                        </div>
                    </form>`,
                    buttons: {
                        ok: {
                            label: game.i18n.localize("lore-reference-board.Common.Create"),
                            callback: (html) => {
                                clicked = true;
                                resolve(html[0].querySelector(`#piv-actor-${uid}`)?.value ?? defaultName);
                            },
                        },
                        cancel: {
                            label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                            callback: () => { clicked = true; resolve("cancel"); },
                        },
                    },
                    default: "ok",
                    close: () => { if (!clicked) reject(new Error("closed")); },
                }).render(true);
            });
        } catch { return; }
        if (result === "cancel" || !result) return;

        const name = result.trim() || defaultName;

        const types = game.documentTypes?.Actor ?? [];
        const type = types.includes("npc") ? "npc"
                   : types.includes("character") ? "character"
                   : (types[0] ?? "npc");

        await Actor.create({
            name,
            type,
            img: this._src,
            prototypeToken: { name, texture: { src: this._src } },
        });
        ui.notifications.info(game.i18n.format("lore-reference-board.ImageViewer.CreatedActor", { name }));
    }

    async _createScene() {
        const fileName = this._src.split("/").pop();
        const sceneName = fileName.replace(/\.[^.]+$/, "");

        const img = new Image();
        img.src = this._src;
        await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
        });
        const width  = img.naturalWidth  || 2000;
        const height = img.naturalHeight || 2000;

        await Scene.create({
            name: sceneName,
            background: { src: this._src },
            width,
            height,
            grid: { type: 1, size: 100 },
            padding: 0.1,
            navigation: true,
        });
        ui.notifications.info(game.i18n.format("lore-reference-board.ImageViewer.CreatedScene", { name: sceneName }));
    }
}


// Pin's Lore
class PinLoreApp extends Application {

    constructor({ src, imageName, pinId, tabId }, options = {}) {
        options.id = options.id ?? `lore-pin-lore-${foundry.utils.randomID()}`;
        super(options);
        this._src        = src;
        this._imageName  = imageName ?? src.split("/").pop().replace(/\.[^.]+$/, "");
        this._pinId      = pinId ?? null;
        this._tabId      = tabId ?? null;
        this._journalId  = undefined;
        this._updateHookId = null;
    }

    get title() { return this._imageName || game.i18n.localize("lore-reference-board.Lore.WindowTitle"); }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/lore-reference-board/templates/pin-lore.html",
            width: 560,
            height: 520,
            resizable: true,
        });
    }

    async getData(_options = {}) {
        if (this._journalId === undefined) {
            const map = getImageJournalMap();
            this._journalId = (this._pinId ? map[this._pinId]?.[this._src] : null) ?? null;
        }

        if (!this._journalId) return { linked: false };

        let entry = game.journal.get(this._journalId);
        if (!entry) {
            try {
                entry = await fromUuid(`JournalEntry.${this._journalId}`);
            } catch {
                entry = null;
            }
        }

        if (!entry) {
            return { linked: false };
        }

        const pages         = getJournalPages(entry);
        const firstPage     = pages[0] ?? null;
        const enrichedContent = await enrichJournalPage(firstPage, entry);

        return {
            linked: true,
            journalName: entry.name,
            enrichedContent,
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        if (this._journalId) {
            // Linked state
            html.find(".plr-btn-edit").on("click", () => this._openJournalSheet());
            html.find(".plr-btn-unlink").on("click", () => this._unlink());
            // Inject page nav above the content div for multi-page journals
            const contentEl = html.find(".plr-content")[0];
            wirePageNav(contentEl, this._journalId);
        } else {
            // Unlinked state
            const appEl = this.element[0];
            let dragDepth = 0;

            appEl.addEventListener("dragenter", (ev) => {
                ev.preventDefault();
                dragDepth++;
                appEl.classList.add("plr-drop-active");
            });
            appEl.addEventListener("dragleave", () => {
                dragDepth = Math.max(0, dragDepth - 1);
                if (dragDepth === 0) appEl.classList.remove("plr-drop-active");
            });
            appEl.addEventListener("dragover", (ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "link";
            });
            appEl.addEventListener("drop", async (ev) => {
                ev.preventDefault();
                dragDepth = 0;
                appEl.classList.remove("plr-drop-active");
                await this._onDrop(ev);
            });

            html.find(".plr-btn-create").on("click", () => this._createNewJournal());
        }

        this._registerUpdateHook();
    }

    async _persistLink() {
        if (this._pinId) {
            if (this._journalId) {
                await saveImageJournalLink(this._pinId, this._src, this._journalId);
            } else {
                await clearImageJournalLink(this._pinId, this._src);
            }
        } else {
            if (this._journalId) {
                await saveLoreForImage(this._src, this._journalId);
            } else {
                await clearLoreForImage(this._src);
            }
        }
    }

    // Live update hook
    _registerUpdateHook() {
        if (this._updateHookId !== null) {
            Hooks.off("updateJournalEntryPage", this._updateHookId);
            this._updateHookId = null;
        }
        if (!this._journalId) return;

        const watchedId = this._journalId;
        this._updateHookId = Hooks.on("updateJournalEntryPage", (page) => {
            if (page.parent?.id === watchedId) this.render(true);
        });
    }

    // Lifecycle cleanup
    async close(options) {
        if (this._updateHookId !== null) {
            Hooks.off("updateJournalEntryPage", this._updateHookId);
            this._updateHookId = null;
        }
        return super.close(options);
    }

    // Drop handling
    async _onDrop(ev) {
        let data;
        try {
            data = JSON.parse(ev.dataTransfer.getData("text/plain"));
        } catch {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Lore.DropReadFail"));
            return;
        }

        let journalId = null;

        if (data.type === "JournalEntry") {
            const entry = await fromUuid(data.uuid ?? "").catch(() => null);
            journalId = entry?.id ?? null;
        } else if (data.type === "JournalEntryPage") {
            const page = await fromUuid(data.uuid ?? "").catch(() => null);
            journalId = page?.parent?.id ?? null;
        }

        if (!journalId) {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Lore.DropWarn"));
            return;
        }

        this._journalId = journalId;
        try {
            await this._persistLink();
        } catch (err) {
            console.error("LoreReferenceBoard | failed to save journal link on drop:", err);
            ui.notifications.error(game.i18n.localize("lore-reference-board.Lore.SaveLinkFail"));
        }
        await this.render(true);
    }

    // Actions
    async _createNewJournal() {
        const uid = foundry.utils.randomID();
        const inputId = `plr-name-${uid}`;
        const defaultName = this._imageName;

        let chosenName;
        try {
            chosenName = await new Promise((resolve, reject) => {
                let clicked = false;
                new Dialog({
                    title: game.i18n.localize("lore-reference-board.Lore.NameEntryTitle"),
                    content: `<form>
                        <div style="padding:6px 0">
                            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.Lore.JournalEntryName")}</label>
                            <input id="${inputId}" name="${inputId}" type="text"
                                   value="${escapeHtml(defaultName)}"
                                   style="width:100%" autofocus />
                        </div>
                    </form>`,
                    buttons: {
                        create: {
                            label: game.i18n.localize("lore-reference-board.Common.Create"),
                            callback: (html) => {
                                clicked = true;
                                resolve(html[0].querySelector(`#${inputId}`)?.value?.trim() || defaultName);
                            },
                        },
                        cancel: {
                            label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                            callback: () => { clicked = true; resolve("cancel"); },
                        },
                    },
                    default: "create",
                    close: () => { if (!clicked) reject(new Error("closed")); },
                }).render(true);
            });
        } catch { return; }
        if (chosenName === "cancel") return;

        const entry = await JournalEntry.create({
            name: chosenName,
            pages: [{
                name: chosenName,
                type: "text",
                text: {
                    content: "",
                    format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,
                },
            }],
        });
        if (!entry) return;

        this._journalId = entry.id;
        await this._persistLink();
        await this.render(true);
        entry.sheet.render(true);
    }

    _openJournalSheet() {
        const entry = game.journal.get(this._journalId);
        if (entry) {
            entry.sheet.render(true);
        } else {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Lore.JournalNotFound"));
        }
    }

    async _unlink() {
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("lore-reference-board.Lore.UnlinkTitle"),
            content: `<p>${game.i18n.localize("lore-reference-board.Lore.UnlinkContent")}</p>`,
        });
        if (!confirmed) return;

        this._journalId = null;
        try {
            await this._persistLink();
        } catch (err) {
            console.error("LoreReferenceBoard | failed to clear journal link on unlink:", err);
        }
        await this.render(true);
    }
}


// Import / Export,  standalone functions
async function _lrbExport() {
    // Flush any pending debounced pin write so the export captures the latest data.
    await _flushPins();

    const payload = {
        version:       1,
        module:        MODULE_SCOPE,
        exportedAt:    new Date().toISOString(),
        tabs:          _getSetting("tabs",          []),
        pins:          _getSetting("pins",          {}),
        "image-lore":  _getSetting("image-lore",   {}),
        imageJournals: _getSetting("imageJournals", {}),
    };

    const filename  = `lore-reference-board-${new Date().toISOString().slice(0, 10)}.json`;
    const worldPath = `worlds/${game.world.id}`;
    const file      = new File([JSON.stringify(payload, null, 2)], filename, { type: "application/json" });

    try {
        await FilePicker.upload("data", worldPath, file, { notify: false });
        ui.notifications.info(
            `${game.i18n.localize("lore-reference-board.ImportExport.ExportSuccess")} → ${worldPath}/${filename}`
        );
    } catch (err) {
        console.error("LoreReferenceBoard | Export failed:", err);
        ui.notifications.error(game.i18n.localize("lore-reference-board.ImportExport.ExportFailed"));
    }
}

// Opens the OS file picker
async function _lrbImport() {
    const importData = await _lrbPickAndParseFile();
    if (!importData) return;

    const mode = await _lrbAskImportMode();
    if (!mode) return;

    if (mode === "replace") {
        await _lrbApplyReplace(importData);
    } else {
        await _lrbApplyMerge(importData);
    }

    // Refresh the board window if it is already open.
    const board = game.loreReferenceBoardAppInstance;
    if (board?.rendered) await board.render(true);

    ui.notifications.info(game.i18n.localize("lore-reference-board.ImportExport.ImportSuccess"));
}

// Opens an OS file picker and parses the chosen JSON
function _lrbPickAndParseFile() {
    return new Promise((resolve) => {
        const input  = document.createElement("input");
        input.type   = "file";
        input.accept = ".json,application/json";
        let settled  = false;

        const done = (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        input.addEventListener("change", async (ev) => {
            const file = ev.target.files?.[0];
            if (!file) { done(null); return; }

            let parsed;
            try {
                parsed = JSON.parse(await file.text());
            } catch {
                ui.notifications.error(game.i18n.localize("lore-reference-board.ImportExport.ParseError"));
                done(null); return;
            }

            if (parsed?.module !== MODULE_SCOPE || !Array.isArray(parsed?.tabs)) {
                ui.notifications.error(game.i18n.localize("lore-reference-board.ImportExport.InvalidFile"));
                done(null); return;
            }

            done(parsed);
        });

        window.addEventListener("focus", () => {
            setTimeout(() => done(null), 400);
        }, { once: true });

        input.click();
    });
}

function _lrbAskImportMode() {
    const L = key => game.i18n.localize(`lore-reference-board.ImportExport.${key}`);
    return new Promise((resolve) => {
        let clicked = false;
        new Dialog({
            title:   L("ImportModeTitle"),
            content: L("ImportModeHint"),
            buttons: {
                addTo: {
                    label:    L("BtnAddTo"),
                    callback: () => { clicked = true; resolve("merge"); },
                },
                replace: {
                    label:    L("BtnReplace"),
                    callback: () => { clicked = true; resolve("replace"); },
                },
                cancel: {
                    label:    game.i18n.localize("lore-reference-board.Common.Cancel"),
                    callback: () => { clicked = true; resolve(null); },
                },
            },
            default: "addTo",
            close:   () => { if (!clicked) resolve(null); },
        }, { width: 480 }).render(true);
    });
}

//Replace All,  overwrites all 
async function _lrbApplyReplace(d) {
    await game.settings.set(MODULE_SCOPE, "tabs",          d.tabs          ?? []);
    await game.settings.set(MODULE_SCOPE, "pins",          d.pins          ?? {});
    await game.settings.set(MODULE_SCOPE, "image-lore",    d["image-lore"] ?? {});
    await game.settings.set(MODULE_SCOPE, "imageJournals", d.imageJournals ?? {});
    _invalidatePinsCache();
}

//
// Add to Existing,  appends imported tabs without touching existing ones.
// All tab and pin IDs are regenerated to avoid collisions between worlds.
// imageJournals links are remapped to the new pin IDs.
// image-lore entries are merged; existing entries take precedence.

async function _lrbApplyMerge(d) {
    // Flush any pending debounced pin write before reading for merge.
    await _flushPins();
    const existingTabs     = await loadTabs();
    const existingPins     = _getSetting("pins",          {});
    const existingLore     = _getSetting("image-lore",    {});
    const existingJournals = _getSetting("imageJournals", {});

    const importedTabs     = Array.isArray(d.tabs) ? d.tabs : [];
    const importedPins     = d.pins          ?? {};
    const importedJournals = d.imageJournals ?? {};

    const newTabs     = [...existingTabs];
    const newPins     = { ...existingPins };
    const newJournals = { ...existingJournals };
    const pinIdMap    = {};   

    for (const tab of importedTabs) {
        const oldTabId = tab.id;
        const newTabId = foundry.utils.randomID();
        newTabs.push({ ...tab, id: newTabId });

        // Remap every pin under this tab to a fresh ID.
        const tabPins = Array.isArray(importedPins[oldTabId]) ? importedPins[oldTabId] : [];
        newPins[newTabId] = tabPins.map(pin => {
            const newPinId   = foundry.utils.randomID();
            pinIdMap[pin.id] = newPinId;
            return { ...pin, id: newPinId };
        });
    }

    // Carry over image-journal links using the remapped pin IDs.
    for (const [oldPinId, pinJournals] of Object.entries(importedJournals)) {
        const newPinId = pinIdMap[oldPinId];
        if (newPinId && !newJournals[newPinId]) {
            newJournals[newPinId] = { ...pinJournals };
        }
    }

    // Merge image-lore
    const newLore = { ...(d["image-lore"] ?? {}), ...existingLore };

    await game.settings.set(MODULE_SCOPE, "tabs",          newTabs);
    await game.settings.set(MODULE_SCOPE, "pins",          newPins);
    await game.settings.set(MODULE_SCOPE, "image-lore",    newLore);
    await game.settings.set(MODULE_SCOPE, "imageJournals", newJournals);
    _invalidatePinsCache();
}

// Inject Import / Export into Settings Panel
Hooks.on("renderSettingsConfig", (_app, html) => {
    // Only show the controls to GMs.
    if (!game.user?.isGM) return;

    const L = key => game.i18n.localize(`lore-reference-board.ImportExport.${key}`);

    const maxTabRowsInput = html.find(`[name="${MODULE_SCOPE}.maxTabRows"]`);
    if (!maxTabRowsInput.length) return;
    const maxTabRowsRow = maxTabRowsInput.closest(".form-group");
    if (!maxTabRowsRow.length) return;

    // Build a row that matches Foundry's settings style.
    const $row = $(`
        <div class="form-group lrb-ie-row">
            <label>${L("MenuLabel")}</label>
            <div class="form-fields" style="gap:6px">
                <button type="button" class="lrb-ie-export-btn"
                        style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px">
                    <i class="fas fa-file-export"></i> ${L("BtnExport")}
                </button>
                <button type="button" class="lrb-ie-import-btn"
                        style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px">
                    <i class="fas fa-file-import"></i> ${L("BtnImport")}
                </button>
            </div>
            <p class="notes">${L("MenuHint")}</p>
        </div>
    `);

    $row.find(".lrb-ie-export-btn").on("click", (ev) => {
        ev.preventDefault();
        _lrbExport();
    });

    $row.find(".lrb-ie-import-btn").on("click", (ev) => {
        ev.preventDefault();
        _lrbImport();
    });

    maxTabRowsRow.after($row);
});


//  Scene Controls Button
function _toggleLoreReferenceBoard() {
    const inst = game.loreReferenceBoardAppInstance;
    if (inst && inst.rendered) {
        inst.close();
        game.loreReferenceBoardAppInstance = null;
        return;
    }
    game.loreReferenceBoardAppInstance = new LoreReferenceBoardApp();
    game.loreReferenceBoardAppInstance.render(true);
}

Hooks.on("renderSceneControls", (app, html) => {
    const allowed = !!game?.user?.isGM || game?.user?.role === CONST.USER_ROLES.ASSISTANT;
    if (!allowed) return;

    // Guard against duplicates
    if (html.find(`li[data-control="${MODULE_SCOPE}"]`).length) return;

    const li = $(`<li class="scene-control"
                      data-control="${MODULE_SCOPE}"
                      title="Lore Reference Board">
                    <i class="fas fa-theater-masks"></i>
                  </li>`);

    li.on("click", (event) => {
        event.preventDefault();
        event.stopPropagation();   
        _toggleLoreReferenceBoard();
    });

    const mainList = html.find(".main-controls");
    (mainList.length ? mainList : html.find("ol").first()).append(li);
});

console.log("[lore-reference-board] Load Complete");
