class PinImageViewer extends Application {

    constructor({ src, folderName, folderPath, pinId, tabId }, options = {}) {
        options.id = options.id ?? `lore-image-viewer-${foundry.utils.randomID()}`;
        super(options);
        this._src = src;
        this._folderName = folderName ?? "";
        this._folderPath = folderPath ?? "";
        this._pinId = pinId ?? null;
        this._tabId = tabId ?? null;
    }

    get title() { return this._folderName || game.i18n.localize("lore-reference-board.ImageViewer.WindowTitle"); }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/lore-reference-board/templates/pin-image-viewer.html",
            width: 520,
            height: 660,
            resizable: true,
        });
    }

    async getData(_options = {}) {
        const fileName = this._src.split("/").pop();
        const locationFolder = this._src.includes("/")
            ? this._src.substring(0, this._src.lastIndexOf("/"))
            : this._src;
        return { src: this._src, fileName, locationFolder };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Resolve image dimensions asynchronously
        const img = new Image();
        img.onload = () => {
            html.find(".piv-dimensions").text(`${img.naturalWidth} × ${img.naturalHeight}`);
        };
        img.onerror = () => {
            html.find(".piv-dimensions").text("unknown");
        };
        img.src = this._src;

        // Right-click on the preview image context menu
        html.find(".piv-preview").on("contextmenu", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this._showContextMenu(ev.clientX, ev.clientY);
        });

        // Footer buttons.
        html.find(".piv-btn-lore").on("click", () => this._openLore());
        html.find(".piv-btn-clipboard").on("click", () => this._copyUrl());
        html.find(".piv-btn-token").on("click", () => this._createToken());
        html.find(".piv-btn-scene").on("click", () => this._createScene());
    }

    // Context Menu

    _showContextMenu(x, y) {
        $(".piv-ctx-menu").remove();

        const menu = $(`
            <ul class="piv-ctx-menu">
                <li class="piv-ctx-show"><i class="fas fa-eye"></i> Show Players</li>
                <li class="piv-ctx-chat"><i class="fas fa-comments"></i> Send to Chat</li>
                <li class="piv-ctx-divider"></li>
                <li class="piv-ctx-copy"><i class="fas fa-link"></i> Copy URL</li>
            </ul>
        `);

        $("body").append(menu);
        const mw = menu.outerWidth();
        const mh = menu.outerHeight();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        menu.css({
            left: Math.min(x, vw - mw - 4) + "px",
            top:  Math.min(y, vh - mh - 4) + "px",
        });

        menu.find(".piv-ctx-show").on("click", () => { menu.remove(); this._showToPlayers(); });
        menu.find(".piv-ctx-chat").on("click", () => { menu.remove(); this._sendToChat(); });
        menu.find(".piv-ctx-copy").on("click", () => { menu.remove(); this._copyUrl(); });

        const dismiss = (ev) => {
            if (!$(ev.target).closest(".piv-ctx-menu").length) {
                menu.remove();
                $(document).off("mousedown", dismiss);
            }
        };
        setTimeout(() => $(document).on("mousedown", dismiss), 0);
    }

    // Actions
    _openLore() {
        new PinLoreApp({
            src: this._src,
            imageName: this._src.split("/").pop().replace(/\.[^.]+$/, ""),
            pinId: this._pinId,
            tabId: this._tabId,
        }).render(true);
    }

    _copyUrl() {
        navigator.clipboard.writeText(this._src)
            .then(() => ui.notifications.info(game.i18n.localize("lore-reference-board.ImageViewer.CopiedToClipboard")))
            .catch(() => {
                const ta = document.createElement("textarea");
                ta.value = this._src;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                ui.notifications.info(game.i18n.localize("lore-reference-board.ImageViewer.CopiedToClipboard"));
            });
    }

    _showToPlayers() {
        game.socket.emit("shareImage", {
            image: this._src,
            title: "",
            uuid: null,
        });

        new ImagePopout(this._src, { title: "" }).render(true);
    }

    _sendToChat() {
        const fileName = this._src.split("/").pop();
        ChatMessage.create({
            content: `<figure style="margin:0;text-align:center">
                <img src="${this._src}" alt="${escapeHtml(fileName)}"
                     style="max-width:100%;border-radius:4px" />
                <figcaption style="font-size:11px;color:#aaa;margin-top:4px">
                    ${escapeHtml(fileName)}
                </figcaption>
            </figure>`,
        });
    }

    async _createToken() {
        const fileName = this._src.split("/").pop();
        const defaultName = fileName.replace(/\.[^.]+$/, "");
        const uid = foundry.utils.randomID();

        let result;
        try {
            result = await new Promise((resolve, reject) => {
                let clicked = false;
                new Dialog({
                    title: game.i18n.localize("lore-reference-board.ImageViewer.CreateTokenTitle"),
                    content: `<form>
                        <div style="padding:6px 0">
                            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.ImageViewer.ActorNameLabel")}</label>
                            <input id="piv-actor-${uid}" type="text"
                                   value="${escapeHtml(defaultName)}" style="width:100%" autofocus />
                        </div>
                    </form>`,
                    buttons: {
                        ok: {
                            label: game.i18n.localize("lore-reference-board.Common.Create"),
                            callback: (html) => {
                                clicked = true;
                                resolve(html[0].querySelector(`#piv-actor-${uid}`)?.value ?? defaultName);
                            },
                        },
                        cancel: {
                            label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                            callback: () => { clicked = true; resolve("cancel"); },
                        },
                    },
                    default: "ok",
                    close: () => { if (!clicked) reject(new Error("closed")); },
                }).render(true);
            });
        } catch { return; }
        if (result === "cancel" || !result) return;

        const name = result.trim() || defaultName;

        const types = game.documentTypes?.Actor ?? [];
        const type = types.includes("npc") ? "npc"
                   : types.includes("character") ? "character"
                   : (types[0] ?? "npc");

        await Actor.create({
            name,
            type,
            img: this._src,
            prototypeToken: { name, texture: { src: this._src } },
        });
        ui.notifications.info(game.i18n.format("lore-reference-board.ImageViewer.CreatedActor", { name }));
    }

    async _createScene() {
        const fileName = this._src.split("/").pop();
        const sceneName = fileName.replace(/\.[^.]+$/, "");

        const img = new Image();
        img.src = this._src;
        await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
        });
        const width  = img.naturalWidth  || 2000;
        const height = img.naturalHeight || 2000;

        await Scene.create({
            name: sceneName,
            background: { src: this._src },
            width,
            height,
            grid: { type: 1, size: 100 },
            padding: 0.1,
            navigation: true,
        });
        ui.notifications.info(game.i18n.format("lore-reference-board.ImageViewer.CreatedScene", { name: sceneName }));
    }
}


