// Processing for APIs that moved or changed shape between Foundry v12 and v13+ with fallbacks

function loreRefBoard_filePickerImpl() {
    return foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
}

// v12 predates the v13+ theme system and ships an unlayered legacy style.css whose
// `.application button` rules override the module's flat button styling
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

export { loreRefBoard_bindSceneControlButton, loreRefBoard_filePickerImpl, loreRefBoard_getDragEventData, loreRefBoard_isLegacyTheme, loreRefBoard_openImagePopout, loreRefBoard_textEditorImpl };
