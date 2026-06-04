const escapeHtml = (s) =>
    String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

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

function computeImageRect(containerW, containerH, imgNW, imgNH) {
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

function computeImageRect(containerW, containerH, imgNW, imgNH) {
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
