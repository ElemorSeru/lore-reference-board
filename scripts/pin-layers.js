import { loreRefBoard_MODULE_SCOPE } from "./module-init.js";
import { _loreRefBoard_getSetting, loreRefBoard_clearAllImageJournalLinksForPin, loreRefBoard_clearLoreForImages, loreRefBoard_collectPinImages, loreRefBoard_getImageJournalMap, loreRefBoard_loadPinsForTab, loreRefBoard_loadTabs, loreRefBoard_savePinsForTab, loreRefBoard_saveTabs, loreRefBoard_setImageJournalMap } from "./storage.js";

const loreRefBoard_LAYER_ALL = "__all__";

const loreRefBoard_LAYER_PALETTE = [
    "#3498db", "#e8b84a", "#5fb86a", "#d9534f", "#a678d8",
    "#e07856", "#4a90d9", "#6c5ce7", "#e84393", "#00b894",
];

function loreRefBoard_layerColorForIndex(idx) {
    return loreRefBoard_LAYER_PALETTE[((idx % loreRefBoard_LAYER_PALETTE.length) + loreRefBoard_LAYER_PALETTE.length) % loreRefBoard_LAYER_PALETTE.length];
}

function loreRefBoard_makeLayer(name, colorIdx = 0) {
    return {
        id: foundry.utils.randomID(),
        name,
        color: loreRefBoard_layerColorForIndex(colorIdx),
    };
}

// Guarantee a tab carries at least one layer
function loreRefBoard_ensureTabLayers(tab) {
    let changed = false;
    if (!Array.isArray(tab.layers) || tab.layers.length === 0) {
        tab.layers = [loreRefBoard_makeLayer("Layer 1", 0)];
        tab.nextLayerNum = 2;
        return true;
    }
    if (typeof tab.nextLayerNum !== "number" || tab.nextLayerNum < tab.layers.length + 1) {
        tab.nextLayerNum = Math.max(tab.layers.length + 1, Number(tab.nextLayerNum) || 0);
        changed = true;
    }
    return changed;
}

// Sweeps any pin with no layerId into the tab's first layer
async function loreRefBoard_adoptOrphanPins(tab) {
    if (!Array.isArray(tab.layers) || !tab.layers.length) return false;
    const validIds = new Set(tab.layers.map(l => l.id));
    const firstId = tab.layers[0].id;
    const pins = await loreRefBoard_loadPinsForTab(tab.id);
    let changed = false;
    for (const pin of pins) {
        if (!pin.layerId || !validIds.has(pin.layerId)) {
            pin.layerId = firstId;
            changed = true;
        }
    }
    if (changed) await loreRefBoard_savePinsForTab(tab.id, pins);
    return changed;
}

// Runs regardless of image state so a broken image tab still gets a Layer 1 and orphaned pin adoption
async function loreRefBoard_normalizeImageTabLayers(tabId) {
    const tabs = await loreRefBoard_loadTabs();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || tab.type !== "image") return false;
    const tabChanged = loreRefBoard_ensureTabLayers(tab);
    if (tabChanged) await loreRefBoard_saveTabs(tabs);
    const pinsChanged = await loreRefBoard_adoptOrphanPins(tab);
    return tabChanged || pinsChanged;
}

function loreRefBoard_getActiveLayerMap() {
    const map = _loreRefBoard_getSetting("activeLayers", {});
    return (map && typeof map === "object") ? map : {};
}

function loreRefBoard_getActiveLayerId(tabId) {
    return loreRefBoard_getActiveLayerMap()[tabId] ?? null;
}

async function loreRefBoard_setActiveLayerId(tabId, layerId) {
    const updated = { ...loreRefBoard_getActiveLayerMap() };
    if (layerId == null) delete updated[tabId];
    else updated[tabId] = layerId;
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "activeLayers", updated);
}

function loreRefBoard_resolveActiveLayerId(tab) {
    const stored = loreRefBoard_getActiveLayerId(tab.id);
    if (stored === loreRefBoard_LAYER_ALL) return loreRefBoard_LAYER_ALL;
    const layers = Array.isArray(tab.layers) ? tab.layers : [];
    if (stored && layers.some(l => l.id === stored)) return stored;
    return layers[0]?.id ?? loreRefBoard_LAYER_ALL;
}

async function loreRefBoard_addLayer(tabId, name = null) {
    const tabs = await loreRefBoard_loadTabs();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return null;
    loreRefBoard_ensureTabLayers(tab);
    const num = tab.nextLayerNum ?? (tab.layers.length + 1);
    const layer = loreRefBoard_makeLayer((name ?? "").trim() || `Layer ${num}`, tab.layers.length);
    tab.layers.push(layer);
    tab.nextLayerNum = num + 1;
    await loreRefBoard_saveTabs(tabs);
    return layer.id;
}

async function loreRefBoard_renameLayer(tabId, layerId, name) {
    const tabs = await loreRefBoard_loadTabs();
    const layer = tabs.find(t => t.id === tabId)?.layers?.find(l => l.id === layerId);
    if (!layer) return false;
    layer.name = (name ?? "").trim() || layer.name;
    await loreRefBoard_saveTabs(tabs);
    return true;
}

async function loreRefBoard_recolorLayer(tabId, layerId, color) {
    const tabs = await loreRefBoard_loadTabs();
    const layer = tabs.find(t => t.id === tabId)?.layers?.find(l => l.id === layerId);
    if (!layer) return false;
    layer.color = color || layer.color;
    await loreRefBoard_saveTabs(tabs);
    return true;
}

