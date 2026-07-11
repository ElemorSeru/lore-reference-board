import { loreRefBoard_getSceneBackgroundSrc } from "./compat.js";
import { loreRefBoard_loadPinsForTab, loreRefBoard_loadTabs, loreRefBoard_saveTabs } from "./storage.js";
import { loreRefBoard_classifySceneChange, loreRefBoard_listPickerScenes, loreRefBoard_reconnectTabScene, loreRefBoard_refreshTabScene, loreRefBoard_resolvePickerScene, loreRefBoard_resolveScene, loreRefBoard_sceneRefFromDoc, loreRefBoard_snapshotSceneImages } from "./scene-source.js";
import { loreRefBoard_addLayer, loreRefBoard_broadcastLayerDeleted, loreRefBoard_canDeleteLayers, loreRefBoard_countLayerContents, loreRefBoard_deleteLayer, loreRefBoard_duplicateLayer, loreRefBoard_moveLayer, loreRefBoard_otherActiveGMs, loreRefBoard_recolorLayer, loreRefBoard_renameLayer } from "./pin-layers.js";
import { _loreRefBoard_docTypeForExt, _loreRefBoard_isUrl, loreRefBoard_afterDialogRender, loreRefBoard_attachDialogValidation, loreRefBoard_escapeHtml, loreRefBoard_normalizePath, loreRefBoard_pickDocFilePath, loreRefBoard_pickImagePath, loreRefBoard_pinChangePrompt } from "./utils.js";

const { DialogV2 } = foundry.applications.api;

async function loreRefBoard_addTabDialog(app, presetType = null) {
        const type = presetType ?? await loreRefBoard_addTabTypeDialog(app);
        if (type === "cancel") return "cancel";
        if (type === "image") return await loreRefBoard_addImageTabDialog(app);
        if (type === "document") return await loreRefBoard_addDocumentTabDialog(app);
        if (type === "reference") return await loreRefBoard_addReferenceTabDialog(app);
        if (type === "faction") return await loreRefBoard_addFactionTabDialog(app);
        if (type === "threads") return await loreRefBoard_addThreadsTabDialog(app);
        return "cancel";
    }

// Shared markup for the 4 tab-type cards, used by the new-tab dialog and the empty-board view
function loreRefBoard_typeButtonsHtml(idPrefix) {
        return `
          <div class="lrt-type-buttons">
            <button type="button" id="${idPrefix}-img" class="lrt-type-btn">
              <i class="fas fa-image lrt-type-icon"></i>
              <span class="lrt-type-label">${game.i18n.localize("lore-reference-board.AddTab.TypeImage")}</span>
              <em class="lrt-type-desc">${game.i18n.localize("lore-reference-board.AddTab.TypeImageDesc")}</em>
            </button>
            <button type="button" id="${idPrefix}-doc" class="lrt-type-btn">
              <i class="fas fa-book-open lrt-type-icon"></i>
              <span class="lrt-type-label">${game.i18n.localize("lore-reference-board.AddTab.TypeDocument")}</span>
              <em class="lrt-type-desc">${game.i18n.localize("lore-reference-board.AddTab.TypeDocumentDesc")}</em>
            </button>
            <button type="button" id="${idPrefix}-ref" class="lrt-type-btn">
              <i class="fas fa-link lrt-type-icon"></i>
              <span class="lrt-type-label">${game.i18n.localize("lore-reference-board.AddTab.TypeReference")}</span>
              <em class="lrt-type-desc">${game.i18n.localize("lore-reference-board.AddTab.TypeReferenceDesc")}</em>
            </button>
            <button type="button" id="${idPrefix}-fac" class="lrt-type-btn">
              <i class="fas fa-people-arrows lrt-type-icon"></i>
              <span class="lrt-type-label">${game.i18n.localize("lore-reference-board.AddTab.TypeFaction")}</span>
              <em class="lrt-type-desc">${game.i18n.localize("lore-reference-board.AddTab.TypeFactionDesc")}</em>
            </button>
            <button type="button" id="${idPrefix}-thr" class="lrt-type-btn">
              <i class="fas fa-timeline lrt-type-icon"></i>
              <span class="lrt-type-label">${game.i18n.localize("lore-reference-board.AddTab.TypeThreads")}</span>
              <em class="lrt-type-desc">${game.i18n.localize("lore-reference-board.AddTab.TypeThreadsDesc")}</em>
            </button>
          </div>
        `;
    }

// 4 Options Picker
async function loreRefBoard_addTabTypeDialog(app) {
        const uid = foundry.utils.randomID();
        const idPrefix = `lrt-type-${uid}`;
        let selectedType = null;

        const content = `
          <div class="lrt-type-picker">
            <p class="lrt-type-prompt">${game.i18n.localize("lore-reference-board.AddTab.ChooseType")}</p>
            ${loreRefBoard_typeButtonsHtml(idPrefix)}
          </div>
        `;

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize("lore-reference-board.AddTab.Title") },
            classes: ["lore-rb-dialog"],
            position: { width: 560 },
            content,
            buttons: [
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel"), default: true },
            ],
            rejectClose: false,
        });

        const attach = () => {
            const imgBtn = document.getElementById(`${idPrefix}-img`);
            const docBtn = document.getElementById(`${idPrefix}-doc`);
            const refBtn = document.getElementById(`${idPrefix}-ref`);
            const facBtn = document.getElementById(`${idPrefix}-fac`);
            const thrBtn = document.getElementById(`${idPrefix}-thr`);
            if (!imgBtn || !docBtn || !refBtn || !facBtn || !thrBtn) return false;
            imgBtn.addEventListener("click", () => { selectedType = "image";     imgBtn.closest("dialog")?.querySelector('[data-action="cancel"]')?.click(); });
            docBtn.addEventListener("click", () => { selectedType = "document";  docBtn.closest("dialog")?.querySelector('[data-action="cancel"]')?.click(); });
            refBtn.addEventListener("click", () => { selectedType = "reference"; refBtn.closest("dialog")?.querySelector('[data-action="cancel"]')?.click(); });
            facBtn.addEventListener("click", () => { selectedType = "faction";   facBtn.closest("dialog")?.querySelector('[data-action="cancel"]')?.click(); });
            thrBtn.addEventListener("click", () => { selectedType = "threads";   thrBtn.closest("dialog")?.querySelector('[data-action="cancel"]')?.click(); });
            return true;
        };
        loreRefBoard_afterDialogRender(attach);

        await waitPromise;
        return selectedType ?? "cancel";
    }


