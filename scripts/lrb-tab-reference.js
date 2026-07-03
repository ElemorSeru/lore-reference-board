import { _loreRefBoard_renderRollTableHtml, loreRefBoard_enrichJournalPage, loreRefBoard_getJournalPages, loreRefBoard_wirePageNav } from "./journal-helpers.js";
import { loreRefBoard_loadTabs, loreRefBoard_saveTabs } from "./storage.js";
import { loreRefBoard_escapeHtml, loreRefBoard_normalizePath, loreRefBoard_pickRefFilePath, loreRefBoard_renderPdfTextLayer } from "./utils.js";

const { DialogV2 } = foundry.applications.api;

const loreRefBoard_REF_DOC_CFG = {
        Actor: { icon: "fa-user", badgeKey: "TypeBadgeActor", imgFn: d => d.prototypeToken?.texture?.src ?? d.img, buttons: ["open"] },
        Cards: { icon: "fa-layer-group",badgeKey: "TypeBadgeCards", imgFn: d => d.img, buttons: ["open", "shuffle", "deal"] },
        Item: { icon: "fa-suitcase", badgeKey: "TypeBadgeItem", imgFn: d => d.img, buttons: ["open"] },
        JournalEntry: { icon: "fa-book-open", badgeKey: "TypeBadgeJournal", imgFn: d => null, buttons: ["open"] },
        Macro: { icon: "fa-code", badgeKey: "TypeBadgeMacro", imgFn: d => d.img, buttons: ["open", "execute"] },
        Playlist: { icon: "fa-music", badgeKey: "TypeBadgePlaylist", imgFn: d => null, buttons: ["open"] },
        RollTable: { icon: "fa-table-list", badgeKey: "TypeBadgeRollTable", imgFn: d => d.img, buttons: ["open", "roll"] },
        Scene: { icon: "fa-map", badgeKey: "TypeBadgeScene", imgFn: d => d.thumb ?? d.background?.src, buttons: ["open", "activate"] },
};

const loreRefBoard_REF_ACCEPTED_TYPES = new Set(["Actor", "Cards", "Item", "JournalEntry", "JournalEntryPage", "Macro", "Playlist", "RollTable", "Scene"]);

