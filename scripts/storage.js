function _getSetting(key, fallback) {
    try { return game.settings.get(MODULE_SCOPE, key) ?? fallback; }
    catch { return fallback; }
}

async function loadTabs() {
    const tabs = _getSetting("tabs", []);
    return Array.isArray(tabs) ? tabs : [];
}

async function saveTabs(tabs) {
    await game.settings.set(MODULE_SCOPE, "tabs", Array.isArray(tabs) ? tabs : []);
    return true;
}

let _pinsWriteCache  = null;   
let _pinsDebounceId  = null;

// Ensure the cache is populated from the settings store.
function _initPinsCache() {
    if (_pinsWriteCache !== null) return;
    const stored = _getSetting("pins", {});
    _pinsWriteCache = (stored && typeof stored === "object") ? { ...stored } : {};
}

async function _flushPins() {
    if (_pinsDebounceId !== null) {
        clearTimeout(_pinsDebounceId);
        _pinsDebounceId = null;
    }
    if (_pinsWriteCache !== null) {
        await game.settings.set(MODULE_SCOPE, "pins", { ..._pinsWriteCache });
    }
}

function _invalidatePinsCache() {
    if (_pinsDebounceId !== null) { clearTimeout(_pinsDebounceId); _pinsDebounceId = null; }
    _pinsWriteCache = null;
}

async function loadPinsForTab(tabId) {
    _initPinsCache();
    return Array.isArray(_pinsWriteCache[tabId]) ? _pinsWriteCache[tabId] : [];
}

async function savePinsForTab(tabId, pinsForTab) {
    _initPinsCache();
    _pinsWriteCache[tabId] = Array.isArray(pinsForTab) ? pinsForTab : [];

    // Debounce
    if (_pinsDebounceId !== null) clearTimeout(_pinsDebounceId);
    _pinsDebounceId = setTimeout(async () => {
        _pinsDebounceId = null;
        await game.settings.set(MODULE_SCOPE, "pins", { ..._pinsWriteCache });
    }, 300);

    return true;
}

async function deletePinsForTab(tabId) {
    _initPinsCache();
    delete _pinsWriteCache[tabId];

    if (_pinsDebounceId !== null) clearTimeout(_pinsDebounceId);
    _pinsDebounceId = setTimeout(async () => {
        _pinsDebounceId = null;
        await game.settings.set(MODULE_SCOPE, "pins", { ..._pinsWriteCache });
    }, 300);
}

// Image Storage Helpers
async function loadImageLore() {
    const lore = _getSetting("image-lore", {});
    return (lore && typeof lore === "object") ? lore : {};
}

async function saveLoreForImage(src, journalId) {
    const lore = await loadImageLore();
    await game.settings.set(MODULE_SCOPE, "image-lore", { ...lore, [src]: journalId });
}

async function clearLoreForImage(src) {
    const lore = await loadImageLore();
    const updated = { ...lore };
    delete updated[src];
    await game.settings.set(MODULE_SCOPE, "image-lore", updated);
}

async function clearLoreForImages(srcArray) {
    if (!srcArray?.length) return;
    const lore = await loadImageLore();
    const updated = { ...lore };
    let changed = false;
    for (const src of srcArray) {
        if (src in updated) { delete updated[src]; changed = true; }
    }
    if (changed) await game.settings.set(MODULE_SCOPE, "image-lore", updated);
}

function collectPinImages(pin) {
    return (pin?.gallery?.folders ?? []).flatMap(f => f.images ?? []);
}

// Image Journal
function getImageJournalMap() {
    try {
        const data = game.settings.get(MODULE_SCOPE, "imageJournals");
        return (data && typeof data === "object") ? data : {};
    } catch { return {}; }
}

async function saveImageJournalLink(pinId, src, journalId) {
    const map    = getImageJournalMap();
    const pinMap = map[pinId] ?? {};
    await game.settings.set(MODULE_SCOPE, "imageJournals", {
        ...map,
        [pinId]: { ...pinMap, [src]: journalId },
    });
}

async function clearImageJournalLink(pinId, src) {
    const map = getImageJournalMap();
    if (!map[pinId]?.[src]) return;
    const pinMap  = { ...map[pinId] };
    delete pinMap[src];
    const updated = { ...map };
    if (Object.keys(pinMap).length === 0) delete updated[pinId];
    else updated[pinId] = pinMap;
    await game.settings.set(MODULE_SCOPE, "imageJournals", updated);
}

async function clearAllImageJournalLinksForPin(pinId) {
    const map = getImageJournalMap();
    if (!map[pinId]) return;
    const updated = { ...map };
    delete updated[pinId];
    await game.settings.set(MODULE_SCOPE, "imageJournals", updated);
}

