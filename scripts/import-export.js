import { loreRefBoard_filePickerImpl } from "./compat.js";
import { loreRefBoard_resolveJournalRef } from "./journal-helpers.js";
import { loreRefBoard_DEFAULT_RELATIONSHIP_TYPES, loreRefBoard_DEFAULT_STANDING_TIERS, loreRefBoard_MODULE_SCOPE } from "./module-init.js";
import { _loreRefBoard_flushPins, _loreRefBoard_getSetting, loreRefBoard_loadTabs, loreRefBoard_saveFactionStandingTiers, loreRefBoard_saveRelationshipTypes, loreRefBoard_saveTabs, loreRefBoard_setFactionDataMap, loreRefBoard_setImageJournalMap, loreRefBoard_setImageLoreMap, loreRefBoard_setPinsMap, loreRefBoard_setThreadsDataMap } from "./storage.js";
import { loreRefBoard_normalizeImageTabLayers } from "./pin-layers.js";
import { loreRefBoard_resolveScene } from "./scene-source.js";
import { _loreRefBoard_isUrl, loreRefBoard_afterDialogRender, loreRefBoard_escapeHtml } from "./utils.js";

var { DialogV2 } = foundry.applications.api;

async function _loreRefBoard_export() {
    // Flush any pending debounced pin write so the export captures the latest data.
    await _loreRefBoard_flushPins();

    const payload = {
        version: 1,
        module: loreRefBoard_MODULE_SCOPE,
        exportedAt: new Date().toISOString(),
        tabs: _loreRefBoard_getSetting("tabs", []),
        pins: _loreRefBoard_getSetting("pins", {}),
        "image-lore": _loreRefBoard_getSetting("image-lore", {}),
        imageJournals: _loreRefBoard_getSetting("imageJournals", {}),
        factionBoardData: _loreRefBoard_getSetting("factionBoardData", {}),
        threadsData: _loreRefBoard_getSetting("threadsData", {}),
        relationshipTypes: _loreRefBoard_getSetting("relationshipTypes", loreRefBoard_DEFAULT_RELATIONSHIP_TYPES),
        factionStandingTiers: _loreRefBoard_getSetting("factionStandingTiers", loreRefBoard_DEFAULT_STANDING_TIERS),
    };

    // deep copy so name never mutates the live settings objects
    const enriched = JSON.parse(JSON.stringify(payload));
    await _loreRefBoard_enrichExportNames(enriched);

    const filename = `lore-reference-board-${new Date().toISOString().slice(0, 10)}.json`;
    const worldPath = `worlds/${game.world.id}`;
    const file = new File([JSON.stringify(enriched, null, 2)], filename, { type: "application/json" });

    try {
        await loreRefBoard_filePickerImpl().upload("data", worldPath, file, { notify: false });
        ui.notifications.info(
            `${game.i18n.localize("lore-reference-board.ImportExport.ExportSuccess")} (${worldPath}/${filename})`
        );
    } catch (err) {
        console.error("LoreReferenceBoard | Export failed:", err);
        ui.notifications.error(game.i18n.localize("lore-reference-board.ImportExport.ExportFailed"));
    }
}

