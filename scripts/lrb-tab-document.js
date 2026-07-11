import { loreRefBoard_enrichJournalPage, loreRefBoard_getJournalPages, loreRefBoard_resolveJournalRef } from "./journal-helpers.js";
import { loreRefBoard_loadTabs, loreRefBoard_saveTabs } from "./storage.js";
import { _loreRefBoard_docTypeForExt, _loreRefBoard_isUrl, loreRefBoard_escapeHtml, loreRefBoard_normalizePath, loreRefBoard_pickDocFilePath, loreRefBoard_renderPdfTextLayer } from "./utils.js";

const { DialogV2 } = foundry.applications.api;

async function loreRefBoard_setupDocumentTab(app, html, tab) {
        const pane = html.find("#lr-doc-pane")[0];
        if (!pane) return;

        const tabId = tab.id;
        const docType = tab.docType ?? null;
        const docRef = tab.docRef  ?? null;

        const saveDocToTab = async (newDocType, newDocRef, newDocName = null) => {
            const all = await loreRefBoard_loadTabs();
            const idx = all.findIndex(t => t.id === tabId);
            if (idx === -1) return;
            all[idx].docType = newDocType;
            all[idx].docRef = newDocRef;
            all[idx].docName = newDocName;
            await loreRefBoard_saveTabs(all);
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
            dz.addEventListener("dragover", ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = "link"; });
            dz.addEventListener("drop", async ev => {
                ev.preventDefault();
                dragDepth = 0;
                dz.classList.remove("lrt-drop-active");

                let data;
                try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                catch { ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.DropReadFail")); return; }

                let journalId = null;
                let journalName = null;
                if (data.type === "JournalEntry") {
                    const entry = await fromUuid(data.uuid ?? "").catch(() => null);
                    journalId = entry?.uuid ?? null;
                    journalName = entry?.name ?? null;
                } else if (data.type === "JournalEntryPage") {
                    const page = await fromUuid(data.uuid ?? "").catch(() => null);
                    journalId = page?.parent?.uuid ?? null;
                    journalName = page?.parent?.name ?? null;
                }

                if (!journalId) { ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.DropWarn")); return; }
                await saveDocToTab("journal", journalId, journalName);
                await app.render();
            });

            // New journal entry button
            pane.querySelector(`#lrt-doc-create-${tabId}`)?.addEventListener("click", async () => {
                const defaultName = tab.name || game.i18n.localize("lore-reference-board.Pin.LoreEntryDefault");
                const nameUid = foundry.utils.randomID();
                const nameInputId = `lrt-dn-${nameUid}`;

                let chosenName;
                try {
                    chosenName = await DialogV2.wait({
                        window: { title: game.i18n.localize("lore-reference-board.Lore.NameEntryTitle") },
                        classes: ["lore-rb-dialog"],
                        content: `<form>
                                <div style="padding:6px 0">
                                    <label style="display:block;margin-bottom:4px;font-weight:bold">
                                        ${game.i18n.localize("lore-reference-board.Lore.JournalEntryName")}
                                    </label>
                                    <input id="${nameInputId}" name="${nameInputId}" type="text"
                                           value="${loreRefBoard_escapeHtml(defaultName)}"
                                           style="width:100%" autofocus />
                                </div>
                            </form>`,
                        buttons: [
                            {
                                action: "create",
                                label: game.i18n.localize("lore-reference-board.Common.Create"),
                                default: true,
                                callback: (_ev, btn) => btn.closest("dialog")?.querySelector(`#${nameInputId}`)?.value?.trim() || defaultName,
                            },
                            { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
                        ],
                        rejectClose: true,
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

                await saveDocToTab("journal", entry.uuid, entry.name);
                await app.render();
                entry.sheet.render(true);
            });

            // File browse button
            pane.querySelector(`#lrt-doc-browse-${tabId}`)?.addEventListener("click", async () => {
                const picked = await loreRefBoard_pickDocFilePath();
                if (!picked) return;
                const newType = _loreRefBoard_docTypeForExt(picked.split(".").pop());
                if (newType) {
                    await saveDocToTab(newType, picked);
                    await app.render();
                } else {
                    ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
                }
            });

            // Manual path input to handle all types including HTML, DOCX, and URLs
            const loadPath = async () => {
                const input = pane.querySelector(`#lrt-doc-path-${tabId}`);
                const rawPath = loreRefBoard_normalizePath(input?.value ?? "");
                if (!rawPath) return;
                const newType = _loreRefBoard_isUrl(rawPath) ? "url" : _loreRefBoard_docTypeForExt(rawPath.split(".").pop());
                if (newType) {
                    await saveDocToTab(newType, rawPath);
                    await app.render();
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
            const entry = await loreRefBoard_resolveJournalRef(docRef);

            if (!entry) {
                const brokenName = tab.docName
                    ? `<p class="lrt-doc-broken-name">${loreRefBoard_escapeHtml(tab.docName)}</p>`
                    : "";
                pane.innerHTML = `
                  <div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${game.i18n.localize("lore-reference-board.DocumentTab.NotFound")}</p>
                    ${brokenName}
                    <p class="lrt-doc-broken-ref">${loreRefBoard_escapeHtml(docRef ?? "")}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-unlink-${tabId}">
                      <i class="fas fa-link"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Relink")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-unlink-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await app.render();
                });
                return;
            }

            // Render first page, type sorted
            const pages = loreRefBoard_getJournalPages(entry);
            const firstPage = pages[0] ?? null;
            let enriched;
            try { enriched = await loreRefBoard_enrichJournalPage(firstPage, entry); }
            catch { enriched = '<p style="color:#888;font-style:italic">Could not render page.</p>'; }

            const pageNavHtml = pages.length > 1 ? `
              <div class="lrt-doc-page-nav">
                <i class="fas fa-book-open" style="color:#888;font-size:11px;flex-shrink:0"></i>
                <select class="lrt-doc-page-sel" id="lrt-doc-psel-${tabId}">
                  ${pages.map((p, i) => `<option value="${i}">${loreRefBoard_escapeHtml(p.name || `Page ${i + 1}`)}</option>`).join("")}
                </select>
              </div>` : "";

            pane.innerHTML = `
              <div class="lrt-doc-linked-bar">
                <i class="fas fa-book lrt-doc-linked-icon"></i>
                <span class="lrt-doc-linked-title">${loreRefBoard_escapeHtml(entry.name)}</span>
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
                await saveDocToTab(null, null); await app.render();
            });

            // enrichJournal Page switcher
            let currentPageIndex = 0;
            pane.querySelector(`#lrt-doc-psel-${tabId}`)?.addEventListener("change", async ev => {
                currentPageIndex = parseInt(ev.target.value) || 0;
                const page = pages[currentPageIndex];
                let enriched2;
                try { enriched2 = await loreRefBoard_enrichJournalPage(page, entry); }
                catch { enriched2 = '<p style="color:#888;font-style:italic">Could not render page.</p>'; }
                const contentEl = pane.querySelector(`#lrt-doc-content-${tabId}`);
                if (contentEl) contentEl.innerHTML = enriched2;
            });

            // Update when any page in this journal changes
            const hookId = Hooks.on("updateJournalEntryPage", async (updatedPage) => {
                if (updatedPage.parent?.uuid !== entry.uuid) return;
                if (updatedPage.id !== pages[currentPageIndex]?.id) return;
                let enriched3;
                try { enriched3 = await loreRefBoard_enrichJournalPage(updatedPage, entry); }
                catch { enriched3 = '<p style="color:#888;font-style:italic">Could not render page.</p>'; }
                const contentEl = pane.querySelector(`#lrt-doc-content-${tabId}`);
                if (contentEl) contentEl.innerHTML = enriched3;
            });
            // Clean up hook when board re-renders.
            Hooks.once("renderLoreReferenceBoardApp", () => Hooks.off("updateJournalEntryPage", hookId));
            return;
        }

        // STATE 3: PDF canvas viewer with infinite scroll, TOC/thumbnail sidebar
        if (docType === "pdf") {
            if (!globalThis.pdfjsLib) {
                pane.innerHTML = `<div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>PDF viewer requires pdf.js. Reload Foundry.</p>
                  </div>`;
                return;
            }
            let pdfDoc = null;
            try {
                const resp = await fetch(docRef);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const buf = await resp.arrayBuffer();
                pdfDoc = await globalThis.pdfjsLib.getDocument({ data: buf }).promise;
            } catch {
                pane.innerHTML = `<div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${game.i18n.localize("lore-reference-board.DocumentTab.LoadFail")}</p>
                    <p class="lrt-doc-broken-ref">${loreRefBoard_escapeHtml(docRef ?? "")}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                      <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await app.render();
                });
                return;
            }

            const totalPages = pdfDoc.numPages;
            const initPage = Math.max(1, Math.min(app._pdfInitPage ?? 1, totalPages));
            app._pdfInitPage = null;

            // Page 1 viewport for placeholder aspect ratio
            const p1 = await pdfDoc.getPage(1);
            const p1vp = p1.getViewport({ scale: 1 });
            const p1aspect = (p1vp.height / p1vp.width * 100).toFixed(2);

            let outline = null;
            try { outline = await pdfDoc.getOutline(); } catch {}
            if (!outline?.length) outline = null;

            async function lrb_destToPage(dest) {
                try {
                    let d = dest;
                    if (typeof d === "string") d = await pdfDoc.getDestination(d);
                    if (!Array.isArray(d) || !d[0]) return null;
                    return (await pdfDoc.getPageIndex(d[0])) + 1;
                } catch { return null; }
            }

            const tocDestMap = new Map();
            let tocIdCtr = 0;

            function lrb_tocItemsHtml(items, depth) {
                if (!items?.length) return "";
                return items.map(item => {
                    const id = "toc-" + (++tocIdCtr);
                    tocDestMap.set(id, item.dest);
                    const hasChildren = item.items?.length > 0;
                    const indent = 8 + depth * 14;
                    const bold = item.bold ? "font-weight:600;" : "";
                    const italic = item.italic ? "font-style:italic;" : "";
                    const caret = hasChildren
                        ? `<i class="fas fa-caret-right lrb-toc-caret" aria-hidden="true"></i>`
                        : `<i class="fas fa-circle lrb-toc-dot" aria-hidden="true"></i>`;
                    const children = hasChildren
                        ? `<div class="lrb-toc-children">${lrb_tocItemsHtml(item.items, depth + 1)}</div>`
                        : "";
                    return `<div class="lrb-toc-item" data-toc-id="${id}" style="padding-left:${indent}px;${bold}${italic}">${caret}<span class="lrb-toc-title">${loreRefBoard_escapeHtml(item.title ?? "")}</span></div>${children}`;
                }).join("");
            }

            const sidebarInner = outline
                ? `<div class="lrb-pdf-toc">${lrb_tocItemsHtml(outline, 0)}</div>`
                : `<div class="lrb-pdf-thumbs" id="lrb-pdf-thumbs-${tabId}"></div>`;

            const placeholders = Array.from({ length: totalPages }, (_, i) => {
                const n = i + 1;
                return `<div class="lrb-pdf-page-ph" data-page="${n}" style="padding-bottom:${p1aspect}%"><span class="lrb-pdf-page-loading">Page ${n}</span></div>`;
            }).join("");

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-file-pdf lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${loreRefBoard_escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrb-pdf-viewer-wrap">
                <div class="lrb-pdf-sidebar" id="lrb-pdf-sb-${tabId}">${sidebarInner}</div>
                <div class="lrb-pdf-main">
                  <div class="lrb-pdf-toolbar">
                    <button class="lrb-pdf-sb-btn" id="lrb-pdf-sb-btn-${tabId}" title="${outline ? "Table of Contents" : "Thumbnails"}">
                      <i class="fas ${outline ? "fa-list-ul" : "fa-th-large"}"></i>
                    </button>
                    <div class="lrb-pdf-page-nav-wrap">
                      <input class="lrb-pdf-page-input" id="lrb-pdf-pg-in-${tabId}"
                             type="number" min="1" max="${totalPages}" value="${initPage}">
                      <span class="lrb-pdf-page-total">/ ${totalPages}</span>
                    </div>
                  </div>
                  <div class="lrb-pdf-scroll" id="lrb-pdf-scroll-${tabId}">${placeholders}</div>
                </div>
              </div>`;

            const scrollEl = pane.querySelector(`#lrb-pdf-scroll-${tabId}`);
            const pageInput = pane.querySelector(`#lrb-pdf-pg-in-${tabId}`);
            const sbPanel = pane.querySelector(`#lrb-pdf-sb-${tabId}`);
            const sbBtn = pane.querySelector(`#lrb-pdf-sb-btn-${tabId}`);
            const pageEls = Array.from(scrollEl.querySelectorAll(".lrb-pdf-page-ph"));

            const rendered = new Set();
            const rendering = new Set();

            async function lrb_renderPage(ph) {
                const n = parseInt(ph.dataset.page);
                if (rendered.has(n) || rendering.has(n)) return;
                rendering.add(n);
                try {
                    const page = await pdfDoc.getPage(n);
                    const vw = Math.max(200, scrollEl.clientWidth - 20);
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
                    console.warn("[lore-reference-board] PDF page render failed:", err);
                } finally {
                    rendering.delete(n);
                }
            }

            // Lazy render with 500px lookahead
            const renderObs = new IntersectionObserver(entries => {
                for (const e of entries) {
                    if (e.isIntersecting) lrb_renderPage(e.target).catch(() => {});
                }
            }, { root: scrollEl, rootMargin: "500px 0px" });
            pageEls.forEach(el => renderObs.observe(el));

            // Track current page for input
            const pageObs = new IntersectionObserver(entries => {
                let best = null, bestR = 0;
                for (const e of entries) {
                    if (e.isIntersecting && e.intersectionRatio > bestR) {
                        bestR = e.intersectionRatio;
                        best = e.target;
                    }
                }
                if (best && document.activeElement !== pageInput) {
                    pageInput.value = best.dataset.page;
                }
            }, { root: scrollEl, threshold: [0.1, 0.5] });
            pageEls.forEach(el => pageObs.observe(el));

            // Scroll to page helper
            function lrb_scrollToPage(n) {
                const el = pageEls[n - 1];
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }

            // Page number input
            pageInput?.addEventListener("change", ev => {
                const n = Math.max(1, Math.min(totalPages, parseInt(ev.target.value) || 1));
                ev.target.value = n;
                lrb_scrollToPage(n);
            });
            pageInput?.addEventListener("keydown", ev => {
                if (ev.key === "Enter") { ev.preventDefault(); ev.target.dispatchEvent(new Event("change")); ev.target.blur(); }
            });

            // Sidebar toggle
            let sbOpen = true;
            sbBtn?.addEventListener("click", () => {
                sbOpen = !sbOpen;
                sbPanel.classList.toggle("lrb-pdf-sidebar--hidden", !sbOpen);
                sbBtn.classList.toggle("active", sbOpen);
            });

            // TOC navigation
            if (outline) {
                sbPanel.querySelectorAll(".lrb-toc-item").forEach(item => {
                    item.addEventListener("click", async ev => {
                        ev.stopPropagation();
                        const children = item.nextElementSibling;
                        if (children?.classList.contains("lrb-toc-children")) {
                            const open = children.classList.toggle("lrb-toc-children--open");
                            const caret = item.querySelector(".lrb-toc-caret");
                            if (caret) { caret.classList.toggle("fa-caret-down", open); caret.classList.toggle("fa-caret-right", !open); }
                        }
                        const dest = tocDestMap.get(item.dataset.tocId);
                        if (dest != null) {
                            const n = await lrb_destToPage(dest);
                            if (n) lrb_scrollToPage(n);
                        }
                    });
                });
            } else {
                // Thumbnail sidebar
                const thumbsEl = sbPanel.querySelector(`#lrb-pdf-thumbs-${tabId}`);
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
                        lrb_scrollToPage(parseInt(ph.dataset.page));
                    });

                    // Sync active thumb with scroll
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

            // render the jump point immediately instead of waiting for the lazy observer
            if (initPage > 1) {
                setTimeout(() => lrb_scrollToPage(initPage), 80);
                setTimeout(() => lrb_renderPage(pageEls[initPage - 1]).catch(() => {}), 120);
            }

            // Change / Remove
            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await loreRefBoard_pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _loreRefBoard_docTypeForExt(picked.split("/").pop().split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await app.render(); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await app.render();
            });

            // Clean up observers on re-render
            Hooks.once("renderLoreReferenceBoardApp", () => {
                renderObs.disconnect();
                pageObs.disconnect();
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
                <span class="lrt-doc-file-name">${loreRefBoard_escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-txt-wrapper">
                <pre class="lrt-doc-txt-content">${loreRefBoard_escapeHtml(fileContent)}</pre>
              </div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await loreRefBoard_pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _loreRefBoard_docTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await app.render(); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await app.render();
            });
            return;
        }

        // STATE 5: Standalone image
        if (docType === "image") {
            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-image lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${loreRefBoard_escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-image-wrapper">
                <img class="lrt-doc-standalone-img" src="${loreRefBoard_escapeHtml(docRef)}" alt="${loreRefBoard_escapeHtml(docRef.split("/").pop())}" />
              </div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await loreRefBoard_pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _loreRefBoard_docTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await app.render(); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await app.render();
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
                    await saveDocToTab(null, null); await app.render();
                });
                return;
            }

            let htmlContent;
            try { htmlContent = window.marked?.parse(mdText) ?? `<pre>${loreRefBoard_escapeHtml(mdText)}</pre>`; }
            catch { htmlContent = `<pre>${loreRefBoard_escapeHtml(mdText)}</pre>`; }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-file-lines lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${loreRefBoard_escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-journal-content lrt-doc-md-content">${htmlContent}</div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await loreRefBoard_pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _loreRefBoard_docTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await app.render(); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await app.render();
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
                    await saveDocToTab(null, null); await app.render();
                });
                return;
            }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-code lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${loreRefBoard_escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-pdf-wrapper">
                <iframe class="lrt-doc-pdf-frame" src="${blobUrl}" title="${loreRefBoard_escapeHtml(docRef.split("/").pop())}"></iframe>
              </div>`;

            Hooks.once("renderLoreReferenceBoardApp", () => { if (blobUrl) URL.revokeObjectURL(blobUrl); });

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await loreRefBoard_pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _loreRefBoard_docTypeForExt(picked.split(".").pop());
                if (newType) { if (blobUrl) URL.revokeObjectURL(blobUrl); await saveDocToTab(newType, picked); await app.render(); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                await saveDocToTab(null, null); await app.render();
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
                if (!window.mammoth) throw new Error("mammoth.js not yet loaded, reload Foundry and try again");
                const result = await window.mammoth.convertToHtml({ arrayBuffer });
                htmlContent = result.value || '<p style="color:#888;font-style:italic">Document appears to be empty.</p>';
            } catch (err) {
                const msg = err?.message ?? game.i18n.localize("lore-reference-board.DocumentTab.LoadFail");
                pane.innerHTML = `<div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${loreRefBoard_escapeHtml(msg)}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                      <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await app.render();
                });
                return;
            }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-file-word lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${loreRefBoard_escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-journal-content lrt-doc-docx-content">${htmlContent}</div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await loreRefBoard_pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _loreRefBoard_docTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await app.render(); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await app.render();
            });
            return;
        }

        // STATE 9: Web URL,  iframe
        if (docType === "url") {
            const shortUrl = docRef.length > 60 ? docRef.slice(0, 57) + "..." : docRef;
            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-globe lrt-doc-file-icon"></i>
                <span class="lrt-doc-url-label" title="${loreRefBoard_escapeHtml(docRef)}">${loreRefBoard_escapeHtml(shortUrl)}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--open-url" id="lrt-doc-openurl-${tabId}">
                  <i class="fas fa-external-link-alt"></i>
                  ${game.i18n.localize("lore-reference-board.DocumentTab.BtnOpenInBrowser")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <iframe class="lrt-doc-url-frame" src="${loreRefBoard_escapeHtml(docRef)}"
                      title="${loreRefBoard_escapeHtml(docRef)}"></iframe>`;

            pane.querySelector(`#lrt-doc-openurl-${tabId}`)?.addEventListener("click", () => {
                window.open(docRef, "_blank");
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null);
                await app.render();
            });
            return;
        }
    }

export { loreRefBoard_setupDocumentTab };
