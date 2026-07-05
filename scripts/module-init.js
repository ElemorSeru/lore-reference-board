import { loreRefBoard_isLegacyTheme } from "./compat.js";
import { loreRefBoard_clearSearchCache, loreRefBoard_forceIndexAll } from "./search.js";

const { DialogV2 } = foundry.applications.api;

console.log("[lore-reference-board] Loading...");

if (typeof window.Panzoom === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@panzoom/panzoom/dist/panzoom.min.js";
    script.onload = () => (window.PanzoomLoaded = true);
    document.head.appendChild(script);
} else {
    window.PanzoomLoaded = true;
}

// Markdown to HTML for Document tabs with .md files.
if (typeof window.marked === "undefined") {
    const _ms = document.createElement("script");
    _ms.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    document.head.appendChild(_ms);
}

Hooks.once("init", () => {
    if (typeof pdfjsLib !== "undefined") {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "modules/lore-reference-board/scripts/libs/pdf.worker.min.js";
    }
});

const loreRefBoard_MODULE_SCOPE = "lore-reference-board";

// Default relationship types
const loreRefBoard_DEFAULT_RELATIONSHIP_TYPES = [
    { id: "ally", label: "Allies", lineStyle: "solid", color: "#5fb86a" },
    { id: "rival", label: "Rivals", lineStyle: "dashed", color: "#d9534f" },
    { id: "trade-partners", label: "Trade Partners", lineStyle: "solid", color: "#e8b339" },
    { id: "vassal-liege", label: "Vassal / Liege", lineStyle: "dash-dot", color: "#7a6a9e" },
    { id: "blood-feud", label: "Blood Feud", lineStyle: "dashed", color: "#a4133c" },
    { id: "truce-ceasefire", label: "Truce / Ceasefire", lineStyle: "dotted", color: "#f4a261" },
    { id: "mentor-student", label: "Mentor & Student", lineStyle: "solid", color: "#4a90d9" },
    { id: "spy-network", label: "Spy Network", lineStyle: "dotted", color: "#6c5ce7" },
    { id: "debtor", label: "Debtor", lineStyle: "dash-dot", color: "#b8860b" },
    { id: "old-allies", label: "Old Allies (Estranged)", lineStyle: "dotted", color: "#9aa6b2" },
    { id: "bound-by-oath", label: "Bound by Oath", lineStyle: "solid", color: "#2f92fd" },
    { id: "unknown", label: "Unknown", lineStyle: "dashed", color: "#c0c0c0" },
];

// 5-tier defaults
const loreRefBoard_DEFAULT_STANDING_TIERS = [
    { id: "hostile", label: "Hostile", min: null, max: -41 },
    { id: "unfriendly", label: "Unfriendly", min: -40, max: -21 },
    { id: "neutral", label: "Neutral", min: -20, max: 20 },
    { id: "friendly", label: "Friendly", min: 21, max: 40 },
    { id: "allied", label: "Allied", min: 41, max: null },
];


class LoreRefBoardClearCacheMenu extends foundry.applications.api.ApplicationV2 {
    async render() {
        const confirmed = await DialogV2.confirm({
            classes: ["lore-rb-dialog"],
            window: { title: game.i18n.localize("lore-reference-board.Settings.ClearCache.Title") },
            content: `<p>${game.i18n.localize("lore-reference-board.Settings.ClearCache.Confirm")}</p>`,
            rejectClose: false,
        });
        if (confirmed) {
            loreRefBoard_clearSearchCache();
            ui.notifications.info(game.i18n.localize("lore-reference-board.Settings.ClearCache.Done"));
        }
    }
}

class LoreRefBoardIndexAllMenu extends foundry.applications.api.ApplicationV2 {
    async render() {
        const confirmed = await DialogV2.confirm({
            classes: ["lore-rb-dialog"],
            window: { title: game.i18n.localize("lore-reference-board.Settings.IndexAll.Title") },
            content: `<p>${game.i18n.localize("lore-reference-board.Settings.IndexAll.Confirm")}</p>`,
            rejectClose: false,
        });
        if (!confirmed) return;

        let cancelled = false;
        const dlg = await new DialogV2({
            window: { title: game.i18n.localize("lore-reference-board.Settings.IndexAll.Title") },
            classes: ["lore-rb-dialog"],
            position: { width: 420 },
            content: `
                <div class="lrb-indexall-progress">
                    <progress value="0" max="1" style="width:100%"></progress>
                    <p class="lrb-indexall-label notes">${game.i18n.localize("lore-reference-board.Settings.IndexAll.Running")}</p>
                </div>`,
            buttons: [{
                action: "cancel",
                label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                callback: () => { cancelled = true; },
            }],
        }).render(true);

        // Closing the dialog cancels the run
        const shouldCancel = () => cancelled || !dlg.rendered;
        const onProgress = (done, total) => {
            if (!dlg.rendered) return;
            const bar = dlg.element?.querySelector?.("progress");
            const label = dlg.element?.querySelector?.(".lrb-indexall-label");
            if (bar) { bar.max = total; bar.value = done; }
            if (label) label.textContent = `${done}/${total}`;
        };

        const completed = await loreRefBoard_forceIndexAll(onProgress, shouldCancel)
            .catch(err => { console.warn("[lore-reference-board] forceIndexAll failed:", err); return false; });

        if (dlg.rendered) await dlg.close();
        ui.notifications.info(game.i18n.localize(
            completed ? "lore-reference-board.Settings.IndexAll.Done" : "lore-reference-board.Settings.IndexAll.Cancelled"
        ));
    }
}