// Embed display names so imports into other worlds can display names instead of ids
async function _loreRefBoard_enrichExportNames(d) {
    const docName = async (uuid) => {
        if (!uuid) return null;
        try { return (await fromUuid(uuid))?.name ?? null; } catch { return null; }
    };
    const journalName = async (ref) => ref ? ((await loreRefBoard_resolveJournalRef(ref))?.name ?? null) : null;

    for (const tab of (Array.isArray(d.tabs) ? d.tabs : [])) {
        if (tab.type === "document" && tab.docType === "journal" && !tab.docName) {
            tab.docName = (await journalName(tab.docRef)) ?? tab.docName;
        }
        if (tab.type === "reference") {
            for (const cell of (Array.isArray(tab.cells) ? tab.cells : [])) {
                if (cell?.docUuid && !cell.linkName) {
                    const n = await docName(cell.docUuid);
                    if (n) cell.linkName = n;
                }
            }
        }
    }
    for (const tabPins of Object.values(d.pins ?? {})) {
        if (!Array.isArray(tabPins)) continue;
        for (const pin of tabPins) {
            if (pin?.journal && !pin.journalName) {
                const n = await journalName(pin.journal);
                if (n) pin.journalName = n;
            }
            for (const row of (Array.isArray(pin?.threads?.rows) ? pin.threads.rows : [])) {
                for (const link of (Array.isArray(row?.links) ? row.links : [])) {
                    if (link?.kind === "journal" && link.uuid && !link.label) {
                        const n = await journalName(link.uuid);
                        if (n) link.label = n;
                    }
                }
            }
        }
    }
    for (const threadsDoc of Object.values(d.threadsData ?? {})) {
        for (const row of (Array.isArray(threadsDoc?.rows) ? threadsDoc.rows : [])) {
            for (const link of (Array.isArray(row?.links) ? row.links : [])) {
                if (link?.kind === "journal" && link.uuid && !link.label) {
                    const n = await journalName(link.uuid);
                    if (n) link.label = n;
                }
            }
        }
    }
}

// Opens the OS file picker
async function _loreRefBoard_import() {
    const importData = await _loreRefBoard_pickAndParseFile();
    if (!importData) return;

    const proceed = await _loreRefBoard_validateImportLinks(importData);
    if (!proceed) return;

    const mode = await _loreRefBoard_askImportMode();
    if (!mode) return;

    if (mode === "replace") {
        await _loreRefBoard_applyReplace(importData);
    } else {
        await _loreRefBoard_applyMerge(importData);
    }

    // Ensure every imported image tab carries at least one layer and no orphans
    for (const t of await loreRefBoard_loadTabs()) {
        if (t.type === "image") await loreRefBoard_normalizeImageTabLayers(t.id);
    }

    // Refresh the board window if it is already open.
    const board = game.loreReferenceBoardAppInstance;
    if (board?.rendered) await board.render(true);

    ui.notifications.info(game.i18n.localize("lore-reference-board.ImportExport.ImportSuccess"));
}

