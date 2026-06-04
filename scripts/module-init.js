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

// Document to HTML for Document tabs with .docx files.
if (typeof window.mammoth === "undefined") {
    const _mm = document.createElement("script");
    _mm.src = "https://cdn.jsdelivr.net/npm/mammoth/mammoth.browser.min.js";
    document.head.appendChild(_mm);
}

const MODULE_SCOPE = "lore-reference-board";

Hooks.once("init", () => {
    game.settings.register(MODULE_SCOPE, "tabs",       { name: "Lore Board Tabs",        scope: "world", config: false, type: Object, default: [] });
    game.settings.register(MODULE_SCOPE, "pins",       { name: "Lore Board Pins",        scope: "world", config: false, type: Object, default: {} });
    game.settings.register(MODULE_SCOPE, "image-lore", { name: "Lore Board Image Links", scope: "world", config: false, type: Object, default: {} });
    game.settings.register(MODULE_SCOPE, "imageJournals", { name: "Image Journal Links", scope: "world", config: false, type: Object, default: {} });
    game.settings.register(MODULE_SCOPE, "tabViews",   { name: "Tab Views (legacy)",     scope: "world", config: false, type: Object, default: {} });

    // Maximum number of tab rows before the tab bar starts scrolling.
    game.settings.register(MODULE_SCOPE, "maxTabRows", {
        name: game.i18n.localize("lore-reference-board.Settings.MaxTabRows.Name"),
        hint: game.i18n.localize("lore-reference-board.Settings.MaxTabRows.Hint"),
        scope:   "client",
        config:  true,
        type:    Number,
        default: 4,
        range:   { min: 0, max: 30, step: 1 },
    });


    game.settings.register(MODULE_SCOPE, "windowPos", {
        scope:   "client",
        config:  false,
        type:    Object,
        default: {},
    });
    if (typeof Handlebars !== "undefined" && !Handlebars.helpers?.eq) {
        Handlebars.registerHelper("eq", (a, b) => a === b);
    }
});

Hooks.once("ready", () => {
    if (document.getElementById("lr-svg-filter-defs")) return; 
    const ns  = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.id    = "lr-svg-filter-defs";
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
