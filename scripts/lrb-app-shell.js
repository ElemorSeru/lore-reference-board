import { loreRefBoard_MODULE_SCOPE } from "./module-init.js";
import { _loreRefBoard_getSetting, loreRefBoard_clearLoreForImages, loreRefBoard_collectPinImages, loreRefBoard_deleteFactionDataForTab, loreRefBoard_deletePinsForTab, loreRefBoard_getImageJournalMap, loreRefBoard_loadPinsForTab, loreRefBoard_loadTabs, loreRefBoard_removeFactionStandingCollapsed, loreRefBoard_saveTabs } from "./storage.js";
import { loreRefBoard_escapeHtml } from "./utils.js";

const { DialogV2 } = foundry.applications.api;

function loreRefBoard_syncMapZoomBar(html, scale) {
    const pct = Math.round((scale ?? 1) * 100);
    const slider = html.find("#lr-zoom-slider")[0];
    const label = html.find("#lr-zoom-label")[0];
    if (slider) slider.value = pct;
    if (label) label.textContent = `${pct}%`;
}

function loreRefBoard_restoreWindowPos(app) {
    if (app._positionRestored) return;
    app._positionRestored = true;
    const savedPos = _loreRefBoard_getSetting("windowPos", {});
    if (savedPos?.width && savedPos?.height) {
        const maxLeft = Math.max(0, window.innerWidth - 200);
        const maxTop = Math.max(0, window.innerHeight - 100);
        app.setPosition({
            left: Math.min(Math.max(0, savedPos.left ?? 0), maxLeft),
            top: Math.min(Math.max(0, savedPos.top ?? 0), maxTop),
            width: Math.min(Math.max(400, savedPos.width), window.innerWidth),
            height: Math.min(Math.max(300, savedPos.height), window.innerHeight),
        });
    }
}

function loreRefBoard_applyTabRowLimit(app, html) {
    const maxRows = (() => {
        try { return game.settings.get(loreRefBoard_MODULE_SCOPE, "maxTabRows") ?? 4; } catch { return 4; }
    })();
    const tabsEl = html.find(".lr-tabs")[0];
    if (!tabsEl) return;
    if (maxRows > 0) {
        tabsEl.style.maxHeight = `${maxRows * 41 - 1}px`;
        tabsEl.style.overflowY = "auto";
    } else {
        tabsEl.style.maxHeight = "";
        tabsEl.style.overflowY = "";
    }
}

function loreRefBoard_applyReorderMode(app, html) {
    const tabs = html.find(".lr-tab[data-tabid]");
    const strip = html.find(".lr-tabs");
    if (app.reorderMode) {
        tabs.attr("draggable", "true");
        strip.addClass("lr-tabs--reorder");
    } else {
        tabs.removeAttr("draggable");
        strip.removeClass("lr-tabs--reorder");
    }
}

function loreRefBoard_bindTabDragReorder(app, html) {
    html.find(".lr-tab[data-tabid]").on("dragstart", function (ev) {
        if (!app.reorderMode) { ev.preventDefault(); return; }
        app._dragTabId = this.dataset.tabid;
        ev.originalEvent.dataTransfer.effectAllowed = "move";
    });

    html.find(".lr-tab[data-tabid]").on("dragover", function (ev) {
        if (!app.reorderMode || !app._dragTabId) return;
        const targetId = this.dataset.tabid;
        if (!targetId || targetId === app._dragTabId) return;
        ev.preventDefault();
        ev.originalEvent.dataTransfer.dropEffect = "move";
        const rect = this.getBoundingClientRect();
        html.find(".lr-tab--drop-before, .lr-tab--drop-after")
            .removeClass("lr-tab--drop-before lr-tab--drop-after");
        if (ev.originalEvent.clientX < rect.left + rect.width / 2) {
            $(this).addClass("lr-tab--drop-before");
        } else {
            $(this).addClass("lr-tab--drop-after");
        }
    });

    html.find(".lr-tab[data-tabid]").on("dragleave", function () {
        $(this).removeClass("lr-tab--drop-before lr-tab--drop-after");
    });

    html.find(".lr-tab[data-tabid]").on("drop", async function (ev) {
        ev.preventDefault();
        if (!app.reorderMode || !app._dragTabId) return;
        const targetId = this.dataset.tabid;
        $(this).removeClass("lr-tab--drop-before lr-tab--drop-after");
        if (!targetId || targetId === app._dragTabId) return;
        const rect = this.getBoundingClientRect();
        const insertBefore = ev.originalEvent.clientX < rect.left + rect.width / 2;
        const allTabs = await loreRefBoard_loadTabs();
        const dragged = allTabs.find(t => t.id === app._dragTabId);
        const target = allTabs.find(t => t.id === targetId);
        if (!dragged || !target || !!dragged.pinned !== !!target.pinned) return;
        const without = allTabs.filter(t => t.id !== app._dragTabId);
        const targetIdx = without.findIndex(t => t.id === targetId);
        without.splice(insertBefore ? targetIdx : targetIdx + 1, 0, dragged);
        app._dragTabId = null;
        await loreRefBoard_saveTabs(without);
        await app.render();
    });

    html.find(".lr-tab[data-tabid]").on("dragend", function () {
        app._dragTabId = null;
        html.find(".lr-tab--drop-before, .lr-tab--drop-after")
            .removeClass("lr-tab--drop-before lr-tab--drop-after");
    });
}

