import { loreRefBoard_filePickerImpl, loreRefBoard_getDragEventData, loreRefBoard_openImagePopout } from "./compat.js";

const { DialogV2 } = foundry.applications.api;

const loreRefBoard_escapeHtml = (s) =>
    String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

const loreRefBoard_isSvgIcon = (icon) => typeof icon === "string" && icon.endsWith(".svg");

function loreRefBoard_showImageToPlayers(src, title = "") {
    game.socket.emit("shareImage", { image: src, title, uuid: null });
    loreRefBoard_openImagePopout(src, title);
}

const _loreRefBoard_svgIconCache = new Map();

async function loreRefBoard_fetchSvgData(url) {
    if (_loreRefBoard_svgIconCache.has(url)) return _loreRefBoard_svgIconCache.get(url);
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svgEl = doc.querySelector("svg");
        if (!svgEl) throw new Error("No <svg> element found");
        const viewBox = svgEl.getAttribute("viewBox") || "0 0 512 512";
        svgEl.querySelectorAll("[fill]").forEach(el => {
            el.removeAttribute("fill");
            el.removeAttribute("fill-opacity");
        });
        const result = { viewBox, inner: svgEl.innerHTML };
        _loreRefBoard_svgIconCache.set(url, result);
        return result;
    } catch (err) {
        console.warn(`[lore-reference-board] Could not load SVG icon "${url}":`, err);
        _loreRefBoard_svgIconCache.set(url, null);
        return null;
    }
}

function loreRefBoard_pickImagePath(current = "modules/") {
    return new Promise((resolve) => {
        const FP = loreRefBoard_filePickerImpl();
        new FP({
            type: "image",
            current: current || "modules/",
            callback: (path) => resolve(path),
        }).render(true);
    });
}

const loreRefBoard_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"]);

function _loreRefBoard_docTypeForExt(ext) {
    const e = (ext ?? "").toLowerCase();
    if (e === "pdf") return "pdf";
    if (e === "txt") return "txt";
    if (e === "md") return "md";
    if (e === "html" || e === "htm") return "html";
    if (e === "docx") return "docx";
    if (loreRefBoard_IMAGE_EXTS.has(e)) return "image";
    return null;
}

function loreRefBoard_pickDocFilePath(current = "modules/") {
    return new Promise((resolve) => {
        const FP = loreRefBoard_filePickerImpl();
        new FP({
            type: "any",
            current: current || "modules/",
            callback: (path) => resolve(path),
        }).render(true);
    });
}

// Open FilePicker for Reference grid file cells,  only PDF, TXT, and Markdown.
function loreRefBoard_pickRefFilePath(current = "modules/") {
    return new Promise((resolve) => {
        const FP = loreRefBoard_filePickerImpl();
        const fp = new FP({
            type: "any",
            extensions: [".pdf", ".txt", ".md"],
            current: current || "modules/",
            callback: (path) => resolve(path),
        });
        fp.extensions = [".pdf", ".txt", ".md"];
        fp.render(true);
    });
}

function _loreRefBoard_isUrl(path) {
    return /^https?:\/\//i.test(path ?? "");
}

