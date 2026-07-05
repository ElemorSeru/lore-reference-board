import { loreRefBoard_bindSceneControlButton } from "./compat.js";
import { _loreRefBoard_export, _loreRefBoard_import } from "./import-export.js";
import { LoreRefBoardApp } from "./lrb-app.js";
import { loreRefBoard_MODULE_SCOPE } from "./module-init.js";

Hooks.on("renderSettingsConfig", (_app, html) => {
    if (!game.user?.isGM) return;

    const L = key => game.i18n.localize(`lore-reference-board.ImportExport.${key}`);

    const maxTabRowsInput = $(html).find(`[name="${loreRefBoard_MODULE_SCOPE}.maxTabRows"]`);
    if (!maxTabRowsInput.length) return;
    const maxTabRowsRow = maxTabRowsInput.closest(".form-group");
    if (!maxTabRowsRow.length) return;

    const $row = $(`
        <div class="form-group lrb-ie-row">
            <div class="lrb-ie-left">
                <label>${L("MenuLabel")}</label>
                <p class="notes">${L("MenuHint")}</p>
            </div>
            <div class="lrb-ie-right">
                <button type="button" class="lrb-ie-export-btn">
                    <i class="fas fa-file-export"></i> ${L("BtnExport")}
                </button>
                <button type="button" class="lrb-ie-import-btn">
                    <i class="fas fa-file-import"></i> ${L("BtnImport")}
                </button>
            </div>
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
            <div class="lrb-ie-left">
                <label>${L("WindowPosLabel")}</label>
                <p class="notes">${L("ResetPosHint")}</p>
            </div>
            <div class="lrb-ie-right">
                <button type="button" class="lrb-reset-pos-btn">
                    <i class="fas fa-undo"></i> ${L("BtnResetPos")}
                </button>
            </div>
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

Hooks.once("init", () => {
    game.keybindings.register(loreRefBoard_MODULE_SCOPE, "toggleBoard", {
        name: "lore-reference-board.Keybindings.ToggleBoard.Name",
        hint: "lore-reference-board.Keybindings.ToggleBoard.Hint",
        editable: [{ key: "KeyB", modifiers: ["Control"] }],
        onDown: () => {
            const allowed = !!game?.user?.isGM || game?.user?.role === CONST.USER_ROLES.ASSISTANT;
            if (!allowed) return false;
            _loreRefBoard_toggleBoard();
            return true;
        },
        precedence: CONST.KEYBINDING_PRECEDENCE?.NORMAL ?? 0,
    });
});

Hooks.on("renderSceneControls", (_app, html) => {
    const allowed = !!game?.user?.isGM || game?.user?.role === CONST.USER_ROLES.ASSISTANT;
    if (!allowed) return;
    loreRefBoard_bindSceneControlButton(html, {
        name: loreRefBoard_MODULE_SCOPE,
        title: game.i18n.localize("lore-reference-board.App.Title"),
        icon: "fas fa-theater-masks",
        onPress: _loreRefBoard_toggleBoard,
    });
});

Hooks.on("getSceneControlButtons", (controls) => {
    const allowed = !!game?.user?.isGM || game?.user?.role === CONST.USER_ROLES.ASSISTANT;
    if (!allowed) return;

    // v12 passes an array
    if (Array.isArray(controls)) return;

    controls[loreRefBoard_MODULE_SCOPE] = {
        name: loreRefBoard_MODULE_SCOPE,
        title: "Lore Reference Board",
        icon: "fas fa-theater-masks",
        visible: true,
        button: true,
        order: Object.keys(controls).length + 1,
        onChange: (event, active) => {
            if (active) canvas.tokens?.activate?.();
        },
        onToolChange: () => {},
        tools: {
            "main-window": {
                name: "main-window",
                title: "Lore Reference Board",
                icon: "fas fa-images",
                button: true,
                order: 1,
                onChange: () => _loreRefBoard_toggleBoard(),
            },
        },
        activeTool: "main-window",
    };
});

console.log("[lore-reference-board] Load Complete");