async function loreRefBoard_moveLayer(tabId, layerId, dir) {
    const tabs = await loreRefBoard_loadTabs();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !Array.isArray(tab.layers)) return false;
    const idx = tab.layers.findIndex(l => l.id === layerId);
    if (idx === -1) return false;
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= tab.layers.length) return false;
    [tab.layers[idx], tab.layers[swap]] = [tab.layers[swap], tab.layers[idx]];
    await loreRefBoard_saveTabs(tabs);
    return true;
}

// Counts pins and gallery images on a layer for the delete confirmation prompt
async function loreRefBoard_countLayerContents(tabId, layerId) {
    const layerPins = (await loreRefBoard_loadPinsForTab(tabId)).filter(p => p.layerId === layerId);
    let images = 0;
    for (const p of layerPins) images += loreRefBoard_collectPinImages(p).length;
    return { pins: layerPins.length, images };
}

async function loreRefBoard_duplicateLayer(tabId, layerId) {
    const tabs = await loreRefBoard_loadTabs();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !Array.isArray(tab.layers)) return null;
    const idx = tab.layers.findIndex(l => l.id === layerId);
    if (idx === -1) return null;
    const src = tab.layers[idx];

    const newLayer = { id: foundry.utils.randomID(), name: `${src.name} (copy)`, color: src.color };
    tab.layers.splice(idx + 1, 0, newLayer);
    if (typeof tab.nextLayerNum === "number") tab.nextLayerNum += 1;
    await loreRefBoard_saveTabs(tabs);

    const pins = await loreRefBoard_loadPinsForTab(tabId);
    const journalMap = loreRefBoard_getImageJournalMap();
    const updatedJournalMap = { ...journalMap };
    const clones = [];
    for (const p of pins) {
        if (p.layerId !== layerId) continue;
        const newId = foundry.utils.randomID();
        clones.push({ ...foundry.utils.deepClone(p), id: newId, layerId: newLayer.id });
        if (journalMap[p.id]) updatedJournalMap[newId] = foundry.utils.deepClone(journalMap[p.id]);
    }
    if (clones.length) {
        await loreRefBoard_savePinsForTab(tabId, [...pins, ...clones]);
        await loreRefBoard_setImageJournalMap(updatedJournalMap);
    }
    return newLayer.id;
}

function loreRefBoard_canDeleteLayers() {
    if (game.user?.isGM) return true;
    if (game.user?.role === CONST.USER_ROLES.ASSISTANT) {
        try { return !!game.settings.get(loreRefBoard_MODULE_SCOPE, "allowAssistantLayerDelete"); }
        catch { return false; }
    }
    return false;
}

// Tier 2: notify other connected GM level clients that a layer was deleted
function loreRefBoard_broadcastLayerDeleted(tabName, layerName) {
    game.socket?.emit(`module.${loreRefBoard_MODULE_SCOPE}`, {
        t: "layerDeleted",
        by: game.user?.name ?? "GM",
        tab: tabName ?? "",
        layer: layerName ?? "",
    });
}

// Count of other connected GM level users for the delete warning.
function loreRefBoard_otherActiveGMs() {
    return game.users?.filter(u =>
        u.active && u.id !== game.user?.id && (u.isGM || u.role === CONST.USER_ROLES.ASSISTANT)
    )?.length ?? 0;
}

// Delete a layer and every pin on it with full satellite cleanup.
async function loreRefBoard_deleteLayer(tabId, layerId) {
    if (!loreRefBoard_canDeleteLayers()) return null;
    const tabs = await loreRefBoard_loadTabs();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !Array.isArray(tab.layers) || tab.layers.length <= 1) return null;
    const idx = tab.layers.findIndex(l => l.id === layerId);
    if (idx === -1) return null;

    const pins = await loreRefBoard_loadPinsForTab(tabId);
    const doomed = pins.filter(p => p.layerId === layerId);
    const imgs = doomed.flatMap(p => loreRefBoard_collectPinImages(p));
    if (imgs.length) await loreRefBoard_clearLoreForImages(imgs);
    for (const p of doomed) await loreRefBoard_clearAllImageJournalLinksForPin(p.id);

    tab.layers.splice(idx, 1);
    await loreRefBoard_saveTabs(tabs);
    await loreRefBoard_savePinsForTab(tabId, pins.filter(p => p.layerId !== layerId));
    return { deletedPins: doomed.length };
}

async function loreRefBoard_layerExists(tabId, layerId) {
    if (!layerId || layerId === loreRefBoard_LAYER_ALL) return false;
    const tabs = await loreRefBoard_loadTabs();
    const tab = tabs.find(t => t.id === tabId);
    return !!(tab && Array.isArray(tab.layers) && tab.layers.some(l => l.id === layerId));
}

export {
    loreRefBoard_LAYER_ALL,
    loreRefBoard_addLayer,
    loreRefBoard_broadcastLayerDeleted,
    loreRefBoard_canDeleteLayers,
    loreRefBoard_countLayerContents,
    loreRefBoard_deleteLayer,
    loreRefBoard_duplicateLayer,
    loreRefBoard_layerExists,
    loreRefBoard_moveLayer,
    loreRefBoard_otherActiveGMs,
    loreRefBoard_recolorLayer,
    loreRefBoard_renameLayer,
    loreRefBoard_LAYER_PALETTE,
    loreRefBoard_adoptOrphanPins,
    loreRefBoard_ensureTabLayers,
    loreRefBoard_getActiveLayerId,
    loreRefBoard_layerColorForIndex,
    loreRefBoard_makeLayer,
    loreRefBoard_normalizeImageTabLayers,
    loreRefBoard_resolveActiveLayerId,
    loreRefBoard_setActiveLayerId,
};