function loreRefBoard_normalizePath(raw) {
    const trimmed = (raw ?? "").trim();
    if (_loreRefBoard_isUrl(trimmed)) return trimmed;     
    let p = trimmed.replace(/\\/g, "/");
    p = p.replace(/^\/+/, "");                 
    p = p.replace(/^[Dd]ata\//, "");           
    return p;
}

function loreRefBoard_afterDialogRender(setupFn, maxTries = 60) {
    let tries = 0;
    const tick = () => { if (setupFn()) return; if (++tries < maxTries) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
}

function loreRefBoard_attachDialogValidation(anchorId, actionName, requiredIds) {
    loreRefBoard_afterDialogRender(() => {
        const anchor = document.getElementById(anchorId);
        if (!anchor) return false;

        const dialogEl = anchor.closest(".dialog, .app, [data-appid]");
        const btn = dialogEl?.querySelector(`[data-action="${CSS.escape(actionName)}"]`);
        const form = anchor.closest("form");
        if (!btn || !form) return false;

        const inputs = requiredIds
            .map(id => form.elements[id] ?? document.getElementById(id))
            .filter(Boolean);

        const update = () => {
            const allFilled = inputs.every(el => el.value.trim() !== "");
            btn.disabled = !allFilled;
            btn.style.opacity = allFilled ? "" : "0.4";
            btn.style.cursor = allFilled ? "" : "not-allowed";
        };

        update();
        inputs.forEach(el => el.addEventListener("input", update));
        return true;
    });
}

// Faction relationship lines
const loreRefBoard_LINE_DASH = { solid: "none", dashed: "8 6", dotted: "2 4", "dash-dot": "10 4 2 4" };

function loreRefBoard_lineDashArray(style) {
    return loreRefBoard_LINE_DASH[style] ?? "none";
}

function loreRefBoard_offsetLineEndpoints(x1, y1, x2, y2, index, total, spacing = 8) {
    if (total <= 1) return { x1, y1, x2, y2 };
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const offset = (index - (total - 1) / 2) * spacing;
    return { x1: x1 + nx * offset, y1: y1 + ny * offset, x2: x2 + nx * offset, y2: y2 + ny * offset };
}

function loreRefBoard_parseRatingInput(current, raw) {
    const trimmed = String(raw ?? "").trim();
    if (trimmed === "") return current;

    // "=" forces an absolute value. "=-20" sets the rating to -20 instead of subtracting 20 from the current value.
    if (trimmed.startsWith("=")) {
        const abs = Number(trimmed.slice(1));
        return Number.isNaN(abs) ? current : abs;
    }

    if (/^[+-]/.test(trimmed)) {
        const delta = Number(trimmed);
        return Number.isNaN(delta) ? current : current + delta;
    }

    const abs = Number(trimmed);
    return Number.isNaN(abs) ? current : abs;
}

// Entity tokens droppable onto faction circles
const loreRefBoard_FACTION_DOC_TYPES = new Set(["Actor", "Item", "JournalEntry", "RollTable"]);

function loreRefBoard_getFactionDocIcon(doc) {
    if (doc?.img) return doc.img;
    switch (doc?.documentName) {
        case "JournalEntry": return "icons/svg/book.svg";
        case "RollTable": return "icons/svg/d20-grey.svg";
        case "Actor": return "icons/svg/mystery-man.svg";
        case "Item": return "icons/svg/item-bag.svg";
        default: return "icons/svg/mystery-man.svg";
    }
}

async function loreRefBoard_resolveDroppedFactionEntity(event) {
    let data;
    try { data = loreRefBoard_getDragEventData(event); }
    catch { return null; }

    if (!data?.type || !loreRefBoard_FACTION_DOC_TYPES.has(data.type)) return null;

    const uuid = data.uuid ?? (data.id ? `${data.type}.${data.id}` : null);
    if (!uuid) return null;

    const doc = await fromUuid(uuid);
    if (!doc) return null;

    return { uuid: doc.uuid, type: data.type, name: doc.name, img: loreRefBoard_getFactionDocIcon(doc) };
}

function loreRefBoard_computeImageRect(containerW, containerH, imgNW, imgNH) {
    if (!imgNW || !imgNH) return { offsetX: 0, offsetY: 0, displayW: containerW, displayH: containerH };
    const cr = containerW / containerH;
    const ir = imgNW / imgNH;
    if (ir > cr) {
        const dh = containerW / ir;
        return { offsetX: 0, offsetY: (containerH - dh) / 2, displayW: containerW, displayH: dh };
    }
    const dw = containerH * ir;
    return { offsetX: (containerW - dw) / 2, offsetY: 0, displayW: dw, displayH: containerH };
}

async function loreRefBoard_renderPdfTextLayer(container, textContent, viewport) {
    const lib = globalThis.pdfjsLib;
    if (!lib) return;
    try {
        if (typeof lib.TextLayer === "function") {
            // pdf.js v3+ API
            try {
                const tl = new lib.TextLayer({ textContentSource: textContent, container, viewport });
                await tl.render();
            } catch {
                // fallback to v2 API in case TextLayer constructor changed
                if (typeof lib.renderTextLayer === "function") {
                    const task = lib.renderTextLayer({ textContentSource: textContent, container, viewport, textDivs: [] });
                    if (task?.promise) await task.promise;
                }
            }
        } else if (typeof lib.renderTextLayer === "function") {
            const task = lib.renderTextLayer({ textContentSource: textContent, container, viewport, textDivs: [] });
            if (task?.promise) await task.promise;
        }
    } catch (err) {
        console.warn("[lore-reference-board] PDF text layer render failed:", err);
    }
}

const loreRefBoard_PDF_LIG = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };

function loreRefBoard_highlightPdfTextLayer(textLayer, queryText) {
    if (!textLayer || !queryText?.trim()) return;
    textLayer.querySelectorAll(".lr-hl-span").forEach(s => s.classList.remove("lr-hl-span"));
    const spans = Array.from(textLayer.querySelectorAll("span"));
    if (!spans.length) return;

    const needle = queryText.toLowerCase()
        .replace(/[\uFB00-\uFB06]/g, c => loreRefBoard_PDF_LIG[c] ?? c)
        .replace(/\s+/g, " ").trim();
    if (!needle) return;

    // pdf.js span boundaries are ambiguous, scan both ways
    const build = (boundaryIsSpace) => {
        const hay = [];
        const spanIdx = [];
        let lastWasSpace = true;
        for (let s = 0; s < spans.length; s++) {
            for (const ch of spans[s].textContent) {
                for (const c of (loreRefBoard_PDF_LIG[ch] ?? ch).toLowerCase()) {
                    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\u00a0") {
                        if (lastWasSpace) continue;
                        hay.push(" ");
                        spanIdx.push(s);
                        lastWasSpace = true;
                    } else {
                        hay.push(c);
                        spanIdx.push(s);
                        lastWasSpace = false;
                    }
                }
            }
            if (boundaryIsSpace && !lastWasSpace) { hay.push(" "); spanIdx.push(s); lastWasSpace = true; }
        }
        return { hayStr: hay.join(""), spanIdx };
    };

    const mark = ({ hayStr, spanIdx }) => {
        let from = 0;
        while (true) {
            const idx = hayStr.indexOf(needle, from);
            if (idx === -1) break;
            const first = spanIdx[idx];
            const last = spanIdx[idx + needle.length - 1];
            for (let s = first; s <= last; s++) {
                if (spans[s].textContent) spans[s].classList.add("lr-hl-span");
            }
            from = idx + needle.length;
        }
    };

    mark(build(true));
    mark(build(false));
}

