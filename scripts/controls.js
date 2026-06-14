Hooks.on("renderSettingsConfig", (_app, html) => {
    if (!game.user?.isGM) return;

    const L = key => game.i18n.localize(`lore-reference-board.ImportExport.${key}`);

    const maxTabRowsInput = html.find(`[name="${loreRefBoard_MODULE_SCOPE}.maxTabRows"]`);
    if (!maxTabRowsInput.length) return;
    const maxTabRowsRow = maxTabRowsInput.closest(".form-group");
    if (!maxTabRowsRow.length) return;

    const $row = $(`
        <div class="form-group lrb-ie-row">
            <label>${L("MenuLabel")}</label>
            <div class="form-fields" style="gap:6px">
                <button type="button" class="lrb-ie-export-btn"
                        style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px">
                    <i class="fas fa-file-export"></i> ${L("BtnExport")}
                </button>
                <button type="button" class="lrb-ie-import-btn"
                        style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px">
                    <i class="fas fa-file-import"></i> ${L("BtnImport")}
                </button>
            </div>
            <p class="notes">${L("MenuHint")}</p>
        </div>
    `);

    $row.find(".lrb-ie-export-btn").on("click", (ev) => {
        ev.preventDefault();
        _loreRefBoard_export();
    });

    $row.find(".lrb-ie-import-btn").on("click", (ev) => {
        ev.preventDefault();
        _loreRefBoard_import();
    });

    const $resetRow = $(`
        <div class="form-group lrb-ie-row">
            <label>${L("WindowPosLabel")}</label>
            <div class="form-fields">
                <button type="button" class="lrb-reset-pos-btn"
                        style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px">
                    <i class="fas fa-undo"></i> ${L("BtnResetPos")}
                </button>
            </div>
            <p class="notes">${L("ResetPosHint")}</p>
        </div>
    `);

    $resetRow.find(".lrb-reset-pos-btn").on("click", async (ev) => {
        ev.preventDefault();
        try {
            await game.settings.set(loreRefBoard_MODULE_SCOPE, "windowPos", {});
            const board = game.loreReferenceBoardAppInstance;
            if (board?.rendered) {
                board._skipPosSave = true;
                await board.close();
            }
            ui.notifications.info(L("ResetPosSuccess"));
        } catch { }
    });

    maxTabRowsRow.after($row);
    $row.after($resetRow);
});


function _loreRefBoard_toggleBoard() {
    const inst = game.loreReferenceBoardAppInstance;
    if (inst && inst.rendered) {
        inst.close();
        game.loreReferenceBoardAppInstance = null;
        return;
    }
    game.loreReferenceBoardAppInstance = new LoreRefBoardApp();
    game.loreReferenceBoardAppInstance.render(true);
}

Hooks.on("renderSceneControls", (app, html) => {
    const allowed = !!game?.user?.isGM || game?.user?.role === CONST.USER_ROLES.ASSISTANT;
    if (!allowed) return;

    if (html.find(`li[data-control="${loreRefBoard_MODULE_SCOPE}"]`).length) return;

    const li = $(`<li class="scene-control"
                      data-control="${loreRefBoard_MODULE_SCOPE}"
                      title="Lore Reference Board">
                    <i class="fas fa-theater-masks"></i>
                  </li>`);

    li.on("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        _loreRefBoard_toggleBoard();
    });

    const mainList = html.find(".main-controls");
    (mainList.length ? mainList : html.find("ol").first()).append(li);
});

console.log("[lore-reference-board] Load Complete");
