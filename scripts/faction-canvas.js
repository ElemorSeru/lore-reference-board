import { loreRefBoard_addFactionCircle, loreRefBoard_renderFactionCircles } from "./faction-circles.js";
import { loreRefBoard_manageFactionRelationshipTypesDialog, loreRefBoard_renderFactionRelationships, loreRefBoard_toggleFactionRelationshipMode } from "./faction-relations.js";
import { _loreRefBoard_bindFactionStandingPanelEvents, _loreRefBoard_renderFactionStandingPanel, loreRefBoard_manageFactionStandingTiersDialog } from "./faction-standing.js";

function _loreRefBoard_syncFactionZoomBar(html, scale) {
    const pct = Math.round((scale ?? 1) * 100);
    const slider = html.find("#lrt-faction-zoom-slider")[0];
    const label = html.find("#lrt-faction-zoom-label")[0];
    if (slider) slider.value = pct;
    if (label) label.textContent = `${pct}%`;
}

function _loreRefBoard_startFactionCanvasPan(app, ev) {
    if (ev.button !== 0) return;
    if (ev.target !== app._factionCanvasViewportEl) return;
    if (!app._factionPanzoom) return;

    ev.preventDefault();

    const startX = ev.clientX;
    const startY = ev.clientY;
    const startPan = app._factionPanzoom.getPan();

    const onMove = (mv) => {
        const scale = app._factionPanzoom.getScale();
        const dx = (mv.clientX - startX) / scale;
        const dy = (mv.clientY - startY) / scale;
        app._factionPanzoom.pan(startPan.x + dx, startPan.y + dy, { relative: false });
    };

    const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
}

function _loreRefBoard_initFactionCanvasPanzoom(app, html) {
    if (app._factionPanzoom) {
        try { app._factionCanvasViewportEl?.removeEventListener("wheel", app._factionPanzoom.zoomWithWheel); } catch { }
        try { app._factionCanvasViewportEl?.removeEventListener("mousedown", app._onFactionCanvasPanStart); } catch { }
        try { app._factionCanvasWrapEl?.removeEventListener("panzoomzoom", app._onFactionPanzoomZoom); } catch { }
        try { app._factionCanvasWrapEl?.removeEventListener("panzoomreset", app._onFactionPanzoomZoom); } catch { }
        try { app._factionPanzoom.destroy(); } catch { }
        app._factionPanzoom = null;
        app._factionCanvasWrapEl = null;
        app._factionCanvasViewportEl = null;
    }

    const wrapEl = html.find("#lrt-faction-canvas-wrap")[0];
    const viewportEl = html.find(".lrt-faction-canvas-viewport")[0];
    if (!wrapEl || !viewportEl || !window.PanzoomLoaded || !window.Panzoom) return;

    app._factionCanvasWrapEl = wrapEl;
    app._factionCanvasViewportEl = viewportEl;
    app._factionPanzoom = Panzoom(wrapEl, {
        maxScale: 5,
        minScale: 0.1,
        excludeClass: "lrt-faction-circle",
    });
    viewportEl.addEventListener("wheel", app._factionPanzoom.zoomWithWheel);

    app._onFactionCanvasPanStart = (ev) => _loreRefBoard_startFactionCanvasPan(app, ev);
    viewportEl.addEventListener("mousedown", app._onFactionCanvasPanStart);

    app._onFactionPanzoomZoom = (ev) => _loreRefBoard_syncFactionZoomBar(html, ev.detail?.scale);
    wrapEl.addEventListener("panzoomzoom", app._onFactionPanzoomZoom);
    wrapEl.addEventListener("panzoomreset", app._onFactionPanzoomZoom);

    _loreRefBoard_syncFactionZoomBar(html, app._factionPanzoom.getScale());
}

async function loreRefBoard_setupFactionTab(app, html, tab) {
    html.find("#lrt-faction-zoom-in").off("click").on("click", () => {
        if (app._factionPanzoom) app._factionPanzoom.zoomIn({ step: 0.1 });
    });

    html.find("#lrt-faction-zoom-out").off("click").on("click", () => {
        if (app._factionPanzoom) app._factionPanzoom.zoomOut({ step: 0.1 });
    });

    html.find("#lrt-faction-reset-view").off("click").on("click", () => {
        if (app._factionPanzoom) app._factionPanzoom.reset();
    });

    html.find("#lrt-faction-zoom-slider").off("input").on("input", (ev) => {
        if (!app._factionPanzoom) return;
        const scale = Number(ev.currentTarget.value) / 100;
        app._factionPanzoom.zoom(scale, { animate: false });
        _loreRefBoard_syncFactionZoomBar(html, scale);
    });

    html.find("#lrt-faction-add-circle").off("click").on("click", async () => {
        await loreRefBoard_addFactionCircle(app, html);
    });

    html.find("#lrt-faction-add-relationship").off("click").on("click", () => {
        loreRefBoard_toggleFactionRelationshipMode(app, html);
    });
    html.find("#lrt-faction-add-relationship").toggleClass("active", !!app._factionRelMode);
    html.find("#lrt-faction-canvas").toggleClass("lrt-faction-canvas--rel-mode", !!app._factionRelMode);

    html.find("#lrt-faction-rel-types").off("click").on("click", async () => {
        await loreRefBoard_manageFactionRelationshipTypesDialog(app, html);
    });

    html.find("#lrt-faction-standing-tiers").off("click").on("click", async () => {
        await loreRefBoard_manageFactionStandingTiersDialog(app, html);
    });

    html.find("#lrt-faction-party-standing").off("click").on("click", async (ev) => {
        app._factionStandingPanelOpen = !app._factionStandingPanelOpen;
        $(ev.currentTarget).toggleClass("active", app._factionStandingPanelOpen);
        html.find("#lrt-faction-standing-panel").toggleClass("lrt-faction-standing-panel--open", app._factionStandingPanelOpen);
        if (app._factionStandingPanelOpen) await _loreRefBoard_renderFactionStandingPanel(app, html);
    });
    html.find("#lrt-faction-party-standing").toggleClass("active", !!app._factionStandingPanelOpen);
    html.find("#lrt-faction-standing-panel").toggleClass("lrt-faction-standing-panel--open", !!app._factionStandingPanelOpen);

    html.find("#lrt-faction-standing-panel-close").off("click").on("click", () => {
        app._factionStandingPanelOpen = false;
        html.find("#lrt-faction-party-standing").removeClass("active");
        html.find("#lrt-faction-standing-panel").removeClass("lrt-faction-standing-panel--open");
    });

    _loreRefBoard_bindFactionStandingPanelEvents(app, html);
    if (app._factionStandingPanelOpen) await _loreRefBoard_renderFactionStandingPanel(app, html);

    _loreRefBoard_initFactionCanvasPanzoom(app, html);

    await loreRefBoard_renderFactionCircles(app, html);
    await loreRefBoard_renderFactionRelationships(app, html);
}

export { loreRefBoard_setupFactionTab };
