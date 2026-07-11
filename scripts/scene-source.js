import { loreRefBoard_getSceneBackgroundSrc, loreRefBoard_getSceneImageList } from "./compat.js";
import { loreRefBoard_clearAllPinsForTab, loreRefBoard_loadTabs, loreRefBoard_saveTabs } from "./storage.js";

function loreRefBoard_decodeImageSize(src) {
    return new Promise((resolve) => {
        if (!src) { resolve({ w: 0, h: 0 }); return; }
        const img = new Image();
        img.src = src;
        const done = () => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
        const fail = () => resolve({ w: 0, h: 0 });
        const p = img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        p.then(done).catch(fail);
    });
}

// World id first then uuid
async function loreRefBoard_resolveScene(ref) {
    if (!ref) return null;
    const byId = ref.sceneId ? game.scenes?.get?.(ref.sceneId) : null;
    if (byId) return byId;
    if (ref.sceneUuid && String(ref.sceneUuid).includes(".")) {
        try {
            const doc = await fromUuid(ref.sceneUuid);
            if (doc?.documentName === "Scene") return doc;
        } catch { }
    }
    return null;
}

// Full ancestor path of a folder.
function _loreRefBoard_folderPath(folder) {
    const parts = [];
    let f = folder;
    let guard = 0;
    while (f && guard++ < 20) { parts.unshift(f.name ?? ""); f = f.folder; }
    return parts.join(" / ");
}

// Group scenes for the picker.
function loreRefBoard_listPickerScenes() {
    const groups = [];
    const worldLabel = game.i18n.localize("lore-reference-board.SceneSelect.WorldGroup");

    const byFolder = new Map();
    for (const s of (game.scenes?.contents ?? [])) {
        const fid = s.folder?.id ?? "__nofolder__";
        if (!byFolder.has(fid)) byFolder.set(fid, { folder: s.folder ?? null, scenes: [] });
        byFolder.get(fid).scenes.push(s);
    }

    const worldGroups = [];
    for (const [fid, { folder, scenes }] of byFolder) {
        scenes.sort((a, b) => ((a.sort ?? 0) - (b.sort ?? 0)) || String(a.name).localeCompare(String(b.name)));
        worldGroups.push({
            key: `world-${fid}`,
            source: "world",
            label: folder ? _loreRefBoard_folderPath(folder) : worldLabel,
            sortKey: folder ? (folder.sort ?? 0) : Number.MIN_SAFE_INTEGER,
            scenes: scenes.map(s => ({
                source: "world",
                id: s.id,
                uuid: s.uuid,
                name: s.name ?? "",
                thumb: s.thumb || "",
                bg: loreRefBoard_getSceneBackgroundSrc(s),
            })),
        });
    }
    worldGroups.sort((a, b) => (a.sortKey - b.sortKey) || String(a.label).localeCompare(String(b.label)));
    groups.push(...worldGroups);

    for (const pack of (game.packs ?? [])) {
        if (pack.documentName !== "Scene") continue;
        const items = [];
        for (const e of pack.index) {
            items.push({
                source: "compendium",
                id: e._id,
                uuid: e.uuid ?? `Compendium.${pack.collection}.Scene.${e._id}`,
                name: e.name ?? "",
                thumb: e.thumb || "",
                bg: "",
            });
        }
        if (!items.length) continue;
        items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        groups.push({ key: pack.collection, source: "compendium", label: pack.title ?? pack.metadata?.label ?? pack.collection, scenes: items });
    }
    return groups;
}

async function loreRefBoard_resolvePickerScene(entry) {
    if (!entry) return null;
    if (entry.source === "world") return game.scenes?.get?.(entry.id) ?? null;
    try {
        const doc = await fromUuid(entry.uuid);
        return doc?.documentName === "Scene" ? doc : null;
    } catch { return null; }
}

function loreRefBoard_sceneRefFromDoc(scene) {
    const isCompendium = !!scene?.pack;
    return {
        sceneSource: isCompendium ? "compendium" : "world",
        sceneId: isCompendium ? null : (scene?.id ?? null),
        sceneUuid: scene?.uuid ?? null,
        sceneName: scene?.name ?? "",
    };
}

// Snapshot the scene's images with decoded sizes and structure fields
async function loreRefBoard_snapshotSceneImages(scene) {
    const list = loreRefBoard_getSceneImageList(scene);
    return Promise.all(list.map(async (im) => {
        const { w, h } = await loreRefBoard_decodeImageSize(im.src);
        return { src: im.src, label: im.label, w, h, level: im.level ?? "", slot: im.slot ?? "" };
    }));
}

function loreRefBoard_sceneFrozenDims(sceneImages) {
    let w = 0, h = 0;
    for (const im of (Array.isArray(sceneImages) ? sceneImages : [])) {
        if ((im?.w ?? 0) > w) w = im.w;
        if ((im?.h ?? 0) > h) h = im.h;
    }
    return { w, h };
}