async function loreRefBoard_setupReferenceTab(app, html, tab) {
        const pane = html.find("#lr-ref-pane")[0];
        if (!pane) return;

        const COLS = 4;
        const tabId = tab.id;
        const L = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);
        const LG = key => game.i18n.localize(`lore-reference-board.ReferenceGrid.${key}`);

        let cells = Array.isArray(tab.cells) ? tab.cells : [];
        if (cells.length === 0 && tab.docUuid) {
            cells = [{
                id: foundry.utils.randomID(),
                row: 1, col: 1, rowSpan: 1, colSpan: 1,
                docUuid: tab.docUuid, docType: tab.docType,
            }];
            const all = await loreRefBoard_loadTabs();
            const idx = all.findIndex(t => t.id === tabId);
            if (idx !== -1) {
                all[idx].cells = cells;
                delete all[idx].docUuid;
                delete all[idx].docType;
                await loreRefBoard_saveTabs(all);
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
                const fileName = (cell.filePath ?? "").split("/").pop() || "File";
                const fType = cell.fileType ?? "txt";
                const typeKey = `file-${fType}`;
                const badgeLabel = fType === "pdf" ? LG("FileCellBadgePdf")
                    : fType === "md" ? LG("FileCellBadgeMd")
                    : fType === "img" ? LG("FileCellBadgeImg")
                    : LG("FileCellBadgeTxt");
                return `
                <div class="lrt-ref-cell lrt-ref-cell--inline-content" style="${gs}" data-cell-id="${cell.id}">
                  <div class="lrt-ref-cell-header">
                    <span class="lrt-ref-type-badge lrt-ref-badge--${loreRefBoard_escapeHtml(typeKey)}">${loreRefBoard_escapeHtml(badgeLabel)}</span>
                    <span class="lrt-ref-cell-hdr-name" title="${loreRefBoard_escapeHtml(fileName)}">${loreRefBoard_escapeHtml(fileName)}</span>
                    <div class="lrt-ref-cell-hdr-btns"></div>
                    <button type="button" class="lrt-ref-cell-edit-btn" data-cell-id="${cell.id}" title="${LG("EditCellTitle")}">
                      <i class="fas fa-pencil-alt"></i>
                    </button>
                  </div>
                  <div class="lrt-ref-cell-content lrt-ref-cell-content--file" data-cell-id="${cell.id}" data-file-type="${loreRefBoard_escapeHtml(fType)}">
                    <p style="color:#555;font-style:italic;font-size:11px;padding:4px 0">Loading...</p>
                  </div>
                </div>`;
            }

            if (!cell.docUuid || !doc) {
                const brokenRef = cell.docUuid
                    ? `<p class="lrt-ref-cell-error-ref" title="${loreRefBoard_escapeHtml(cell.docUuid)}">${loreRefBoard_escapeHtml(cell.linkName || cell.docUuid)}</p>`
                    : "";
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
                    ${brokenRef}
                    <p class="lrt-ref-cell-error-hint">${L("RelinkHint")}</p>
                  </div>
                </div>`;
            }

            const cfg = loreRefBoard_REF_DOC_CFG[cell.docType] ??
                { icon: "fa-link", badgeKey: "TypeBadgeActor", imgFn: () => null, buttons: ["open"] };
            const badge = L(cfg.badgeKey);
            const typeKey = cell.docType ?? "unknown";

            // Inline-content variant: Journal & RollTable
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
                    <span class="lrt-ref-type-badge lrt-ref-badge--${typeKey}">${loreRefBoard_escapeHtml(badge)}</span>
                    <span class="lrt-ref-cell-hdr-name" title="${loreRefBoard_escapeHtml(doc.name ?? "")}">${loreRefBoard_escapeHtml(doc.name ?? "")}</span>
                    <div class="lrt-ref-cell-hdr-btns">${hdrBtnsHtml}</div>
                    <button type="button" class="lrt-ref-cell-edit-btn" data-cell-id="${cell.id}" title="${LG("EditCellTitle")}">
                      <i class="fas fa-pencil-alt"></i>
                    </button>
                  </div>
                  <div class="lrt-ref-cell-content" data-cell-id="${cell.id}" data-doc-type="${typeKey}">
                    <p style="color:#555;font-style:italic;font-size:11px;padding:4px 0">Loading...</p>
                  </div>
                </div>`;
            }

            // Standard card variant: Actor, Item, Macro, Playlist, Scene, Cards
            const imgSrc = cfg.imgFn(doc);
            const showImg = !!imgSrc && cell.rowSpan >= 2;

            const btnHtml = cfg.buttons.map(b => {
                switch (b) {
                    case "open": return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--open" data-cell-id="${cell.id}"><i class="fas fa-external-link-alt"></i> ${L("BtnOpen")}</button>`;
                    case "execute": return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--exec" data-cell-id="${cell.id}"><i class="fas fa-play"></i> ${L("BtnExecute")}</button>`;
                    case "roll": return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--roll" data-cell-id="${cell.id}"><i class="fas fa-dice-d20"></i> ${L("BtnRoll")}</button>`;
                    case "activate": return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--activate" data-cell-id="${cell.id}"><i class="fas fa-eye"></i> ${L("BtnActivateScene")}</button>`;
                    case "shuffle": return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--shuffle lrt-ref-cell-btn--icon" data-cell-id="${cell.id}" title="${L("BtnShuffle")}"><i class="fas fa-shuffle"></i></button>`;
                    case "deal": return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--deal lrt-ref-cell-btn--icon" data-cell-id="${cell.id}" title="${L("BtnDeal")}"><i class="fas fa-hand-holding"></i></button>`;
                    default: return "";
                }
            }).join("");

            return `
            <div class="lrt-ref-cell" style="${gs}" data-cell-id="${cell.id}">
              <div class="lrt-ref-cell-header">
                <span class="lrt-ref-type-badge lrt-ref-badge--${typeKey}">${loreRefBoard_escapeHtml(badge)}</span>
                <button type="button" class="lrt-ref-cell-edit-btn" data-cell-id="${cell.id}" title="${LG("EditCellTitle")}">
                  <i class="fas fa-pencil-alt"></i>
                </button>
              </div>
              <div class="lrt-ref-cell-body">
                ${showImg ? `<div class="lrt-ref-cell-img-wrap"><img class="lrt-ref-cell-img" src="${loreRefBoard_escapeHtml(imgSrc)}" alt="${loreRefBoard_escapeHtml(doc.name ?? "")}" /></div>` : ""}
                <div class="lrt-ref-cell-info">
                  <div class="lrt-ref-cell-name">${loreRefBoard_escapeHtml(doc.name ?? "")}</div>
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

        const _refGrid = pane.querySelector(".lrt-ref-grid");
        if (_refGrid && app._refGridScrollTop) {
            _refGrid.scrollTop = app._refGridScrollTop;
        }

        // Async: inject the inline content for Journal, RollTable, and file cells
        for (const { cell, doc } of resolved) {
            // File cells have no doc,  handle before the doc guard
            if (cell.docType === "file") {
                const contentEl = pane.querySelector(`.lrt-ref-cell-content[data-cell-id="${cell.id}"]`);
                if (!contentEl) continue;
                const fPath = cell.filePath ?? "";
                const fType = cell.fileType ?? "txt";
                (async () => {
                    try {
                        const fname = loreRefBoard_escapeHtml(fPath.split("/").pop());
                        if (fType === "pdf") {
                            if (!globalThis.pdfjsLib) {
                                contentEl.innerHTML = `<p class="lrt-ref-cell-load-fail">${LG("FileCellLoadFail")}</p>`;
                            } else {
                                try {
                                    const resp = await fetch(fPath);
                                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                                    const buf = await resp.arrayBuffer();
                                    const pdfDoc = await globalThis.pdfjsLib.getDocument({ data: buf }).promise;
                                    const totalPages = pdfDoc.numPages;

                                    const p1 = await pdfDoc.getPage(1);
                                    const p1vp = p1.getViewport({ scale: 1 });
                                    const p1aspect = (p1vp.height / p1vp.width * 100).toFixed(2);

                                    let outline = null;
                                    try { outline = await pdfDoc.getOutline(); } catch {}
                                    if (!outline?.length) outline = null;

                                    async function lrb_refDestToPage(dest) {
                                        try {
                                            let d = dest;
                                            if (typeof d === "string") d = await pdfDoc.getDestination(d);
                                            if (!Array.isArray(d) || !d[0]) return null;
                                            return (await pdfDoc.getPageIndex(d[0])) + 1;
                                        } catch { return null; }
                                    }

                                    const tocDestMap = new Map();
                                    let tocIdCtr = 0;

                                    function lrb_refTocItemsHtml(items, depth) {
                                        if (!items?.length) return "";
                                        return items.map(item => {
                                            const id = "rtoc-" + (++tocIdCtr);
                                            tocDestMap.set(id, item.dest);
                                            const hasChildren = item.items?.length > 0;
                                            const indent = 8 + depth * 14;
                                            const bold = item.bold ? "font-weight:600;" : "";
                                            const italic = item.italic ? "font-style:italic;" : "";
                                            const caret = hasChildren
                                                ? `<span class="lrb-toc-caret" aria-hidden="true">▸</span>`
                                                : `<span class="lrb-toc-dot" aria-hidden="true">·</span>`;
                                            const children = hasChildren
                                                ? `<div class="lrb-toc-children">${lrb_refTocItemsHtml(item.items, depth + 1)}</div>`
                                                : "";
                                            return `<div class="lrb-toc-item" data-toc-id="${id}" style="padding-left:${indent}px;${bold}${italic}">${caret}<span class="lrb-toc-title">${loreRefBoard_escapeHtml(item.title ?? "")}</span></div>${children}`;
                                        }).join("");
                                    }

                                    const cellPid = cell.id;
                                    const sidebarInner = outline
                                        ? `<div class="lrb-pdf-toc">${lrb_refTocItemsHtml(outline, 0)}</div>`
                                        : `<div class="lrb-pdf-thumbs" id="lrb-ref-thumbs-${cellPid}"></div>`;

                                    const placeholders = Array.from({ length: totalPages }, (_, i) => {
                                        const n = i + 1;
                                        return `<div class="lrb-pdf-page-ph" data-page="${n}" style="padding-bottom:${p1aspect}%"><span class="lrb-pdf-page-loading">Page ${n}</span></div>`;
                                    }).join("");

                                    contentEl.innerHTML = `
                                      <div class="lrb-ref-pdf-wrap lrb-pdf-viewer-wrap">
                                        <div class="lrb-pdf-sidebar lrb-pdf-sidebar--hidden" id="lrb-ref-sb-${cellPid}">${sidebarInner}</div>
                                        <div class="lrb-pdf-main">
                                          <div class="lrb-pdf-toolbar">
                                            <button class="lrb-pdf-sb-btn" id="lrb-ref-sb-btn-${cellPid}" title="${outline ? "Table of Contents" : "Thumbnails"}">
                                              <i class="fas ${outline ? "fa-list-ul" : "fa-th-large"}"></i>
                                            </button>
                                            <div class="lrb-pdf-page-nav-wrap">
                                              <input class="lrb-pdf-page-input" id="lrb-ref-pg-in-${cellPid}"
                                                     type="number" min="1" max="${totalPages}" value="1">
                                              <span class="lrb-pdf-page-total">/ ${totalPages}</span>
                                            </div>
                                          </div>
                                          <div class="lrb-pdf-scroll" id="lrb-ref-pscroll-${cellPid}">${placeholders}</div>
                                        </div>
                                      </div>`;

                                    const scrollEl = contentEl.querySelector(`#lrb-ref-pscroll-${cellPid}`);
                                    const pgInput = contentEl.querySelector(`#lrb-ref-pg-in-${cellPid}`);
                                    const sbPanel = contentEl.querySelector(`#lrb-ref-sb-${cellPid}`);
                                    const sbBtn = contentEl.querySelector(`#lrb-ref-sb-btn-${cellPid}`);
                                    const pageEls = Array.from(scrollEl.querySelectorAll(".lrb-pdf-page-ph"));

                                    const rendered = new Set();
                                    const rendering = new Set();

                                    async function lrb_renderRefPdfPage(ph) {
                                        const n = parseInt(ph.dataset.page);
                                        if (rendered.has(n) || rendering.has(n)) return;
                                        rendering.add(n);
                                        try {
                                            const page = await pdfDoc.getPage(n);
                                            const vw = Math.max(120, scrollEl.clientWidth - 8);
                                            const baseVp = page.getViewport({ scale: 1 });
                                            const scale = vw / baseVp.width;
                                            const viewport = page.getViewport({ scale });
                                            const dpr = window.devicePixelRatio || 1;

                                            const canvas = document.createElement("canvas");
                                            canvas.width = Math.round(viewport.width * dpr);
                                            canvas.height = Math.round(viewport.height * dpr);
                                            canvas.style.width = viewport.width + "px";
                                            canvas.style.height = viewport.height + "px";
                                            canvas.style.display = "block";
                                            const ctx = canvas.getContext("2d");
                                            ctx.scale(dpr, dpr);
                                            await page.render({ canvasContext: ctx, viewport }).promise;

                                            const textDiv = document.createElement("div");
                                            textDiv.className = "lrb-pdf-text-layer";
                                            textDiv.dataset.pdfPage = n;
                                            textDiv.style.cssText = `position:absolute;left:0;top:0;width:${viewport.width}px;height:${viewport.height}px;overflow:hidden;`;
                                            textDiv.style.setProperty("--scale-factor", String(viewport.scale));
                                            const tc = await page.getTextContent();
                                            await loreRefBoard_renderPdfTextLayer(textDiv, tc, viewport);

                                            const wrap = document.createElement("div");
                                            wrap.className = "lrb-pdf-page-wrap";
                                            wrap.style.cssText = `position:relative;width:${viewport.width}px;height:${viewport.height}px;`;
                                            wrap.appendChild(canvas);
                                            wrap.appendChild(textDiv);

                                            ph.style.cssText = `width:${viewport.width}px;`;
                                            ph.innerHTML = "";
                                            ph.appendChild(wrap);
                                            rendered.add(n);
                                            ph.dispatchEvent(new CustomEvent("lrb-pdf-page-rendered", { bubbles: true, detail: { page: n } }));
                                        } catch (err) {
                                            console.warn("[lore-reference-board] Ref PDF page render failed:", err);
                                        } finally {
                                            rendering.delete(n);
                                        }
                                    }

                                    function lrb_refScrollToPage(n) {
                                        pageEls[n - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }

                                    const renderObs = new IntersectionObserver(entries => {
                                        for (const e of entries) {
                                            if (e.isIntersecting) lrb_renderRefPdfPage(e.target).catch(() => {});
                                        }
                                    }, { root: scrollEl, rootMargin: "300px 0px" });
                                    pageEls.forEach(el => renderObs.observe(el));

                                    const pageObs = new IntersectionObserver(entries => {
                                        let best = null, bestR = 0;
                                        for (const e of entries) {
                                            if (e.isIntersecting && e.intersectionRatio > bestR) {
                                                bestR = e.intersectionRatio;
                                                best = e.target;
                                            }
                                        }
                                        if (best && document.activeElement !== pgInput) {
                                            pgInput.value = best.dataset.page;
                                        }
                                    }, { root: scrollEl, threshold: [0.1, 0.5] });
                                    pageEls.forEach(el => pageObs.observe(el));

                                    pgInput?.addEventListener("change", ev => {
                                        const n = Math.max(1, Math.min(totalPages, parseInt(ev.target.value) || 1));
                                        ev.target.value = n;
                                        lrb_refScrollToPage(n);
                                    });
                                    pgInput?.addEventListener("keydown", ev => {
                                        if (ev.key === "Enter") { ev.preventDefault(); ev.target.dispatchEvent(new Event("change")); ev.target.blur(); }
                                    });

                                    let sbOpen = false;
                                    sbBtn?.addEventListener("click", () => {
                                        sbOpen = !sbOpen;
                                        sbPanel.classList.toggle("lrb-pdf-sidebar--hidden", !sbOpen);
                                        sbBtn.classList.toggle("active", sbOpen);
                                    });

                                    if (outline) {
                                        sbPanel.querySelectorAll(".lrb-toc-item").forEach(item => {
                                            item.addEventListener("click", async ev => {
                                                ev.stopPropagation();
                                                const children = item.nextElementSibling;
                                                if (children?.classList.contains("lrb-toc-children")) {
                                                    const open = children.classList.toggle("lrb-toc-children--open");
                                                    const caret = item.querySelector(".lrb-toc-caret");
                                                    if (caret) caret.textContent = open ? "▾" : "▸";
                                                }
                                                const dest = tocDestMap.get(item.dataset.tocId);
                                                if (dest != null) {
                                                    const n = await lrb_refDestToPage(dest);
                                                    if (n) lrb_refScrollToPage(n);
                                                }
                                            });
                                        });
                                    } else {
                                        const thumbsEl = sbPanel.querySelector(`#lrb-ref-thumbs-${cellPid}`);
                                        if (thumbsEl) {
                                            thumbsEl.innerHTML = Array.from({ length: totalPages }, (_, i) =>
                                                `<div class="lrb-pdf-thumb-ph" data-page="${i + 1}"><span class="lrb-pdf-thumb-num">${i + 1}</span></div>`
                                            ).join("");

                                            const thumbObs = new IntersectionObserver(entries => {
                                                for (const e of entries) {
                                                    if (!e.isIntersecting) continue;
                                                    const ph = e.target;
                                                    if (ph.dataset.thumbDone) continue;
                                                    ph.dataset.thumbDone = "1";
                                                    thumbObs.unobserve(ph);
                                                    const n = parseInt(ph.dataset.page);
                                                    (async () => {
                                                        try {
                                                            const pg = await pdfDoc.getPage(n);
                                                            const bvp = pg.getViewport({ scale: 1 });
                                                            const ts = 80 / bvp.width;
                                                            const tvp = pg.getViewport({ scale: ts });
                                                            const tc2 = document.createElement("canvas");
                                                            tc2.width = Math.round(tvp.width);
                                                            tc2.height = Math.round(tvp.height);
                                                            tc2.style.cssText = `width:${tvp.width}px;height:${tvp.height}px;display:block;`;
                                                            await pg.render({ canvasContext: tc2.getContext("2d"), viewport: tvp }).promise;
                                                            ph.innerHTML = `<span class="lrb-pdf-thumb-num">${n}</span>`;
                                                            ph.insertBefore(tc2, ph.firstChild);
                                                        } catch {}
                                                    })();
                                                }
                                            }, { root: thumbsEl, rootMargin: "150px" });
                                            thumbsEl.querySelectorAll(".lrb-pdf-thumb-ph").forEach(el => thumbObs.observe(el));

                                            thumbsEl.addEventListener("click", ev => {
                                                const ph = ev.target.closest(".lrb-pdf-thumb-ph");
                                                if (!ph) return;
                                                thumbsEl.querySelectorAll(".lrb-pdf-thumb-ph--active").forEach(el => el.classList.remove("lrb-pdf-thumb-ph--active"));
                                                ph.classList.add("lrb-pdf-thumb-ph--active");
                                                lrb_refScrollToPage(parseInt(ph.dataset.page));
                                            });

                                            scrollEl.addEventListener("scroll", () => {
                                                const st = scrollEl.scrollTop;
                                                const sh = scrollEl.clientHeight;
                                                let bestN = 1, bestOverlap = -1;
                                                for (const el of pageEls) {
                                                    const top = el.offsetTop;
                                                    const bot = top + el.offsetHeight;
                                                    const overlap = Math.min(bot, st + sh) - Math.max(top, st);
                                                    if (overlap > bestOverlap) { bestOverlap = overlap; bestN = parseInt(el.dataset.page); }
                                                }
                                                const activePh = thumbsEl.querySelector(`[data-page="${bestN}"]`);
                                                if (activePh && !activePh.classList.contains("lrb-pdf-thumb-ph--active")) {
                                                    thumbsEl.querySelectorAll(".lrb-pdf-thumb-ph--active").forEach(el => el.classList.remove("lrb-pdf-thumb-ph--active"));
                                                    activePh.classList.add("lrb-pdf-thumb-ph--active");
                                                    activePh.scrollIntoView({ block: "nearest" });
                                                }
                                            }, { passive: true });

                                            Hooks.once("renderLoreReferenceBoardApp", () => thumbObs.disconnect());
                                        }
                                    }

                                    Hooks.once("renderLoreReferenceBoardApp", () => {
                                        renderObs.disconnect();
                                        pageObs.disconnect();
                                    });
                                } catch {
                                    contentEl.innerHTML = `<p class="lrt-ref-cell-load-fail">${LG("FileCellLoadFail")}</p>`;
                                }
                            }
                        } else if (fType === "img") {
                            contentEl.innerHTML = `<img src="${loreRefBoard_escapeHtml(fPath)}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;margin:auto" alt="${fname}">`;
                        } else {
                            const resp = await fetch(fPath);
                            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                            if (fType === "md") {
                                const mdText = await resp.text();
                                let html;
                                try   { html = window.marked?.parse(mdText) ?? `<pre>${loreRefBoard_escapeHtml(mdText)}</pre>`; }
                                catch { html = `<pre>${loreRefBoard_escapeHtml(mdText)}</pre>`; }
                                contentEl.innerHTML = html;
                            } else {
                                const text = await resp.text();
                                contentEl.innerHTML = `<pre class="lrt-doc-txt-content">${loreRefBoard_escapeHtml(text)}</pre>`;
                            }
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
            if (!contentEl) continue;

            if (cell.docType === "JournalEntry") {
                (async () => {
                    const pages = loreRefBoard_getJournalPages(doc);
                    const firstPage = pages[0] ?? null;
                    contentEl.innerHTML = await loreRefBoard_enrichJournalPage(firstPage, doc);
                    await loreRefBoard_wirePageNav(contentEl, doc.uuid);
                })().catch(err =>
                    console.error("[lore-reference-board] Journal cell render error:", err));
            } else if (cell.docType === "RollTable") {
                contentEl.innerHTML = _loreRefBoard_renderRollTableHtml(doc);
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
            if (doc) btn.addEventListener("click", () => app._dealCardsDialog(doc));
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
                const contentEl = pane.querySelector(`.lrt-ref-cell-content[data-cell-id="${btn.dataset.cellId}"]`);
                if (contentEl) contentEl.innerHTML = _loreRefBoard_renderRollTableHtml(doc);
            });
        });

        // Wire edit buttons
        pane.querySelectorAll(".lrt-ref-cell-edit-btn").forEach(btn => {
            btn.addEventListener("click", () =>
                loreRefBoard_editRefCellDialog(app, tabId, btn.dataset.cellId));
        });

        // Wire add buttons
        pane.querySelectorAll(".lrt-ref-add-btn").forEach(btn => {
            btn.addEventListener("click", () =>
                loreRefBoard_addRefCellDialog(app, tabId, parseInt(btn.dataset.row), parseInt(btn.dataset.col)));
        });

        if (_refGrid) {
            _refGrid.addEventListener("scroll", () => {
                app._refGridScrollTop = _refGrid.scrollTop;
            }, { passive: true });
        }
    }