async function loreRefBoard_finishAddTab(app, res) {
        const name = (res.name ?? "").trim();
        if (!name) {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.NameRequired"));
            return false;
        }

        const all = await loreRefBoard_loadTabs();
        const id = foundry.utils.randomID();

        if (res.type === "document") {
            let docType = null;
            let docRef = null;
            if (res.docPath) {
                const cleanPath = loreRefBoard_normalizePath(res.docPath);
                if (_loreRefBoard_isUrl(cleanPath)) {
                    docType = "url";
                    docRef = cleanPath;
                } else {
                    const detectedType = _loreRefBoard_docTypeForExt(cleanPath.split(".").pop());
                    if (detectedType) { docType = detectedType; docRef = cleanPath; }
                }
            }
            all.push({ id, name, type: "document", docType, docRef, pinned: false });
        } else if (res.type === "reference") {
            all.push({ id, name, type: "reference", docUuid: null, docType: null, pinned: false });
        } else if (res.type === "faction") {
            all.push({ id, name, type: "faction", pinned: false });
        } else if (res.type === "threads") {
            all.push({ id, name, type: "threads", pinned: false });
        } else {
            // image tab
            const sd = res.sceneData;
            if (sd && Array.isArray(sd.images) && sd.images.length) {
                all.push({
                    id, name, type: "image", pinned: false,
                    imgSource: "scene",
                    sceneSource: sd.sceneSource ?? "world",
                    sceneId: sd.sceneId ?? null,
                    sceneUuid: sd.sceneUuid ?? null,
                    sceneName: sd.sceneName ?? "",
                    sceneImages: sd.images,
                    sceneIndex: 0,
                    img: sd.images[0].src,
                });
            } else {
                const img = (res.img ?? "").trim();
                if (!img) {
                    ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.ImageRequired"));
                    return false;
                }
                all.push({ id, name, type: "image", img, pinned: false });
            }
        }

        await loreRefBoard_saveTabs(all);
        app.activeTab = id;
        await app.render();
        return true;
    }

