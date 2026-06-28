const loreRefBoard_SEARCH_CACHE_PFX = "lrb-sc2";
const loreRefBoard_SEARCH_STATE_PFX = "lrb-ss";
const loreRefBoard_SEARCH_MAX_PCT = 0.35;
const loreRefBoard_SEARCH_MIN_W = 220;
const loreRefBoard_SEARCH_DEBOUNCE_MS = 280;

const loreRefBoard_memIndex = new Map();
let loreRefBoard_searchCellObs = null;
let loreRefBoard_searchDragCleanup = null;
let loreRefBoard_searchIsDragging = false;
let loreRefBoard_searchDebounceTimer = null;
const loreRefBoard_searchCollapsedIds = new Set();


function loreRefBoard_clearSearchCache() {
    const pfx = loreRefBoard_searchWorldKey(loreRefBoard_SEARCH_CACHE_PFX) + "::";
    Object.keys(localStorage).filter(k => k.startsWith(pfx)).forEach(k => localStorage.removeItem(k));
    loreRefBoard_memIndex.clear();
}

async function loreRefBoard_forceIndexAll(onProgress) {
    loreRefBoard_clearSearchCache();
    const tabs = await loreRefBoard_loadTabs();
    const items = [];
    for (const tab of tabs) {
        if (tab.type === "document") items.push({ kind: "doc", tab });
        else if (tab.type === "reference") {
            for (const c of (tab.cells ?? [])) items.push({ kind: "ref", tab, cell: c });
        }
    }
    let done = 0;
    for (const item of items) {
        if (item.kind === "doc") {
            await loreRefBoard_indexDocTab(item.tab).catch(() => {});
        } else {
            const cellName = item.cell.name || (item.cell.filePath ?? "").split("/").pop() || "Cell";
            await loreRefBoard_indexRefCell(item.cell, cellName, item.tab.id).catch(() => {});
        }
        onProgress?.(++done, items.length);
    }
    loreRefBoard_maybeRefreshSearch();
}

function loreRefBoard_searchWorldKey(pfx) {
    return `${pfx}::${game.world?.id ?? "x"}`;
}

