class PinGalleryApp extends Application {
    constructor({ pin, tabId, boardApp }, options = {}) {
        super(options);
        this._pin = pin;
        this._tabId = tabId;
        this._boardApp = boardApp;
        this._gallery = PinGalleryApp._cloneGallery(pin);
        this._journalId    = undefined;
        this._updateHookId = null;
    }

    static _cloneGallery(pin) {
        const g = pin.gallery ?? {};
        return {
            name: g.name ?? pin.title ?? "",
            folders: (g.folders ?? []).map(f => ({
                id: f.id ?? foundry.utils.randomID(),
                name: f.name ?? "",
                path: f.path ?? "",
                images: Array.isArray(f.images) ? [...f.images] : [],
            })),
        };
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "lore-reference-board-gallery",
            template: "modules/lore-reference-board/templates/pin-gallery.html",
            width: 960,
            height: 600,
            resizable: true,
        });
    }

    get title() { return game.i18n.localize("lore-reference-board.Gallery.WindowTitle"); }

    async getData(_options = {}) {
        //  Gallery (left pane) 
        const galleryCtx = {
            galleryName: this._gallery.name,
            folders: this._gallery.folders,
        };

        //  Pin journal (right pane) 
        if (this._journalId === undefined) {
            this._journalId = this._pin.journal || null;
        }

        let journalLinked  = false;
        let journalName    = "";
        let journalContent = "";

        if (this._journalId) {
            let entry = game.journal.get(this._journalId);
            if (!entry) {
                try { entry = await fromUuid(`JournalEntry.${this._journalId}`); } catch { entry = null; }
            }
            if (entry) {
                journalLinked = true;
                journalName   = entry.name;
                // Render the first page (sorted order);
                const pages    = getJournalPages(entry);
                const firstPage = pages[0] ?? null;
                journalContent = await enrichJournalPage(firstPage, entry);
            }
        }

        return {
            ...galleryCtx,
            journalLinked,
            journalName,
            journalContent,
        };
    }

    async activateListeners(html) {
        super.activateListeners(html);

        //  Folder name (top field) 
        html.find("#pg-name").on("input", ev => {
            this._gallery.name = ev.target.value;
        });

        //  Add folder button 
        html.find("#pg-add-folder").on("click", async () => {
            const name = await PinGalleryApp._promptText(game.i18n.localize("lore-reference-board.Gallery.NewFolderTitle"), game.i18n.localize("lore-reference-board.Gallery.FolderNamePrompt"));
            if (!name) return;
            const folderPick = await PinGalleryApp._promptFolderPath();

            const newFolder = {
                id:     foundry.utils.randomID(),
                name:   name.trim(),
                path:   folderPick?.path   ?? "",
                source: folderPick?.source ?? "data",
                images: [],
            };

            if (newFolder.path) {
                const IMAGE_EXT = /\.(apng|avif|bmp|gif|jpe?g|png|svg|tiff?|webp)$/i;
                try {
                    // FilePicker is a global
                    const browseResult = await FilePicker.browse(newFolder.source, newFolder.path);
                    const imgs = (browseResult.files ?? []).filter(f => IMAGE_EXT.test(f));
                    newFolder.images = imgs;
                    if (imgs.length) {
                        ui.notifications.info(
                            imgs.length === 1
                                ? game.i18n.format("lore-reference-board.Gallery.ImportedSingle", { path: newFolder.path })
                                : game.i18n.format("lore-reference-board.Gallery.ImportedMany", { count: imgs.length, path: newFolder.path })
                        );
                    } else {
                        ui.notifications.warn(game.i18n.format("lore-reference-board.Gallery.NoImagesFound", { path: newFolder.path }));
                    }
                } catch (err) {
                    ui.notifications.warn(
                        game.i18n.format("lore-reference-board.Gallery.ImportNewFolderFailed", { path: newFolder.path })
                    );
                    console.error("[lore-reference-board] FilePicker.browse failed on new folder", err);
                }
            }

            this._gallery.folders.push(newFolder);
            await this._save();
            await this.render(true);
        });

        //  Per-folder rename/delete
        html.find(".pg-folder-rename").on("click", async ev => {
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            if (!folder) return;

            const result = await PinGalleryApp._promptFolderRename(folder);
            if (!result) return;

            if (result.action === "delete") {
                const imgCount = folder.images.length;
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize("lore-reference-board.Gallery.DeleteFolder"),
                    content: `<p>${game.i18n.format("lore-reference-board.Gallery.DeleteFolderContent", { name: escapeHtml(folder.name), count: imgCount })}</p>`,
                });
                if (!confirmed) return;

                await clearLoreForImages(folder.images ?? []);
                this._gallery.folders = this._gallery.folders.filter(f => f.id !== folderId);
                await this._save();
                await this.render(true);
                return;
            }

            if (result.action === "save" && result.name) {
                folder.name = result.name;
                await this._save();
                await this.render(true);
            }
        });

        //  Per-folder path edit 
        html.find(".pg-folder-path").on("click", async ev => {
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            if (!folder) return;
            const picked = await PinGalleryApp._pickFolder(folder.path, folder.source);
            if (picked === null) return;
            folder.path = picked.path;
            folder.source = picked.source;
            await this._save();
            await this.render(true);
        });

        //  Add single image to folder
        html.find(".pg-folder-add-images").on("click", async ev => {
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            if (!folder) return;
            const path = await pickImagePath(folder.path || "modules/");
            if (!path) return;
            if (!folder.images.includes(path)) folder.images.push(path);
            await this._save();
            await this.render(true);
        });

        //  Import all images from the folder's path
        html.find(".pg-folder-import").on("click", async ev => {
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            if (!folder) return;

            const picked = await PinGalleryApp._pickFolder(folder.path, folder.source);
            if (!picked) return;
            folder.path = picked.path;
            folder.source = picked.source;
            const importPath = picked.path;
            const importSource = picked.source;

            let browseResult;
            try {
                // FilePicker is a global
                browseResult = await FilePicker.browse(importSource, importPath);
            } catch (err) {
                ui.notifications.error(
                    game.i18n.format("lore-reference-board.Gallery.ImportFailed", { path: importPath })
                );
                console.error(`[lore-reference-board] FilePicker.browse failed`, err);
                return;
            }

            const IMAGE_EXT = /\.(apng|avif|bmp|gif|jpe?g|png|svg|tiff?|webp)$/i;
            const newImages = (browseResult.files ?? []).filter(f => IMAGE_EXT.test(f));

            if (!newImages.length) {
                ui.notifications.warn(game.i18n.format("lore-reference-board.Gallery.NoImagesFound", { path: importPath }));
                return;
            }

            let added = 0;
            for (const img of newImages) {
                if (!folder.images.includes(img)) {
                    folder.images.push(img);
                    added++;
                }
            }

            ui.notifications.info(
                added === 0
                    ? game.i18n.format("lore-reference-board.Gallery.ImportedAlready", { path: importPath })
                    : added === 1
                        ? game.i18n.format("lore-reference-board.Gallery.ImportedSingle", { path: importPath })
                        : game.i18n.format("lore-reference-board.Gallery.ImportedMany", { count: added, path: importPath })
            );

            await this._save();
            await this.render(true);
        });

        //  Remove image (right-click)
        html.find(".pg-thumb").on("contextmenu", async ev => {
            ev.preventDefault();
            const src = $(ev.currentTarget).data("src");
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            if (!folder) return;

            const ok = await Dialog.confirm({
                title: game.i18n.localize("lore-reference-board.Gallery.RemoveImage"),
                content: `<p>${game.i18n.format("lore-reference-board.Gallery.RemoveImageContent", { src: escapeHtml(src) })}</p>`,
            });
            if (!ok) return;
            folder.images = folder.images.filter(i => i !== src);
            await clearLoreForImage(src);
            await this._save();
            await this.render(true);
        });

        //  Click thumbnail to open the custom image viewer
        html.find(".pg-thumb").on("click", ev => {
            const src = $(ev.currentTarget).data("src");
            const folderId = $(ev.currentTarget).closest(".pg-folder-section").data("folderid");
            const folder = this._gallery.folders.find(f => f.id === folderId);
            new PinImageViewer({
                src,
                folderName: folder?.name ?? this._gallery.name,
                folderPath: folder?.path ?? "",
                pinId: this._pin.id,
                tabId: this._tabId,
            }).render(true);
        });

        //  Save Name button in header
        html.find("#pg-save-name").on("click", async () => {
            await this._save();
        });

        //  Pin journal pane (right column) 
        const journalCol = html.find(".pg-journal-col")[0];
        if (this._journalId) {
            html.find(".pgj-btn-edit").on("click", () => this._openPinJournalSheet());
            html.find(".pgj-btn-unlink").on("click", () => this._unlinkPinJournal());
            const contentEl = html.find(".pgj-content")[0];
            wirePageNav(contentEl, this._journalId);
        } else if (journalCol) {
            let dragDepth = 0;
            journalCol.addEventListener("dragenter", (ev) => {
                ev.preventDefault();
                dragDepth++;
                journalCol.classList.add("pgj-drop-active");
            });
            journalCol.addEventListener("dragleave", () => {
                dragDepth = Math.max(0, dragDepth - 1);
                if (dragDepth === 0) journalCol.classList.remove("pgj-drop-active");
            });
            journalCol.addEventListener("dragover", (ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "link";
            });
            journalCol.addEventListener("drop", async (ev) => {
                ev.preventDefault();
                dragDepth = 0;
                journalCol.classList.remove("pgj-drop-active");
                await this._onPinJournalDrop(ev);
            });

            html.find(".pgj-btn-create").on("click", () => this._createPinJournal());
        }

        // Register live-update so the journal pane refreshes when the entry is edited
        this._registerPinJournalUpdateHook();
    }

    async _save() {
        const pins = await loadPinsForTab(this._tabId);
        const idx = pins.findIndex(p => p.id === this._pin.id);
        if (idx === -1) return;

        pins[idx].gallery = {
            name: this._gallery.name,
            folders: this._gallery.folders.map(f => ({ ...f })),
        };
        if (this._gallery.name) pins[idx].title = this._gallery.name;

        await savePinsForTab(this._tabId, pins);
        this._pin = pins[idx];

        if (this._boardApp) await this._boardApp.renderPins(this._boardApp._htmlRef);
    }

    // Pin journal pane helpers
    async _saveJournal(journalId) {
        const pins = await loadPinsForTab(this._tabId);
        const idx  = pins.findIndex(p => p.id === this._pin.id);
        if (idx === -1) return;
        pins[idx].journal = journalId || "";
        this._journalId   = journalId || null;
        await savePinsForTab(this._tabId, pins);
        this._pin = pins[idx];
    }

    async _onPinJournalDrop(ev) {
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
            journalId   = entry?.id ?? null;
        } else if (data.type === "JournalEntryPage") {
            const page  = await fromUuid(data.uuid ?? "").catch(() => null);
            journalId   = page?.parent?.id ?? null;
        }

        if (!journalId) {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Lore.DropWarn"));
            return;
        }

        try {
            await this._saveJournal(journalId);
        } catch (err) {
            console.error("LoreReferenceBoard | failed to save pin journal on drop:", err);
            ui.notifications.error(game.i18n.localize("lore-reference-board.Lore.SaveLinkFail"));
            return;
        }
        await this.render(true);
    }

    async _createPinJournal() {
        const uid       = foundry.utils.randomID();
        const inputId   = `pgj-name-${uid}`;
        const defaultName = this._gallery.name || game.i18n.localize("lore-reference-board.Pin.LoreEntryDefault");

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

        await this._saveJournal(entry.id);
        await this.render(true);
        entry.sheet.render(true);
    }

    _openPinJournalSheet() {
        const entry = game.journal.get(this._journalId);
        if (entry) {
            entry.sheet.render(true);
        } else {
            ui.notifications.warn(game.i18n.localize("lore-reference-board.Lore.JournalNotFound"));
        }
    }

    async _unlinkPinJournal() {
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("lore-reference-board.Lore.UnlinkTitle"),
            content: `<p>${game.i18n.localize("lore-reference-board.Pin.UnlinkPinContent")}</p>`,
        });
        if (!confirmed) return;
        await this._saveJournal(null);
        await this.render(true);
    }

    _registerPinJournalUpdateHook() {
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

    async close(options) {
        if (this._updateHookId !== null) {
            Hooks.off("updateJournalEntryPage", this._updateHookId);
            this._updateHookId = null;
        }
        return super.close(options);
    }

    // File / folder picker helpers
    static _pickFolder(startPath = "", startSource = "data") {
        return new Promise((resolve) => {
            let resolved = false;
            const fp = new FilePicker({
                type: "folder",
                current: startPath,
                activeSource: startSource,
                callback: (path) => {
                    resolved = true;
                    resolve({ path, source: fp.activeSource ?? startSource });
                },
            });
            const origClose = fp.close.bind(fp);
            fp.close = async (...args) => {
                if (!resolved) resolve(null);
                return origClose(...args);
            };
            fp.render(true);
        });
    }

    static async _promptFolderRename(folder) {
        const uid     = foundry.utils.randomID();
        const inputId = `pg-rename-${uid}`;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.Gallery.EditFolder"),
                content: `<form>
                    <div style="padding:6px 0">
                        <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.Gallery.FolderNameLabel")}</label>
                        <input id="${inputId}" name="${inputId}" type="text" value="${escapeHtml(folder.name)}"
                               style="width:100%" autofocus />
                    </div>
                </form>`,
                buttons: {
                    save: {
                        label: game.i18n.localize("lore-reference-board.Common.Save"),
                        callback: (html) => {
                            clicked = true;
                            resolve({
                                action: "save",
                                name: html[0].querySelector(`#${inputId}`)?.value?.trim() ?? folder.name,
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                    delete: {
                        label: game.i18n.localize("lore-reference-board.Gallery.DeleteFolder"),
                        callback: () => { clicked = true; resolve({ action: "delete" }); },
                    },
                },
                default: "save",
                close: () => { if (!clicked) reject(new Error("closed")); },
            }, { width: 380, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        attachDialogValidation(inputId, "save", [inputId]);

        let result;
        try { result = await waitPromise; } catch { return null; }
        if (result === "cancel") return null;
        return result;
    }

    static async _promptFolderPath(defaultPath = "", defaultSource = "data") {
        const uid = foundry.utils.randomID();
        const inputId   = `pg-fp-input-${uid}`;
        const browseBtnId = `pg-fp-browse-${uid}`;
        let currentSource = defaultSource;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.Gallery.FolderPath"),
                content: `<form>
                    <div style="padding:6px 0">
                        <label style="display:block;margin-bottom:4px;font-weight:bold">
                            ${game.i18n.localize("lore-reference-board.Gallery.FolderPathLabel")}
                            <span style="font-weight:normal;color:#999;font-size:11px">${game.i18n.localize("lore-reference-board.Gallery.FolderPathOptional")}</span>
                        </label>
                        <div style="display:flex;gap:6px;align-items:center">
                            <input id="${inputId}" type="text" value="${escapeHtml(defaultPath)}"
                                   style="flex:1;min-width:0;box-sizing:border-box"
                                   placeholder="${game.i18n.localize("lore-reference-board.Gallery.FolderPathPlaceholder")}" />
                            <button type="button" id="${browseBtnId}"
                                style="width:auto;padding:4px 10px;background:#3a3a3a;border:1px solid #555;
                                       border-radius:4px;color:#ccc;cursor:pointer;
                                       white-space:nowrap;flex-shrink:0;font-size:12px;display:inline-flex;align-items:center">
                                ${game.i18n.localize("lore-reference-board.Common.Browse")}
                            </button>
                        </div>
                        <p style="margin:6px 0 0;font-size:11px;color:#aaa">
                            ${game.i18n.localize("lore-reference-board.Gallery.FolderPathNote")}
                        </p>
                    </div>
                </form>`,
                buttons: {
                    ok: {
                        label: game.i18n.localize("lore-reference-board.Common.OK"),
                        callback: (html) => {
                            clicked = true;
                            resolve({
                                path:   html[0].querySelector(`#${inputId}`)?.value?.trim() ?? "",
                                source: currentSource,
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "ok",
                close: () => { if (!clicked) reject(new Error("closed")); },
            }, { width: 440, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        // Attach the folder picker to the Browse button.
        let tries = 0;
        const tick = () => {
            const btn = document.getElementById(browseBtnId);
            if (!btn) { if (++tries < 60) requestAnimationFrame(tick); return; }
            btn.addEventListener("click", async () => {
                const pathInput = document.getElementById(inputId);
                const picked = await PinGalleryApp._pickFolder(
                    pathInput?.value ?? "", currentSource
                );
                if (picked) {
                    currentSource = picked.source;
                    if (pathInput) pathInput.value = picked.path;
                }
            });
        };
        requestAnimationFrame(tick);

        let result;
        try { result = await waitPromise; } catch { return null; }
        if (result === "cancel") return null;
        return result;
    }

    static async _promptText(title, label, defaultVal = "", required = true) {
        const uid = foundry.utils.randomID();
        const inputId = `pg-prompt-${uid}`;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title,
                content: `<form><div style="padding:6px 0">
                    <label style="display:block;margin-bottom:4px;font-weight:bold">${escapeHtml(label)}</label>
                    <input id="${inputId}" type="text" value="${escapeHtml(defaultVal)}" style="width:100%" autofocus />
                </div></form>`,
                buttons: {
                    ok: {
                        label: game.i18n.localize("lore-reference-board.Common.OK"),
                        callback: (html) => {
                            clicked = true;
                            resolve(html[0].querySelector(`#${inputId}`)?.value ?? "");
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "ok",
                close: () => { if (!clicked) reject(new Error("closed")); },
            }, { width: 380, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        if (required) attachDialogValidation(inputId, "ok", [inputId]);

        let result;
        try { result = await waitPromise; } catch { return null; }
        if (result === "cancel") return null;
        return result ?? null;
    }
}