function loreRefBoard_buildSpanPickerHtml(existingCells, maxRows, excludeId = null) {
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

function loreRefBoard_initSpanPicker(pickerEl, sizeEl, existingCells, initialRow, initialCol, excludeId = null) {
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

                // Hover preview
                if (anchorRow !== null && hoverRow !== null) {
                    const r1 = Math.min(anchorRow, hoverRow), r2 = Math.max(anchorRow, hoverRow);
                    const c1 = Math.min(anchorCol, hoverCol), c2 = Math.max(anchorCol, hoverCol);
                    if (r >= r1 && r <= r2 && c >= c1 && c <= c2) {
                        cell.classList.remove("lrt-span-selected");
                        cell.classList.add(isFreeRect(r1, c1, r2, c2)
                            ? "lrt-span-preview" : "lrt-span-invalid");
                    }
                }

                // Anchor dot
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
                    // First click set anchor, default to 1x1 selection here
                    anchorRow = r; anchorCol = c;
                    sel = { row: r, col: c, rowSpan: 1, colSpan: 1 };
                    updateLabel();
                    repaint(r, c);
                } else {
                    // Second click confirm rectangle
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

function loreRefBoard_refCellCollides(cells, excludeId, row, col, rowSpan, colSpan) {
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

async function loreRefBoard_addRefCellDialog(app, tabId, startRow, startCol) {
        const uid = foundry.utils.randomID();
        const L = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);
        const LG = key => game.i18n.localize(`lore-reference-board.ReferenceGrid.${key}`);

        // Load current cells to show occupancy in the picker
        const allTabsInit = await loreRefBoard_loadTabs();
        const tabIdxInit = allTabsInit.findIndex(t => t.id === tabId);
        const initCells = tabIdxInit !== -1 ? (allTabsInit[tabIdxInit].cells ?? []) : [];

        // Calculate picker rows: current grid height & 2 empty rows for expansion
        let maxRow = 0;
        for (const c of initCells) maxRow = Math.max(maxRow, c.row + c.rowSpan - 1);
        const pickerRows = Math.max(maxRow + 3, startRow + 1);

        let pendingUuid = null;
        let pendingType = null;
        let pendingName = null;
        let pendingFilePath = null;
        let pendingFileType = null;
        let picker = null;

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
              <div class="lrt-span-picker" id="lrt-span-picker-${uid}">${loreRefBoard_buildSpanPickerHtml(initCells, pickerRows)}</div>
              <p class="lrt-span-size-label" id="lrt-span-size-${uid}"></p>
            </div>
          </div>`;

        const _addCellPromise = DialogV2.wait({
            window: { title: LG("AddCellTitle") },
            classes: ["lore-rb-dialog"],
            position: { width: 400 },
            content,
            buttons: [
                { action: "add", label: game.i18n.localize("lore-reference-board.Common.Add"), default: true, callback: () => "add" },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: false,
        });

        let _addSetupTries = 0;
        const _addSetup = () => {
            const dz = document.getElementById(`lrt-rcd-dz-${uid}`);
            const pickerEl = document.getElementById(`lrt-span-picker-${uid}`);
            if (!dz || !pickerEl) { if (++_addSetupTries < 60) requestAnimationFrame(_addSetup); return; }

            picker = loreRefBoard_initSpanPicker(
                pickerEl,
                document.getElementById(`lrt-span-size-${uid}`),
                initCells, startRow, startCol
            );

            let depth = 0;
            dz.addEventListener("dragenter", ev => { ev.preventDefault(); depth++; dz.classList.add("lrt-drop-active"); });
            dz.addEventListener("dragleave", () => { if (!--depth) dz.classList.remove("lrt-drop-active"); });
            dz.addEventListener("dragover", ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = "link"; });
            dz.addEventListener("drop", async ev => {
                ev.preventDefault(); depth = 0; dz.classList.remove("lrt-drop-active");
                let data;
                try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                catch { ui.notifications.warn(L("DropReadFail")); return; }
                if (!loreRefBoard_REF_ACCEPTED_TYPES.has(data.type)) { ui.notifications.warn(L("DropWarn")); return; }
                let doc; try { doc = await fromUuid(data.uuid ?? ""); } catch { doc = null; }
                if (!doc) { ui.notifications.warn(L("DropWarn")); return; }
                const rd = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
                const rt = rd?.documentName ?? null;
                if (!rt || !loreRefBoard_REF_DOC_CFG[rt]) { ui.notifications.warn(L("DropWarn")); return; }
                pendingUuid = rd.uuid; pendingType = rt; pendingName = rd.name ?? null;
                pendingFilePath = null; pendingFileType = null;
                const fpathElDrop = document.getElementById(`lrt-rcd-fpath-${uid}`);
                if (fpathElDrop) fpathElDrop.value = "";
                const cfg = loreRefBoard_REF_DOC_CFG[rt];
                dz.classList.add("lrt-ref-dz--linked");
                document.getElementById(`lrt-rcd-icon-${uid}`).className = `fas ${cfg.icon} lrt-ref-dz-icon lrt-ref-dz-icon--linked`;
                document.getElementById(`lrt-rcd-name-${uid}`).textContent = rd.name ?? "";
                document.getElementById(`lrt-rcd-sub-${uid}`).textContent = L(cfg.badgeKey);
            });

            const fpathEl = document.getElementById(`lrt-rcd-fpath-${uid}`);
            const fbrowseEl = document.getElementById(`lrt-rcd-fbrowse-${uid}`);

            const applyFilePath = (path) => {
                if (!path) return;
                const ext = path.split(".").pop().toLowerCase();
                const _IMG_EXTS = new Set(["png","jpg","jpeg","gif","webp","svg","avif","bmp"]);
                const type = ext === "pdf" ? "pdf" : ext === "md" ? "md" : _IMG_EXTS.has(ext) ? "img" : "txt";
                fpathEl.value = path;
                pendingFilePath = path;
                pendingFileType = type;
                pendingUuid = null; pendingType = null; pendingName = null;
                dz.classList.remove("lrt-ref-dz--linked");
                document.getElementById(`lrt-rcd-icon-${uid}`).className = "fas fa-link lrt-ref-dz-icon";
                document.getElementById(`lrt-rcd-name-${uid}`).textContent = LG("DropToLink");
                document.getElementById(`lrt-rcd-sub-${uid}`).textContent = L("DropSubtext");
            };

            fpathEl?.addEventListener("change", () => {
                const path = loreRefBoard_normalizePath(fpathEl.value);
                if (path) applyFilePath(path);
                else { pendingFilePath = null; pendingFileType = null; }
            });
            fbrowseEl?.addEventListener("click", async () => {
                const picked = await loreRefBoard_pickRefFilePath(fpathEl?.value || "modules/");
                if (picked) applyFilePath(loreRefBoard_normalizePath(picked));
            });
        };
        requestAnimationFrame(_addSetup);

        const result = (await _addCellPromise) ?? "cancel";

        if (result !== "add" || (!pendingUuid && !pendingFilePath)) return;

        const span = picker?.getSpan();
        if (!span) { ui.notifications.warn(LG("SpanNotSelected")); return; }

        const { row, col, rowSpan, colSpan } = span;
        const allTabs = await loreRefBoard_loadTabs();
        const idx = allTabs.findIndex(t => t.id === tabId);
        if (idx === -1) return;
        const cells = allTabs[idx].cells ?? [];
        const problem = loreRefBoard_refCellCollides(cells, null, row, col, rowSpan, colSpan);
        if (problem === "overflow")   { ui.notifications.warn(LG("OverflowError"));   return; }
        if (problem === "collision")  { ui.notifications.warn(LG("CollisionError"));  return; }

        const newCell = pendingFilePath
            ? { id: foundry.utils.randomID(), row, col, rowSpan, colSpan, docType: "file", filePath: pendingFilePath, fileType: pendingFileType }
            : { id: foundry.utils.randomID(), row, col, rowSpan, colSpan, docUuid: pendingUuid, docType: pendingType, linkName: pendingName };
        allTabs[idx].cells = [...cells, newCell];
        await loreRefBoard_saveTabs(allTabs);
        await app.render();
    }

async function loreRefBoard_editRefCellDialog(app, tabId, cellId) {
        const COLS = 4;
        const uid = foundry.utils.randomID();
        const L = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);
        const LG = key => game.i18n.localize(`lore-reference-board.ReferenceGrid.${key}`);

        // Load fresh data
        const allTabs = await loreRefBoard_loadTabs();
        const tabIdx = allTabs.findIndex(t => t.id === tabId);
        if (tabIdx === -1) return;
        const cells = allTabs[tabIdx].cells ?? [];
        const cell = cells.find(c => c.id === cellId);
        if (!cell) return;

        // Resolve current doc
        const isFileCell = cell.docType === "file";
        let currentDoc = null;
        try { if (cell.docUuid) currentDoc = await fromUuid(cell.docUuid); } catch {}

        let pendingUuid = cell.docUuid ?? null;
        let pendingType = isFileCell ? null : (cell.docType ?? null);
        let pendingName = cell.linkName ?? null;
        let pendingFilePath = isFileCell ? (cell.filePath ?? null) : null;
        let pendingFileType = isFileCell ? (cell.fileType ?? "txt") : null;
        let picker = null;

        let maxRow = 0;
        for (const c of cells) maxRow = Math.max(maxRow, c.row + c.rowSpan - 1);
        const pickerRows = maxRow + 3;

        // Initial drop-zone
        const initLinked = !!currentDoc && !isFileCell;
        const initCfg = loreRefBoard_REF_DOC_CFG[cell.docType] ?? { icon: "fa-link", badgeKey: "TypeBadgeActor" };

        const content = `
          <div class="lrt-ref-cell-dialog">
            <div class="lrt-ref-cell-dz${initLinked ? " lrt-ref-dz--linked" : ""}" id="lrt-rcd-dz-${uid}">
              <i class="fas ${initCfg.icon} lrt-ref-dz-icon${initLinked ? " lrt-ref-dz-icon--linked" : ""}" id="lrt-rcd-icon-${uid}"></i>
              <p class="lrt-ref-dz-primary" id="lrt-rcd-name-${uid}">${initLinked ? loreRefBoard_escapeHtml(currentDoc.name ?? "") : LG("DropToLink")}</p>
              <p class="lrt-ref-dz-sub"    id="lrt-rcd-sub-${uid}">${initLinked ? loreRefBoard_escapeHtml(L(initCfg.badgeKey)) : L("DropSubtext")}</p>
              ${(!initLinked && cell.docUuid) ? `<p class="lrt-ref-dz-prev">${loreRefBoard_escapeHtml(game.i18n.format("lore-reference-board.ReferenceTab.PreviouslyLinked", { name: cell.linkName || cell.docUuid }))}</p>` : ""}
            </div>
            <div class="lrt-ref-file-section">
              <div class="lrt-ref-file-divider">${LG("FileCellDivider")}</div>
              <p class="lrt-ref-file-instruct">${LG("FileCellInstruct")}</p>
              <div class="lrt-ref-file-row">
                <input type="text" class="lrt-ref-file-path" id="lrt-rcd-fpath-${uid}"
                       value="${loreRefBoard_escapeHtml(pendingFilePath ?? "")}"
                       placeholder="${LG("FileCellPathPlaceholder")}" />
                <button type="button" class="lrt-ref-file-browse-btn" id="lrt-rcd-fbrowse-${uid}">
                  <i class="fas fa-folder-open"></i> ${LG("FileCellBrowse")}
                </button>
              </div>
            </div>
            <div class="lrt-ref-span-section">
              <p class="lrt-ref-span-label">${LG("SpanPickerLabel")}</p>
              <p class="lrt-ref-span-hint">${LG("SpanPickerHint")}</p>
              <div class="lrt-span-picker" id="lrt-span-picker-${uid}">${loreRefBoard_buildSpanPickerHtml(cells, pickerRows, cellId)}</div>
              <p class="lrt-span-size-label" id="lrt-span-size-${uid}"></p>
            </div>
          </div>`;

        const _editCellPromise = DialogV2.wait({
            window: { title: LG("EditCellTitle") },
            classes: ["lore-rb-dialog"],
            position: { width: 400 },
            content,
            buttons: [
                { action: "save", label: game.i18n.localize("lore-reference-board.Common.Save"), default: true, callback: () => "save" },
                { action: "delete", label: LG("DeleteCell"), callback: () => "delete" },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel"), callback: () => "cancel" },
            ],
            rejectClose: false,
        });

        let _editSetupTries = 0;
        const _editSetup = () => {
            const dz = document.getElementById(`lrt-rcd-dz-${uid}`);
            const pickerEl = document.getElementById(`lrt-span-picker-${uid}`);
            if (!dz || !pickerEl) { if (++_editSetupTries < 60) requestAnimationFrame(_editSetup); return; }

            picker = loreRefBoard_initSpanPicker(
                pickerEl,
                document.getElementById(`lrt-span-size-${uid}`),
                cells, cell.row, cell.col, cellId
            );

            let depth = 0;
            dz.addEventListener("dragenter", ev => { ev.preventDefault(); depth++; dz.classList.add("lrt-drop-active"); });
            dz.addEventListener("dragleave", () => { if (!--depth) dz.classList.remove("lrt-drop-active"); });
            dz.addEventListener("dragover", ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = "link"; });
            dz.addEventListener("drop", async ev => {
                ev.preventDefault(); depth = 0; dz.classList.remove("lrt-drop-active");
                let data;
                try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                catch { ui.notifications.warn(L("DropReadFail")); return; }
                if (!loreRefBoard_REF_ACCEPTED_TYPES.has(data.type)) { ui.notifications.warn(L("DropWarn")); return; }
                let doc; try { doc = await fromUuid(data.uuid ?? ""); } catch { doc = null; }
                if (!doc) { ui.notifications.warn(L("DropWarn")); return; }
                const rd = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
                const rt = rd?.documentName ?? null;
                if (!rt || !loreRefBoard_REF_DOC_CFG[rt]) { ui.notifications.warn(L("DropWarn")); return; }
                pendingUuid = rd.uuid; pendingType = rt; pendingName = rd.name ?? null;
                pendingFilePath = null; pendingFileType = null;
                const fpathElDrop = document.getElementById(`lrt-rcd-fpath-${uid}`);
                if (fpathElDrop) fpathElDrop.value = "";
                const cfg = loreRefBoard_REF_DOC_CFG[rt];
                dz.classList.add("lrt-ref-dz--linked");
                document.getElementById(`lrt-rcd-icon-${uid}`).className = `fas ${cfg.icon} lrt-ref-dz-icon lrt-ref-dz-icon--linked`;
                document.getElementById(`lrt-rcd-name-${uid}`).textContent = rd.name ?? "";
                document.getElementById(`lrt-rcd-sub-${uid}`).textContent = L(cfg.badgeKey);
            });

            const fpathEl = document.getElementById(`lrt-rcd-fpath-${uid}`);
            const fbrowseEl = document.getElementById(`lrt-rcd-fbrowse-${uid}`);

            const applyFilePath = (path) => {
                if (!path) return;
                const ext = path.split(".").pop().toLowerCase();
                const _IMG_EXTS = new Set(["png","jpg","jpeg","gif","webp","svg","avif","bmp"]);
                const type = ext === "pdf" ? "pdf" : ext === "md" ? "md" : _IMG_EXTS.has(ext) ? "img" : "txt";
                fpathEl.value = path;
                pendingFilePath = path;
                pendingFileType = type;
                pendingUuid = null; pendingType = null; pendingName = null;
                dz.classList.remove("lrt-ref-dz--linked");
                document.getElementById(`lrt-rcd-icon-${uid}`).className = "fas fa-link lrt-ref-dz-icon";
                document.getElementById(`lrt-rcd-name-${uid}`).textContent = LG("DropToLink");
                document.getElementById(`lrt-rcd-sub-${uid}`).textContent = L("DropSubtext");
            };

            fpathEl?.addEventListener("change", () => {
                const path = loreRefBoard_normalizePath(fpathEl.value);
                if (path) applyFilePath(path);
                else { pendingFilePath = null; pendingFileType = null; }
            });
            fbrowseEl?.addEventListener("click", async () => {
                const picked = await loreRefBoard_pickRefFilePath(fpathEl?.value || "modules/");
                if (picked) applyFilePath(loreRefBoard_normalizePath(picked));
            });
        };
        requestAnimationFrame(_editSetup);

        const result = (await _editCellPromise) ?? "cancel";

        if (result === "cancel") return;

        if (result === "delete") {
            allTabs[tabIdx].cells = cells.filter(c => c.id !== cellId);
            await loreRefBoard_saveTabs(allTabs);
            await app.render();
            return;
        }

        if (result === "save") {
            if (!pendingUuid && !pendingFilePath) return;
            const span = picker?.getSpan();
            if (!span) { ui.notifications.warn(LG("SpanNotSelected")); return; }
            const { row, col, rowSpan, colSpan } = span;
            const problem = loreRefBoard_refCellCollides(cells, cellId, row, col, rowSpan, colSpan);
            if (problem === "overflow")  { ui.notifications.warn(LG("OverflowError"));  return; }
            if (problem === "collision") { ui.notifications.warn(LG("CollisionError")); return; }
            const updatedCell = pendingFilePath
                ? { id: cell.id, row, col, rowSpan, colSpan, docType: "file", filePath: pendingFilePath, fileType: pendingFileType }
                : { id: cell.id, row, col, rowSpan, colSpan, docUuid: pendingUuid, docType: pendingType, linkName: pendingName };
            allTabs[tabIdx].cells = cells.map(c => c.id === cellId ? updatedCell : c);
            await loreRefBoard_saveTabs(allTabs);
            await app.render();
        }
    }

export { loreRefBoard_setupReferenceTab };
