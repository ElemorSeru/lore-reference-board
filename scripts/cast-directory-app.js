import { loreRefBoard_renderCastCard, loreRefBoard_wireCastCardEvents } from "./cast-card.js";
import { LoreRefBoardPinImageViewer } from "./pin-apps.js";
import {
    loreRefBoard_clearCastLinkForImage,
    loreRefBoard_deleteCastEntry,
    loreRefBoard_getCastDirectoryCollapsed,
    loreRefBoard_getCastLinksMap,
    loreRefBoard_loadCastDataMap,
    loreRefBoard_loadPinsForTab,
    loreRefBoard_loadTabs,
    loreRefBoard_setCastDirectoryCollapsed,
    loreRefBoard_setCastLinkForImage,
} from "./storage.js";
import { loreRefBoard_escapeHtml, loreRefBoard_showImageToPlayers } from "./utils.js";

var { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

class LoreRefBoardCastDirectoryApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static _instance = null;

    static open() {
        if (LoreRefBoardCastDirectoryApp._instance?.rendered) {
            LoreRefBoardCastDirectoryApp._instance.bringToFront();
            return LoreRefBoardCastDirectoryApp._instance;
        }
        LoreRefBoardCastDirectoryApp._instance = new LoreRefBoardCastDirectoryApp();
        LoreRefBoardCastDirectoryApp._instance.render(true);
        return LoreRefBoardCastDirectoryApp._instance;
    }

    constructor(options = {}) {
        super(options);
        this._selectedCastId = null;
        this._expandedShowBack = false;
    }

    get title() { return game.i18n.localize("lore-reference-board.Cast.DirectoryTitle"); }

    static DEFAULT_OPTIONS = {
        id: "lore-reference-board-cast-directory",
        window: { resizable: true, title: "lore-reference-board.Cast.DirectoryTitle" },
        position: { width: 760, height: 560 },
    };

    static PARTS = {
        main: { template: "modules/lore-reference-board/templates/cast-directory.html" },
    };

    async _prepareContext(_options = {}) {
        const castMap = await loreRefBoard_loadCastDataMap();
        const linksMap = loreRefBoard_getCastLinksMap();

        // link resolves group even if inactive
        const linkByCastId = new Map();
        for (const [pinId, bySrc] of Object.entries(linksMap)) {
            for (const [src, link] of Object.entries(bySrc)) {
                if (link?.castId) linkByCastId.set(link.castId, { pinId, src, active: !!link.active });
            }
        }

        const pinLabel = new Map();
        const pinTabId = new Map();
        const tabs = await loreRefBoard_loadTabs();
        for (const tab of tabs) {
            const pins = await loreRefBoard_loadPinsForTab(tab.id);
            for (const pin of pins) {
                pinLabel.set(pin.id, `${tab.name} / ${pin.title || pin.gallery?.name || pin.id}`);
                pinTabId.set(pin.id, tab.id);
            }
        }

        const collapsedMap = loreRefBoard_getCastDirectoryCollapsed();

        const groupsByKey = new Map();
        let totalCount = 0;
        for (const [castId, entry] of Object.entries(castMap)) {
            const link = linkByCastId.get(castId);
            const resolvable = link && pinLabel.has(link.pinId);

            const key = resolvable ? link.pinId : `orphan:${castId}`;
            const title = resolvable ? pinLabel.get(link.pinId) : (entry.originLabel || game.i18n.localize("lore-reference-board.Cast.UnknownOrigin"));
            const orphaned = !resolvable;

            if (!groupsByKey.has(key)) {
                groupsByKey.set(key, { key, title, orphaned, tiles: [] });
            }
            totalCount++;
            groupsByKey.get(key).tiles.push({
                castId,
                name: entry.name || "",
                role: entry.role || "",
                art: link?.src ?? "",
                active: !!link?.active,
                orphaned,
                pinId: link?.pinId ?? null,
                src: link?.src ?? null,
                tabId: link?.pinId ? (pinTabId.get(link.pinId) ?? null) : null,
                selected: this._selectedCastId === castId,
            });
        }

        const groups = [...groupsByKey.values()]
            .sort((a, b) => a.title.localeCompare(b.title))
            .map(g => ({ ...g, collapsed: !!collapsedMap[g.key] }));

        if (this._selectedCastId && !castMap[this._selectedCastId]) this._selectedCastId = null;
        const selectedEntry = this._selectedCastId ? castMap[this._selectedCastId] : null;
        const selected = selectedEntry
            ? {
                castId: this._selectedCastId,
                name: selectedEntry.name || "",
                role: selectedEntry.role || "",
                cardHtml: loreRefBoard_renderCastCard(selectedEntry, { showBack: this._expandedShowBack }),
            }
            : null;

        return {
            groups,
            hasEntries: groups.length > 0,
            totalCount,
            hasSelection: !!selected,
            selected,
        };
    }

    async _onRender(context, options) {
        const html = $(this.element);

        const body = html.find(".lrcd-body")[0];
        if (body) {
            if (this._scrollTop) body.scrollTop = this._scrollTop;
            body.addEventListener("scroll", () => { this._scrollTop = body.scrollTop; }, { passive: true });
        }

        const detailBody = html.find(".lrcd-detail-body")[0];
        if (detailBody) {
            if (this._detailScrollTop) detailBody.scrollTop = this._detailScrollTop;
            detailBody.addEventListener("scroll", () => { this._detailScrollTop = detailBody.scrollTop; }, { passive: true });
        }

        html.find(".lrcd-group-header").on("click", async (ev) => {
            const key = $(ev.currentTarget).closest(".lrcd-group").data("key");
            const map = loreRefBoard_getCastDirectoryCollapsed();
            const updated = { ...map, [key]: !map[key] };
            await loreRefBoard_setCastDirectoryCollapsed(updated);
            await this.render();
        });

        html.find(".lrcd-tile").on("click", async (ev) => {
            const castId = $(ev.currentTarget).data("castid");
            this._selectedCastId = (this._selectedCastId === castId) ? null : castId;
            this._expandedShowBack = false;
            this._detailScrollTop = 0;
            await this.render();
        });

        html.find(".lrcd-detail-close").on("click", async () => {
            this._selectedCastId = null;
            await this.render();
        });

        const tileData = ($el) => {
            const $tile = $el.closest(".lrcd-tile");
            return {
                castId: $tile.data("castid"),
                active: $tile.data("active") === true || $tile.data("active") === "true",
                pinId: $tile.data("pinid") || null,
                src: $tile.data("src") || null,
                tabId: $tile.data("tabid") || null,
            };
        };

        html.find(".lrcd-tile-menu").each((_i, menuEl) => {
            const $menu = $(menuEl);
            $menu.find(".lrcd-tile-menu-toggle").on("click", (ev) => {
                ev.stopPropagation();
                const wasOpen = $menu.hasClass("is-open");
                html.find(".lrt-threads-overflow.is-open").removeClass("is-open");
                if (!wasOpen) $menu.addClass("is-open");
            });
        });

        html.find(".lrcd-tile-menu-item[data-act='open-preview']").on("click", (ev) => {
            ev.stopPropagation();
            const { pinId, src, tabId } = tileData($(ev.currentTarget));
            if (!pinId || !tabId) return;
            new LoreRefBoardPinImageViewer({ src, pinId, tabId }).render(true);
        });

        html.find(".lrcd-tile-menu-item[data-act='show-players']").on("click", (ev) => {
            ev.stopPropagation();
            const { src } = tileData($(ev.currentTarget));
            if (src) loreRefBoard_showImageToPlayers(src);
        });

        html.find(".lrcd-tile-menu-item[data-act='delete']").on("click", async (ev) => {
            ev.stopPropagation();
            await this._onDeleteEntry(tileData($(ev.currentTarget)));
        });

        $(document).off("click.lrcdMenu").on("click.lrcdMenu", (ev) => {
            if ($(ev.target).closest(".lrcd-tile-menu").length) return;
            html.find(".lrcd-tile-menu.is-open").removeClass("is-open");
        });

        if (this._selectedCastId) {
            const hostEl = html.find(`.lrcd-detail-card[data-castid="${this._selectedCastId}"]`)[0];
            loreRefBoard_wireCastCardEvents(hostEl, this._selectedCastId, {
                onChange: () => this.render(),
                onFlip: () => { this._expandedShowBack = !this._expandedShowBack; this.render(); },
            });
        }
    }

    async _onDeleteEntry({ castId, active, pinId, src }) {
        const msgKey = active
            ? "lore-reference-board.Cast.DeleteLinkedConfirm"
            : "lore-reference-board.Cast.DeleteOrphanConfirm";
        const confirmed = await DialogV2.confirm({
            classes: ["lore-rb-dialog"],
            window: { title: game.i18n.localize("lore-reference-board.Cast.DeleteTitle") },
            content: `<p>${game.i18n.localize(msgKey)}</p>`,
            rejectClose: false,
        });
        if (!confirmed) return;

        if (active && pinId && src) {
            await loreRefBoard_clearCastLinkForImage(pinId, src);
        }
        await loreRefBoard_deleteCastEntry(castId);
        if (this._selectedCastId === castId) this._selectedCastId = null;
        await this.render();
    }
}

export { LoreRefBoardCastDirectoryApp };
