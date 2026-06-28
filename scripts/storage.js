function _loreRefBoard_getSetting(key, fallback) {
    try { return game.settings.get(loreRefBoard_MODULE_SCOPE, key) ?? fallback; }
    catch { return fallback; }
}

async function loreRefBoard_loadTabs() {
    const tabs = _loreRefBoard_getSetting("tabs", []);
    return Array.isArray(tabs) ? tabs : [];
}

async function loreRefBoard_saveTabs(tabs) {
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "tabs", Array.isArray(tabs) ? tabs : []);
    return true;
}

let _loreRefBoard_pinsWriteCache = null;   
let _loreRefBoard_pinsDebounceId = null;

// Ensure the cache is populated from the settings store.
function _loreRefBoard_initPinsCache() {
    if (_loreRefBoard_pinsWriteCache !== null) return;
    const stored = _loreRefBoard_getSetting("pins", {});
    _loreRefBoard_pinsWriteCache = (stored && typeof stored === "object") ? { ...stored } : {};
}

async function _loreRefBoard_flushPins() {
    if (_loreRefBoard_pinsDebounceId !== null) {
        clearTimeout(_loreRefBoard_pinsDebounceId);
        _loreRefBoard_pinsDebounceId = null;
    }
    if (_loreRefBoard_pinsWriteCache !== null) {
        await game.settings.set(loreRefBoard_MODULE_SCOPE, "pins", { ..._loreRefBoard_pinsWriteCache });
    }
}

function _loreRefBoard_invalidatePinsCache() {
    if (_loreRefBoard_pinsDebounceId !== null) { clearTimeout(_loreRefBoard_pinsDebounceId); _loreRefBoard_pinsDebounceId = null; }
    _loreRefBoard_pinsWriteCache = null;
}

async function loreRefBoard_loadPinsForTab(tabId) {
    _loreRefBoard_initPinsCache();
    return Array.isArray(_loreRefBoard_pinsWriteCache[tabId]) ? _loreRefBoard_pinsWriteCache[tabId] : [];
}

async function loreRefBoard_savePinsForTab(tabId, pinsForTab) {
    _loreRefBoard_initPinsCache();
    _loreRefBoard_pinsWriteCache[tabId] = Array.isArray(pinsForTab) ? pinsForTab : [];

    // Debounce
    if (_loreRefBoard_pinsDebounceId !== null) clearTimeout(_loreRefBoard_pinsDebounceId);
    _loreRefBoard_pinsDebounceId = setTimeout(async () => {
        _loreRefBoard_pinsDebounceId = null;
        await game.settings.set(loreRefBoard_MODULE_SCOPE, "pins", { ..._loreRefBoard_pinsWriteCache });
    }, 300);

    return true;
}

async function loreRefBoard_deletePinsForTab(tabId) {
    _loreRefBoard_initPinsCache();
    delete _loreRefBoard_pinsWriteCache[tabId];

    if (_loreRefBoard_pinsDebounceId !== null) clearTimeout(_loreRefBoard_pinsDebounceId);
    _loreRefBoard_pinsDebounceId = setTimeout(async () => {
        _loreRefBoard_pinsDebounceId = null;
        await game.settings.set(loreRefBoard_MODULE_SCOPE, "pins", { ..._loreRefBoard_pinsWriteCache });
    }, 300);
}

// Image Storage Helpers
async function loreRefBoard_loadImageLore() {
    const lore = _loreRefBoard_getSetting("image-lore", {});
    return (lore && typeof lore === "object") ? lore : {};
}

async function loreRefBoard_saveLoreForImage(src, journalId) {
    const lore = await loreRefBoard_loadImageLore();
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "image-lore", { ...lore, [src]: journalId });
}

async function loreRefBoard_clearLoreForImage(src) {
    const lore = await loreRefBoard_loadImageLore();
    const updated = { ...lore };
    delete updated[src];
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "image-lore", updated);
}

async function loreRefBoard_clearLoreForImages(srcArray) {
    if (!srcArray?.length) return;
    const lore = await loreRefBoard_loadImageLore();
    const updated = { ...lore };
    let changed = false;
    for (const src of srcArray) {
        if (src in updated) { delete updated[src]; changed = true; }
    }
    if (changed) await game.settings.set(loreRefBoard_MODULE_SCOPE, "image-lore", updated);
}

function loreRefBoard_collectPinImages(pin) {
    return (pin?.gallery?.folders ?? []).flatMap(f => f.images ?? []);
}

// Image Journal
function loreRefBoard_getImageJournalMap() {
    try {
        const data = game.settings.get(loreRefBoard_MODULE_SCOPE, "imageJournals");
        return (data && typeof data === "object") ? data : {};
    } catch { return {}; }
}