// Pin's Lore
class PinLoreApp extends Application {

    constructor({ src, imageName, pinId, tabId }, options = {}) {
        options.id = options.id ?? `lore-pin-lore-${foundry.utils.randomID()}`;
        super(options);
        this._src        = src;
        this._imageName  = imageName ?? src.split("/").pop().replace(/\.[^.]+$/, "");
        this._pinId      = pinId ?? null;
        this._tabId      = tabId ?? null;
        this._journalId  = undefined;
        this._updateHookId = null;
    }

    get title() { return this._imageName || game.i18n.localize("lore-reference-board.Lore.WindowTitle"); }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/lore-reference-board/templates/pin-lore.html",
            width: 560,
            height: 520,
            resizable: true,
        });
    }

    async getData(_options = {}) {
        if (this._journalId === undefined) {
            const map = getImageJournalMap();
            this._journalId = (this._pinId ? map[this._pinId]?.[this._src] : null) ?? null;
        }

        if (!this._journalId) return { linked: false };

        let entry = game.journal.get(this._journalId);
        if (!entry) {
            try {
                entry = await fromUuid(`JournalEntry.${this._journalId}`);
            } catch {
                entry = null;
            }
        }

        if (!entry) {
            return { linked: false };
        }

        const pages         = getJournalPages(entry);
        const firstPage     = pages[0] ?? null;
        const enrichedContent = await enrichJournalPage(firstPage, entry);

        return {
            linked: true,
            journalName: entry.name,
            enrichedContent,
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        if (this._journalId) {
            // Linked state
            html.find(".plr-btn-edit").on("click", () => this._openJournalSheet());
            html.find(".plr-btn-unlink").on("click", () => this._unlink());
            // Inject page nav above the content div for multi-page journals
            const contentEl = html.find(".plr-content")[0];
            wirePageNav(contentEl, this._journalId);
        } else {
            // Unlinked state
            const appEl = this.element[0];
            let dragDepth = 0;

            appEl.addEventListener("dragenter", (ev) => {
                ev.preventDefault();
                dragDepth++;
                appEl.classList.add("plr-drop-active");
            });
            appEl.addEventListener("dragleave", () => {
                dragDepth = Math.max(0, dragDepth - 1);
                if (dragDepth === 0) appEl.classList.remove("plr-drop-active");
            });
            appEl.addEventListener("dragover", (ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "link";
            });
            appEl.addEventListener("drop", async (ev) => {
                ev.preventDefault();
                dragDepth = 0;
                appEl.classList.remove("plr-drop-active");
                await this._onDrop(ev);
            });

            html.find(".plr-btn-create").on("click", () => this._createNewJournal());
        }

        this._registerUpdateHook();
    }

    async _persistLink() {
        if (this._pinId) {
            if (this._journalId) {
                await saveImageJournalLink(this._pinId, this._src, this._journalId);
            } else {
                await clearImageJournalLink(this._pinId, this._src);
            }
        } else {
            if (this._journalId) {
                await saveLoreForImage(this._src, this._journalId);
            } else {
                await clearLoreForImage(this._src);
            }
        }
    }

    // Live update hook
    _registerUpdateHook() {
        if (this._updateHookId !== null) {
            Hooks.off("updateJournalEntryPage", this._updateHookId);
            this._updateHookId = null;
        }
        if (!this._journalId) return;

        const watchedId = this._journalId;
        this._updateHookId = Hooks.on("updateJournalEntryPage", (page) => {
            if (page.parent?.id === watchedId) this.render(true);
        });
    }

    // Lifecycle cleanup
    async close(options) {
        if (this._updateHookId !== null) {
            Hooks.off("updateJournalEntryPage", this._updateHookId);
            this._updateHookId = null;
        }
        return super.close(options);
    }

    // Drop handling
    async _onDrop(ev) {
        let data;
        try {
            data = JSON.parse(ev.dataTransfer.getData("text/plain"));
        } catch {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Lore.DropReadFail"));
            return;
        }

        let journalId = null;

        if (data.type === "JournalEntry") {
            const entry = await fromUuid(data.uuid ?? "").catch(() => null);
            journalId = entry?.id ?? null;
        } else if (data.type === "JournalEntryPage") {
            const page = await fromUuid(data.uuid ?? "").catch(() => null);
            journalId = page?.parent?.id ?? null;
        }

        if (!journalId) {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Lore.DropWarn"));
            return;
        }

        this._journalId = journalId;
        try {
            await this._persistLink();
        } catch (err) {
            console.error("LoreReferenceBoard | failed to save journal link on drop:", err);
            ui.notifications.error(game.i18n.localize("lore-reference-board.Lore.SaveLinkFail"));
        }
        await this.render(true);
    }

    // Actions
    async _createNewJournal() {
        const uid = foundry.utils.randomID();
        const inputId = `plr-name-${uid}`;
        const defaultName = this._imageName;

        let chosenName;
        try {
            chosenName = await new Promise((resolve, reject) => {
                let clicked = false;
                new Dialog({
                    title: game.i18n.localize("lore-reference-board.Lore.NameEntryTitle"),
                    content: `<form>
                        <div style="padding:6px 0">
                            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.Lore.JournalEntryName")}</label>
                            <input id="${inputId}" name="${inputId}" type="text"
                                   value="${escapeHtml(defaultName)}"
                                   style="width:100%" autofocus />
                        </div>
                    </form>`,
                    buttons: {
                        create: {
                            label: game.i18n.localize("lore-reference-board.Common.Create"),
                            callback: (html) => {
                                clicked = true;
                                resolve(html[0].querySelector(`#${inputId}`)?.value?.trim() || defaultName);
                            },
                        },
                        cancel: {
                            label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                            callback: () => { clicked = true; resolve("cancel"); },
                        },
                    },
                    default: "create",
                    close: () => { if (!clicked) reject(new Error("closed")); },
                }).render(true);
            });
        } catch { return; }
        if (chosenName === "cancel") return;

        const entry = await JournalEntry.create({
            name: chosenName,
            pages: [{
                name: chosenName,
                type: "text",
                text: {
                    content: "",
                    format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,
                },
            }],
        });
        if (!entry) return;

        this._journalId = entry.id;
        await this._persistLink();
        await this.render(true);
        entry.sheet.render(true);
    }

    _openJournalSheet() {
        const entry = game.journal.get(this._journalId);
        if (entry) {
            entry.sheet.render(true);
        } else {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Lore.JournalNotFound"));
        }
    }

    async _unlink() {
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("lore-reference-board.Lore.UnlinkTitle"),
            content: `<p>${game.i18n.localize("lore-reference-board.Lore.UnlinkContent")}</p>`,
        });
        if (!confirmed) return;

        this._journalId = null;
        try {
            await this._persistLink();
        } catch (err) {
            console.error("LoreReferenceBoard | failed to clear journal link on unlink:", err);
        }
        await this.render(true);
    }
}