function loreRefBoard_searchHash(s) {
    let h = 0;
    const n = Math.min(s.length, 5000);
    for (let i = 0; i < n; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h.toString(36);
}

function loreRefBoard_loadCachedIndex(id) {
    try {
        const raw = localStorage.getItem(`${loreRefBoard_searchWorldKey(loreRefBoard_SEARCH_CACHE_PFX)}::${id}`);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function loreRefBoard_saveCachedIndex(id, entry) {
    try {
        localStorage.setItem(
            `${loreRefBoard_searchWorldKey(loreRefBoard_SEARCH_CACHE_PFX)}::${id}`,
            JSON.stringify(entry)
        );
    } catch {}
}

function loreRefBoard_dropCachedIndex(id) {
    try {
        localStorage.removeItem(`${loreRefBoard_searchWorldKey(loreRefBoard_SEARCH_CACHE_PFX)}::${id}`);
        loreRefBoard_memIndex.delete(id);
    } catch {}
}

function loreRefBoard_htmlToText(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.innerText || tmp.textContent || "";
}

async function loreRefBoard_pdfToChunks(path) {
    try {
        const lib = globalThis.pdfjsLib;
        if (!lib) return null;
        const resp = await fetch(path);
        if (!resp.ok) return null;
        const buf = await resp.arrayBuffer();
        const pdf = await lib.getDocument({ data: buf }).promise;
        const chunks = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const pg = await pdf.getPage(i);
            const ct = await pg.getTextContent();
            const text = ct.items.map(it => it.str).join(" ").trim();
            if (text) chunks.push({ text, location: { page: i } });
        }
        return chunks.length ? chunks : null;
    } catch (err) {
        console.warn("[lore-reference-board] PDF indexing failed:", err);
        return null;
    }
}

async function loreRefBoard_docxToText(path) {
    try {
        if (!window.mammoth) return null;
        const resp = await fetch(path);
        if (!resp.ok) return null;
        const arrayBuffer = await resp.arrayBuffer();
        const result = await window.mammoth.convertToHtml({ arrayBuffer });
        return loreRefBoard_htmlToText(result.value ?? "");
    } catch (err) {
        console.warn("[lore-reference-board] DOCX indexing failed:", err);
        return null;
    }
}

function loreRefBoard_maybeRefreshSearch() {
    try {
        const panel = document.getElementById("lr-search-panel");
        if (!panel) return;
        const input = document.getElementById("lr-search-input");
        const q = input?.value ?? "";
        if (!q || q.trim().length < 2) return;
        const results = loreRefBoard_runSearch(q);
        loreRefBoard_patchSearchPanelState({ results });
        loreRefBoard_renderSearchResults(results, q, panel);
    } catch (err) {
        console.warn("[lore-reference-board] maybeRefreshSearch failed:", err);
    }
}

async function loreRefBoard_indexDocTab(tab) {
    const id = `doc::${tab.id}`;
    const docType = tab.docType ?? null;
    const docRef = tab.docRef ?? null;
    const name = tab.name ?? "";

    if (!docType || docType === "image") {
        loreRefBoard_memIndex.set(id, { id, name, type: docType ?? "none", chunks: [], docRef: null });
        return;
    }

    if (docType === "url") {
        loreRefBoard_memIndex.set(id, { id, name, type: "url", chunks: [], docRef: null });
        return;
    }

    if (docType === "journal") {
        const _exJ = loreRefBoard_memIndex.get(id);
        if (_exJ && _exJ.docRef !== docRef) loreRefBoard_dropCachedIndex(id);
        if (loreRefBoard_memIndex.has(id)) return;
        loreRefBoard_memIndex.set(id, { id, name, type: "indexing", chunks: [], docRef });
        let entry = game.journal?.get(docRef);
        if (!entry) {
            try { entry = await fromUuid(`JournalEntry.${docRef}`); } catch { entry = null; }
        }
        if (!entry) { loreRefBoard_memIndex.delete(id); return; }
        const modTime = entry._stats?.modifiedTime ?? 0;
        const cached = loreRefBoard_loadCachedIndex(id);
        if (cached?.docRef === docRef && cached?.lastModified === modTime) {
            loreRefBoard_memIndex.set(id, cached);
            loreRefBoard_maybeRefreshSearch();
            return;
        }
        const pages = (entry.pages?.contents ?? []).slice().sort((a, b) => a.sort - b.sort);
        const chunks = pages
            .map((p, i) => {
                const text = loreRefBoard_htmlToText(p.text?.content ?? "");
                return text.trim() ? { text, location: { pageIndex: i, pageId: p.id } } : null;
            })
            .filter(Boolean);
        const rec = { id, name, type: "journal", chunks, lastModified: modTime, docRef };
        loreRefBoard_memIndex.set(id, rec);
        loreRefBoard_saveCachedIndex(id, rec);
        loreRefBoard_maybeRefreshSearch();
        return;
    }

    if (docType === "pdf") {
        const _exP = loreRefBoard_memIndex.get(id);
        if (_exP && _exP.docRef !== docRef) loreRefBoard_dropCachedIndex(id);
        if (loreRefBoard_memIndex.has(id)) return;
        const cached = loreRefBoard_loadCachedIndex(id);
        if (cached?.docRef === docRef) { loreRefBoard_memIndex.set(id, cached); return; }
        if (!globalThis.pdfjsLib) {
            loreRefBoard_memIndex.set(id, { id, name, type: "pdf-unavailable", chunks: [], docRef });
            return;
        }
        loreRefBoard_memIndex.set(id, { id, name, type: "pdf-indexing", chunks: [], docRef });
        (async () => {
            const chunks = await loreRefBoard_pdfToChunks(docRef);
            if (!chunks) return;
            const rec = { id, name, type: "pdf", chunks, docRef };
            loreRefBoard_memIndex.set(id, rec);
            loreRefBoard_saveCachedIndex(id, rec);
            loreRefBoard_maybeRefreshSearch();
        })();
        return;
    }

    if (docType === "docx") {
        const _exD = loreRefBoard_memIndex.get(id);
        if (_exD && _exD.docRef !== docRef) loreRefBoard_dropCachedIndex(id);
        if (loreRefBoard_memIndex.has(id)) return;
        const cached = loreRefBoard_loadCachedIndex(id);
        if (cached?.docRef === docRef) { loreRefBoard_memIndex.set(id, cached); return; }
        if (!window.mammoth) {
            loreRefBoard_memIndex.set(id, { id, name, type: "docx-unavailable", chunks: [], docRef });
            return;
        }
        loreRefBoard_memIndex.set(id, { id, name, type: "docx-indexing", chunks: [], docRef });
        (async () => {
            const text = await loreRefBoard_docxToText(docRef);
            if (text === null) return;
            const rec = { id, name, type: "docx", chunks: [{ text, location: {} }], docRef };
            loreRefBoard_memIndex.set(id, rec);
            loreRefBoard_saveCachedIndex(id, rec);
            loreRefBoard_maybeRefreshSearch();
        })();
        return;
    }

    // txt, md, html
    const _exT = loreRefBoard_memIndex.get(id);
    if (_exT && _exT.docRef !== docRef) loreRefBoard_dropCachedIndex(id);
    if (loreRefBoard_memIndex.has(id)) return;
    loreRefBoard_memIndex.set(id, { id, name, type: "indexing", chunks: [], docRef });
    const cached = loreRefBoard_loadCachedIndex(id);
    try {
        const resp = await fetch(docRef);
        if (!resp.ok) {
            console.warn(`[lore-reference-board] fetch failed for ${docRef}: ${resp.status}`);
            loreRefBoard_memIndex.delete(id);
            return;
        }
        const raw = await resp.text();
        const hash = loreRefBoard_searchHash(raw);
        if (cached?.hash === hash) {
            loreRefBoard_memIndex.set(id, cached);
            loreRefBoard_maybeRefreshSearch();
            return;
        }
        const text = (docType === "txt" || docType === "md") ? raw : loreRefBoard_htmlToText(raw);
        const rec = { id, name, type: docType, chunks: [{ text, location: {} }], docRef, hash };
        loreRefBoard_memIndex.set(id, rec);
        loreRefBoard_saveCachedIndex(id, rec);
    } catch (err) {
        console.warn(`[lore-reference-board] indexing failed for ${docRef}:`, err);
        loreRefBoard_memIndex.delete(id);
        return;
    }
    loreRefBoard_maybeRefreshSearch();
}

async function loreRefBoard_indexRefCell(cell, cellName, tabId = null) {
    const id = `ref::${cell.id}`;

    if (cell.docType === "file") {
        const fType = cell.fileType ?? "txt";
        const fPath = cell.filePath ?? "";

        if (fType === "img") {
            loreRefBoard_memIndex.set(id, { id, name: cellName, type: "image", chunks: [], parentTabId: tabId });
            return;
        }

        if (fType === "pdf") {
            const _exRP = loreRefBoard_memIndex.get(id);
            if (_exRP && _exRP.docRef !== fPath) loreRefBoard_dropCachedIndex(id);
            if (loreRefBoard_memIndex.has(id)) return;
            const cached = loreRefBoard_loadCachedIndex(id);
            if (cached?.docRef === fPath) { loreRefBoard_memIndex.set(id, cached); return; }
            if (!globalThis.pdfjsLib) {
                loreRefBoard_memIndex.set(id, { id, name: cellName, type: "pdf-unavailable", chunks: [], docRef: fPath, parentTabId: tabId });
                return;
            }
            loreRefBoard_memIndex.set(id, { id, name: cellName, type: "pdf-indexing", chunks: [], docRef: fPath, parentTabId: tabId });
            (async () => {
                const chunks = await loreRefBoard_pdfToChunks(fPath);
                if (!chunks) return;
                const rec = { id, name: cellName, type: "pdf", chunks, docRef: fPath, parentTabId: tabId };
                loreRefBoard_memIndex.set(id, rec);
                loreRefBoard_saveCachedIndex(id, rec);
                loreRefBoard_maybeRefreshSearch();
            })();
            return;
        }

        const _exRF = loreRefBoard_memIndex.get(id);
        if (_exRF && _exRF.docRef !== fPath) loreRefBoard_dropCachedIndex(id);
        if (loreRefBoard_memIndex.has(id)) return;
        const cached = loreRefBoard_loadCachedIndex(id);
        let _cellRefreshed = false;
        try {
            const resp = await fetch(fPath);
            if (!resp.ok) {
                console.warn(`[lore-reference-board] fetch failed for cell ${fPath}: ${resp.status}`);
                return;
            }
            const raw = await resp.text();
            const hash = loreRefBoard_searchHash(raw);
            if (cached?.hash === hash) {
                loreRefBoard_memIndex.set(id, cached);
                _cellRefreshed = true;
            } else {
                const text = (fType === "txt" || fType === "md") ? raw : loreRefBoard_htmlToText(raw);
                const rec = { id, name: cellName, type: fType, chunks: [{ text, location: {} }], docRef: fPath, hash, parentTabId: tabId };
                loreRefBoard_memIndex.set(id, rec);
                loreRefBoard_saveCachedIndex(id, rec);
                _cellRefreshed = true;
            }
        } catch (err) {
            console.warn(`[lore-reference-board] cell indexing failed for ${fPath}:`, err);
        }
        if (_cellRefreshed) loreRefBoard_maybeRefreshSearch();
        return;
    }

    if (cell.docType === "JournalEntry") {
        try {
            const resolved = await fromUuid(cell.docUuid ?? "");
            if (!resolved) return;
            const doc = resolved.documentName === "JournalEntryPage" ? resolved.parent : resolved;
            if (!doc) return;
            const modTime = doc._stats?.modifiedTime ?? 0;
            const cached = loreRefBoard_loadCachedIndex(id);
            if (cached?.lastModified === modTime) { loreRefBoard_memIndex.set(id, cached); return; }
            const pages = (doc.pages?.contents ?? []).slice().sort((a, b) => a.sort - b.sort);
            const chunks = pages
                .map((p, i) => {
                    const text = loreRefBoard_htmlToText(p.text?.content ?? "");
                    return text.trim() ? { text, location: { pageIndex: i, pageId: p.id } } : null;
                })
                .filter(Boolean);
            const rec = { id, name: cellName, type: "journal", chunks, lastModified: modTime, parentTabId: tabId };
            loreRefBoard_memIndex.set(id, rec);
            loreRefBoard_saveCachedIndex(id, rec);
        } catch (err) {
            console.warn("[lore-reference-board] journal cell indexing failed:", err);
        }
        return;
    }

    loreRefBoard_memIndex.set(id, { id, name: cellName, type: cell.docType ?? "other", chunks: [], parentTabId: tabId });
}

function loreRefBoard_runSearch(query) {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    const results = [];

    for (const [, entry] of loreRefBoard_memIndex) {
        if (entry.type === "url" || entry.type === "pdf-unavailable" || entry.type === "docx-unavailable" || entry.type === "indexing" || entry.type === "pdf-indexing" || entry.type === "docx-indexing") {
            results.push({ id: entry.id, name: entry.name, type: entry.type, matches: [], parentTabId: entry.parentTabId ?? null });
            continue;
        }
        if (!entry.chunks.length) continue;

        const matches = [];
        for (const chunk of entry.chunks) {
            const lower = chunk.text.toLowerCase();
            let idx = 0;
            let occurrenceIdx = 0;
            while (true) {
                const pos = lower.indexOf(q, idx);
                if (pos === -1) break;
                const start = Math.max(0, pos - 55);
                const end = Math.min(chunk.text.length, pos + q.length + 55);
                matches.push({
                    snippet: chunk.text.slice(start, end),
                    matchStart: pos - start,
                    matchLen: q.length,
                    location: chunk.location,
                    occurrenceIdx,
                });
                occurrenceIdx++;
                idx = pos + q.length;
            }
        }
        if (matches.length) results.push({ id: entry.id, name: entry.name, type: entry.type, matches, parentTabId: entry.parentTabId ?? null });
    }
    return results;
}

function loreRefBoard_searchSnippetHtml(snippet, start, len) {
    const pre = loreRefBoard_escapeHtml(snippet.slice(0, start));
    const hit = loreRefBoard_escapeHtml(snippet.slice(start, start + len));
    const post = loreRefBoard_escapeHtml(snippet.slice(start + len));
    return `${pre}<mark>${hit}</mark>${post}`;
}

function loreRefBoard_searchTypeIcon(type) {
    const icons = {
        "pdf": "fa-file-pdf", "pdf-indexing": "fa-file-pdf", "pdf-unavailable": "fa-file-pdf",
        "txt": "fa-file-lines", "md": "fa-file-code", "html": "fa-file-code",
        "docx": "fa-file-word", "docx-indexing": "fa-file-word", "docx-unavailable": "fa-file-word",
        "journal": "fa-book-open", "url": "fa-globe", "image": "fa-image",
    };
    return icons[type] ?? "fa-file";
}

function loreRefBoard_getIndexStatus() {
    let indexed = 0, pending = 0, skipped = 0;
    for (const [, e] of loreRefBoard_memIndex) {
        if (e.type === "indexing" || e.type === "pdf-indexing" || e.type === "docx-indexing") pending++;
        else if (!e.chunks?.length) skipped++;
        else indexed++;
    }
    return { indexed, pending, skipped };
}

function loreRefBoard_renderSearchResults(results, query, panel) {
    const el = panel.querySelector("#lr-search-results");
    if (!el) return;

    if (!query || query.trim().length < 2) { el.innerHTML = ""; return; }

    const { indexed, pending } = loreRefBoard_getIndexStatus();
    const statusBar = pending > 0
        ? `<div class="lr-search-status-bar">${game.i18n.format("lore-reference-board.Search.IndexingStatus", { indexed, pending })}</div>`
        : "";

    if (!results.length) {
        el.innerHTML = statusBar + `<div class="lr-search-status">${game.i18n.localize("lore-reference-board.Search.NoResults")}</div>`;
        return;
    }

    const colBar = panel.querySelector("#lr-search-collapse-bar");
    if (colBar) colBar.style.display = results.length > 1 ? "" : "none";

    el.innerHTML = statusBar + results.map((r, ri) => {
        const icon = loreRefBoard_searchTypeIcon(r.type);
        const collapsed = loreRefBoard_searchCollapsedIds.has(r.id);
        const chevron = `<i class="fas fa-chevron-down lr-search-chevron${collapsed ? " lr-search-chevron--up" : ""}"></i>`;
        const hdr = `<div class="lr-search-group-label" data-group-id="${loreRefBoard_escapeHtml(r.id)}">${chevron}<i class="fas ${icon}"></i>${loreRefBoard_escapeHtml(r.name)}</div>`;

        if (r.type === "url") {
            return `<div class="lr-search-group" data-group-id="${loreRefBoard_escapeHtml(r.id)}">${hdr}<div class="lr-search-group-rows"><div class="lr-search-result lr-search-na"><span class="lr-search-snippet">${game.i18n.localize("lore-reference-board.Search.NotSearchable")}</span></div></div></div>`;
        }
        if (r.type === "pdf-unavailable") {
            return `<div class="lr-search-group" data-group-id="${loreRefBoard_escapeHtml(r.id)}">${hdr}<div class="lr-search-group-rows"><div class="lr-search-result lr-search-na"><span class="lr-search-snippet">${game.i18n.localize("lore-reference-board.Search.PdfUnavailable")}</span></div></div></div>`;
        }
        if (r.type === "docx-unavailable") {
            return `<div class="lr-search-group" data-group-id="${loreRefBoard_escapeHtml(r.id)}">${hdr}<div class="lr-search-group-rows"><div class="lr-search-result lr-search-na"><span class="lr-search-snippet">${game.i18n.localize("lore-reference-board.Search.DocxUnavailable")}</span></div></div></div>`;
        }
        if (r.type === "indexing" || r.type === "pdf-indexing" || r.type === "docx-indexing") {
            return `<div class="lr-search-group" data-group-id="${loreRefBoard_escapeHtml(r.id)}">${hdr}<div class="lr-search-group-rows"><div class="lr-search-result lr-search-na"><span class="lr-search-snippet lr-search-indexing-msg">${game.i18n.localize("lore-reference-board.Search.Indexing")}</span></div></div></div>`;
        }

        const groupCollapsed = loreRefBoard_searchCollapsedIds.has(r.id);
        const matchRows = r.matches.map((m, mi) => {
            const pgLabel = m.location?.page
                ? ` <span class="lr-search-pg">${game.i18n.format("lore-reference-board.Search.PageLabel", { page: m.location.page })}</span>`
                : "";
            return `<div class="lr-search-result" data-ri="${ri}" data-mi="${mi}"><span class="lr-search-snippet">${loreRefBoard_searchSnippetHtml(m.snippet, m.matchStart, m.matchLen)}${pgLabel}</span></div>`;
        }).join("");

        return `<div class="lr-search-group${groupCollapsed ? " lr-search-group--collapsed" : ""}" data-group-id="${loreRefBoard_escapeHtml(r.id)}">${hdr}<div class="lr-search-group-rows">${matchRows}</div></div>`;
    }).join("");
}

function loreRefBoard_pollForEl(root, selector, callback, maxTries = 25, interval = 150) {
    let tries = 0;
    const poll = () => {
        const el = (root ?? document).querySelector(selector);
        if (el) { callback(el); return; }
        if (tries++ < maxTries) setTimeout(poll, interval);
    };
    setTimeout(poll, 50);
}

async function loreRefBoard_goToSearchResult(result, matchIdx, app) {
    const [kind, entityId] = result.id.split("::");
    const match = result.matches[matchIdx] ?? result.matches[0];

    if (kind === "doc") {
        if (result.type === "pdf" && match?.location?.page) {
            app._pdfInitPage = match.location.page;
        }
        app.activeTab = entityId;
        await app.render();
        if (!match) return;
        if (result.type === "pdf") {
            const targetPage = match?.location?.page ?? 1;
            loreRefBoard_pollForEl(document, "#lr-doc-pane .lrb-pdf-scroll", scrollEl => {
                const ph = scrollEl.querySelector(`[data-page="${targetPage}"]`);
                if (ph) ph.scrollIntoView({ behavior: "smooth", block: "start" });
                const tlSel = targetPage > 1
                    ? `#lr-doc-pane .lrb-pdf-text-layer[data-pdf-page="${targetPage}"]`
                    : "#lr-doc-pane .lrb-pdf-text-layer";
                const query = loreRefBoard_getSearchPanelState().query;
                loreRefBoard_pollForEl(document, tlSel, tl => {
                    setTimeout(() => loreRefBoard_highlightPdfTextLayer(tl, query), 150);
                }, 40, 300);
            }, 60, 300);
        } else if (result.type === "journal" && match.location?.pageIndex != null && match.location.pageIndex > 0) {
            loreRefBoard_pollForEl(document, `#lrt-doc-psel-${entityId}`, sel => {
                sel.value = String(match.location.pageIndex);
                sel.dispatchEvent(new Event("change"));
                setTimeout(() => loreRefBoard_highlightInElement(document.getElementById("lr-doc-pane"), match), 500);
            });
        } else {
            setTimeout(() => loreRefBoard_highlightInElement(document.getElementById("lr-doc-pane"), match), 200);
        }
        return;
    }

    if (kind === "ref") {
        const allTabs = await loreRefBoard_loadTabs();
        let refTab = result.parentTabId ? allTabs.find(t => t.id === result.parentTabId) ?? null : null;
        if (!refTab) refTab = allTabs.find(t => t.type === "reference" && (t.cells ?? []).some(c => c.id === entityId)) ?? null;
        if (!refTab) {
            console.warn("[lore-reference-board] ref nav: tab not found for cell", entityId, "parentTabId:", result.parentTabId);
            return;
        }
        app.activeTab = refTab.id;
        await app.render();
        setTimeout(() => loreRefBoard_highlightRefCell(entityId, match), 250);
    }
}

function loreRefBoard_highlightInElement(el, match) {
    if (!el || !match?.snippet) return;

    el.querySelectorAll("mark.lr-hl").forEach(m => m.replaceWith(document.createTextNode(m.textContent)));

    const q = match.snippet.slice(match.matchStart, match.matchStart + match.matchLen).toLowerCase();
    if (!q) return;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    let offset = 0;
    const map = nodes.map(n => {
        const start = offset;
        offset += n.textContent.length;
        return { node: n, start, end: offset };
    });
    const flat = nodes.map(n => n.textContent).join("").toLowerCase();

    const targetOcc = match.occurrenceIdx ?? 0;
    let occ = 0;
    let hitStart = -1;
    let searchFrom = 0;
    while (true) {
        const found = flat.indexOf(q, searchFrom);
        if (found === -1) break;
        if (occ === targetOcc) { hitStart = found; break; }
        occ++;
        searchFrom = found + 1;
    }
    if (hitStart === -1) return;
    const hitEnd = hitStart + q.length;

    let firstMark = null;
    for (const { node: n, start, end } of map) {
        if (end <= hitStart || start >= hitEnd) continue;
        const lo = Math.max(hitStart - start, 0);
        const hi = Math.min(hitEnd - start, n.textContent.length);
        if (lo >= hi) continue;
        const before = n.textContent.slice(0, lo);
        const mid = n.textContent.slice(lo, hi);
        const after = n.textContent.slice(hi);
        const mark = document.createElement("mark");
        mark.className = "lr-hl";
        mark.textContent = mid;
        const frag = document.createDocumentFragment();
        if (before) frag.appendChild(document.createTextNode(before));
        frag.appendChild(mark);
        if (after) frag.appendChild(document.createTextNode(after));
        n.parentNode?.replaceChild(frag, n);
        if (!firstMark) firstMark = mark;
    }
    firstMark?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function loreRefBoard_highlightRefCell(cellId, match) {
    const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
    if (!cell) return;
    cell.scrollIntoView({ behavior: "smooth", block: "center" });
    cell.classList.add("lr-search-cell-hl");
    setTimeout(() => cell.classList.remove("lr-search-cell-hl"), 2000);
    if (!match?.snippet) return;

    // PDF ref cell, have to wait for scroll container, then navigate
    if (match.location?.page) {
        const targetPage = match.location.page;
        let scTries = 0;
        const waitForScroll = () => {
            const scrollEl = cell.querySelector(".lrb-pdf-scroll");
            if (scrollEl) {
                const ph = scrollEl.querySelector(`[data-page="${targetPage}"]`);
                if (ph) ph.scrollIntoView({ behavior: "smooth", block: "start" });
                const query = loreRefBoard_getSearchPanelState().query;
                const tlSel = `.lrb-pdf-text-layer[data-pdf-page="${targetPage}"]`;
                let hlTries = 0;
                const pollTl = () => {
                    const tl = cell.querySelector(tlSel);
                    if (tl) { loreRefBoard_highlightPdfTextLayer(tl, query); return; }
                    if (++hlTries < 40) setTimeout(pollTl, 300);
                };
                setTimeout(pollTl, 200);
                return;
            }
            if (++scTries < 60) setTimeout(waitForScroll, 300);
        };
        waitForScroll();
        return;
    }

    const pageIndex = match.location?.pageIndex ?? 0;
    const doHighlight = () => {
        let tries = 0;
        const tryHl = () => {
            const contentEl = cell.querySelector(".lrt-ref-cell-content");
            if (!contentEl || contentEl.querySelector("iframe")) return;
            const text = contentEl.innerText?.trim();
            if (!text && tries++ < 6) { setTimeout(tryHl, 300); return; }
            loreRefBoard_highlightInElement(contentEl, match);
        };
        tryHl();
    };

    if (pageIndex > 0) {
        loreRefBoard_pollForEl(cell, ".lrb-page-nav .lrb-pg-select", sel => {
            const opts = Array.from(sel.options);
            if (opts[pageIndex]) {
                sel.value = opts[pageIndex].value;
                sel.dispatchEvent(new Event("change"));
                setTimeout(doHighlight, 500);
            } else {
                setTimeout(doHighlight, 400);
            }
        });
        return;
    }

    setTimeout(doHighlight, 400);
}

function loreRefBoard_getSearchPanelState() {
    try {
        const raw = localStorage.getItem(loreRefBoard_searchWorldKey(loreRefBoard_SEARCH_STATE_PFX));
        return Object.assign({ open: false, query: "", panelWidthPct: 0.28, results: [] }, raw ? JSON.parse(raw) : {});
    } catch { return { open: false, query: "", panelWidthPct: 0.28, results: [] }; }
}

function loreRefBoard_patchSearchPanelState(patch) {
    try {
        const cur = loreRefBoard_getSearchPanelState();
        localStorage.setItem(
            loreRefBoard_searchWorldKey(loreRefBoard_SEARCH_STATE_PFX),
            JSON.stringify(Object.assign(cur, patch))
        );
    } catch {}
}

function loreRefBoard_setupSearchPanel(app, root) {
    const panel = root.querySelector("#lr-search-panel");
    const divider = root.querySelector("#lr-search-divider");
    const input = root.querySelector("#lr-search-input");
    const toggleBtn = root.querySelector("#lr-search-toggle");
    const closeBtn = root.querySelector("#lr-search-close");
    if (!panel || !divider || !input) return;

    if (loreRefBoard_searchDragCleanup && !loreRefBoard_searchIsDragging) {
        loreRefBoard_searchDragCleanup();
        loreRefBoard_searchDragCleanup = null;
    }
    if (app._searchResizeObs) { app._searchResizeObs.disconnect(); app._searchResizeObs = null; }

    const state = loreRefBoard_getSearchPanelState();

    const applyPanelWidth = (pct) => {
        const maxW = Math.floor(root.offsetWidth * loreRefBoard_SEARCH_MAX_PCT);
        const w = Math.max(loreRefBoard_SEARCH_MIN_W, Math.min(Math.floor(root.offsetWidth * pct), maxW));
        panel.style.width = `${w}px`;
    };

    const openPanel = () => {
        root.classList.add("lr-search-open");
        applyPanelWidth(loreRefBoard_getSearchPanelState().panelWidthPct);
        toggleBtn?.classList.add("active");
        loreRefBoard_patchSearchPanelState({ open: true });
        setTimeout(() => input.focus(), 60);
    };

    const closePanel = () => {
        root.classList.remove("lr-search-open");
        panel.style.width = "";
        toggleBtn?.classList.remove("active");
        loreRefBoard_patchSearchPanelState({ open: false });
    };

    if (state.open) {
        root.classList.add("lr-search-open");
        toggleBtn?.classList.add("active");
        applyPanelWidth(state.panelWidthPct);
    }

    if (state.query) {
        input.value = state.query;
        const q = state.query;
        if (q.trim().length >= 2) {
            const fresh = loreRefBoard_runSearch(q);
            if (fresh.length) {
                loreRefBoard_renderSearchResults(fresh, q, panel);
            } else if (state.results?.length) {
                loreRefBoard_renderSearchResults(state.results, q, panel);
            }
            if (state.resultsScrollTop || state.activeRi != null) {
                requestAnimationFrame(() => {
                    const resultsEl = panel.querySelector("#lr-search-results");
                    if (!resultsEl) return;
                    if (state.resultsScrollTop) resultsEl.scrollTop = state.resultsScrollTop;
                    if (state.activeRi != null) {
                        resultsEl.querySelector(`[data-ri="${state.activeRi}"][data-mi="${state.activeMi ?? 0}"]`)?.classList.add("active");
                    }
                });
            }
        }
    }

    toggleBtn?.addEventListener("click", () => {
        root.classList.contains("lr-search-open") ? closePanel() : openPanel();
    });

    closeBtn?.addEventListener("click", () => {
        loreRefBoard_searchCollapsedIds.clear();
        loreRefBoard_patchSearchPanelState({ query: "", results: [] });
        input.value = "";
        const resultsEl = panel.querySelector("#lr-search-results");
        if (resultsEl) resultsEl.innerHTML = "";
        const colBar = panel.querySelector("#lr-search-collapse-bar");
        if (colBar) colBar.style.display = "none";
        closePanel();
    });

    input.addEventListener("input", () => {
        const q = input.value;
        loreRefBoard_searchCollapsedIds.clear();
        loreRefBoard_patchSearchPanelState({ query: q });
        clearTimeout(loreRefBoard_searchDebounceTimer);
        loreRefBoard_searchDebounceTimer = setTimeout(() => {
            const results = loreRefBoard_runSearch(q);
            loreRefBoard_patchSearchPanelState({ results });
            loreRefBoard_renderSearchResults(results, q, panel);
        }, loreRefBoard_SEARCH_DEBOUNCE_MS);
    });

    input.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });

    panel.addEventListener("click", async e => {
        const el = e.target.closest(".lr-search-result[data-ri]");
        if (!el) return;
        const ri = parseInt(el.dataset.ri, 10);
        const mi = parseInt(el.dataset.mi ?? "0", 10);
        const results = loreRefBoard_runSearch(input.value);
        if (!results[ri]) return;
        panel.querySelectorAll(".lr-search-result").forEach(r => r.classList.remove("active"));
        el.classList.add("active");
        const resultsEl = panel.querySelector("#lr-search-results");
        loreRefBoard_patchSearchPanelState({ resultsScrollTop: resultsEl?.scrollTop ?? 0, activeRi: ri, activeMi: mi });
        await loreRefBoard_goToSearchResult(results[ri], mi, app);
    });

    // Group collapse toggle
    panel.addEventListener("click", e => {
        const lbl = e.target.closest(".lr-search-group-label[data-group-id]");
        if (!lbl) return;
        if (e.target.closest(".lr-search-result")) return;
        const groupId = lbl.dataset.groupId;
        const groupEl = panel.querySelector(`.lr-search-group[data-group-id="${CSS.escape(groupId)}"]`);
        if (!groupEl) return;
        const isCollapsed = groupEl.classList.toggle("lr-search-group--collapsed");
        const chevron = lbl.querySelector(".lr-search-chevron");
        if (chevron) chevron.classList.toggle("lr-search-chevron--up", isCollapsed);
        if (isCollapsed) loreRefBoard_searchCollapsedIds.add(groupId);
        else loreRefBoard_searchCollapsedIds.delete(groupId);
    }, true);

    panel.querySelector("#lr-search-collapse-all")?.addEventListener("click", () => {
        panel.querySelectorAll(".lr-search-group[data-group-id]").forEach(g => {
            g.classList.add("lr-search-group--collapsed");
            g.querySelector(".lr-search-chevron")?.classList.add("lr-search-chevron--up");
            loreRefBoard_searchCollapsedIds.add(g.dataset.groupId);
        });
    });

    panel.querySelector("#lr-search-expand-all")?.addEventListener("click", () => {
        panel.querySelectorAll(".lr-search-group[data-group-id]").forEach(g => {
            g.classList.remove("lr-search-group--collapsed");
            g.querySelector(".lr-search-chevron")?.classList.remove("lr-search-chevron--up");
            loreRefBoard_searchCollapsedIds.delete(g.dataset.groupId);
        });
    });

    let dragStartX = 0, dragStartW = 0;

    const onDragMove = e => {
        if (!loreRefBoard_searchIsDragging) return;
        const delta = dragStartX - e.clientX;
        const maxW = Math.floor(root.offsetWidth * loreRefBoard_SEARCH_MAX_PCT);
        panel.style.width = `${Math.max(loreRefBoard_SEARCH_MIN_W, Math.min(dragStartW + delta, maxW))}px`;
    };

    const onDragUp = () => {
        if (!loreRefBoard_searchIsDragging) return;
        loreRefBoard_searchIsDragging = false;
        root.querySelectorAll("iframe").forEach(f => { f.style.pointerEvents = ""; });
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        loreRefBoard_patchSearchPanelState({ panelWidthPct: panel.offsetWidth / root.offsetWidth });
    };

    divider.addEventListener("mousedown", e => {
        if (e.button !== 0) return;
        loreRefBoard_searchIsDragging = true;
        dragStartX = e.clientX;
        dragStartW = panel.offsetWidth;
        root.querySelectorAll("iframe").forEach(f => { f.style.pointerEvents = "none"; });
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
        e.preventDefault();
    });

    if (!loreRefBoard_searchDragCleanup) {
        document.addEventListener("mousemove", onDragMove);
        document.addEventListener("mouseup", onDragUp);
        loreRefBoard_searchDragCleanup = () => {
            document.removeEventListener("mousemove", onDragMove);
            document.removeEventListener("mouseup", onDragUp);
        };
    }

    app._searchResizeObs = new ResizeObserver(() => {
        if (!root.classList.contains("lr-search-open")) return;
        const maxW = Math.floor(root.offsetWidth * loreRefBoard_SEARCH_MAX_PCT);
        if (panel.offsetWidth > maxW) panel.style.width = `${maxW}px`;
    });
    app._searchResizeObs.observe(root);

    loreRefBoard_loadTabs().then(tabs => {
        const activeTab = tabs.find(t => t.id === app.activeTab) ?? null;

        // Remove memIndex entries for tabs/cells that no longer exist
        const validIds = new Set();
        for (const tab of tabs) {
            validIds.add(`doc::${tab.id}`);
            if (tab.type === "reference") {
                for (const c of (tab.cells ?? [])) validIds.add(`ref::${c.id}`);
            }
        }
        for (const key of loreRefBoard_memIndex.keys()) {
            if (!validIds.has(key)) loreRefBoard_dropCachedIndex(key);
        }

        // Full index for the active doc tab
        if (activeTab?.type === "document") {
            loreRefBoard_indexDocTab(activeTab).catch(err =>
                console.warn("[lore-reference-board] indexDocTab failed:", err)
            );
        }

        // Load all other doc tabs from cache
        for (const tab of tabs) {
            if (tab.id === activeTab?.id) continue;
            if (tab.type !== "document") continue;
            if (!tab.docType || tab.docType === "url" || tab.docType === "image") continue;
            const cid = `doc::${tab.id}`;
            const exEntry = loreRefBoard_memIndex.get(cid);
            if (exEntry && exEntry.docRef !== (tab.docRef ?? null)) loreRefBoard_dropCachedIndex(cid);
            if (loreRefBoard_memIndex.has(cid)) continue;
            const cached = loreRefBoard_loadCachedIndex(cid);
            if (cached?.docRef === (tab.docRef ?? null)) {
                loreRefBoard_memIndex.set(cid, cached);
            } else {
                loreRefBoard_indexDocTab(tab).catch(() => {});
            }
        }

        for (const tab of tabs) {
            if (tab.type !== "reference") continue;
            for (const c of (tab.cells ?? [])) {
                const cid = `ref::${c.id}`;
                const exEntry = loreRefBoard_memIndex.get(cid);
                if (exEntry && c.docType === "file" && exEntry.docRef !== (c.filePath ?? null)) {
                    loreRefBoard_dropCachedIndex(cid);
                }
                if (loreRefBoard_memIndex.has(cid)) continue;
                const cached = loreRefBoard_loadCachedIndex(cid);
                if (cached) {
                    loreRefBoard_memIndex.set(cid, cached);
                } else {
                    const cellName = c.name || (c.filePath ?? "").split("/").pop() || "Cell";
                    loreRefBoard_indexRefCell(c, cellName, tab.id).catch(() => {});
                }
            }
        }

        // Refresh search once after all synchronous cache loads complete
        loreRefBoard_maybeRefreshSearch();
    }).catch(err => console.warn("[lore-reference-board] setupSearchPanel loadTabs failed:", err));
}