// Scene picker grouped by world and compendium
async function loreRefBoard_sceneSelectDialog(currentSceneUuid = null) {
        const esc = loreRefBoard_escapeHtml;
        const L = k => game.i18n.localize(`lore-reference-board.SceneSelect.${k}`);
        const groups = loreRefBoard_listPickerScenes();
        const flat = groups.flatMap(g => g.scenes);
        const uid = foundry.utils.randomID();
        const listId = `lrb-scene-list-${uid}`;

        let selectedUuid = (currentSceneUuid && flat.some(s => s.uuid === currentSceneUuid)) ? currentSceneUuid : null;

        const badKey = `lore-reference-board:bad-thumbs:${game.world?.id ?? "world"}`;
        let badThumbs;
        try { badThumbs = new Set(JSON.parse(localStorage.getItem(badKey) || "[]")); }
        catch { badThumbs = new Set(); }
        const markBadThumb = (url) => {
            if (!url || badThumbs.has(url)) return;
            badThumbs.add(url);
            try { localStorage.setItem(badKey, JSON.stringify([...badThumbs])); } catch { }
        };

        const rowHtml = (s) => {
            const thumb = s.thumb && !badThumbs.has(s.thumb) ? s.thumb : "";
            const bg = s.bg && !badThumbs.has(s.bg) ? s.bg : "";
            const primary = thumb || bg || "";
            const noImg = primary ? "" : " lrb-scene-row--noimg";
            const img = (primary || s.source === "compendium")
                ? `<img class="lrb-scene-thumb-img"${primary ? ` src="${esc(primary)}"` : ""} alt="" loading="lazy" data-uuid="${esc(s.uuid)}" data-source="${esc(s.source)}" data-bg="${esc(s.bg ?? "")}" />`
                : "";
            return `<button type="button" class="lrb-scene-row${s.uuid === selectedUuid ? " is-selected" : ""}${noImg}" data-uuid="${esc(s.uuid)}">
                <i class="fas fa-map lrb-scene-row-ph" aria-hidden="true"></i>
                ${img}
                <span class="lrb-scene-row-name">${esc(s.name)}</span>
            </button>`;
        };
        const groupHtml = (g, gi) => `<div class="lrb-scene-group lrb-scene-group--${g.source}" data-group="${gi}">
                <button type="button" class="lrb-scene-group-label" aria-expanded="true">
                    <i class="fas fa-chevron-down lrb-scene-chevron"></i>
                    <span class="lrb-scene-group-title">${esc(g.label ?? "")}</span>
                    <span class="lrb-scene-group-count">${g.scenes.length}</span>
                </button>
                <div class="lrb-scene-group-rows">${g.scenes.map(rowHtml).join("")}</div>
            </div>`;

        const collapseBtns = groups.length > 1
            ? `<button type="button" class="lrb-scene-collapse-btn" id="lrb-scene-collapse-all-${uid}" title="${esc(game.i18n.localize("lore-reference-board.Search.CollapseAll"))}"><i class="fas fa-angles-up"></i></button>
               <button type="button" class="lrb-scene-collapse-btn" id="lrb-scene-expand-all-${uid}" title="${esc(game.i18n.localize("lore-reference-board.Search.ExpandAll"))}"><i class="fas fa-angles-down"></i></button>`
            : "";
        const toolbar = flat.length
            ? `<div class="lrb-scene-toolbar">
                    <div class="lrb-scene-search-wrap">
                        <i class="fas fa-magnifying-glass lrb-scene-search-icon"></i>
                        <input type="text" id="lrb-scene-search-${uid}" class="lrb-scene-search-input" placeholder="${esc(L("SearchPlaceholder"))}" autocomplete="off" />
                        <button type="button" class="lrb-scene-search-clear" id="lrb-scene-clear-${uid}" title="${esc(L("ClearSearch"))}" aria-label="${esc(L("ClearSearch"))}"><i class="fas fa-xmark"></i></button>
                    </div>
                    ${collapseBtns}
                </div>`
            : "";

        const sourceLabels = { world: L("LegendWorld"), compendium: L("LegendCompendium") };
        const presentSources = [...new Set(groups.map(g => g.source))];
        const legend = flat.length && presentSources.length
            ? `<div class="lrb-scene-legend">${presentSources.map(src =>
                `<span class="lrb-scene-legend-item lrb-scene-legend--${src}"><span class="lrb-scene-legend-swatch"></span>${esc(sourceLabels[src] ?? src)}</span>`).join("")}</div>`
            : "";

        const body = flat.length ? groups.map(groupHtml).join("") : `<p class="lrb-scene-empty">${esc(L("Empty"))}</p>`;
        const content = `
          <div class="lrb-scene-picker">
            ${toolbar}
            ${legend}
            <div id="${listId}" class="lrb-scene-list">${body}</div>
          </div>`;

        const waitPromise = DialogV2.wait({
            window: { title: L("Title") },
            classes: ["lore-rb-dialog", "lrb-scene-dialog"],
            position: { width: 560 },
            content,
            buttons: [
                {
                    action: "select",
                    label: L("Confirm"),
                    default: true,
                    callback: () => ({ action: "select", uuid: selectedUuid }),
                },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: false,
        });

        const resolveThumb = async (img) => {
            if (img.dataset.fb === "2") return;
            const row = img.closest(".lrb-scene-row");
            const failed = img.getAttribute("src") || "";
            if (failed) markBadThumb(failed);
            if (img.dataset.fb !== "1") {
                img.dataset.fb = "1";
                let bg = img.dataset.bg || "";
                if (!bg && img.dataset.source === "compendium") {
                    try { const doc = await fromUuid(img.dataset.uuid); bg = doc ? loreRefBoard_getSceneBackgroundSrc(doc) : ""; }
                    catch { bg = ""; }
                }
                if (bg && bg !== failed && !badThumbs.has(bg)) { img.src = bg; return; }
            }
            img.dataset.fb = "2";
            img.style.display = "none";
            row?.classList.add("lrb-scene-row--noimg");
        };

        const attach = () => {
            const listEl = document.getElementById(listId);
            if (!listEl) return false;
            const confirmBtn = listEl.closest("dialog")?.querySelector('[data-action="select"]');
            const syncBtn = () => {
                if (!confirmBtn) return;
                confirmBtn.disabled = !selectedUuid;
                confirmBtn.style.opacity = selectedUuid ? "" : "0.4";
                confirmBtn.style.cursor = selectedUuid ? "" : "not-allowed";
            };

            listEl.addEventListener("click", (ev) => {
                const hdr = ev.target.closest?.(".lrb-scene-group-label");
                if (hdr) {
                    const group = hdr.closest(".lrb-scene-group");
                    if (!group) return;
                    const collapsed = group.classList.toggle("lrb-scene-group--collapsed");
                    hdr.setAttribute("aria-expanded", collapsed ? "false" : "true");
                    return;
                }
                const row = ev.target.closest?.(".lrb-scene-row");
                if (!row) return;
                selectedUuid = row.dataset.uuid;
                listEl.querySelectorAll(".lrb-scene-row.is-selected").forEach(el => el.classList.remove("is-selected"));
                row.classList.add("is-selected");
                syncBtn();
            });

            document.getElementById(`lrb-scene-collapse-all-${uid}`)?.addEventListener("click", () => {
                listEl.querySelectorAll(".lrb-scene-group").forEach(g => {
                    g.classList.add("lrb-scene-group--collapsed");
                    g.querySelector(".lrb-scene-group-label")?.setAttribute("aria-expanded", "false");
                });
            });
            document.getElementById(`lrb-scene-expand-all-${uid}`)?.addEventListener("click", () => {
                listEl.querySelectorAll(".lrb-scene-group").forEach(g => {
                    g.classList.remove("lrb-scene-group--collapsed");
                    g.querySelector(".lrb-scene-group-label")?.setAttribute("aria-expanded", "true");
                });
            });

            const searchInput = document.getElementById(`lrb-scene-search-${uid}`);
            const searchWrap = searchInput?.closest(".lrb-scene-search-wrap");
            searchInput?.addEventListener("input", () => {
                const q = (searchInput.value || "").trim().toLowerCase();
                searchWrap?.classList.toggle("has-text", !!searchInput.value);
                listEl.classList.toggle("is-filtering", !!q);
                listEl.querySelectorAll(".lrb-scene-group").forEach(group => {
                    const label = (group.querySelector(".lrb-scene-group-title")?.textContent || "").toLowerCase();
                    const labelMatch = !!q && label.includes(q);
                    let anyVisible = false;
                    group.querySelectorAll(".lrb-scene-row").forEach(row => {
                        const name = (row.querySelector(".lrb-scene-row-name")?.textContent || "").toLowerCase();
                        const show = !q || labelMatch || name.includes(q);
                        row.style.display = show ? "" : "none";
                        if (show) anyVisible = true;
                    });
                    group.style.display = (!q || anyVisible) ? "" : "none";
                });
            });

            document.getElementById(`lrb-scene-clear-${uid}`)?.addEventListener("click", () => {
                if (!searchInput) return;
                searchInput.value = "";
                searchInput.dispatchEvent(new Event("input", { bubbles: true }));
                searchInput.focus();
            });

            listEl.querySelectorAll(".lrb-scene-thumb-img").forEach(img => {
                img.addEventListener("error", () => { resolveThumb(img); });
                if (!img.getAttribute("src")) resolveThumb(img);
                else if (img.complete && img.naturalWidth === 0) resolveThumb(img);
            });

            syncBtn();
            return true;
        };
        loreRefBoard_afterDialogRender(attach);

        let result;
        try { result = await waitPromise; } catch { return null; }
        if (!result || result === "cancel" || result.action !== "select" || !result.uuid) return null;

        const entry = flat.find(s => s.uuid === result.uuid);
        const scene = await loreRefBoard_resolvePickerScene(entry);
        if (!scene) { ui.notifications.warn(L("SceneGone")); return null; }
        const images = await loreRefBoard_snapshotSceneImages(scene);
        if (!images.length) { ui.notifications.warn(L("NoImages")); return null; }

        return { ...loreRefBoard_sceneRefFromDoc(scene), images };
    }

// Keep/Clear/Cancel prompt on change detection
async function loreRefBoard_sceneChangePrompt(tab, pick, imagesUnverified) {
        const esc = loreRefBoard_escapeHtml;
        const pins = await loreRefBoard_loadPinsForTab(tab.id);
        const oldCount = Array.isArray(tab.sceneImages) ? tab.sceneImages.length : 0;
        const newCount = pick.images.length;
        const sourceLabel = pick.sceneSource === "compendium"
            ? game.i18n.localize("lore-reference-board.SceneSelect.SourceCompendium")
            : game.i18n.localize("lore-reference-board.SceneSelect.SourceWorld");
        let body = `<p>${game.i18n.format("lore-reference-board.SceneSelect.ChangeIntro", { name: esc(pick.sceneName), source: esc(sourceLabel) })}</p>`;
        body += `<p>${game.i18n.format("lore-reference-board.SceneSelect.ChangeCounts", { oldCount, newCount })}</p>`;
        if (imagesUnverified) body += `<p class="lrb-scene-warn">${game.i18n.localize("lore-reference-board.SceneSelect.ChangeUnverified")}</p>`;
        body += `<p>${game.i18n.format("lore-reference-board.SceneSelect.ChangePins", { count: pins.length })}</p>`;
        return loreRefBoard_pinChangePrompt(game.i18n.localize("lore-reference-board.SceneSelect.ChangeTitle"), body);
    }

function loreRefBoard_wireSceneSettings(app, tab, ids) {
        const { refreshBtnId, pickBtnId } = ids;
        loreRefBoard_afterDialogRender(() => {
            const refreshBtn = document.getElementById(refreshBtnId);
            const pickBtn = document.getElementById(pickBtnId);
            if (!refreshBtn && !pickBtn) return false;

            refreshBtn?.addEventListener("click", async () => {
                const res = await loreRefBoard_refreshTabScene(tab.id);
                if (res.ok) {
                    ui.notifications.info(game.i18n.format("lore-reference-board.SceneSelect.Refreshed", { count: res.count }));
                    await app.render();
                } else if (res.reason === "noscene") {
                    ui.notifications.warn(game.i18n.localize("lore-reference-board.SceneSelect.RefreshNoScene"));
                } else {
                    ui.notifications.warn(game.i18n.localize("lore-reference-board.SceneSelect.RefreshFailed"));
                }
            });

            pickBtn?.addEventListener("click", async () => {
                const pick = await loreRefBoard_sceneSelectDialog(tab.sceneUuid ?? null);
                if (!pick) return;
                const verdict = loreRefBoard_classifySceneChange(tab, pick);
                let clearPins = false;
                if (!verdict.same) {
                    const choice = await loreRefBoard_sceneChangePrompt(tab, pick, verdict.imagesUnverified);
                    if (choice === "cancel") return;
                    clearPins = choice === "clear";
                }
                const ok = await loreRefBoard_reconnectTabScene(tab.id, pick, { clearPins });
                if (!ok) return;
                ui.notifications.info(game.i18n.format("lore-reference-board.SceneSelect.Reconnected", { name: pick.sceneName }));
                await app.render();
                pickBtn.closest("dialog")?.querySelector('[data-action="cancel"]')?.click();
            });
            return true;
        });
    }

// Image tab creation dialog
async function loreRefBoard_addImageTabDialog(app) {
        const uid = foundry.utils.randomID();
        const nameInputId = `at-name-${uid}`;
        const browseBtnId = `at-browse-${uid}`;
        const sceneBtnId = `at-scene-${uid}`;
        const sceneInfoId = `at-scene-info-${uid}`;

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
            <button type="button" id="${sceneBtnId}"
              style="margin-top:6px;width:100%;padding:5px 10px;background:#2a3550;border:1px solid #48597f;border-radius:4px;
                     color:#cdd8f0;cursor:pointer;font-size:12px;display:inline-flex;align-items:center;justify-content:center;gap:6px">
              <i class="fas fa-clapperboard"></i> ${game.i18n.localize("lore-reference-board.SceneSelect.BtnSelect")}
            </button>
            <div id="${sceneInfoId}" class="lrt-scene-info" style="display:none"></div>
            <div style="margin-top:6px;color:#888;font-size:11px">
              ${game.i18n.localize("lore-reference-board.AddTab.Hint")}
            </div>
          </div>
        </div>
      </form>
    `;

        let sceneData = null;
        let programmaticImg = false;

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize("lore-reference-board.AddTab.ImageTabTitle") },
            classes: ["lore-rb-dialog"],
            position: { width: 420 },
            content,
            buttons: [
                {
                    action: "add",
                    label: game.i18n.localize("lore-reference-board.Common.Add"),
                    default: true,
                    callback: (_ev, btn) => {
                        const form = btn.closest("dialog")?.querySelector("form")?.elements;
                        return {
                            action: "add",
                            name: (form?.tabName?.value ?? "").trim(),
                            img: (form?.tabImg?.value ?? "").trim(),
                            sceneData,
                        };
                    },
                },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: true,
        });

        const clearSceneInfo = () => {
            const info = document.getElementById(sceneInfoId);
            if (info) { info.style.display = "none"; info.textContent = ""; }
        };

        const attachBrowse = () => {
            const btn = document.getElementById(browseBtnId);
            if (!btn) return false;
            btn.addEventListener("click", async () => {
                const imgInput = btn.closest("form")?.elements?.tabImg;
                const picked = await loreRefBoard_pickImagePath(imgInput?.value || "modules/");
                if (picked && imgInput) {
                    imgInput.value = picked;
                    imgInput.dispatchEvent(new Event("input"));
                }
            });
            const imgInput = btn.closest("form")?.elements?.tabImg;
            imgInput?.addEventListener("input", () => {
                if (programmaticImg || !sceneData) return;
                sceneData = null;
                clearSceneInfo();
            });
            return true;
        };

        const attachScene = () => {
            const btn = document.getElementById(sceneBtnId);
            if (!btn) return false;
            btn.addEventListener("click", async () => {
                const picked = await loreRefBoard_sceneSelectDialog(sceneData?.sceneUuid ?? null);
                if (!picked) return;
                sceneData = picked;
                const form = btn.closest("form")?.elements;
                const imgInput = form?.tabImg;
                if (imgInput) {
                    programmaticImg = true;
                    imgInput.value = picked.images[0].src;
                    imgInput.dispatchEvent(new Event("input"));
                    programmaticImg = false;
                }
                const nameInput = form?.tabName;
                if (nameInput && !nameInput.value.trim()) {
                    nameInput.value = picked.sceneName;
                    nameInput.dispatchEvent(new Event("input"));
                }
                const info = document.getElementById(sceneInfoId);
                if (info) {
                    info.style.display = "";
                    info.textContent = game.i18n.format("lore-reference-board.SceneSelect.LinkedInfo", { name: picked.sceneName, count: picked.images.length });
                }
            });
            return true;
        };

        let browseWired = false;
        let sceneWired = false;
        loreRefBoard_afterDialogRender(() => {
            if (!browseWired) browseWired = attachBrowse();
            if (!sceneWired) sceneWired = attachScene();
            return browseWired && sceneWired;
        });

        loreRefBoard_attachDialogValidation(nameInputId, "add", ["tabName", "tabImg"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "image", name: result.name, img: result.img, sceneData: result.sceneData ?? null };
        return "cancel";
    }

// Document tab creation dialog
async function loreRefBoard_addDocumentTabDialog(app) {
        const uid = foundry.utils.randomID();
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

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize("lore-reference-board.AddTab.DocumentTabTitle") },
            classes: ["lore-rb-dialog"],
            position: { width: 420 },
            content,
            buttons: [
                {
                    action: "add",
                    label: game.i18n.localize("lore-reference-board.Common.Add"),
                    default: true,
                    callback: (_ev, btn) => {
                        const form = btn.closest("dialog")?.querySelector("form")?.elements;
                        return {
                            action: "add",
                            name: (form?.tabName?.value ?? "").trim(),
                            docPath: (form?.tabDocPath?.value ?? "").trim(),
                        };
                    },
                },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: true,
        });

        const attachBrowse = () => {
            const btn = document.getElementById(browseBtnId);
            if (!btn) return false;
            btn.addEventListener("click", async () => {
                const pathInput = document.getElementById(pathInputId);
                const picked = await loreRefBoard_pickDocFilePath(pathInput?.value || "modules/");
                if (picked && pathInput) {
                    pathInput.value = picked;
                    pathInput.dispatchEvent(new Event("input"));
                }
            });
            return true;
        };
        loreRefBoard_afterDialogRender(attachBrowse);

        loreRefBoard_attachDialogValidation(nameInputId, "add", ["tabName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "document", name: result.name, docPath: result.docPath };
        return "cancel";
    }

// Reference tab creation dialog
async function loreRefBoard_addReferenceTabDialog(app) {
        const uid = foundry.utils.randomID();
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

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize("lore-reference-board.AddTab.ReferenceTabTitle") },
            classes: ["lore-rb-dialog"],
            position: { width: 420 },
            content,
            buttons: [
                {
                    action: "add",
                    label: game.i18n.localize("lore-reference-board.Common.Add"),
                    default: true,
                    callback: (_ev, btn) => {
                        const form = btn.closest("dialog")?.querySelector("form")?.elements;
                        return { action: "add", name: (form?.tabName?.value ?? "").trim() };
                    },
                },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: true,
        });

        loreRefBoard_attachDialogValidation(nameInputId, "add", ["tabName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "reference", name: result.name };
        return "cancel";
    }


async function loreRefBoard_addFactionTabDialog(app) {
        const uid = foundry.utils.randomID();
        const nameInputId = `aft-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:12px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="tabName" value=""
                   placeholder="${game.i18n.localize("lore-reference-board.AddTab.FactionNamePlaceholder")}"
                   style="width:100%" autofocus />
          </div>
          <p style="margin:0;font-size:11px;color:#888">
            ${game.i18n.localize("lore-reference-board.AddTab.TypeFactionDesc")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize("lore-reference-board.AddTab.FactionTabTitle") },
            classes: ["lore-rb-dialog"],
            position: { width: 420 },
            content,
            buttons: [
                {
                    action: "add",
                    label: game.i18n.localize("lore-reference-board.Common.Add"),
                    default: true,
                    callback: (_ev, btn) => {
                        const form = btn.closest("dialog")?.querySelector("form")?.elements;
                        return { action: "add", name: (form?.tabName?.value ?? "").trim() };
                    },
                },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: true,
        });

        loreRefBoard_attachDialogValidation(nameInputId, "add", ["tabName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "faction", name: result.name };
        return "cancel";
    }

// Threads tab creation dialog
async function loreRefBoard_addThreadsTabDialog(app) {
        const uid = foundry.utils.randomID();
        const nameInputId = `att-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:12px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="tabName" value=""
                   placeholder="${game.i18n.localize("lore-reference-board.AddTab.ThreadsNamePlaceholder")}"
                   style="width:100%" autofocus />
          </div>
          <p style="margin:0;font-size:11px;color:#888">
            ${game.i18n.localize("lore-reference-board.AddTab.TypeThreadsDesc")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize("lore-reference-board.AddTab.ThreadsTabTitle") },
            classes: ["lore-rb-dialog"],
            position: { width: 420 },
            content,
            buttons: [
                {
                    action: "add",
                    label: game.i18n.localize("lore-reference-board.Common.Add"),
                    default: true,
                    callback: (_ev, btn) => {
                        const form = btn.closest("dialog")?.querySelector("form")?.elements;
                        return { action: "add", name: (form?.tabName?.value ?? "").trim() };
                    },
                },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: true,
        });

        loreRefBoard_attachDialogValidation(nameInputId, "add", ["tabName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "threads", name: result.name };
        return "cancel";
    }


async function loreRefBoard_tabSettingsDialog(app, tab) {
        if (tab.type === "document")  return await loreRefBoard_documentTabSettingsDialog(app, tab);
        if (tab.type === "reference") return await loreRefBoard_referenceTabSettingsDialog(app, tab);
        if (tab.type === "faction")   return await loreRefBoard_factionTabSettingsDialog(app, tab);
        if (tab.type === "threads")   return await loreRefBoard_threadsTabSettingsDialog(app, tab);

        let name = tab?.name ?? "";
        let img = tab?.img ?? "";

        const uid = foundry.utils.randomID();
        const nameFieldId = `ts-name-${uid}`;
        const browseBtnId = `ts-browse-${uid}`;
        const listId = `ts-layers-${uid}`;
        const addBtnId = `ts-layer-add-${uid}`;
        const refreshBtnId = `ts-scene-refresh-${uid}`;
        const pickBtnId = `ts-scene-pick-${uid}`;
        const isScene = tab?.imgSource === "scene";
        const sceneCount = Array.isArray(tab?.sceneImages) ? tab.sceneImages.length : 0;
        const sceneLinked = isScene ? !!(await loreRefBoard_resolveScene(tab)) : false;
        const sceneNameEsc = loreRefBoard_escapeHtml(tab?.sceneName || game.i18n.localize("lore-reference-board.SceneSelect.UnknownScene"));
        const countLabel = game.i18n.format("lore-reference-board.SceneSelect.ImageCount", { count: sceneCount });

        const sceneLinkedBlock = `
          <div class="lrt-scene-settings">
            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.TabSettings.SceneLinkedLabel")}</label>
            <div class="lrt-scene-settings-row">
              <i class="fas fa-clapperboard lrt-scene-settings-icon"></i>
              <span class="lrt-scene-settings-name">${sceneNameEsc}</span>
              <span class="lrt-scene-settings-count">${countLabel}</span>
            </div>
            <div class="lrt-scene-settings-actions">
              <button type="button" id="${refreshBtnId}" class="lrt-layer-mini-btn"><i class="fas fa-rotate"></i> ${game.i18n.localize("lore-reference-board.TabSettings.BtnRefreshScene")}</button>
              <button type="button" id="${pickBtnId}" class="lrt-layer-mini-btn"><i class="fas fa-repeat"></i> ${game.i18n.localize("lore-reference-board.TabSettings.BtnChangeScene")}</button>
            </div>
            <p style="margin:6px 0 0;font-size:11px;color:#aaa">${game.i18n.localize("lore-reference-board.TabSettings.SceneHint")}</p>
          </div>`;

        const sceneUnlinkedBlock = `
          <div class="lrt-scene-settings">
            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.TabSettings.SceneUnlinkedLabel")}</label>
            <div class="lrt-scene-settings-row lrt-scene-unlinked">
              <i class="fas fa-clapperboard lrt-scene-settings-icon"></i>
              <span class="lrt-scene-settings-name">${sceneNameEsc}</span>
              <span class="lrt-scene-settings-count">${countLabel}</span>
            </div>
            <div class="lrt-scene-settings-actions">
              <button type="button" id="${pickBtnId}" class="lrt-layer-mini-btn"><i class="fas fa-link"></i> ${game.i18n.localize("lore-reference-board.TabSettings.BtnReconnectScene")}</button>
            </div>
            <p style="margin:6px 0 0;font-size:11px;color:#aaa">${game.i18n.localize("lore-reference-board.TabSettings.SceneUnlinkedHint")}</p>
          </div>`;

        const fileBlock = `
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.TabSettings.LabelImage")}</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input type="text" name="tsImg" value="${loreRefBoard_escapeHtml(img)}" style="flex:1;min-width:0;box-sizing:border-box" />
              <button type="button" id="${browseBtnId}"
                style="width:auto;padding:4px 10px;background:#3a3a3a;border:1px solid #555;border-radius:4px;
                       color:#ccc;cursor:pointer;white-space:nowrap;flex-shrink:0;font-size:12px;display:inline-flex;align-items:center">
                ${game.i18n.localize("lore-reference-board.Common.Browse")}
              </button>
            </div>
            <p style="margin:6px 0 0;font-size:11px;color:#aaa">
              ${game.i18n.localize("lore-reference-board.TabSettings.ImageWarning")}
            </p>
          </div>`;

        const imgSourceBlock = isScene ? (sceneLinked ? sceneLinkedBlock : sceneUnlinkedBlock) : fileBlock;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}</label>
            <input type="text" id="${nameFieldId}" name="tsName" value="${loreRefBoard_escapeHtml(name)}" style="width:100%" autofocus />
          </div>
          ${imgSourceBlock}
          <div class="lrt-layers-section">
            <div class="lrt-layers-head">
              <span class="lrt-layers-title">${game.i18n.localize("lore-reference-board.Layers.SectionTitle")}</span>
              <button type="button" id="${addBtnId}" class="lrt-layer-mini-btn">
                <i class="fas fa-plus"></i> ${game.i18n.localize("lore-reference-board.Layers.AddLayer")}
              </button>
            </div>
            <div id="${listId}" class="lrt-layers-list"></div>
            <p id="${listId}-hint" class="lrt-layers-hint" style="display:none">${game.i18n.localize("lore-reference-board.Layers.MinOneHint")}</p>
          </div>
        </div>
      </form>
    `;

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize("lore-reference-board.TabSettings.Title") },
            classes: ["lore-rb-dialog"],
            position: { width: 440 },
            content,
            buttons: [
                {
                    action: "save",
                    label: game.i18n.localize("lore-reference-board.Common.Save"),
                    default: true,
                    callback: (_ev, btn) => {
                        const form = btn.closest("dialog")?.querySelector("form")?.elements;
                        return {
                            action: "save",
                            name: (form?.tsName?.value ?? "").trim(),
                            img: (form?.tsImg?.value ?? "").trim(),
                        };
                    },
                },
                { action: "delete", label: game.i18n.localize("lore-reference-board.TabSettings.BtnDeleteTab"), callback: () => ({ action: "delete" }) },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: true,
        });

        // The Browse button click handler
        const attachBrowse = () => {
            const btn = document.getElementById(browseBtnId);
            if (!btn) return false;
            btn.addEventListener("click", async () => {
                const imgInput = btn.closest("form")?.elements?.tsImg;
                const picked = await loreRefBoard_pickImagePath(imgInput?.value || "modules/");
                if (picked && imgInput) {
                    imgInput.value = picked;
                    imgInput.dispatchEvent(new Event("input"));
                }
            });
            return true;
        };
        if (!isScene) {
            loreRefBoard_afterDialogRender(attachBrowse);
        } else {
            loreRefBoard_wireSceneSettings(app, tab, { refreshBtnId, pickBtnId });
        }

        loreRefBoard_attachDialogValidation(nameFieldId, "save", ["tsName"]);

        const rebuildLayers = async () => {
            const listEl = document.getElementById(listId);
            if (!listEl) return;
            const freshTab = (await loreRefBoard_loadTabs()).find(t => t.id === tab.id);
            const layers = Array.isArray(freshTab?.layers) ? freshTab.layers : [];
            const only = layers.length <= 1;
            listEl.innerHTML = layers.map((l, i) => `
                <div class="lrt-layer-row" data-layerid="${loreRefBoard_escapeHtml(l.id)}">
                    <input type="color" class="lrt-layer-row-color" value="${loreRefBoard_escapeHtml(l.color || "#3498db")}" title="${loreRefBoard_escapeHtml(game.i18n.localize("lore-reference-board.Layers.RowColor"))}" />
                    <input type="text" class="lrt-layer-row-name" value="${loreRefBoard_escapeHtml(l.name || "")}" />
                    <button type="button" class="lr-action-btn lrt-layer-row-btn" data-act="up" ${i === 0 ? "disabled" : ""} title="${loreRefBoard_escapeHtml(game.i18n.localize("lore-reference-board.Layers.MoveUp"))}"><i class="fas fa-chevron-up"></i></button>
                    <button type="button" class="lr-action-btn lrt-layer-row-btn" data-act="down" ${i === layers.length - 1 ? "disabled" : ""} title="${loreRefBoard_escapeHtml(game.i18n.localize("lore-reference-board.Layers.MoveDown"))}"><i class="fas fa-chevron-down"></i></button>
                    <button type="button" class="lr-action-btn lrt-layer-row-btn" data-act="dup" title="${loreRefBoard_escapeHtml(game.i18n.localize("lore-reference-board.Layers.Duplicate"))}"><i class="fas fa-clone"></i></button>
                    <button type="button" class="lr-action-btn lrt-layer-row-btn" data-act="del" ${(only || !loreRefBoard_canDeleteLayers()) ? "disabled" : ""} title="${loreRefBoard_escapeHtml(game.i18n.localize("lore-reference-board.Layers.Delete"))}"><i class="fas fa-trash"></i></button>
                </div>`).join("");
            const hintEl = document.getElementById(`${listId}-hint`);
            if (hintEl) hintEl.style.display = only ? "block" : "none";
            const firstRow = listEl.querySelector(".lrt-layer-row");
            if (firstRow) {
                const rowH = firstRow.getBoundingClientRect().height;
                listEl.style.height = `${Math.round(rowH * 6 + 6 * 5)}px`;
                listEl.style.overflowY = "auto";
            }
        };

        const onLayerChange = async (ev) => {
            const row = ev.target.closest?.(".lrt-layer-row");
            if (!row) return;
            const layerId = row.dataset.layerid;
            if (ev.target.classList.contains("lrt-layer-row-color")) {
                await loreRefBoard_recolorLayer(tab.id, layerId, ev.target.value);
                await app.render();
            } else if (ev.target.classList.contains("lrt-layer-row-name")) {
                await loreRefBoard_renameLayer(tab.id, layerId, ev.target.value);
                await app.render();
                await rebuildLayers();
            }
        };

        const onLayerClick = async (ev) => {
            const btn = ev.target.closest?.("[data-act]");
            if (!btn) return;
            const layerId = btn.closest(".lrt-layer-row")?.dataset?.layerid;
            if (!layerId) return;
            const act = btn.dataset.act;
            if (act === "up" || act === "down") {
                await loreRefBoard_moveLayer(tab.id, layerId, act);
            } else if (act === "dup") {
                await loreRefBoard_duplicateLayer(tab.id, layerId);
            } else if (act === "del") {
                const { pins, images } = await loreRefBoard_countLayerContents(tab.id, layerId);
                const others = loreRefBoard_otherActiveGMs();
                const warn = others > 0
                    ? `<p class="lrt-layers-hint">${game.i18n.format("lore-reference-board.Layers.DeletePresence", { count: others })}</p>`
                    : "";
                const confirmed = await DialogV2.confirm({
                    classes: ["lore-rb-dialog"],
                    window: { title: game.i18n.localize("lore-reference-board.Layers.DeleteTitle") },
                    content: `<p>${game.i18n.format("lore-reference-board.Layers.DeleteConfirm", { pins, images })}</p>${warn}`,
                    rejectClose: false,
                });
                if (!confirmed) return;
                const freshTab = (await loreRefBoard_loadTabs()).find(t => t.id === tab.id);
                const layerName = freshTab?.layers?.find(l => l.id === layerId)?.name ?? "";
                const result = await loreRefBoard_deleteLayer(tab.id, layerId);
                if (result) loreRefBoard_broadcastLayerDeleted(tab.name, layerName);
            }
            await app.render();
            await rebuildLayers();
        };

        loreRefBoard_afterDialogRender(() => {
            const listEl = document.getElementById(listId);
            if (!listEl) return false;
            listEl.addEventListener("change", onLayerChange);
            listEl.addEventListener("click", onLayerClick);
            document.getElementById(addBtnId)?.addEventListener("click", async () => {
                await loreRefBoard_addLayer(tab.id);
                await app.render();
                await rebuildLayers();
            });
            rebuildLayers();
            return true;
        });

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }

        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "delete") return { action: "delete" };
        if (result?.action === "save")   return { name: result.name, img: result.img };
        return "cancel";
    }

