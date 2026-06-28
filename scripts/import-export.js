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
        relationshipTypes: _loreRefBoard_getSetting("relationshipTypes", loreRefBoard_DEFAULT_RELATIONSHIP_TYPES),
        factionStandingTiers: _loreRefBoard_getSetting("factionStandingTiers", loreRefBoard_DEFAULT_STANDING_TIERS),
    };

    const filename = `lore-reference-board-${new Date().toISOString().slice(0, 10)}.json`;
    const worldPath = `worlds/${game.world.id}`;
    const file = new File([JSON.stringify(payload, null, 2)], filename, { type: "application/json" });

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
async function _loreRefBoard_import() {
    const importData = await _loreRefBoard_pickAndParseFile();
    if (!importData) return;

    const mode = await _loreRefBoard_askImportMode();
    if (!mode) return;

    if (mode === "replace") {
        await _loreRefBoard_applyReplace(importData);
    } else {
        await _loreRefBoard_applyMerge(importData);
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
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "tabs", d.tabs ?? []);
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "pins", d.pins ?? {});
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "image-lore", d["image-lore"] ?? {});
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "imageJournals", d.imageJournals ?? {});
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "factionBoardData", d.factionBoardData ?? {});
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "relationshipTypes", Array.isArray(d.relationshipTypes) ? d.relationshipTypes : loreRefBoard_DEFAULT_RELATIONSHIP_TYPES);
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "factionStandingTiers", Array.isArray(d.factionStandingTiers) ? d.factionStandingTiers : loreRefBoard_DEFAULT_STANDING_TIERS);
    _loreRefBoard_invalidatePinsCache();
    _loreRefBoard_invalidateFactionDataCache();
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

    // Merge relationship types so imported relationships keep a valid type;
    // existing types take precedence on id conflicts.
    const importedTypes = Array.isArray(d.relationshipTypes) ? d.relationshipTypes : [];
    const existingTypes = _loreRefBoard_getSetting("relationshipTypes", loreRefBoard_DEFAULT_RELATIONSHIP_TYPES);
    const typeMap = new Map();
    for (const t of importedTypes) { if (t?.id) typeMap.set(t.id, t); }
    for (const t of (Array.isArray(existingTypes) ? existingTypes : [])) { if (t?.id) typeMap.set(t.id, t); }
    const newTypes = Array.from(typeMap.values());

    await game.settings.set(loreRefBoard_MODULE_SCOPE, "tabs", newTabs);
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "pins", newPins);
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "image-lore", newLore);
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "imageJournals", newJournals);
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "factionBoardData", newFactionData);
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "relationshipTypes", newTypes);
    _loreRefBoard_invalidatePinsCache();
    _loreRefBoard_invalidateFactionDataCache();
}

// Inject Import / Export into Settings Panel
