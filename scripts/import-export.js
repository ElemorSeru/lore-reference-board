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