// Settings dialog for document type tabs
async function loreRefBoard_documentTabSettingsDialog(app, tab) {
        const uid = foundry.utils.randomID();
        const nameInputId = `dts-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="dtsName"
                   value="${loreRefBoard_escapeHtml(tab?.name ?? "")}" style="width:100%" autofocus />
          </div>
          <p style="margin:4px 0 0;font-size:11px;color:#aaa">
            ${game.i18n.localize("lore-reference-board.TabSettings.DocumentHint")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize("lore-reference-board.TabSettings.Title") },
            classes: ["lore-rb-dialog"],
            position: { width: 440 },
            content,
            buttons: [
                {
                    action: "save",
                    label: game.i18n.localize("lore-reference-board.Common.Save"),
                    default: true,
                    callback: (_ev, btn) => {
                        const form = btn.closest("dialog")?.querySelector("form")?.elements;
                        return { action: "save", name: (form?.dtsName?.value ?? "").trim() };
                    },
                },
                { action: "delete", label: game.i18n.localize("lore-reference-board.TabSettings.BtnDeleteTab"), callback: () => ({ action: "delete" }) },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: true,
        });

        loreRefBoard_attachDialogValidation(nameInputId, "save", ["dtsName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "delete") return { action: "delete" };
        if (result?.action === "save")   return { name: result.name };
        return "cancel";
    }

// Settings dialog for faction type tabs
async function loreRefBoard_factionTabSettingsDialog(app, tab) {
        const uid = foundry.utils.randomID();
        const nameInputId = `fts-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="ftsName"
                   value="${loreRefBoard_escapeHtml(tab?.name ?? "")}" style="width:100%" autofocus />
          </div>
          <p style="margin:4px 0 0;font-size:11px;color:#aaa">
            ${game.i18n.localize("lore-reference-board.TabSettings.FactionHint")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize("lore-reference-board.TabSettings.Title") },
            classes: ["lore-rb-dialog"],
            position: { width: 440 },
            content,
            buttons: [
                {
                    action: "save",
                    label: game.i18n.localize("lore-reference-board.Common.Save"),
                    default: true,
                    callback: (_ev, btn) => {
                        const form = btn.closest("dialog")?.querySelector("form")?.elements;
                        return { action: "save", name: (form?.ftsName?.value ?? "").trim() };
                    },
                },
                { action: "delete", label: game.i18n.localize("lore-reference-board.TabSettings.BtnDeleteTab"), callback: () => ({ action: "delete" }) },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: true,
        });

        loreRefBoard_attachDialogValidation(nameInputId, "save", ["ftsName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "delete") return { action: "delete" };
        if (result?.action === "save")   return { name: result.name };
        return "cancel";
    }

// Settings dialog for reference type tabs
async function loreRefBoard_referenceTabSettingsDialog(app, tab) {
        const uid = foundry.utils.randomID();
        const nameInputId = `rts-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="rtsName"
                   value="${loreRefBoard_escapeHtml(tab?.name ?? "")}" style="width:100%" autofocus />
          </div>
          <p style="margin:4px 0 0;font-size:11px;color:#aaa">
            ${game.i18n.localize("lore-reference-board.AddTab.TypeReferenceDesc")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize("lore-reference-board.TabSettings.Title") },
            classes: ["lore-rb-dialog"],
            position: { width: 440 },
            content,
            buttons: [
                {
                    action: "save",
                    label: game.i18n.localize("lore-reference-board.Common.Save"),
                    default: true,
                    callback: (_ev, btn) => {
                        const form = btn.closest("dialog")?.querySelector("form")?.elements;
                        return { action: "save", name: (form?.rtsName?.value ?? "").trim() };
                    },
                },
                { action: "delete", label: game.i18n.localize("lore-reference-board.TabSettings.BtnDeleteTab"), callback: () => ({ action: "delete" }) },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: true,
        });

        loreRefBoard_attachDialogValidation(nameInputId, "save", ["rtsName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "delete") return { action: "delete" };
        if (result?.action === "save")   return { name: result.name };
        return "cancel";
    }

// Settings dialog for threads type tabs
async function loreRefBoard_threadsTabSettingsDialog(app, tab) {
        const uid = foundry.utils.randomID();
        const nameInputId = `tts-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="ttsName"
                   value="${loreRefBoard_escapeHtml(tab?.name ?? "")}" style="width:100%" autofocus />
          </div>
          <p style="margin:4px 0 0;font-size:11px;color:#aaa">
            ${game.i18n.localize("lore-reference-board.TabSettings.ThreadsHint")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize("lore-reference-board.TabSettings.Title") },
            classes: ["lore-rb-dialog"],
            position: { width: 440 },
            content,
            buttons: [
                {
                    action: "save",
                    label: game.i18n.localize("lore-reference-board.Common.Save"),
                    default: true,
                    callback: (_ev, btn) => {
                        const form = btn.closest("dialog")?.querySelector("form")?.elements;
                        return {
                            action: "save",
                            name: (form?.ttsName?.value ?? "").trim(),
                        };
                    },
                },
                { action: "delete", label: game.i18n.localize("lore-reference-board.TabSettings.BtnDeleteTab"), callback: () => ({ action: "delete" }) },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: true,
        });

        loreRefBoard_attachDialogValidation(nameInputId, "save", ["ttsName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "delete") return { action: "delete" };
        if (result?.action === "save")   return { name: result.name };
        return "cancel";
    }



export { loreRefBoard_addDocumentTabDialog, loreRefBoard_addFactionTabDialog, loreRefBoard_addImageTabDialog, loreRefBoard_addReferenceTabDialog, loreRefBoard_addTabDialog, loreRefBoard_addTabTypeDialog, loreRefBoard_addThreadsTabDialog, loreRefBoard_documentTabSettingsDialog, loreRefBoard_factionTabSettingsDialog, loreRefBoard_finishAddTab, loreRefBoard_referenceTabSettingsDialog, loreRefBoard_tabSettingsDialog, loreRefBoard_threadsTabSettingsDialog, loreRefBoard_typeButtonsHtml };
