import { loreRefBoard_setupFactionTab } from "./faction-canvas.js";
import { loreRefBoard_applyTabRowLimit, loreRefBoard_bindNewTab, loreRefBoard_bindTabSettings, loreRefBoard_bindTabStrip, loreRefBoard_bindToolbar, loreRefBoard_restoreWindowPos } from "./lrb-app-shell.js";
import { loreRefBoard_addDocumentTabDialog, loreRefBoard_addFactionTabDialog, loreRefBoard_addImageTabDialog, loreRefBoard_addReferenceTabDialog, loreRefBoard_addTabDialog, loreRefBoard_addTabTypeDialog, loreRefBoard_documentTabSettingsDialog, loreRefBoard_factionTabSettingsDialog, loreRefBoard_finishAddTab, loreRefBoard_referenceTabSettingsDialog, loreRefBoard_tabSettingsDialog, loreRefBoard_typeButtonsHtml } from "./lrb-tab-dialogs.js";
import { loreRefBoard_setupDocumentTab } from "./lrb-tab-document.js";
import { loreRefBoard_buildPinElement, loreRefBoard_pinDialog, loreRefBoard_renderPins, loreRefBoard_setupImageTab } from "./lrb-tab-image.js";
import { loreRefBoard_setupReferenceTab } from "./lrb-tab-reference.js";
import { loreRefBoard_MODULE_SCOPE } from "./module-init.js";
import { loreRefBoard_setupSearchPanel } from "./search.js";
import { loreRefBoard_loadTabs } from "./storage.js";
import { loreRefBoard_escapeHtml } from "./utils.js";

var { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

class LoreRefBoardApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.placingPin = false;
        this._panzoom = null;
        this._mapWrapEl = null;
        this._mapResizeObs = null;
        this._htmlRef = null;
        this._maximized = false;

        this.activeTab = null;
        this._imgNaturalW = 0;
        this._imgNaturalH = 0;
        this._skipPosSave = false;
        this._positionRestored = false;

        this._pinDrag = {
            active: false,
            pinId: null,
            startX: 0,
            startY: 0,
            didDrag: false,
            offsetXPx: 0,
            offsetYPx: 0,
        };

        this.reorderMode = false;
        this._dragTabId = null;

    }


    static DEFAULT_OPTIONS = {
        id: "lore-reference-board",
        classes: ["lore-reference-board"],
        window: { title: "lore-reference-board.App.Title", resizable: true },
        position: { width: 1020, height: 680 },
    };

    static PARTS = {
        main: { template: "modules/lore-reference-board/templates/lore-reference-board-mapboard.html" },
    };

    get title() { return game.i18n.localize("lore-reference-board.App.Title"); }

    async _prepareContext(options) {
        const tabs = await loreRefBoard_loadTabs();

        for (const t of tabs) {
            if (t.pinned === undefined) t.pinned = false;
            if (!t.type) t.type = "image";
        }

        if (!tabs.length) {
            this.activeTab = null;
            this._cachedActiveTabImg = "";
            this._cachedCurrentTab = null;
            this.placingPin = false;
            this.reorderMode = false;

            return {
                tabs: [],
                activeTab: null,
                noTabs: true,
                isImageTab: false,
                isDocumentTab: false,
                isReferenceTab: false,
                isFactionTab: false,
            };
        }

        if (!this.activeTab) this.activeTab = tabs[0].id;
        if (!tabs.find((t) => t.id === this.activeTab)) this.activeTab = tabs[0].id;

        const currentTab = tabs.find(t => t.id === this.activeTab) ?? null;
        this._cachedActiveTabImg = currentTab?.img ?? "";
        this._cachedCurrentTab = currentTab;

        const pinnedTabs = tabs.filter(t => t.pinned);
        const unpinnedTabs = tabs.filter(t => !t.pinned);
        const displayTabs = (pinnedTabs.length && unpinnedTabs.length)
            ? [...pinnedTabs, { isDivider: true }, ...unpinnedTabs]
            : [...pinnedTabs, ...unpinnedTabs];

        const isImageTab = currentTab?.type === "image";
        if (!isImageTab) this.placingPin = false;

        return {
            tabs: displayTabs,
            activeTab: this.activeTab,
            noTabs: false,
            isImageTab,
            isDocumentTab: currentTab?.type === "document",
            isReferenceTab: currentTab?.type === "reference",
            isFactionTab: currentTab?.type === "faction",
            typeIcons: {
                image: "fa-image",
                document: "fa-file-lines",
                reference: "fa-table-cells",
                faction: "fa-people-group",
            },
        };
    }

    async _pinDialog({ pin, isNew }) {
        return loreRefBoard_pinDialog({ pin, isNew });
    }

    async _addTabDialog(presetType = null) {
        return loreRefBoard_addTabDialog(this, presetType);
    }

    _typeButtonsHtml(idPrefix) {
        return loreRefBoard_typeButtonsHtml(idPrefix);
    }

    async _addTabTypeDialog() {
        return loreRefBoard_addTabTypeDialog(this);
    }

    async _finishAddTab(res) {
        return loreRefBoard_finishAddTab(this, res);
    }

    async _addImageTabDialog() {
        return loreRefBoard_addImageTabDialog(this);
    }

    async _addDocumentTabDialog() {
        return loreRefBoard_addDocumentTabDialog(this);
    }

    async _addReferenceTabDialog() {
        return loreRefBoard_addReferenceTabDialog(this);
    }

    async _addFactionTabDialog() {
        return loreRefBoard_addFactionTabDialog(this);
    }

    async _tabSettingsDialog(tab) {
        return loreRefBoard_tabSettingsDialog(this, tab);
    }

    async _documentTabSettingsDialog(tab) {
        return loreRefBoard_documentTabSettingsDialog(this, tab);
    }

    async _factionTabSettingsDialog(tab) {
        return loreRefBoard_factionTabSettingsDialog(this, tab);
    }

    async _referenceTabSettingsDialog(tab) {
        return loreRefBoard_referenceTabSettingsDialog(this, tab);
    }

    async _onRender(context, options) {
        const html = $(this.element);
        this._htmlRef = html;
        loreRefBoard_restoreWindowPos(this);
        loreRefBoard_applyTabRowLimit(this, html);
        loreRefBoard_bindTabStrip(this, html);
        loreRefBoard_bindNewTab(this, html);
        loreRefBoard_bindToolbar(this, html);
        loreRefBoard_bindTabSettings(this, html);
        loreRefBoard_setupSearchPanel(this, this.element);

        const currentTab = this._cachedCurrentTab;
        if (currentTab?.type === "document") {
            this._setupDocumentTab(html, currentTab).catch(err =>
                console.error("[lore-reference-board] _setupDocumentTab failed", err)
            );
            return;
        }
        if (currentTab?.type === "reference") {
            this._setupReferenceTab(html, currentTab).catch(err =>
                console.error("[lore-reference-board] _setupReferenceTab failed", err)
            );
            return;
        }
        if (currentTab?.type === "faction") {
            loreRefBoard_setupFactionTab(this, html, currentTab).catch(err =>
                console.error("[lore-reference-board] loreRefBoard_setupFactionTab failed", err)
            );
            return;
        }
        loreRefBoard_setupImageTab(this, html);
    }


    // Document tab rendering
    async _setupDocumentTab(html, tab) {
        return loreRefBoard_setupDocumentTab(this, html, tab);
    }

    async _setupReferenceTab(html, tab) {
        return loreRefBoard_setupReferenceTab(this, html, tab);
    }


    // Deal Cards Dialog
    async _dealCardsDialog(deck) {
        const L = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);

        // Collect all card hands in the world
        const hands = game.cards.filter(c => c.type === "hand");
        if (!hands.length) {
            ui.notifications.warn(L("DealNoHands"));
            return;
        }

        const maxCards = deck.cards?.size ?? 1;

        const content = `
          <form>
            <div style="display:flex;flex-direction:column;gap:12px;padding:6px 0">
              <div>
                <label style="display:block;margin-bottom:4px;font-weight:bold">${L("DealHandLabel")}</label>
                <select name="targetHand" style="width:100%;color-scheme:dark">
                  ${hands.map(h => `<option value="${loreRefBoard_escapeHtml(h.id)}">${loreRefBoard_escapeHtml(h.name)}</option>`).join("")}
                </select>
              </div>
              <div>
                <label style="display:block;margin-bottom:4px;font-weight:bold">${L("DealCountLabel")}</label>
                <input type="number" name="dealCount" value="1" min="1" max="${maxCards}"
                       style="width:100%;box-sizing:border-box" />
              </div>
            </div>
          </form>`;

        const result = await DialogV2.wait({
            window: { title: L("DealTitle") },
            classes: ["lore-rb-dialog"],
            position: { width: 340 },
            content,
            buttons: [
                {
                    action: "deal",
                    label: L("DealBtn"),
                    default: true,
                    callback: (_ev, btn) => {
                        const form = btn.closest("dialog")?.querySelector("form")?.elements;
                        return {
                            handId: form?.targetHand?.value ?? null,
                            count:  Math.max(1, parseInt(form?.dealCount?.value) || 1),
                        };
                    },
                },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: false,
        });

        if (result === "cancel" || !result?.handId) return;

        const targetHand = game.cards.get(result.handId);
        if (!targetHand) return;

        await deck.deal([targetHand], result.count);
    }


    // Pin Rendering
    async buildPinElement(pin, zoom = 1, imgRect = null, containerW = 0, containerH = 0) {
        return loreRefBoard_buildPinElement(this, pin, zoom, imgRect, containerW, containerH);
    }

    async renderPins(html) {
        return loreRefBoard_renderPins(this, html);
    }


    async close(options) {
        if (!this._skipPosSave) {
        const pos = this.position;
        if (pos?.width && pos?.height) {
            try {
                await game.settings.set(loreRefBoard_MODULE_SCOPE, "windowPos", {
                    left: pos.left,
                    top: pos.top,
                    width: pos.width,
                    height: pos.height,
                });
            } catch { }
        }
        }
        return super.close(options);
    }
}

export { LoreRefBoardApp };