Hooks.once("init", () => {
    game.settings.registerMenu(loreRefBoard_MODULE_SCOPE, "clearSearchCache", {
        name: game.i18n.localize("lore-reference-board.Settings.ClearCache.Name"),
        label: game.i18n.localize("lore-reference-board.Settings.ClearCache.Label"),
        hint: game.i18n.localize("lore-reference-board.Settings.ClearCache.Hint"),
        icon: "fas fa-trash",
        type: LoreRefBoardClearCacheMenu,
        restricted: false,
    });

    game.settings.registerMenu(loreRefBoard_MODULE_SCOPE, "indexAll", {
        name: game.i18n.localize("lore-reference-board.Settings.IndexAll.Name"),
        label: game.i18n.localize("lore-reference-board.Settings.IndexAll.Label"),
        hint: game.i18n.localize("lore-reference-board.Settings.IndexAll.Hint"),
        icon: "fas fa-database",
        type: LoreRefBoardIndexAllMenu,
        restricted: false,
    });

    game.settings.register(loreRefBoard_MODULE_SCOPE, "tabs", { name: "Lore Board Tabs", scope: "world", config: false, type: Object, default: [] });
    game.settings.register(loreRefBoard_MODULE_SCOPE, "pins", { name: "Lore Board Pins", scope: "world", config: false, type: Object, default: {} });
    game.settings.register(loreRefBoard_MODULE_SCOPE, "image-lore", { name: "Lore Board Image Links", scope: "world", config: false, type: Object, default: {} });
    game.settings.register(loreRefBoard_MODULE_SCOPE, "imageJournals", { name: "Image Journal Links", scope: "world", config: false, type: Object, default: {} });
    game.settings.register(loreRefBoard_MODULE_SCOPE, "tabViews", { name: "Tab Views (legacy)", scope: "world", config: false, type: Object, default: {} });
    game.settings.register(loreRefBoard_MODULE_SCOPE, "factionBoardData", { name: "Faction Board Data", scope: "world", config: false, type: Object, default: {} });
    game.settings.register(loreRefBoard_MODULE_SCOPE, "relationshipTypes", { name: "Relationship Types", scope: "world", config: false, type: Object, default: loreRefBoard_DEFAULT_RELATIONSHIP_TYPES });
    game.settings.register(loreRefBoard_MODULE_SCOPE, "factionStandingTiers", { name: "Faction Standing Tiers", scope: "world", config: false, type: Object, default: loreRefBoard_DEFAULT_STANDING_TIERS });
    game.settings.register(loreRefBoard_MODULE_SCOPE, "factionStandingCollapsed", { name: "Faction Standing Collapsed", scope: "client", config: false, type: Object, default: {} });

    // Maximum number of tab rows before the tab bar starts scrolling.
    game.settings.register(loreRefBoard_MODULE_SCOPE, "maxTabRows", {
        name: game.i18n.localize("lore-reference-board.Settings.MaxTabRows.Name"),
        hint: game.i18n.localize("lore-reference-board.Settings.MaxTabRows.Hint"),
        scope: "client",
        config: true,
        type: Number,
        default: 4,
        range: { min: 0, max: 30, step: 1 },
    });


    game.settings.register(loreRefBoard_MODULE_SCOPE, "windowPos", {
        scope: "client",
        config: false,
        type: Object,
        default: {},
    });

    if (typeof Handlebars !== "undefined" && !Handlebars.helpers?.eq) {
        Handlebars.registerHelper("eq", (a, b) => a === b);
    }
});

Hooks.once("init", () => {
    for (const hook of ["deleteJournalEntry", "deleteActor", "deleteItem", "deleteRollTable", "deleteScene", "deleteMacro", "deletePlaylist", "deleteCards"]) {
        Hooks.on(hook, () => {
            const app = game.loreReferenceBoardAppInstance;
            app?._journalOkCache?.clear();
            app?._factionUuidOk?.clear();
        });
    }
});

Hooks.once("ready", () => {
    if (loreRefBoard_isLegacyTheme()) document.body.classList.add("lrb-legacy-theme");

    if (document.getElementById("lr-svg-filter-defs")) return;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.id = "lr-svg-filter-defs";
    svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = `
      <defs>
        <!-- lr-pin-svg-outline: crisp two-ring halo for SVG map pins. -->
        <filter id="lr-pin-svg-outline"
                x="-20%" y="-20%" width="140%" height="140%"
                color-interpolation-filters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="dilated-outer"/>
          <feComposite in="dilated-outer" in2="SourceAlpha" operator="out" result="ring-shape-outer"/>
          <feFlood flood-color="#000000" flood-opacity="0.9" result="flood-black"/>
          <feComposite in="flood-black" in2="ring-shape-outer" operator="in" result="ring-black"/>
          <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="dilated-inner"/>
          <feComposite in="dilated-inner" in2="SourceAlpha" operator="out" result="ring-shape-inner"/>
          <feFlood flood-color="#ffffff" flood-opacity="0.65" result="flood-white"/>
          <feComposite in="flood-white" in2="ring-shape-inner" operator="in" result="ring-white"/>
          <feMerge>
            <feMergeNode in="ring-black"/>
            <feMergeNode in="ring-white"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
    `;
    document.body.appendChild(svg);
});

export { loreRefBoard_DEFAULT_RELATIONSHIP_TYPES, loreRefBoard_DEFAULT_STANDING_TIERS, loreRefBoard_MODULE_SCOPE };
