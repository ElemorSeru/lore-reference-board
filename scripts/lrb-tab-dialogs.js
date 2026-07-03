import { loreRefBoard_loadTabs, loreRefBoard_saveTabs } from "./storage.js";
import { _loreRefBoard_docTypeForExt, _loreRefBoard_isUrl, loreRefBoard_attachDialogValidation, loreRefBoard_escapeHtml, loreRefBoard_normalizePath, loreRefBoard_pickDocFilePath, loreRefBoard_pickImagePath } from "./utils.js";

const { DialogV2 } = foundry.applications.api;

async function loreRefBoard_addTabDialog(app, presetType = null) {
        const type = presetType ?? await loreRefBoard_addTabTypeDialog(app);
        if (type === "cancel") return "cancel";
        if (type === "image") return await loreRefBoard_addImageTabDialog(app);
        if (type === "document") return await loreRefBoard_addDocumentTabDialog(app);
        if (type === "reference") return await loreRefBoard_addReferenceTabDialog(app);
        if (type === "faction") return await loreRefBoard_addFactionTabDialog(app);
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
            position: { width: 600 },
            content,
            buttons: [
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel"), default: true },
            ],
            rejectClose: false,
        });

        let tries = 0;
        const attach = () => {
            const imgBtn = document.getElementById(`${idPrefix}-img`);
            const docBtn = document.getElementById(`${idPrefix}-doc`);
            const refBtn = document.getElementById(`${idPrefix}-ref`);
            const facBtn = document.getElementById(`${idPrefix}-fac`);
            if (!imgBtn || !docBtn || !refBtn || !facBtn) return false;
            imgBtn.addEventListener("click", () => { selectedType = "image";     imgBtn.closest("dialog")?.querySelector('[data-action="cancel"]')?.click(); });
            docBtn.addEventListener("click", () => { selectedType = "document";  docBtn.closest("dialog")?.querySelector('[data-action="cancel"]')?.click(); });
            refBtn.addEventListener("click", () => { selectedType = "reference"; refBtn.closest("dialog")?.querySelector('[data-action="cancel"]')?.click(); });
            facBtn.addEventListener("click", () => { selectedType = "faction";   facBtn.closest("dialog")?.querySelector('[data-action="cancel"]')?.click(); });
            return true;
        };
        const tick = () => { if (!attach() && ++tries < 60) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);

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
        } else {
            // image tab
            const img = (res.img ?? "").trim();
            if (!img) {
                ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.ImageRequired"));
                return false;
            }
            all.push({ id, name, type: "image", img, pinned: false });
        }

        await loreRefBoard_saveTabs(all);
        app.activeTab = id;
        await app.render();
        return true;
    }

// Image tab creation dialog
async function loreRefBoard_addImageTabDialog(app) {
        const uid = foundry.utils.randomID();
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
                            img:  (form?.tabImg?.value  ?? "").trim(),
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
                const imgInput = btn.closest("form")?.elements?.tabImg;
                const picked = await loreRefBoard_pickImagePath(imgInput?.value || "modules/");
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

        loreRefBoard_attachDialogValidation(nameInputId, "add", ["tabName", "tabImg"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "image", name: result.name, img: result.img };
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
        let tries = 0;
        const tick = () => { if (!attachBrowse() && ++tries < 60) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);

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


async function loreRefBoard_tabSettingsDialog(app, tab) {
        if (tab.type === "document")  return await loreRefBoard_documentTabSettingsDialog(app, tab);
        if (tab.type === "reference") return await loreRefBoard_referenceTabSettingsDialog(app, tab);
        if (tab.type === "faction")   return await loreRefBoard_factionTabSettingsDialog(app, tab);

        let name = tab?.name ?? "";
        let img = tab?.img ?? "";

        const uid = foundry.utils.randomID();
        const browseBtnId = `ts-browse-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}</label>
            <input type="text" name="tsName" value="${loreRefBoard_escapeHtml(name)}" style="width:100%" autofocus />
          </div>
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
                            img:  (form?.tsImg?.value  ?? "").trim(),
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
        let tries = 0;
        const tick = () => {
            if (attachBrowse()) return;
            if (++tries < 60) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        loreRefBoard_attachDialogValidation(browseBtnId, "save", ["tsName"]);

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



export { loreRefBoard_addDocumentTabDialog, loreRefBoard_addFactionTabDialog, loreRefBoard_addImageTabDialog, loreRefBoard_addReferenceTabDialog, loreRefBoard_addTabDialog, loreRefBoard_addTabTypeDialog, loreRefBoard_documentTabSettingsDialog, loreRefBoard_factionTabSettingsDialog, loreRefBoard_finishAddTab, loreRefBoard_referenceTabSettingsDialog, loreRefBoard_tabSettingsDialog, loreRefBoard_typeButtonsHtml };
