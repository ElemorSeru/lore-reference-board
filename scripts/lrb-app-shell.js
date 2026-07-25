import { LoreRefBoardCastDirectoryApp } from "./cast-directory-app.js";
import { loreRefBoard_MODULE_SCOPE } from "./module-init.js";
import { loreRefBoard_addLayer, loreRefBoard_setActiveLayerId } from "./pin-layers.js";
import { loreRefBoard_setSceneImageIndex } from "./scene-source.js";
import { _loreRefBoard_getSetting, loreRefBoard_clearAllPinsForTab, loreRefBoard_deleteTab, loreRefBoard_loadPinsForTab, loreRefBoard_loadTabs, loreRefBoard_saveTabs } from "./storage.js";
import { loreRefBoard_bindZoomControls, loreRefBoard_escapeHtml, loreRefBoard_pinChangePrompt, loreRefBoard_syncZoomBar } from "./utils.js";

const { DialogV2 } = foundry.applications.api;

function loreRefBoard_syncMapZoomBar(html, scale) {
    loreRefBoard_syncZoomBar(html, scale, "#lr-zoom-slider", "#lr-zoom-label");
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
    tabsEl.scrollTop = app._tabStripScrollTop ?? 0;
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
        app._tabStripScrollTop = html.find(".lr-tabs")[0]?.scrollTop ?? 0;
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
    bindType("thr", "threads");
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

    loreRefBoard_bindZoomControls(html, () => app._panzoom,
        { zoomIn: "#lr-zoom-in", zoomOut: "#lr-zoom-out", reset: "#lr-reset-view", slider: "#lr-zoom-slider" },
        (scale) => loreRefBoard_syncMapZoomBar(html, scale));

    html.find("#lr-cast-directory").off("click").on("click", () => {
        LoreRefBoardCastDirectoryApp.open();
    });
}

// Recomputed on each open so a resized window adapts.
function loreRefBoard_sizeLayerMenu(html) {
    const menu = html.find("#lrt-layer-dd-menu")[0];
    if (!menu) return;
    const MAX_ITEMS = 10;
    const firstOpt = menu.querySelector(".lrt-layer-dd-opt");
    const padTop = parseFloat(getComputedStyle(menu).paddingTop) || 0;
    const rowH = firstOpt ? firstOpt.getBoundingClientRect().height + 2 : 30;
    const tenItems = Math.ceil(rowH * MAX_ITEMS + padTop);

    let cap = tenItems;
    const viewport = html.find(".lr-map-viewport")[0];
    if (viewport) {
        const avail = viewport.getBoundingClientRect().bottom - menu.getBoundingClientRect().top - 12;
        cap = Math.min(tenItems, avail);
    }
    menu.style.maxHeight = `${Math.max(80, Math.round(cap))}px`;
}

function loreRefBoard_bindLayerBar(app, html) {
    const toolbar = html.find("#lrt-map-toolbar");
    const btn = html.find("#lrt-layer-dd-btn");

    btn.off("click").on("click", (ev) => {
        ev.stopPropagation();
        const opening = !toolbar.hasClass("lrt-dd-open");
        toolbar.toggleClass("lrt-dd-open");
        btn.attr("aria-expanded", opening ? "true" : "false");
        if (opening) loreRefBoard_sizeLayerMenu(html);
    });

    html.find("#lrt-layer-dd-menu .lrt-layer-dd-opt").off("click").on("click", async (ev) => {
        ev.stopPropagation();
        toolbar.removeClass("lrt-dd-open");
        await loreRefBoard_setActiveLayerId(app.activeTab, ev.currentTarget.dataset.value);
        await app.render();
    });

    $(document).off("click.lrbLayerDD").on("click.lrbLayerDD", (ev) => {
        if (!toolbar.length || !toolbar.hasClass("lrt-dd-open")) return;
        if ($(ev.target).closest("#lrt-map-toolbar").length) return;
        toolbar.removeClass("lrt-dd-open");
        btn.attr("aria-expanded", "false");
    });

    html.find("#lrt-layer-add").off("click").on("click", async () => {
        const newId = await loreRefBoard_addLayer(app.activeTab);
        if (!newId) return;
        await loreRefBoard_setActiveLayerId(app.activeTab, newId);
        await app.render();
    });
}

// Scene image dropdown: Swaps the displayed base image
function loreRefBoard_bindSceneBar(app, html) {
    const toolbar = html.find("#lrt-map-toolbar");
    const btn = html.find("#lrt-scene-dd-btn");
    if (!btn.length) return;

    btn.off("click").on("click", (ev) => {
        ev.stopPropagation();
        const opening = !toolbar.hasClass("lrt-scene-dd-open");
        toolbar.removeClass("lrt-dd-open");
        toolbar.toggleClass("lrt-scene-dd-open");
        btn.attr("aria-expanded", opening ? "true" : "false");
    });

    html.find("#lrt-scene-dd-menu .lrt-scene-dd-opt").off("click").on("click", async (ev) => {
        ev.stopPropagation();
        toolbar.removeClass("lrt-scene-dd-open");
        const idx = Number(ev.currentTarget.dataset.index);
        if (!Number.isFinite(idx)) return;
        await loreRefBoard_setSceneImageIndex(app.activeTab, idx);
        await app.render();
    });

    $(document).off("click.lrbSceneDD").on("click.lrbSceneDD", (ev) => {
        if (!toolbar.length || !toolbar.hasClass("lrt-scene-dd-open")) return;
        if ($(ev.target).closest("#lrt-map-toolbar").length) return;
        toolbar.removeClass("lrt-scene-dd-open");
        btn.attr("aria-expanded", "false");
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

            const remaining = await loreRefBoard_deleteTab(app.activeTab);
            app.activeTab = remaining[0]?.id ?? null;
            await app.render();
            return;
        }

        const newName = (res.name ?? "").trim();
        const newImg = (res.img ?? "").trim();
        if (!newName) return ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.NameRequired"));

        const imageChanged = newImg && newImg !== (tab.img ?? "");
        if (imageChanged) {
            const pins = await loreRefBoard_loadPinsForTab(app.activeTab);
            let body = `<p>${game.i18n.localize("lore-reference-board.TabSettings.ReplaceMapContent")}</p>`;
            body += `<p>${game.i18n.format("lore-reference-board.Pin.KeepClearBody", { count: pins.length })}</p>`;
            const choice = await loreRefBoard_pinChangePrompt(game.i18n.localize("lore-reference-board.TabSettings.ReplaceMapTitle"), body);
            if (choice === "cancel") return;
            if (choice === "clear") await loreRefBoard_clearAllPinsForTab(app.activeTab);
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

export { loreRefBoard_applyTabRowLimit, loreRefBoard_bindLayerBar, loreRefBoard_bindNewTab, loreRefBoard_bindSceneBar, loreRefBoard_bindTabSettings, loreRefBoard_bindTabStrip, loreRefBoard_bindToolbar, loreRefBoard_restoreWindowPos, loreRefBoard_syncMapZoomBar };