function loreRefBoard_sceneStructureKey(sceneImages) {
    if (!Array.isArray(sceneImages) || !sceneImages.length) return null;
    const parts = [];
    for (const im of sceneImages) {
        if (typeof im?.slot !== "string" || !im.slot) return null;
        parts.push((im.level ?? "") + " " + im.slot);
    }
    return parts.join("");
}

// Keep pins for same scene or prompt for a real change.
function loreRefBoard_classifySceneChange(tab, pick) {
    if (tab?.sceneUuid && pick?.sceneUuid && tab.sceneUuid === pick.sceneUuid) return { same: true };
    const imgs = Array.isArray(pick?.images) ? pick.images : [];
    const imagesResolve = imgs.length > 0 && imgs.every(im => (im?.w ?? 0) > 0 && (im?.h ?? 0) > 0);
    const nameMatch = !!tab?.sceneName && tab.sceneName === pick?.sceneName;
    const keyTab = loreRefBoard_sceneStructureKey(tab?.sceneImages);
    const keyPick = loreRefBoard_sceneStructureKey(imgs);
    const structureMatch = keyTab !== null && keyTab === keyPick;
    if (nameMatch && structureMatch && imagesResolve) return { same: true };
    return { same: false, imagesUnverified: !imagesResolve };
}

function loreRefBoard_clampSceneIndex(tab) {
    const n = Array.isArray(tab?.sceneImages) ? tab.sceneImages.length : 0;
    if (!n) return 0;
    return Math.min(Math.max(0, tab.sceneIndex ?? 0), n - 1);
}

async function loreRefBoard_setSceneImageIndex(tabId, index) {
    const tabs = await loreRefBoard_loadTabs();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !Array.isArray(tab.sceneImages) || !tab.sceneImages.length) return false;
    const idx = Math.min(Math.max(0, index | 0), tab.sceneImages.length - 1);
    tab.sceneIndex = idx;
    tab.img = tab.sceneImages[idx].src;
    await loreRefBoard_saveTabs(tabs);
    return true;
}

// Re-pull the linked scene.
async function loreRefBoard_refreshTabScene(tabId) {
    const tabs = await loreRefBoard_loadTabs();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || tab.imgSource !== "scene") return { ok: false, reason: "notscene" };
    const scene = await loreRefBoard_resolveScene(tab);
    if (!scene) return { ok: false, reason: "noscene" };

    const prevLabel = tab.sceneImages?.[loreRefBoard_clampSceneIndex(tab)]?.label ?? null;
    const images = await loreRefBoard_snapshotSceneImages(scene);
    if (!images.length) return { ok: false, reason: "noimages" };

    let idx = prevLabel ? images.findIndex(im => im.label === prevLabel) : -1;
    if (idx < 0) idx = Math.min(loreRefBoard_clampSceneIndex(tab), images.length - 1);

    tab.sceneImages = images;
    tab.sceneIndex = idx;
    tab.sceneName = scene.name ?? tab.sceneName;
    tab.img = images[idx].src;
    await loreRefBoard_saveTabs(tabs);
    return { ok: true, count: images.length };
}

// Repoint a scene tab at a picked scene and replacing the link and image list
async function loreRefBoard_reconnectTabScene(tabId, pick, opts = {}) {
    const tabs = await loreRefBoard_loadTabs();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !pick || !Array.isArray(pick.images) || !pick.images.length) return false;

    const prevLabel = tab.sceneImages?.[loreRefBoard_clampSceneIndex(tab)]?.label ?? null;
    tab.imgSource = "scene";
    tab.sceneSource = pick.sceneSource ?? "world";
    tab.sceneId = pick.sceneId ?? null;
    tab.sceneUuid = pick.sceneUuid ?? null;
    tab.sceneName = pick.sceneName ?? "";
    tab.sceneImages = pick.images;

    let idx = prevLabel ? pick.images.findIndex(im => im.label === prevLabel) : -1;
    if (idx < 0) idx = 0;
    tab.sceneIndex = idx;
    tab.img = pick.images[idx]?.src ?? tab.img;

    await loreRefBoard_saveTabs(tabs);
    if (opts.clearPins) await loreRefBoard_clearAllPinsForTab(tabId);
    return true;
}

export {
    loreRefBoard_clampSceneIndex,
    loreRefBoard_classifySceneChange,
    loreRefBoard_decodeImageSize,
    loreRefBoard_listPickerScenes,
    loreRefBoard_reconnectTabScene,
    loreRefBoard_refreshTabScene,
    loreRefBoard_resolvePickerScene,
    loreRefBoard_resolveScene,
    loreRefBoard_sceneFrozenDims,
    loreRefBoard_sceneRefFromDoc,
    loreRefBoard_sceneStructureKey,
    loreRefBoard_setSceneImageIndex,
    loreRefBoard_snapshotSceneImages,
};
