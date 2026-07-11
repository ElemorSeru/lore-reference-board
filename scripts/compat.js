function loreRefBoard_filePickerImpl() {
    return foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
}

function loreRefBoard_isLegacyTheme() {
    return (game.release?.generation ?? 13) < 13;
}

function loreRefBoard_textEditorImpl() {
    return foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
}

function loreRefBoard_getDragEventData(event) {
    return loreRefBoard_textEditorImpl().getDragEventData(event);
}

function loreRefBoard_openImagePopout(src, title = "") {
    const PopoutV2 = foundry.applications?.apps?.ImagePopout;
    if (PopoutV2) return new PopoutV2({ src, window: { title } }).render(true);
    return new ImagePopout(src, { title }).render(true);
}

// Cyclable images for a scene. Detect on the v14 levels collection
function loreRefBoard_getSceneImageList(scene) {
    if (!scene) return [];
    const L = k => game.i18n.localize(`lore-reference-board.SceneSelect.${k}`);
    const F = (k, d) => game.i18n.format(`lore-reference-board.SceneSelect.${k}`, d);
    const out = [];

    const levels = scene.levels;
    const levelArr = levels && typeof levels.size === "number" && levels.size > 0
        ? (Array.isArray(levels.contents) ? levels.contents : Array.from(levels))
        : null;

    if (levelArr && levelArr.length) {
        const multi = levelArr.length > 1;
        for (const lvl of levelArr) {
            const nm = lvl?.name ?? "";
            const bg = lvl?.background?.src ?? null;
            const fg = lvl?.foreground?.src ?? null;
            if (bg) out.push({ src: bg, label: multi ? F("LevelImageLabel", { level: nm, kind: L("Background") }) : L("Background"), level: nm, slot: "background" });
            if (fg) out.push({ src: fg, label: multi ? F("LevelImageLabel", { level: nm, kind: L("Foreground") }) : L("Foreground"), level: nm, slot: "foreground" });
        }
        return out;
    }

    const bg = scene.background?.src ?? null;
    const fg = (typeof scene.foreground === "string" ? scene.foreground : scene.foreground?.src) ?? null;
    if (bg) out.push({ src: bg, label: L("Background"), level: "", slot: "background" });
    if (fg) out.push({ src: fg, label: L("Foreground"), level: "", slot: "foreground" });
    return out;
}

// Read the first level's background on v14 and fall back to the flat background on v12/v13
function loreRefBoard_getSceneBackgroundSrc(scene) {
    if (!scene) return "";
    const levels = scene.levels;
    if (levels && typeof levels.size === "number" && levels.size > 0) {
        const arr = Array.isArray(levels.contents) ? levels.contents : Array.from(levels);
        for (const lvl of arr) {
            if (lvl?.background?.src) return lvl.background.src;
        }
        return "";
    }
    return scene.background?.src ?? "";
}

// Preview thumbnail for a scene: the stored thumb if present, else its background.
function loreRefBoard_getSceneThumb(scene) {
    if (!scene) return "";
    return scene.thumb || loreRefBoard_getSceneBackgroundSrc(scene);
}

function loreRefBoard_bindSceneControlButton(html, { name, title, icon, onPress }) {
    const rootEl = html instanceof HTMLElement ? html : html?.[0];
    if (!rootEl) return;

    let btn = rootEl.querySelector(`button.layer[data-control="${name}"]`)
        ?? rootEl.querySelector(`[data-control="${name}"]`);

    if (!btn) {
        const list = rootEl.querySelector("ol.main-controls") ?? rootEl.querySelector("ol");
        if (!list) return;
        const li = document.createElement("li");
        li.className = "scene-control";
        li.dataset.control = name;
        li.title = title;
        li.innerHTML = `<i class="${icon}"></i>`;
        list.appendChild(li);
        btn = li;
    }

    if (btn.dataset.lrbBound) return;
    btn.dataset.lrbBound = "1";
    btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onPress();
    });
}

export { loreRefBoard_bindSceneControlButton, loreRefBoard_filePickerImpl, loreRefBoard_getDragEventData, loreRefBoard_getSceneBackgroundSrc, loreRefBoard_getSceneImageList, loreRefBoard_getSceneThumb, loreRefBoard_isLegacyTheme, loreRefBoard_openImagePopout, loreRefBoard_textEditorImpl };
