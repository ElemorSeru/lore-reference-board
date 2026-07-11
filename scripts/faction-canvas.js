import { loreRefBoard_addFactionCircle, loreRefBoard_renderFactionCircles } from "./faction-circles.js";
import { loreRefBoard_manageFactionRelationshipTypesDialog, loreRefBoard_renderFactionRelationships, loreRefBoard_toggleFactionRelationshipMode } from "./faction-relations.js";
import { _loreRefBoard_bindFactionStandingPanelEvents, _loreRefBoard_renderFactionStandingPanel, loreRefBoard_manageFactionStandingTiersDialog } from "./faction-standing.js";
import { loreRefBoard_bindZoomControls, loreRefBoard_syncZoomBar } from "./utils.js";

function _loreRefBoard_syncFactionZoomBar(html, scale) {
    loreRefBoard_syncZoomBar(html, scale, "#lrt-faction-zoom-slider", "#lrt-faction-zoom-label");
}

function _loreRefBoard_startFactionCanvasPan(app, ev) {
    if (ev.button !== 0) return;
    if (ev.target !== app._faction.canvasViewportEl) return;
    if (!app._faction.panzoom) return;

    ev.preventDefault();

    const startX = ev.clientX;
    const startY = ev.clientY;
    const startPan = app._faction.panzoom.getPan();

    const onMove = (mv) => {
        const scale = app._faction.panzoom.getScale();
        const dx = (mv.clientX - startX) / scale;
        const dy = (mv.clientY - startY) / scale;
        app._faction.panzoom.pan(startPan.x + dx, startPan.y + dy, { relative: false });
    };

    const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
}

function _loreRefBoard_initFactionCanvasPanzoom(app, html) {
    if (app._faction.panzoom) {
        try { app._faction.canvasViewportEl?.removeEventListener("wheel", app._faction.panzoom.zoomWithWheel); } catch { }
        try { app._faction.canvasViewportEl?.removeEventListener("mousedown", app._faction.onCanvasPanStart); } catch { }
        try { app._faction.canvasWrapEl?.removeEventListener("panzoomzoom", app._faction.onPanzoomZoom); } catch { }
        try { app._faction.canvasWrapEl?.removeEventListener("panzoomreset", app._faction.onPanzoomZoom); } catch { }
        try { app._faction.panzoom.destroy(); } catch { }
        app._faction.panzoom = null;
        app._faction.canvasWrapEl = null;
        app._faction.canvasViewportEl = null;
    }

    const wrapEl = html.find("#lrt-faction-canvas-wrap")[0];
    const viewportEl = html.find(".lrt-faction-canvas-viewport")[0];
    if (!wrapEl || !viewportEl || !window.PanzoomLoaded || !window.Panzoom) return;

    app._faction.canvasWrapEl = wrapEl;
    app._faction.canvasViewportEl = viewportEl;
    app._faction.panzoom = Panzoom(wrapEl, {
        maxScale: 5,
        minScale: 0.1,
        excludeClass: "lrt-faction-circle",
    });
    viewportEl.addEventListener("wheel", app._faction.panzoom.zoomWithWheel);

    app._faction.onCanvasPanStart = (ev) => _loreRefBoard_startFactionCanvasPan(app, ev);
    viewportEl.addEventListener("mousedown", app._faction.onCanvasPanStart);

    app._faction.onPanzoomZoom = (ev) => _loreRefBoard_syncFactionZoomBar(html, ev.detail?.scale);
    wrapEl.addEventListener("panzoomzoom", app._faction.onPanzoomZoom);
    wrapEl.addEventListener("panzoomreset", app._faction.onPanzoomZoom);

    _loreRefBoard_syncFactionZoomBar(html, app._faction.panzoom.getScale());
}

async function loreRefBoard_setupFactionTab(app, html, tab) {
    loreRefBoard_bindZoomControls(html, () => app._faction.panzoom,
        { zoomIn: "#lrt-faction-zoom-in", zoomOut: "#lrt-faction-zoom-out", reset: "#lrt-faction-reset-view", slider: "#lrt-faction-zoom-slider" },
        (scale) => _loreRefBoard_syncFactionZoomBar(html, scale));

    html.find("#lrt-faction-add-circle").off("click").on("click", async () => {
        await loreRefBoard_addFactionCircle(app, html);
    });

    html.find("#lrt-faction-add-relationship").off("click").on("click", () => {
        loreRefBoard_toggleFactionRelationshipMode(app, html);
    });
    html.find("#lrt-faction-add-relationship").toggleClass("active", !!app._faction.relMode);
    html.find("#lrt-faction-canvas").toggleClass("lrt-faction-canvas--rel-mode", !!app._faction.relMode);

    html.find("#lrt-faction-rel-types").off("click").on("click", async () => {
        await loreRefBoard_manageFactionRelationshipTypesDialog(app, html);
    });

    html.find("#lrt-faction-standing-tiers").off("click").on("click", async () => {
        await loreRefBoard_manageFactionStandingTiersDialog(app, html);
    });

    html.find("#lrt-faction-party-standing").off("click").on("click", async (ev) => {
        app._faction.standingPanelOpen = !app._faction.standingPanelOpen;
        $(ev.currentTarget).toggleClass("active", app._faction.standingPanelOpen);
        html.find("#lrt-faction-standing-panel").toggleClass("lrt-faction-standing-panel--open", app._faction.standingPanelOpen);
        if (app._faction.standingPanelOpen) await _loreRefBoard_renderFactionStandingPanel(app, html);
    });
    html.find("#lrt-faction-party-standing").toggleClass("active", !!app._faction.standingPanelOpen);
    html.find("#lrt-faction-standing-panel").toggleClass("lrt-faction-standing-panel--open", !!app._faction.standingPanelOpen);

    html.find("#lrt-faction-standing-panel-close").off("click").on("click", () => {
        app._faction.standingPanelOpen = false;
        html.find("#lrt-faction-party-standing").removeClass("active");
        html.find("#lrt-faction-standing-panel").removeClass("lrt-faction-standing-panel--open");
    });

    _loreRefBoard_bindFactionStandingPanelEvents(app, html);
    if (app._faction.standingPanelOpen) await _loreRefBoard_renderFactionStandingPanel(app, html);

    _loreRefBoard_initFactionCanvasPanzoom(app, html);

    await loreRefBoard_renderFactionCircles(app, html);
    await loreRefBoard_renderFactionRelationships(app, html);
}

export { loreRefBoard_setupFactionTab };