// Keep/Clear/Cancel prompt for a source change.
async function loreRefBoard_pinChangePrompt(title, bodyHtml) {
    const result = await DialogV2.wait({
        classes: ["lore-rb-dialog"],
        window: { title },
        content: bodyHtml,
        buttons: [
            { action: "keep", label: game.i18n.localize("lore-reference-board.Pin.KeepPins"), default: true, callback: () => "keep" },
            { action: "clear", label: game.i18n.localize("lore-reference-board.Pin.ClearPins"), callback: () => "clear" },
            { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
        ],
        rejectClose: false,
    });
    return (result === "keep" || result === "clear") ? result : "cancel";
}

// Shared panzoom scale zoom slider + label.
function loreRefBoard_syncZoomBar(html, scale, sliderSel, labelSel) {
    const pct = Math.round((scale ?? 1) * 100);
    const slider = html.find(sliderSel)[0];
    const label = html.find(labelSel)[0];
    if (slider) slider.value = pct;
    if (label) label.textContent = pct + "%";
}

// Lazy getPanzoom
function loreRefBoard_bindZoomControls(html, getPanzoom, ids, sync) {
    html.find(ids.zoomIn).off("click").on("click", () => { const pz = getPanzoom(); if (pz) pz.zoomIn({ step: 0.1 }); });
    html.find(ids.zoomOut).off("click").on("click", () => { const pz = getPanzoom(); if (pz) pz.zoomOut({ step: 0.1 }); });
    html.find(ids.reset).off("click").on("click", () => { const pz = getPanzoom(); if (pz) pz.reset(); });
    html.find(ids.slider).off("input").on("input", (ev) => {
        const pz = getPanzoom();
        if (!pz) return;
        const scale = Number(ev.currentTarget.value) / 100;
        pz.zoom(scale, { animate: false });
        sync(scale);
    });
}

export { _loreRefBoard_docTypeForExt, _loreRefBoard_isUrl, loreRefBoard_LINE_DASH, loreRefBoard_afterDialogRender, loreRefBoard_attachDialogValidation, loreRefBoard_computeImageRect, loreRefBoard_escapeHtml, loreRefBoard_fetchSvgData, loreRefBoard_highlightPdfTextLayer, loreRefBoard_isSvgIcon, loreRefBoard_lineDashArray, loreRefBoard_normalizePath, loreRefBoard_offsetLineEndpoints, loreRefBoard_parseRatingInput, loreRefBoard_pickDocFilePath, loreRefBoard_pickImagePath, loreRefBoard_pickRefFilePath, loreRefBoard_pinChangePrompt, loreRefBoard_renderPdfTextLayer, loreRefBoard_bindZoomControls, loreRefBoard_resolveDroppedFactionEntity, loreRefBoard_showImageToPlayers, loreRefBoard_syncZoomBar };