function loreRefBoard_bindTabStrip(app, html) {
    html.find(".lr-tab[data-tabid]").off("click").on("click", async (ev) => {
        const tabId = ev.currentTarget.dataset.tabid;
        if (!tabId || tabId === app.activeTab) return;
        app.activeTab = tabId;
        await app.render();
    });

    html.find(".lr-tab-pin-icon").off("click").on("click", async (ev) => {
        ev.stopPropagation();
        try {
            const tabId = $(ev.currentTarget).closest(".lr-tab[data-tabid]").data("tabid");
            if (!tabId) return;
            const allTabs = await loreRefBoard_loadTabs();
            const tab = allTabs.find(t => t.id === tabId);
            if (!tab) return;
            tab.pinned = !tab.pinned;
            if (tab.pinned) {
                const others = allTabs.filter(t => t.id !== tabId);
                const lastPinnedIdx = others.reduce((acc, t, i) => (t.pinned ? i : acc), -1);
                others.splice(lastPinnedIdx + 1, 0, tab);
                await loreRefBoard_saveTabs(others);
            } else {
                const others = allTabs.filter(t => t.id !== tabId);
                others.push(tab);
                await loreRefBoard_saveTabs(others);
            }
            await app.render();
        } catch (err) {
            console.error("[lore-reference-board] tab pin error:", err);
        }
    });

    loreRefBoard_bindTabDragReorder(app, html);
}

function loreRefBoard_bindNewTab(app, html) {
    html.find("#lr-new-tab").off("click").on("click", async () => {
        const res = await app._addTabDialog();
        if (!res || res === "cancel") return;
        await app._finishAddTab(res);
    });

    const emptyPicker = html.find("#lr-empty-type-picker");
    if (!emptyPicker.length) return;
    const uid = foundry.utils.randomID();
    const idPrefix = `lrt-empty-type-${uid}`;
    emptyPicker.html(app._typeButtonsHtml(idPrefix));

    const bindType = (suffix, type) => {
        emptyPicker.find(`#${idPrefix}-${suffix}`).off("click").on("click", async () => {
            const res = await app._addTabDialog(type);
            if (!res || res === "cancel") return;
            await app._finishAddTab(res);
        });
    };
    bindType("img", "image");
    bindType("doc", "document");
    bindType("ref", "reference");
    bindType("fac", "faction");
}

function loreRefBoard_bindToolbar(app, html) {
    html.find("#lr-reorder-tabs").off("click").on("click", (ev) => {
        app.reorderMode = !app.reorderMode;
        $(ev.currentTarget).toggleClass("active", app.reorderMode);
        loreRefBoard_applyReorderMode(app, html);
    });
    html.find("#lr-reorder-tabs").toggleClass("active", app.reorderMode);
    if (app.reorderMode) loreRefBoard_applyReorderMode(app, html);

    html.find("#lr-toggle-pin").off("click").on("click", (ev) => {
        app.placingPin = !app.placingPin;
        $(ev.currentTarget).toggleClass("active", app.placingPin);
        ui.notifications.info(game.i18n.localize(
            app.placingPin ? "lore-reference-board.Tab.PinModeOn" : "lore-reference-board.Tab.PinModeOff"
        ));
    });
    html.find("#lr-toggle-pin").toggleClass("active", app.placingPin);

    html.find("#lr-maximize").off("click").on("click", (ev) => {
        app._maximized = !app._maximized;
        $(ev.currentTarget).toggleClass("active", app._maximized);
        $(app.element).toggleClass("lr-maximized", app._maximized);
    });
    html.find("#lr-maximize").toggleClass("active", !!app._maximized);

    html.find("#lr-reset-view").off("click").on("click", () => {
        if (app._panzoom) app._panzoom.reset();
    });

    html.find("#lr-zoom-in").off("click").on("click", () => {
        if (app._panzoom) app._panzoom.zoomIn({ step: 0.1 });
    });
    html.find("#lr-zoom-out").off("click").on("click", () => {
        if (app._panzoom) app._panzoom.zoomOut({ step: 0.1 });
    });
    html.find("#lr-zoom-slider").off("input").on("input", (ev) => {
        if (!app._panzoom) return;
        const scale = Number(ev.currentTarget.value) / 100;
        app._panzoom.zoom(scale, { animate: false });
        loreRefBoard_syncMapZoomBar(html, scale);
    });
}