async function loreRefBoard_saveImageJournalLink(pinId, src, journalId) {
    const map = loreRefBoard_getImageJournalMap();
    const pinMap = map[pinId] ?? {};
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "imageJournals", {
        ...map,
        [pinId]: { ...pinMap, [src]: journalId },
    });
}

async function loreRefBoard_clearImageJournalLink(pinId, src) {
    const map = loreRefBoard_getImageJournalMap();
    if (!map[pinId]?.[src]) return;
    const pinMap = { ...map[pinId] };
    delete pinMap[src];
    const updated = { ...map };
    if (Object.keys(pinMap).length === 0) delete updated[pinId];
    else updated[pinId] = pinMap;
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "imageJournals", updated);
}

async function loreRefBoard_clearAllImageJournalLinksForPin(pinId) {
    const map = loreRefBoard_getImageJournalMap();
    if (!map[pinId]) return;
    const updated = { ...map };
    delete updated[pinId];
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "imageJournals", updated);
}

// Faction Board Data
function _loreRefBoard_emptyFactionData() {
    return { circles: [], relationships: [] };
}

let _loreRefBoard_factionDataWriteCache = null;

function _loreRefBoard_initFactionDataCache() {
    if (_loreRefBoard_factionDataWriteCache !== null) return;
    const stored = _loreRefBoard_getSetting("factionBoardData", {});
    _loreRefBoard_factionDataWriteCache = (stored && typeof stored === "object") ? { ...stored } : {};
}

async function loreRefBoard_loadFactionDataForTab(tabId) {
    _loreRefBoard_initFactionDataCache();
    const data = _loreRefBoard_factionDataWriteCache[tabId];
    if (!data || typeof data !== "object") return _loreRefBoard_emptyFactionData();
    return {
        circles: Array.isArray(data.circles) ? data.circles : [],
        relationships: Array.isArray(data.relationships) ? data.relationships : [],
    };
}

async function loreRefBoard_saveFactionDataForTab(tabId, data) {
    _loreRefBoard_initFactionDataCache();
    _loreRefBoard_factionDataWriteCache[tabId] = {
        circles: Array.isArray(data?.circles) ? data.circles : [],
        relationships: Array.isArray(data?.relationships) ? data.relationships : [],
    };

    await game.settings.set(loreRefBoard_MODULE_SCOPE, "factionBoardData", { ..._loreRefBoard_factionDataWriteCache });
    return true;
}

async function loreRefBoard_deleteFactionDataForTab(tabId) {
    _loreRefBoard_initFactionDataCache();
    delete _loreRefBoard_factionDataWriteCache[tabId];
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "factionBoardData", { ..._loreRefBoard_factionDataWriteCache });
}

// Force the next read to re-pull factionBoardData from the settings store
function _loreRefBoard_invalidateFactionDataCache() {
    _loreRefBoard_factionDataWriteCache = null;
}

// Relationship Types
async function loreRefBoard_loadRelationshipTypes() {
    const types = _loreRefBoard_getSetting("relationshipTypes", loreRefBoard_DEFAULT_RELATIONSHIP_TYPES);
    return Array.isArray(types) ? types : [];
}

async function loreRefBoard_saveRelationshipTypes(types) {
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "relationshipTypes", Array.isArray(types) ? types : []);
    return true;
}

// Faction Standing Tiers
function loreRefBoard_getFactionStandingTiers() {
    const tiers = _loreRefBoard_getSetting("factionStandingTiers", loreRefBoard_DEFAULT_STANDING_TIERS);
    return Array.isArray(tiers) && tiers.length ? tiers : loreRefBoard_DEFAULT_STANDING_TIERS;
}

async function loreRefBoard_saveFactionStandingTiers(tiers) {
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "factionStandingTiers", Array.isArray(tiers) ? tiers : []);
    return true;
}

// Faction Standing Panel collapse state, client-scoped per tab id
function loreRefBoard_getFactionStandingCollapsed() {
    const map = _loreRefBoard_getSetting("factionStandingCollapsed", {});
    return (map && typeof map === "object") ? map : {};
}

async function loreRefBoard_setFactionStandingCollapsed(map) {
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "factionStandingCollapsed", (map && typeof map === "object") ? map : {});
    return true;
}

async function loreRefBoard_removeFactionStandingCollapsed(tabId) {
    const map = loreRefBoard_getFactionStandingCollapsed();
    if (!(tabId in map)) return;
    const updated = { ...map };
    delete updated[tabId];
    await game.settings.set(loreRefBoard_MODULE_SCOPE, "factionStandingCollapsed", updated);
}