// Opens an OS file picker and parses the chosen JSON
function _loreRefBoard_pickAndParseFile() {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        let settled = false;

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

            if (parsed?.module !== loreRefBoard_MODULE_SCOPE || !Array.isArray(parsed?.tabs)) {
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

// Validates every payload link
async function _loreRefBoard_validateImportLinks(d) {
    const L = key => game.i18n.localize(`lore-reference-board.ImportExport.${key}`);
    const F = (key, data) => game.i18n.format(`lore-reference-board.ImportExport.${key}`, data);
    const esc = loreRefBoard_escapeHtml;

    const fileOk = async (p) => {
        if (!p || _loreRefBoard_isUrl(p)) return true;
        try { return (await fetch(p, { method: "HEAD" })).ok; } catch { return false; }
    };
    const folderOk = async (p) => {
        if (!p) return true;
        const FP = loreRefBoard_filePickerImpl();
        try { await FP.browse("data", p); return true; } catch { }
        // core Foundry assets
        try { await FP.browse("public", p); return true; } catch { return false; }
    };
    const docOk = async (uuid) => {
        if (!uuid) return true;
        try { if (await fromUuid(uuid)) return true; } catch { }
        return false;
    };
    const journalOk = async (ref) => !ref || !!(await loreRefBoard_resolveJournalRef(ref));

    const broken = [];
    let total = 0;
    const check = async (ok, kind, where, ref, opts = {}) => {
        total++;
        if (!(await ok)) {
            broken.push({
                kind: L(kind),
                where: String(where),
                ref: String(ref),
                label: opts.label ? String(opts.label) : null,
                type: opts.type ?? null,
                docType: opts.docType ?? null,
                apply: opts.apply ?? null,
                precomputed: opts.precomputed ?? null,
            });
        }
    };

    const tabs = Array.isArray(d.tabs) ? d.tabs : [];
    const tabName = t => t?.name ?? t?.id ?? "?";

    for (const tab of tabs) {
        if (tab.type === "image" && tab.imgSource === "scene" && Array.isArray(tab.sceneImages) && tab.sceneImages.length) {
            const activeIdx = Math.min(Math.max(0, tab.sceneIndex ?? 0), tab.sceneImages.length - 1);
            for (let i = 0; i < tab.sceneImages.length; i++) {
                const im = tab.sceneImages[i];
                if (!im?.src) continue;
                const isActive = i === activeIdx;
                await check(fileOk(im.src), "LinkTab", tabName(tab), im.src,
                    { type: "file", apply: v => { im.src = v; if (isActive) tab.img = v; } });
            }
            if (tab.sceneName && !(await loreRefBoard_resolveScene(tab))) {
                const sceneCands = game.scenes.filter(s => s.name === tab.sceneName)
                    .map(s => ({ value: s.uuid, name: s.name, folder: s.folder?.name ?? "" }));
                for (const pack of (game.packs ?? [])) {
                    if (pack.documentName !== "Scene") continue;
                    for (const e of pack.index) {
                        if (e.name !== tab.sceneName) continue;
                        sceneCands.push({ value: e.uuid ?? ("Compendium." + pack.collection + ".Scene." + e._id), name: e.name, folder: pack.title ?? pack.metadata?.label ?? "" });
                    }
                }
                if (sceneCands.length) {
                    await check(Promise.resolve(false), "LinkScene", tabName(tab), tab.sceneName,
                        { label: tab.sceneName, type: "scene", precomputed: sceneCands,
                          apply: (v, n) => {
                              tab.sceneUuid = v;
                              tab.sceneId = (typeof v === "string" && v.startsWith("Scene.")) ? v.slice(6) : null;
                              tab.sceneSource = (typeof v === "string" && v.startsWith("Compendium.")) ? "compendium" : "world";
                              if (n) tab.sceneName = n;
                          } });
                }
            }
        } else if (tab.type === "image" && tab.img) {
            await check(fileOk(tab.img), "LinkTab", tabName(tab), tab.img,
                { type: "file", apply: v => { tab.img = v; } });
        } else if (tab.type === "document" && tab.docType && tab.docRef) {
            if (tab.docType === "journal") {
                await check(journalOk(tab.docRef), "LinkTab", tabName(tab), tab.docRef,
                    { label: tab.docName, type: "journal", apply: (v, n) => { tab.docRef = v; if (n) tab.docName = n; } });
            } else if (tab.docType !== "url") {
                await check(fileOk(tab.docRef), "LinkTab", tabName(tab), tab.docRef,
                    { type: "file", apply: v => { tab.docRef = v; } });
            }
        } else if (tab.type === "reference") {
            for (const cell of (Array.isArray(tab.cells) ? tab.cells : [])) {
                if (cell?.docUuid) {
                    await check(docOk(cell.docUuid), "LinkCell", tabName(tab), cell.docUuid,
                        { label: cell.linkName, type: "uuid", docType: cell.docType, apply: (v, n) => { cell.docUuid = v; if (n) cell.linkName = n; } });
                } else if (cell?.filePath) {
                    await check(fileOk(cell.filePath), "LinkCell", tabName(tab), cell.filePath,
                        { type: "file", apply: v => { cell.filePath = v; } });
                }
            }
        }
    }

    const pinsByTab = (d.pins && typeof d.pins === "object") ? d.pins : {};
    for (const tabPins of Object.values(pinsByTab)) {
        for (const pin of (Array.isArray(tabPins) ? tabPins : [])) {
            const pinName = pin?.title || "?";
            if (pin?.journal) {
                await check(journalOk(pin.journal), "LinkPin", pinName, pin.journal,
                    { label: pin.journalName, type: "journal", apply: (v, n) => { pin.journal = v; if (n) pin.journalName = n; } });
            }
            for (const folder of (pin?.gallery?.folders ?? [])) {
                if (folder?.path) {
                    await check(folderOk(folder.path), "LinkGallery", pinName, folder.path,
                        { type: "folder", apply: v => { folder.path = v; } });
                }
            }
            for (const row of (Array.isArray(pin?.threads?.rows) ? pin.threads.rows : [])) {
                for (const link of (Array.isArray(row?.links) ? row.links : [])) {
                    if (link?.kind === "journal" && link.uuid) {
                        await check(journalOk(link.uuid), "LinkPin", pinName, link.uuid,
                            { label: link.label, type: "journal", apply: (v, n) => { link.uuid = v; if (n) link.label = n; } });
                    }
                }
            }
        }
    }

    const imageJournals = (d.imageJournals && typeof d.imageJournals === "object") ? d.imageJournals : {};
    for (const pinMap of Object.values(imageJournals)) {
        for (const [src, journalId] of Object.entries(pinMap ?? {})) {
            if (journalId) {
                await check(journalOk(journalId), "LinkPinImage", src.split("/").pop(), journalId,
                    { type: "journal", apply: v => { pinMap[src] = v; } });
            }
        }
    }

    const threadsData = (d.threadsData && typeof d.threadsData === "object") ? d.threadsData : {};
    for (const threadsDoc of Object.values(threadsData)) {
        for (const row of (Array.isArray(threadsDoc?.rows) ? threadsDoc.rows : [])) {
            for (const link of (Array.isArray(row?.links) ? row.links : [])) {
                if (link?.kind === "journal" && link.uuid) {
                    await check(journalOk(link.uuid), "LinkTab", row?.title ?? "?", link.uuid,
                        { label: link.label, type: "journal", apply: (v, n) => { link.uuid = v; if (n) link.label = n; } });
                }
            }
        }
    }

    const factionData = (d.factionBoardData && typeof d.factionBoardData === "object") ? d.factionBoardData : {};
    for (const data of Object.values(factionData)) {
        for (const circle of (Array.isArray(data?.circles) ? data.circles : [])) {
            for (const ent of (Array.isArray(circle?.entities) ? circle.entities : [])) {
                if (ent?.uuid) {
                    await check(docOk(ent.uuid), "LinkFaction", circle?.name ?? "?", ent.uuid,
                        { label: ent.name, type: "uuid", docType: ent.type, apply: (v, n) => { ent.uuid = v; if (n) ent.name = n; } });
                }
            }
        }
    }

    if (!broken.length) return true;

    // Name/type relink candidates from this world
    const collections = {
        Actor: () => game.actors, Item: () => game.items, JournalEntry: () => game.journal,
        RollTable: () => game.tables, Scene: () => game.scenes, Macro: () => game.macros,
        Playlist: () => game.playlists, Cards: () => game.cards,
    };
    const packCandidates = (docType, name) => {
        const out = [];
        for (const pack of (game.packs ?? [])) {
            if (pack.documentName !== docType) continue;
            for (const e of pack.index) {
                if (e.name !== name) continue;
                out.push({
                    value: e.uuid ?? `Compendium.${pack.collection}.${e._id}`,
                    name: e.name,
                    folder: pack.title ?? pack.metadata?.label ?? "",
                });
            }
        }
        return out;
    };
    for (const b of broken) {
        b.candidates = [];
        if (b.precomputed) {
            b.candidates = b.precomputed;
        } else if (b.label && b.apply) {
            if (b.type === "journal") {
                b.candidates = [
                    ...game.journal.filter(j => j.name === b.label)
                        .map(j => ({ value: j.uuid, name: j.name, folder: j.folder?.name ?? "" })),
                    ...packCandidates("JournalEntry", b.label),
                ];
            } else if (b.type === "uuid" && collections[b.docType]) {
                const col = collections[b.docType]();
                b.candidates = [
                    ...(col?.filter?.(x => x.name === b.label) ?? [])
                        .map(x => ({ value: x.uuid, name: x.name, folder: x.folder?.name ?? "" })),
                    ...packCandidates(b.docType, b.label),
                ];
            }
        }
        b.accepted = false;
        b.chosen = b.candidates.length === 1 ? b.candidates[0].value : null;
        b.remapFixed = null;
        b.remapPath = null;
    }
    broken.forEach((b, i) => { b.i = i; });

    // shared prefix remap candidate for broken file and folder paths
    const pathItems = broken.filter(b => (b.type === "file" || b.type === "folder") && b.apply);
    let commonPrefix = "";
    if (pathItems.length >= 2) {
        const dirs = pathItems.map(b => b.ref.slice(0, b.ref.lastIndexOf("/") + 1));
        commonPrefix = dirs.reduce((a, s) => {
            let i = 0;
            while (i < a.length && i < s.length && a[i] === s[i]) i++;
            return a.slice(0, i);
        });
        commonPrefix = commonPrefix.slice(0, commonPrefix.lastIndexOf("/") + 1);
    }
    const showRemap = pathItems.length >= 2;

    const uid = foundry.utils.randomID();

    const rowHtml = (b) => {
        const what = b.label
            ? `<span class="lrb-broken-label" title="${esc(b.ref)}">${esc(b.label)}</span>`
            : `<code>${esc(b.ref)}</code>`;
        let suggest = "";
        if (b.candidates.length === 1) {
            const c = b.candidates[0];
            const shown = c.folder ? `${c.name} (${c.folder})` : c.name;
            suggest = `<div class="lrb-ic-suggest">
                <span>${esc(F("SuggestFound", { name: shown }))}</span>
                <button type="button" class="lrb-ic-accept" data-i="${b.i}">${esc(L("BtnRelink"))}</button>
              </div>`;
        } else if (b.candidates.length > 1) {
            suggest = `<div class="lrb-ic-suggest">
                <span>${esc(F("SuggestMultiple", { count: b.candidates.length }))}</span>
                <select class="lrb-ic-pick" data-i="${b.i}">
                  <option value="">${esc(L("SuggestChoose"))}</option>
                  ${b.candidates.map(c => `<option value="${esc(c.value)}">${esc(c.name)}${c.folder ? ` - ${esc(c.folder)}` : ""}</option>`).join("")}
                </select>
                <button type="button" class="lrb-ic-accept" data-i="${b.i}" disabled>${esc(L("BtnRelink"))}</button>
              </div>`;
        }
        return `<li class="lrb-ic-row" data-i="${b.i}"><div class="lrb-ic-main"><b>${esc(b.kind)}</b> ${esc(b.where)}: ${what}</div>${suggest}</li>`;
    };

    const exactCount = broken.filter(b => b.candidates.length === 1).length;
    const relinkAllHtml = exactCount > 1
        ? `<button type="button" class="lrb-ic-relink-all" id="lrb-ic-all-${uid}">${esc(F("RelinkAll", { count: exactCount }))}</button>`
        : "";

    const remapHtml = showRemap ? `
        <div class="lrb-ic-remap">
            <p class="lrb-ic-remap-title">${esc(L("RemapTitle"))}</p>
            <p class="lrb-ic-remap-hint">${esc(F("RemapHint", { count: pathItems.length }))}</p>
            <div class="lrb-ic-remap-row">
                <label>${esc(L("RemapOld"))}</label>
                <input type="text" id="lrb-remap-old-${uid}" value="${esc(commonPrefix)}" />
            </div>
            <div class="lrb-ic-remap-row">
                <label>${esc(L("RemapNew"))}</label>
                <input type="text" id="lrb-remap-new-${uid}" value="" placeholder="${esc(L("RemapNewPlaceholder"))}" />
                <button type="button" id="lrb-remap-browse-${uid}" title="${esc(L("RemapBrowse"))}"><i class="fas fa-folder-open"></i></button>
            </div>
            <p class="lrb-ic-remap-status" id="lrb-remap-status-${uid}"></p>
        </div>` : "";

    const summary = F("ValidationSummary", { ok: total - broken.length, total, broken: broken.length });
    const content = `
        <p id="lrb-ic-summary-${uid}">${esc(summary)}</p>
        <ul class="lrb-ic-list" id="lrb-ic-list-${uid}">${broken.map(rowHtml).join("")}</ul>
        ${relinkAllHtml}
        ${remapHtml}
        <p class="notes">${esc(L("ValidationHint"))}</p>`;

    const state = { remapOld: commonPrefix, remapNew: "" };

    const refresh = () => {
        const listEl = document.getElementById(`lrb-ic-list-${uid}`);
        if (!listEl) return;
        let fixed = 0;
        for (const b of broken) {
            const isFixed = b.accepted || b.remapFixed === true;
            if (isFixed) fixed++;
            listEl.querySelector(`.lrb-ic-row[data-i="${b.i}"]`)?.classList.toggle("lrb-ic-row--fixed", isFixed);
        }
        const remaining = broken.length - fixed;
        const summaryEl = document.getElementById(`lrb-ic-summary-${uid}`);
        if (summaryEl) {
            summaryEl.textContent = remaining === 0
                ? L("ValidationAllFixed")
                : F("ValidationSummary", { ok: total - remaining, total, broken: remaining });
        }
        const importBtn = listEl.closest("dialog")?.querySelector('.form-footer button[data-action="continue"]');
        if (importBtn) importBtn.textContent = remaining === 0 ? L("BtnImport") : L("BtnImportAnyway");
    };

    const pathCheckCache = new Map();
    const checkPath = async (type, p) => {
        const key = `${type}::${p}`;
        if (pathCheckCache.has(key)) return pathCheckCache.get(key);
        const ok = type === "folder" ? await folderOk(p) : await fileOk(p);
        pathCheckCache.set(key, ok);
        return ok;
    };

    let remapRun = 0;
    const runRemap = async () => {
        const run = ++remapRun;
        const oldP = state.remapOld;
        let newP = state.remapNew;
        if (newP && oldP.endsWith("/") && !newP.endsWith("/")) newP += "/";
        for (const b of pathItems) { b.remapFixed = null; b.remapPath = null; }
        if (oldP && newP) {
            for (const b of pathItems) {
                if (!b.ref.startsWith(oldP)) { b.remapFixed = false; continue; }
                const np = newP + b.ref.slice(oldP.length);
                const ok = await checkPath(b.type, np);
                if (run !== remapRun) return;
                b.remapFixed = ok;
                b.remapPath = ok ? np : null;
            }
        }
        const statusEl = document.getElementById(`lrb-remap-status-${uid}`);
        if (statusEl) {
            const fixedCount = pathItems.filter(b => b.remapFixed === true).length;
            statusEl.textContent = (oldP && newP)
                ? F("RemapStatus", { fixed: fixedCount, total: pathItems.length })
                : "";
        }
        refresh();
    };

    const setup = () => {
        const listEl = document.getElementById(`lrb-ic-list-${uid}`);
        if (!listEl) return false;

        listEl.addEventListener("click", ev => {
            const btn = ev.target.closest(".lrb-ic-accept");
            if (!btn) return;
            const b = broken[parseInt(btn.dataset.i, 10)];
            if (!b) return;
            const sel = listEl.querySelector(`.lrb-ic-pick[data-i="${b.i}"]`);
            if (!b.accepted) {
                if (sel) b.chosen = sel.value || null;
                if (!b.chosen) return;
                b.accepted = true;
                btn.textContent = L("BtnUndo");
                if (sel) sel.disabled = true;
            } else {
                b.accepted = false;
                btn.textContent = L("BtnRelink");
                if (sel) sel.disabled = false;
            }
            refresh();
        });

        listEl.addEventListener("change", ev => {
            const sel = ev.target.closest(".lrb-ic-pick");
            if (!sel) return;
            const btn = listEl.querySelector(`.lrb-ic-accept[data-i="${sel.dataset.i}"]`);
            if (btn) btn.disabled = !sel.value;
        });

        document.getElementById(`lrb-ic-all-${uid}`)?.addEventListener("click", ev => {
            for (const b of broken) {
                if (b.candidates.length !== 1 || b.accepted) continue;
                b.accepted = true;
                b.chosen = b.candidates[0].value;
                const btn = listEl.querySelector(`.lrb-ic-accept[data-i="${b.i}"]`);
                if (btn) btn.textContent = L("BtnUndo");
            }
            ev.currentTarget.disabled = true;
            refresh();
        });

        const oldIn = document.getElementById(`lrb-remap-old-${uid}`);
        const newIn = document.getElementById(`lrb-remap-new-${uid}`);
        let remapTimer = null;
        const queueRemap = () => {
            state.remapOld = oldIn?.value ?? "";
            state.remapNew = newIn?.value ?? "";
            clearTimeout(remapTimer);
            remapTimer = setTimeout(() => { runRemap().catch(() => { }); }, 400);
        };
        oldIn?.addEventListener("input", queueRemap);
        newIn?.addEventListener("input", queueRemap);
        document.getElementById(`lrb-remap-browse-${uid}`)?.addEventListener("click", () => {
            const FP = loreRefBoard_filePickerImpl();
            new FP({
                type: "folder",
                callback: path => {
                    if (newIn) newIn.value = path.endsWith("/") ? path : `${path}/`;
                    queueRemap();
                },
            }).render(true);
        });
        return true;
    };
    loreRefBoard_afterDialogRender(setup);

    const result = await DialogV2.wait({
        window: { title: L("ValidationTitle") },
        classes: ["lore-rb-dialog"],
        position: { width: 640 },
        content,
        buttons: [
            { action: "continue", label: L("BtnImportAnyway"), callback: () => "continue" },
            { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel"), default: true },
        ],
        rejectClose: false,
    });
    if (result !== "continue") return false;

    for (const b of broken) {
        if (!b.apply) continue;
        if (b.accepted && b.chosen) {
            const c = b.candidates.find(x => x.value === b.chosen);
            b.apply(b.chosen, c?.name ?? null);
        } else if (b.remapFixed === true && b.remapPath) {
            b.apply(b.remapPath);
        }
    }
    return true;
}

function _loreRefBoard_askImportMode() {
    const L = key => game.i18n.localize(`lore-reference-board.ImportExport.${key}`);
    return DialogV2.wait({
        window: { title: L("ImportModeTitle") },
        classes: ["lore-rb-dialog"],
        position: { width: 480 },
        content: L("ImportModeHint"),
        buttons: [
            { action: "merge", label: L("BtnAddTo"), default: true, callback: () => "merge" },
            { action: "replace", label: L("BtnReplace"), callback: () => "replace" },
            { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
        ],
        rejectClose: false,
    }).then(r => r ?? null);
}

//Replace All,  overwrites all 
async function _loreRefBoard_applyReplace(d) {
    await loreRefBoard_saveTabs(d.tabs ?? []);
    await loreRefBoard_setPinsMap(d.pins ?? {});
    await loreRefBoard_setImageLoreMap(d["image-lore"] ?? {});
    await loreRefBoard_setImageJournalMap(d.imageJournals ?? {});
    await loreRefBoard_setFactionDataMap(d.factionBoardData ?? {});
    await loreRefBoard_setThreadsDataMap((d.threadsData && typeof d.threadsData === "object") ? d.threadsData : {});
    await loreRefBoard_saveRelationshipTypes(Array.isArray(d.relationshipTypes) ? d.relationshipTypes : loreRefBoard_DEFAULT_RELATIONSHIP_TYPES);
    await loreRefBoard_saveFactionStandingTiers(Array.isArray(d.factionStandingTiers) ? d.factionStandingTiers : loreRefBoard_DEFAULT_STANDING_TIERS);
}

async function _loreRefBoard_applyMerge(d) {
    // Flush any pending debounced pin write before reading for merge.
    await _loreRefBoard_flushPins();
    const existingTabs = await loreRefBoard_loadTabs();
    const existingPins = _loreRefBoard_getSetting("pins", {});
    const existingLore = _loreRefBoard_getSetting("image-lore", {});
    const existingJournals = _loreRefBoard_getSetting("imageJournals", {});

    const importedTabs = Array.isArray(d.tabs) ? d.tabs : [];
    const importedPins = d.pins          ?? {};
    const importedJournals = d.imageJournals ?? {};

    const newTabs = [...existingTabs];
    const newPins = { ...existingPins };
    const newJournals = { ...existingJournals };
    const pinIdMap = {};
    const tabIdMap = {};

    for (const tab of importedTabs) {
        const oldTabId = tab.id;
        const newTabId = foundry.utils.randomID();
        newTabs.push({ ...tab, id: newTabId });
        tabIdMap[oldTabId] = newTabId;

        // Remap every pin under this tab to a fresh ID.
        const tabPins = Array.isArray(importedPins[oldTabId]) ? importedPins[oldTabId] : [];
        newPins[newTabId] = tabPins.map(pin => {
            const newPinId = foundry.utils.randomID();
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

    // Remap faction board data (circles/relationships) onto the new tab IDs.
    const importedFactionData = (d.factionBoardData && typeof d.factionBoardData === "object") ? d.factionBoardData : {};
    const existingFactionData = _loreRefBoard_getSetting("factionBoardData", {});
    const newFactionData = { ...existingFactionData };
    for (const [oldTabId, newTabId] of Object.entries(tabIdMap)) {
        if (importedFactionData[oldTabId]) {
            newFactionData[newTabId] = importedFactionData[oldTabId];
        }
    }

    // Older exports don't have a threadsData key so this loop is a no-op for them.
    const importedThreadsData = (d.threadsData && typeof d.threadsData === "object") ? d.threadsData : {};
    const existingThreadsData = _loreRefBoard_getSetting("threadsData", {});
    const newThreadsData = { ...existingThreadsData };
    for (const [oldTabId, newTabId] of Object.entries(tabIdMap)) {
        if (importedThreadsData[oldTabId]) {
            newThreadsData[newTabId] = importedThreadsData[oldTabId];
        }
    }

    // merge relationship types; existing types win on id conflicts
    const importedTypes = Array.isArray(d.relationshipTypes) ? d.relationshipTypes : [];
    const existingTypes = _loreRefBoard_getSetting("relationshipTypes", loreRefBoard_DEFAULT_RELATIONSHIP_TYPES);
    const typeMap = new Map();
    for (const t of importedTypes) { if (t?.id) typeMap.set(t.id, t); }
    for (const t of (Array.isArray(existingTypes) ? existingTypes : [])) { if (t?.id) typeMap.set(t.id, t); }
    const newTypes = Array.from(typeMap.values());

    await loreRefBoard_saveTabs(newTabs);
    await loreRefBoard_setPinsMap(newPins);
    await loreRefBoard_setImageLoreMap(newLore);
    await loreRefBoard_setImageJournalMap(newJournals);
    await loreRefBoard_setFactionDataMap(newFactionData);
    await loreRefBoard_setThreadsDataMap(newThreadsData);
    await loreRefBoard_saveRelationshipTypes(newTypes);
}

// Inject Import / Export into Settings Panel

export { _loreRefBoard_export, _loreRefBoard_import, _loreRefBoard_validateImportLinks };