function loreRefBoard_bindTabSettings(app, html) {
    html.find("#lr-tab-settings").off("click").on("click", async () => {
        const allTabs = await loreRefBoard_loadTabs();
        const tab = allTabs.find((t) => t.id === app.activeTab);
        if (!tab) return;

        const res = await app._tabSettingsDialog(tab);
        if (!res || res === "cancel") return;

        if (res?.action === "delete") {
            const confirmed = await DialogV2.confirm({
                classes: ["lore-rb-dialog"],
                window: { title: game.i18n.localize("lore-reference-board.TabSettings.DeleteTitle") },
                content: `<p>${game.i18n.format("lore-reference-board.TabSettings.DeleteContent", { name: loreRefBoard_escapeHtml(tab.name) })}</p>`,
                rejectClose: false,
            });
            if (!confirmed) return;

            const tabPins = await loreRefBoard_loadPinsForTab(app.activeTab);
            await loreRefBoard_clearLoreForImages(tabPins.flatMap(p => loreRefBoard_collectPinImages(p)));
            if (tabPins.length) {
                const journalMap = loreRefBoard_getImageJournalMap();
                const updatedMap = { ...journalMap };
                for (const p of tabPins) delete updatedMap[p.id];
                await game.settings.set(loreRefBoard_MODULE_SCOPE, "imageJournals", updatedMap);
            }
            await loreRefBoard_deletePinsForTab(app.activeTab);
            if (tab.type === "faction") {
                await loreRefBoard_deleteFactionDataForTab(app.activeTab);
                await loreRefBoard_removeFactionStandingCollapsed(app.activeTab);
            }
            const remaining = (await loreRefBoard_loadTabs()).filter(t => t.id !== app.activeTab);
            await loreRefBoard_saveTabs(remaining);
            app.activeTab = remaining[0]?.id ?? null;
            await app.render();
            return;
        }

        const newName = (res.name ?? "").trim();
        const newImg = (res.img ?? "").trim();
        if (!newName) return ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.NameRequired"));

        const imageChanged = newImg && newImg !== (tab.img ?? "");
        if (imageChanged) {
            const confirmed = await DialogV2.confirm({
                classes: ["lore-rb-dialog"],
                window: { title: game.i18n.localize("lore-reference-board.TabSettings.ReplaceMapTitle") },
                content: `<p>${game.i18n.localize("lore-reference-board.TabSettings.ReplaceMapContent")}</p>`,
                rejectClose: false,
            });
            if (!confirmed) return;
            const oldPins = await loreRefBoard_loadPinsForTab(app.activeTab);
            await loreRefBoard_clearLoreForImages(oldPins.flatMap(p => loreRefBoard_collectPinImages(p)));
            await loreRefBoard_deletePinsForTab(app.activeTab);
        }

        const latest = await loreRefBoard_loadTabs();
        const idx = latest.findIndex((t) => t.id === app.activeTab);
        if (idx !== -1) {
            latest[idx].name = newName;
            if (imageChanged) latest[idx].img = newImg;
            await loreRefBoard_saveTabs(latest);
        }
        await app.render();
    });
}

export { loreRefBoard_applyTabRowLimit, loreRefBoard_bindNewTab, loreRefBoard_bindTabSettings, loreRefBoard_bindTabStrip, loreRefBoard_bindToolbar, loreRefBoard_restoreWindowPos, loreRefBoard_syncMapZoomBar };
