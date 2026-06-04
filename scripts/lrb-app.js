class LoreReferenceBoardApp extends Application {
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

        this._pinDrag = {
            active: false,
            pinId: null,
            startX: 0,
            startY: 0,
            didDrag: false,
            offsetXPx: 0,
            offsetYPx: 0,
        };
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "lore-reference-board",
            template: "modules/lore-reference-board/templates/lore-reference-board-mapboard.html",
            width: 1020,
            height: 680,
            resizable: true,
        });
    }

    get title() { return game.i18n.localize("lore-reference-board.App.Title"); }

    async getData(options = {}) {
        const tabs = await loadTabs();

        if (!tabs.length) {
            const def = { id: "default", name: game.i18n.localize("lore-reference-board.Tab.Default"), img: "" };
            await saveTabs([def]);
            tabs.push(def);
        }

        if (!this.activeTab) this.activeTab = tabs[0].id;
        if (!tabs.find((t) => t.id === this.activeTab)) this.activeTab = tabs[0].id;

        // Cache the active tab's image
        const currentTab = tabs.find(t => t.id === this.activeTab) ?? null;
        this._cachedActiveTabImg = currentTab?.img ?? "";
        this._cachedCurrentTab   = currentTab;

        return {
            tabs,
            activeTab: this.activeTab,
            isDocumentTab:  currentTab?.type === "document",
            isReferenceTab: currentTab?.type === "reference",
        };
    }

    async _pinDialog({ pin, isNew }) {
        const L = key => game.i18n.localize(`lore-reference-board.Pin.Icons.${key}`);
        const faIcons = [
            { value: "fas fa-location-dot",      label: L("LocationDot") },
            { value: "fas fa-dragon",             label: L("Dragon") },
            { value: "fas fa-book",               label: L("Book") },
            { value: "fas fa-shield-alt",         label: L("Shield") },
            { value: "fas fa-scroll",             label: L("Scroll") },
            { value: "fas fa-treasure-chest",     label: L("TreasureChest") },
            { value: "fas fa-map-pin",            label: L("MapPin") },
            { value: "fas fa-skull",              label: L("Skull") },
            { value: "fas fa-dungeon",            label: L("Dungeon") },
            { value: "fas fa-tower-observation",  label: L("TowerObservation") },
        ];
        const svgIcons = [
            "anchor", "angel", "aura", "cancel", "card-hand", "castle", "cave",
            "city", "clockwork", "daze", "door-closed", "door-steel", "explosion",
            "eye", "falling", "hazard", "house", "item-bag", "mountain", "oak",
            "obelisk", "padlock", "pawprint", "pill", "poison", "radiation",
            "ruins", "sleep", "sword", "teleport", "temple", "tower", "tower-flag",
            "trap", "village", "waterfall", "whale", "windmill",
        ].map(name => ({
            value: `icons/svg/${name}.svg`,
            label: L(name.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join("")),
        }));

        const current = {
            icon: pin?.icon ?? "fas fa-location-dot",
            color: pin?.color ?? "#e74c3c",
            title: pin?.title ?? "",
            description: pin?.description ?? "",
            journal: pin?.journal ?? "",
        };

        let pinJournalId = current.journal || null;

        const uid           = foundry.utils.randomID();
        const idColor       = `lr-pin-color-${uid}`;
        const idIcon        = `lr-pin-icon-${uid}`;
        const idPreview     = `lr-pin-preview-${uid}`;
        const idUnlinked    = `lr-pin-ju-${uid}`;
        const idLinked      = `lr-pin-jl-${uid}`;
        const idJTitle      = `lr-pin-jt-${uid}`;
        const idJContent    = `lr-pin-jc-${uid}`;
        const idBtnCreate   = `lr-pin-bc-${uid}`;
        const idBtnEdit     = `lr-pin-be-${uid}`;
        const idBtnUnlink   = `lr-pin-bu-${uid}`;

        const content = `
      <form>
        <div class="pd-layout">

          <!-- ===== Left column: pin fields ===== -->
          <div class="pd-left">

            <div class="pd-preview-wrap">
              <div id="${idPreview}" class="pd-preview-icon"></div>
            </div>

            <div class="pd-row">
              <div class="pd-field pd-field-flex">
                <label>Title</label>
                <input type="text" name="pTitle" value="${escapeHtml(current.title)}"
                       style="width:100%;box-sizing:border-box" />
              </div>
              <div class="pd-field pd-field-color">
                <label>Color</label>
                <input id="${idColor}" type="color" name="pColor"
                       value="${escapeHtml(current.color)}" />
              </div>
            </div>

            <div class="pd-field">
              <label>Icon</label>
              <select id="${idIcon}" name="pIcon" style="width:100%;box-sizing:border-box">
                ${[...faIcons, ...svgIcons].map(ic =>
                    `<option value="${escapeHtml(ic.value)}"${ic.value === current.icon ? " selected" : ""}>${escapeHtml(ic.label)}</option>`
                ).join("")}
              </select>
            </div>

            <div class="pd-field">
              <label>Description</label>
              <textarea name="pDesc" rows="5"
                        style="width:100%;box-sizing:border-box;resize:vertical">${escapeHtml(current.description)}</textarea>
            </div>

          </div><!-- /pd-left -->

          <!-- ===== Right column: journal linking panel ===== -->
          <div class="pd-right">

            <div class="pd-journal-label">
              <i class="fas fa-book"></i> Linked Lore Journal
            </div>

            <!-- Unlinked state -->
            <div class="pd-journal-unlinked" id="${idUnlinked}">
              <div class="pd-journal-dropzone">
                <i class="fas fa-book pd-drop-icon"></i>
                <p class="pd-drop-primary">
                  ${game.i18n.localize("lore-reference-board.Pin.DropText")}
                </p>
                <div class="pd-drop-or">,  or, </div>
                <button type="button" class="pd-btn-create" id="${idBtnCreate}">
                  <i class="fas fa-plus"></i> ${game.i18n.localize("lore-reference-board.Pin.CreateLoreEntry")}
                </button>
              </div>
            </div>

            <!-- Linked state (hidden until a journal is linked) -->
            <div class="pd-journal-linked" id="${idLinked}" style="display:none">
              <div class="pd-linked-bar">
                <i class="fas fa-book-open"></i>
                <span class="pd-journal-title" id="${idJTitle}"></span>
                <button type="button" class="pd-btn-edit" id="${idBtnEdit}">
                  <i class="fas fa-edit"></i> ${game.i18n.localize("lore-reference-board.Lore.BtnEditLabel")}
                </button>
                <button type="button" class="pd-btn-unlink" id="${idBtnUnlink}">
                  <i class="fas fa-unlink"></i> ${game.i18n.localize("lore-reference-board.Common.Unlink")}
                </button>
              </div>
              <div class="pd-linked-content" id="${idJContent}">
                <em style="color:#666;font-size:12px">Loading…</em>
              </div>
            </div>

          </div><!-- /pd-right -->

        </div><!-- /pd-layout -->
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let buttonClicked = false;
            const buttons = {
                save: {
                    label: game.i18n.localize("lore-reference-board.Common.Save"),
                    callback: (html) => {
                        buttonClicked = true;
                        const form = html[0].querySelector("form")?.elements;
                        resolve({
                            action: "save",
                            data: {
                                icon:        form?.pIcon?.value  ?? current.icon,
                                color:       form?.pColor?.value ?? current.color,
                                title:       (form?.pTitle?.value ?? "").trim(),
                                description: (form?.pDesc?.value  ?? "").trim(),
                                journal:     pinJournalId,
                            },
                        });
                    },
                },
                cancel: {
                    label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                    callback: () => { buttonClicked = true; resolve("cancel"); },
                },
            };
            if (!isNew) {
                buttons.delete = {
                    label: game.i18n.localize("lore-reference-board.Common.Delete"),
                    callback: () => { buttonClicked = true; resolve({ action: "delete" }); },
                };
            }
            new Dialog({
                title: game.i18n.localize(isNew ? "lore-reference-board.Pin.DialogTitleNew" : "lore-reference-board.Pin.DialogTitleEdit"),
                content,
                buttons,
                default: "save",
                close: () => { if (!buttonClicked) reject(new Error("Dialog closed")); },
            }, { width: 760, height: 540, classes: ["app", "window-app", "dialog", "lore-rb-dialog", "lore-rb-pin-dialog"] }).render(true);
        });

        const setupDialog = async () => {
            const colorInput = document.getElementById(idColor);
            if (!colorInput) return false;  // not rendered yet

            const iconSelect   = document.getElementById(idIcon);
            const preview      = document.getElementById(idPreview);
            const unlinkedEl   = document.getElementById(idUnlinked);
            const linkedEl     = document.getElementById(idLinked);
            const journalTitle = document.getElementById(idJTitle);
            const journalCont  = document.getElementById(idJContent);
            const btnCreate    = document.getElementById(idBtnCreate);
            const btnEdit      = document.getElementById(idBtnEdit);
            const btnUnlink    = document.getElementById(idBtnUnlink);
            if (!iconSelect || !preview || !unlinkedEl || !linkedEl) return false;

            const pdLeft   = preview.closest(".pd-left");
            const pdRight  = preview.closest(".pd-layout")?.querySelector(".pd-right");
            const pdLayout = preview.closest(".pd-layout");
            if (pdLeft && pdRight && pdLayout) {
                const capColumns = () => {
                    const wc   = pdLayout.closest(".window-content");
                    if (!wc) return;
                    const wcCS = getComputedStyle(wc);
                    const plCS = getComputedStyle(pdLayout);
                    
                    const btnBar  = wc.closest(".app")?.querySelector(".dialog-buttons");
                    const btnBarH = btnBar ? btnBar.offsetHeight : 0;
                    const colH = wc.clientHeight
                        - parseFloat(wcCS.paddingTop)    - parseFloat(wcCS.paddingBottom)
                        - parseFloat(plCS.paddingTop)    - parseFloat(plCS.paddingBottom)
                        - btnBarH - 25;
                    pdLeft.style.height     = colH + "px";
                    pdRight.style.maxHeight = colH + "px";
                };
                capColumns();
                // Re-run whenever the dialog is resized
                const ro = new ResizeObserver(capColumns);
                ro.observe(pdLayout.closest(".window-content") ?? pdLeft);
            }

            // Live Pin Preview
            const updatePreview = () => {
                const iconVal  = iconSelect.value;
                const colorVal = colorInput.value;
                if (isSvgIcon(iconVal)) {
                    preview.style.color = "";
                    preview.innerHTML = `<span class="pd-preview-svg-mask" style="background-color:${colorVal};-webkit-mask-image:url('${iconVal}');mask-image:url('${iconVal}')"></span>`;
                } else {
                    preview.style.color = colorVal;
                    preview.innerHTML = `<i class="${iconVal}"></i>`;
                }
            };
            iconSelect.addEventListener("change", updatePreview);
            colorInput.addEventListener("input",  updatePreview);
            updatePreview();

            // Journal state helpers
            const showLinked = async (journalId) => {
                let entry = game.journal.get(journalId);
                if (!entry) {
                    try { entry = await fromUuid(`JournalEntry.${journalId}`); }
                    catch { entry = null; }
                }
                unlinkedEl.style.display = "none";
                linkedEl.style.display   = "flex";
                journalTitle.textContent = entry?.name ?? "(Unknown Journal)";

                linkedEl.querySelectorAll(".lrb-page-nav").forEach(el => el.remove());

                if (entry) {
                    // Render first page
                    const pages     = getJournalPages(entry);
                    const firstPage = pages[0] ?? null;
                    journalCont.innerHTML = await enrichJournalPage(firstPage, entry);

                    await wirePageNav(journalCont, journalId);
                } else {
                    journalCont.innerHTML =
                        '<em style="color:#666;font-size:12px">Journal entry not found.</em>';
                }
            };

            const showUnlinked = () => {
                pinJournalId             = null;
                linkedEl.style.display   = "none";
                unlinkedEl.style.display = "flex";
            };

            if (pinJournalId) {
                await showLinked(pinJournalId);
            }

            let dragDepth = 0;
            unlinkedEl.addEventListener("dragenter", (ev) => {
                ev.preventDefault();
                dragDepth++;
                unlinkedEl.classList.add("pd-drop-active");
            });
            unlinkedEl.addEventListener("dragleave", () => {
                dragDepth = Math.max(0, dragDepth - 1);
                if (dragDepth === 0) unlinkedEl.classList.remove("pd-drop-active");
            });
            unlinkedEl.addEventListener("dragover", (ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "link";
            });
            unlinkedEl.addEventListener("drop", async (ev) => {
                ev.preventDefault();
                dragDepth = 0;
                unlinkedEl.classList.remove("pd-drop-active");

                let data;
                try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                catch { ui.notifications.warn(game.i18n.localize("lore-reference-board.Pin.DropReadFail")); return; }

                let journalId = null;
                if (data.type === "JournalEntry") {
                    const entry = await fromUuid(data.uuid ?? "").catch(() => null);
                    journalId = entry?.id ?? null;
                } else if (data.type === "JournalEntryPage") {
                    const page = await fromUuid(data.uuid ?? "").catch(() => null);
                    journalId = page?.parent?.id ?? null;
                }

                if (!journalId) {
                    ui.notifications.warn(game.i18n.localize("lore-reference-board.Pin.DropWarn"));
                    return;
                }

                pinJournalId = journalId;
                await showLinked(journalId);
            });

            // Create New Lore Entry
            btnCreate?.addEventListener("click", async () => {
                const titleFieldVal = btnCreate.closest("form")?.elements?.pTitle?.value?.trim();
                const defaultName   = titleFieldVal || current.title || game.i18n.localize("lore-reference-board.Pin.LoreEntryDefault");
                const nameUid       = foundry.utils.randomID();
                const nameInputId   = `pd-name-${nameUid}`;

                let chosenName;
                try {
                    chosenName = await new Promise((resolve, reject) => {
                        let clicked = false;
                        new Dialog({
                            title: game.i18n.localize("lore-reference-board.Lore.NameEntryTitle"),
                            content: `<form>
                                <div style="padding:6px 0">
                                    <label style="display:block;margin-bottom:4px;font-weight:bold">
                                        ${game.i18n.localize("lore-reference-board.Lore.JournalEntryName")}
                                    </label>
                                    <input id="${nameInputId}" name="${nameInputId}" type="text"
                                           value="${escapeHtml(defaultName)}"
                                           style="width:100%" autofocus />
                                </div>
                            </form>`,
                            buttons: {
                                create: {
                                    label: game.i18n.localize("lore-reference-board.Common.Create"),
                                    callback: (html) => {
                                        clicked = true;
                                        resolve(html[0].querySelector(`#${nameInputId}`)?.value?.trim() || defaultName);
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
                        text: { content: "", format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML },
                    }],
                });
                if (!entry) return;

                pinJournalId = entry.id;
                await showLinked(entry.id);
                entry.sheet.render(true);
            });

            // Edit linked journal
            btnEdit?.addEventListener("click", () => {
                const entry = game.journal.get(pinJournalId);
                if (entry) entry.sheet.render(true);
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.Pin.JournalNotFound"));
            });

            // Unlink journal
            btnUnlink?.addEventListener("click", async () => {
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize("lore-reference-board.Pin.UnlinkTitle"),
                    content: `<p>${game.i18n.localize("lore-reference-board.Pin.UnlinkPinContent")}</p>`,
                });
                if (!confirmed) return;
                showUnlinked();
            });

            return true; 
        };

        let tries = 0;
        const tick = () => {
            setupDialog().then(done => {
                if (done) return;
                if (++tries < 60) requestAnimationFrame(tick);
            });
        };
        requestAnimationFrame(tick);

        // Disable Save until Title has a value.
        attachDialogValidation(idColor, "save", ["pTitle"]);

        try {
            return await waitPromise;
        } catch {
            return "cancel";
        }
    }


    // Add Tab & Settings

    async _addTabDialog() {
        const type = await this._addTabTypeDialog();
        if (type === "cancel") return "cancel";
        if (type === "image")     return await this._addImageTabDialog();
        if (type === "document")  return await this._addDocumentTabDialog();
        if (type === "reference") return await this._addReferenceTabDialog();
        return "cancel";
    }

    // 3 Options Picker
    async _addTabTypeDialog() {
        const uid      = foundry.utils.randomID();
        const imgBtnId = `lrt-type-img-${uid}`;
        const docBtnId = `lrt-type-doc-${uid}`;
        const refBtnId = `lrt-type-ref-${uid}`;
        let selectedType = "cancel";
        let dialogRef    = null;

        const content = `
          <div class="lrt-type-picker">
            <p class="lrt-type-prompt">${game.i18n.localize("lore-reference-board.AddTab.ChooseType")}</p>
            <div class="lrt-type-buttons">
              <button type="button" id="${imgBtnId}" class="lrt-type-btn">
                <i class="fas fa-image lrt-type-icon"></i>
                <span class="lrt-type-label">${game.i18n.localize("lore-reference-board.AddTab.TypeImage")}</span>
                <em class="lrt-type-desc">${game.i18n.localize("lore-reference-board.AddTab.TypeImageDesc")}</em>
              </button>
              <button type="button" id="${docBtnId}" class="lrt-type-btn">
                <i class="fas fa-book-open lrt-type-icon"></i>
                <span class="lrt-type-label">${game.i18n.localize("lore-reference-board.AddTab.TypeDocument")}</span>
                <em class="lrt-type-desc">${game.i18n.localize("lore-reference-board.AddTab.TypeDocumentDesc")}</em>
              </button>
              <button type="button" id="${refBtnId}" class="lrt-type-btn">
                <i class="fas fa-link lrt-type-icon"></i>
                <span class="lrt-type-label">${game.i18n.localize("lore-reference-board.AddTab.TypeReference")}</span>
                <em class="lrt-type-desc">${game.i18n.localize("lore-reference-board.AddTab.TypeReferenceDesc")}</em>
              </button>
            </div>
          </div>
        `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            dialogRef = new Dialog({
                title: game.i18n.localize("lore-reference-board.AddTab.Title"),
                content,
                buttons: {
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "cancel",
                close: () => { if (!clicked) resolve(selectedType); },
            }, { width: 600, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] });
            dialogRef.render(true);
        });

        let tries = 0;
        const attach = () => {
            const imgBtn = document.getElementById(imgBtnId);
            const docBtn = document.getElementById(docBtnId);
            const refBtn = document.getElementById(refBtnId);
            if (!imgBtn || !docBtn || !refBtn) return false;
            imgBtn.addEventListener("click", () => { selectedType = "image";     dialogRef?.close(); });
            docBtn.addEventListener("click", () => { selectedType = "document";  dialogRef?.close(); });
            refBtn.addEventListener("click", () => { selectedType = "reference"; dialogRef?.close(); });
            return true;
        };
        const tick = () => { if (!attach() && ++tries < 60) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);

        return await waitPromise;
    }

    // Image tab creation dialog
    async _addImageTabDialog() {
        const uid         = foundry.utils.randomID();
        const nameInputId = `at-name-${uid}`;
        const browseBtnId = `at-browse-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:12px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="tabName" value=""
                   placeholder="${game.i18n.localize("lore-reference-board.AddTab.ImageNamePlaceholder")}"
                   style="width:100%" autofocus />
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelImage")}
            </label>
            <div style="display:flex;gap:6px;align-items:center">
              <input type="text" name="tabImg" value=""
                     placeholder="${game.i18n.localize("lore-reference-board.AddTab.ImagePathPlaceholder")}"
                     style="flex:1;min-width:0;box-sizing:border-box" />
              <button type="button" id="${browseBtnId}"
                style="width:auto;padding:4px 10px;background:#2a3f2a;border:1px solid #4a6a4a;border-radius:4px;
                       color:#cfc;cursor:pointer;white-space:nowrap;flex-shrink:0;font-size:12px;display:inline-flex;align-items:center">
                ${game.i18n.localize("lore-reference-board.Common.Browse")}
              </button>
            </div>
            <div style="margin-top:6px;color:#888;font-size:11px">
              ${game.i18n.localize("lore-reference-board.AddTab.Hint")}
            </div>
          </div>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.AddTab.ImageTabTitle"),
                content,
                buttons: {
                    add: {
                        label: game.i18n.localize("lore-reference-board.Common.Add"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({
                                action: "add",
                                name: (form?.tabName?.value ?? "").trim(),
                                img:  (form?.tabImg?.value  ?? "").trim(),
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "add",
                close: () => { if (!clicked) reject(new Error("Dialog closed")); },
            }, { width: 420, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        const attachBrowse = () => {
            const btn = document.getElementById(browseBtnId);
            if (!btn) return false;
            btn.addEventListener("click", async () => {
                const imgInput = btn.closest("form")?.elements?.tabImg;
                const picked = await pickImagePath(imgInput?.value || "modules/");
                if (picked && imgInput) {
                    imgInput.value = picked;
                    imgInput.dispatchEvent(new Event("input"));
                }
            });
            return true;
        };
        let tries = 0;
        const tick = () => { if (!attachBrowse() && ++tries < 60) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);

        // Both name and image path required
        attachDialogValidation(nameInputId, "add", ["tabName", "tabImg"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "image", name: result.name, img: result.img };
        return "cancel";
    }

    // Document tab creation dialog
    async _addDocumentTabDialog() {
        const uid         = foundry.utils.randomID();
        const nameInputId = `adt-name-${uid}`;
        const pathInputId = `adt-path-${uid}`;
        const browseBtnId = `adt-browse-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:12px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="tabName" value=""
                   placeholder="${game.i18n.localize("lore-reference-board.AddTab.DocumentNamePlaceholder")}"
                   style="width:100%" autofocus />
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelDocPath")}
            </label>
            <div style="display:flex;gap:6px;align-items:center">
              <input type="text" id="${pathInputId}" name="tabDocPath" value=""
                     placeholder="${game.i18n.localize("lore-reference-board.AddTab.DocPathPlaceholder")}"
                     style="flex:1;min-width:0;box-sizing:border-box" />
              <button type="button" id="${browseBtnId}"
                style="width:auto;padding:4px 10px;background:#2a3f2a;border:1px solid #4a6a4a;border-radius:4px;
                       color:#cfc;cursor:pointer;white-space:nowrap;flex-shrink:0;font-size:12px;display:inline-flex;align-items:center">
                ${game.i18n.localize("lore-reference-board.AddTab.BrowseDoc")}
              </button>
            </div>
            <div style="margin-top:6px;color:#888;font-size:11px">
              ${game.i18n.localize("lore-reference-board.AddTab.DocPathHint")}
            </div>
          </div>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.AddTab.DocumentTabTitle"),
                content,
                buttons: {
                    add: {
                        label: game.i18n.localize("lore-reference-board.Common.Add"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({
                                action: "add",
                                name:    (form?.tabName?.value    ?? "").trim(),
                                docPath: (form?.tabDocPath?.value ?? "").trim(),
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "add",
                close: () => { if (!clicked) reject(new Error("Dialog closed")); },
            }, { width: 420, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        const attachBrowse = () => {
            const btn = document.getElementById(browseBtnId);
            if (!btn) return false;
            btn.addEventListener("click", async () => {
                const pathInput = document.getElementById(pathInputId);
                const picked = await pickDocFilePath(pathInput?.value || "modules/");
                if (picked && pathInput) {
                    pathInput.value = picked;
                    pathInput.dispatchEvent(new Event("input"));
                }
            });
            return true;
        };
        let tries = 0;
        const tick = () => { if (!attachBrowse() && ++tries < 60) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);

        attachDialogValidation(nameInputId, "add", ["tabName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "document", name: result.name, docPath: result.docPath };
        return "cancel";
    }

    // Reference tab creation dialog
    async _addReferenceTabDialog() {
        const uid         = foundry.utils.randomID();
        const nameInputId = `art-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:12px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.AddTab.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="tabName" value=""
                   placeholder="${game.i18n.localize("lore-reference-board.AddTab.ReferenceNamePlaceholder")}"
                   style="width:100%" autofocus />
          </div>
          <p style="margin:0;font-size:11px;color:#888">
            ${game.i18n.localize("lore-reference-board.AddTab.TypeReferenceDesc")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.AddTab.ReferenceTabTitle"),
                content,
                buttons: {
                    add: {
                        label: game.i18n.localize("lore-reference-board.Common.Add"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({ action: "add", name: (form?.tabName?.value ?? "").trim() });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "add",
                close: () => { if (!clicked) reject(new Error("Dialog closed")); },
            }, { width: 420, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        attachDialogValidation(nameInputId, "add", ["tabName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "add") return { type: "reference", name: result.name };
        return "cancel";
    }

    async _tabSettingsDialog(tab) {
        if (tab.type === "document")  return await this._documentTabSettingsDialog(tab);
        if (tab.type === "reference") return await this._referenceTabSettingsDialog(tab);

        let name = tab?.name ?? "";
        let img = tab?.img ?? "";

        const uid = foundry.utils.randomID();
        const browseBtnId = `ts-browse-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}</label>
            <input type="text" name="tsName" value="${escapeHtml(name)}" style="width:100%" autofocus />
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">${game.i18n.localize("lore-reference-board.TabSettings.LabelImage")}</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input type="text" name="tsImg" value="${escapeHtml(img)}" style="flex:1;min-width:0;box-sizing:border-box" />
              <button type="button" id="${browseBtnId}"
                style="width:auto;padding:4px 10px;background:#3a3a3a;border:1px solid #555;border-radius:4px;
                       color:#ccc;cursor:pointer;white-space:nowrap;flex-shrink:0;font-size:12px;display:inline-flex;align-items:center">
                ${game.i18n.localize("lore-reference-board.Common.Browse")}
              </button>
            </div>
            <p style="margin:6px 0 0;font-size:11px;color:#aaa">
              ${game.i18n.localize("lore-reference-board.TabSettings.ImageWarning")}
            </p>
          </div>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let buttonClicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.TabSettings.Title"),
                content,
                buttons: {
                    save: {
                        label: game.i18n.localize("lore-reference-board.Common.Save"),
                        callback: (html) => {
                            buttonClicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({
                                action: "save",
                                name: (form?.tsName?.value ?? "").trim(),
                                img:  (form?.tsImg?.value  ?? "").trim(),
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { buttonClicked = true; resolve("cancel"); },
                    },
                    delete: {
                        label: game.i18n.localize("lore-reference-board.TabSettings.BtnDeleteTab"),
                        callback: () => { buttonClicked = true; resolve({ action: "delete" }); },
                    },
                },
                default: "save",
                close: () => { if (!buttonClicked) reject(new Error("Dialog closed")); },
            }, { width: 440, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        // Attach the Browse button click handler
        const attachBrowse = () => {
            const btn = document.getElementById(browseBtnId);
            if (!btn) return false;
            btn.addEventListener("click", async () => {
                const imgInput = btn.closest("form")?.elements?.tsImg;
                const picked = await pickImagePath(imgInput?.value || "modules/");
                if (picked && imgInput) {
                    imgInput.value = picked;
                    imgInput.dispatchEvent(new Event("input"));
                }
            });
            return true;
        };
        let tries = 0;
        const tick = () => {
            if (attachBrowse()) return;
            if (++tries < 60) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        attachDialogValidation(browseBtnId, "save", ["tsName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }

        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "delete") return { action: "delete" };
        if (result?.action === "save")   return { name: result.name, img: result.img };
        return "cancel";
    }

    // Settings dialog for document type tabs
    async _documentTabSettingsDialog(tab) {
        const uid         = foundry.utils.randomID();
        const nameInputId = `dts-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="dtsName"
                   value="${escapeHtml(tab?.name ?? "")}" style="width:100%" autofocus />
          </div>
          <p style="margin:4px 0 0;font-size:11px;color:#aaa">
            ${game.i18n.localize("lore-reference-board.TabSettings.DocumentHint")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.TabSettings.Title"),
                content,
                buttons: {
                    save: {
                        label: game.i18n.localize("lore-reference-board.Common.Save"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({ action: "save", name: (form?.dtsName?.value ?? "").trim() });
                        },
                    },
                    delete: {
                        label: game.i18n.localize("lore-reference-board.TabSettings.BtnDeleteTab"),
                        callback: () => { clicked = true; resolve({ action: "delete" }); },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "save",
                close: () => { if (!clicked) reject(new Error("Dialog closed")); },
            }, { width: 440, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        attachDialogValidation(nameInputId, "save", ["dtsName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "delete") return { action: "delete" };
        if (result?.action === "save")   return { name: result.name };
        return "cancel";
    }

    // Settings dialog for reference type tabs
    async _referenceTabSettingsDialog(tab) {
        const uid         = foundry.utils.randomID();
        const nameInputId = `rts-name-${uid}`;

        const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.TabSettings.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="rtsName"
                   value="${escapeHtml(tab?.name ?? "")}" style="width:100%" autofocus />
          </div>
          <p style="margin:4px 0 0;font-size:11px;color:#aaa">
            ${game.i18n.localize("lore-reference-board.AddTab.TypeReferenceDesc")}
          </p>
        </div>
      </form>
    `;

        const waitPromise = new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: game.i18n.localize("lore-reference-board.TabSettings.Title"),
                content,
                buttons: {
                    save: {
                        label: game.i18n.localize("lore-reference-board.Common.Save"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({ action: "save", name: (form?.rtsName?.value ?? "").trim() });
                        },
                    },
                    delete: {
                        label: game.i18n.localize("lore-reference-board.TabSettings.BtnDeleteTab"),
                        callback: () => { clicked = true; resolve({ action: "delete" }); },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "save",
                close: () => { if (!clicked) reject(new Error("Dialog closed")); },
            }, { width: 440, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        });

        attachDialogValidation(nameInputId, "save", ["rtsName"]);

        let result;
        try { result = await waitPromise; } catch { return "cancel"; }
        if (result === "cancel" || result?.action === "cancel") return "cancel";
        if (result?.action === "delete") return { action: "delete" };
        if (result?.action === "save")   return { name: result.name };
        return "cancel";
    }

    activateListeners(html) {
        super.activateListeners(html);
        this._htmlRef = html;

        const savedPos = _getSetting("windowPos", {});
        if (savedPos?.width && savedPos?.height) {
            const maxLeft = Math.max(0, window.innerWidth  - 200);
            const maxTop  = Math.max(0, window.innerHeight - 100);
            this.setPosition({
                left:   Math.min(Math.max(0, savedPos.left   ?? 0), maxLeft),
                top:    Math.min(Math.max(0, savedPos.top    ?? 0), maxTop),
                width:  Math.min(Math.max(400, savedPos.width),  window.innerWidth),
                height: Math.min(Math.max(300, savedPos.height), window.innerHeight),
            });
        }

        // Apply maxTabRows setting to the tab strip.
        const maxRows = (() => {
            try { return game.settings.get(MODULE_SCOPE, "maxTabRows") ?? 4; } catch { return 4; }
        })();
        const tabsEl = html.find(".lr-tabs")[0];
        if (tabsEl) {
            if (maxRows > 0) {
                tabsEl.style.maxHeight = `${maxRows * 36}px`;
                tabsEl.style.overflowY = "auto";
            } else {
                tabsEl.style.maxHeight = "";
                tabsEl.style.overflowY = "";
            }
        }

        // Tabs
        html.find(".lr-tab[data-tabid]").off("click").on("click", async (ev) => {
            const tabId = ev.currentTarget.dataset.tabid;
            if (!tabId || tabId === this.activeTab) return;
            this.activeTab = tabId;
            await this.render(true);
        });

        // New tab
        html.find("#lr-new-tab").off("click").on("click", async () => {
            const res = await this._addTabDialog();
            if (!res || res === "cancel") return;

            const name = (res.name ?? "").trim();
            if (!name) return ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.NameRequired"));

            const all = await loadTabs();
            const id  = foundry.utils.randomID();

            if (res.type === "document") {
                let docType = null;
                let docRef  = null;
                if (res.docPath) {
                    const cleanPath = normalizeLrbPath(res.docPath);
                    if (_lrbIsUrl(cleanPath)) {
                        docType = "url";
                        docRef  = cleanPath;
                    } else {
                        const detectedType = _lrbDocTypeForExt(cleanPath.split(".").pop());
                        if (detectedType) { docType = detectedType; docRef = cleanPath; }
                    }
                }
                all.push({ id, name, type: "document", docType, docRef });
            } else if (res.type === "reference") {
                // Reference tab,  no document linked yet
                all.push({ id, name, type: "reference", docUuid: null, docType: null });
            } else {
                // image tab
                const img = (res.img ?? "").trim();
                if (!img) return ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.ImageRequired"));
                all.push({ id, name, type: "image", img });
            }

            await saveTabs(all);
            this.activeTab = id;
            await this.render(true);
        });

        // Toolbar
        html.find("#lr-toggle-pin").off("click").on("click", (ev) => {
            this.placingPin = !this.placingPin;
            $(ev.currentTarget).toggleClass("active", this.placingPin);
            ui.notifications.info(game.i18n.localize(this.placingPin ? "lore-reference-board.Tab.PinModeOn" : "lore-reference-board.Tab.PinModeOff"));
        });
        html.find("#lr-toggle-pin").toggleClass("active", this.placingPin);

        html.find("#lr-maximize").off("click").on("click", (ev) => {
            this._maximized = !this._maximized;
            $(ev.currentTarget).toggleClass("active", this._maximized);
            // v12: this.element is already jQuery
            this.element.toggleClass("lr-maximized", this._maximized);
        });
        html.find("#lr-maximize").toggleClass("active", !!this._maximized);

        html.find("#lr-reset-view").off("click").on("click", () => {
            if (this._panzoom) this._panzoom.reset();
        });

        // Tab settings
        html.find("#lr-tab-settings").off("click").on("click", async () => {
            const allTabs = await loadTabs();
            const tab = allTabs.find((t) => t.id === this.activeTab);
            if (!tab) return;

            const res = await this._tabSettingsDialog(tab);
            if (!res || res === "cancel") return;

            // Delete Tab
            if (res?.action === "delete") {
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize("lore-reference-board.TabSettings.DeleteTitle"),
                    content: `<p>${game.i18n.format("lore-reference-board.TabSettings.DeleteContent", { name: escapeHtml(tab.name) })}</p>`,
                });
                if (!confirmed) return;

                const tabPins = await loadPinsForTab(this.activeTab);
                await clearLoreForImages(tabPins.flatMap(p => collectPinImages(p)));
                if (tabPins.length) {
                    const journalMap = getImageJournalMap();
                    const updatedMap = { ...journalMap };
                    for (const p of tabPins) delete updatedMap[p.id];
                    await game.settings.set(MODULE_SCOPE, "imageJournals", updatedMap);
                }
                await deletePinsForTab(this.activeTab);
                const remaining = (await loadTabs()).filter(t => t.id !== this.activeTab);
                await saveTabs(remaining);

                this.activeTab = remaining[0]?.id ?? null;
                await this.render(true);
                return;
            }

            const newName = (res.name ?? "").trim();
            const newImg = (res.img ?? "").trim();
            if (!newName) return ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.NameRequired"));

            const imageChanged = newImg && newImg !== (tab.img ?? "");
            if (imageChanged) {
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize("lore-reference-board.TabSettings.ReplaceMapTitle"),
                    content: `<p>${game.i18n.localize("lore-reference-board.TabSettings.ReplaceMapContent")}</p>`,
                });
                if (!confirmed) return;
                const oldPins = await loadPinsForTab(this.activeTab);
                await clearLoreForImages(oldPins.flatMap(p => collectPinImages(p)));
                await deletePinsForTab(this.activeTab);
            }

            const latest = await loadTabs();
            const idx = latest.findIndex((t) => t.id === this.activeTab);
            if (idx !== -1) {
                latest[idx].name = newName;
                if (imageChanged) latest[idx].img = newImg;
                await saveTabs(latest);
            }
            await this.render(true);
        });

        // Document & Reference tabs
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

        // Map image
        if (this._cachedActiveTabImg) {
            html.find("#lr-map-image").css({
                "background-image": `url('${this._cachedActiveTabImg}')`,
                "background-size": "contain",
                "background-position": "center",
                "background-repeat": "no-repeat",
            });
        } else {
            html.find("#lr-map-image").css({ "background-image": "" });
        }

        if (this._mapResizeObs) {
            this._mapResizeObs.disconnect();
            this._mapResizeObs = null;
        }
        if (this._panzoom) {
            try {
                this._mapWrapEl?.removeEventListener("wheel", this._panzoom.zoomWithWheel);
            } catch { }
            try {
                this._panzoom.destroy();
            } catch { }
            this._panzoom = null;
            this._mapWrapEl = null;
        }

        const mapWrapEl = html.find("#lr-map-wrap")[0];
        if (mapWrapEl && window.PanzoomLoaded && window.Panzoom) {
            this._mapWrapEl = mapWrapEl;
            this._panzoom = Panzoom(mapWrapEl, {
                maxScale: 5,
                minScale: 0.5,
                contain: "outside",
                excludeClass: "lr-pin",
            });
            mapWrapEl.addEventListener("wheel", this._panzoom.zoomWithWheel);
            mapWrapEl.addEventListener("panzoomchange", () => {
                const zoom = this._panzoom?.getScale?.() ?? 1;
                $(this._mapWrapEl).find(".lr-pin").css(
                    "transform", `translate(-50%, -100%) scale(${1 / zoom})`
                );
            });
        }

        // Clear handlers
        html.find("#lr-map-wrap").off(".lrMap");
        $(document).off(".lrMapDrag");

        const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

        const mapWrap = html.find("#lr-map-wrap")[0];
        const clientToMapPct = (clientX, clientY) => {
            const r  = mapWrap.getBoundingClientRect();
            const xLayout = (clientX - r.left) / r.width  * mapWrap.offsetWidth;
            const yLayout = (clientY - r.top)  / r.height * mapWrap.offsetHeight;
            const ir = computeImageRect(mapWrap.offsetWidth, mapWrap.offsetHeight, this._imgNaturalW, this._imgNaturalH);
            return {
                xPct: clamp(((xLayout - ir.offsetX) / ir.displayW) * 100, 0, 100),
                yPct: clamp(((yLayout - ir.offsetY) / ir.displayH) * 100, 0, 100),
            };
        };

        // Open gallery when placement is OFF and user clicks an existing pin
        html.find("#lr-map-wrap").on("click.lrMap", ".lr-pin", async (ev) => {
            if (this.placingPin) return;
            ev.stopPropagation();
            const pinId = $(ev.currentTarget).data("pinid");
            const pins = await loadPinsForTab(this.activeTab);
            const pin = pins.find(p => p.id === pinId);
            if (!pin) return;
            new PinGalleryApp({ pin, tabId: this.activeTab, boardApp: this }).render(true);
        });

        // Add pin - placement ON, click on empty map space
        html.find("#lr-map-wrap").on("click.lrMap", async (ev) => {
            if (!this.placingPin) return;
            if ($(ev.target).closest(".lr-pin").length) return;

            const { xPct, yPct } = clientToMapPct(ev.clientX, ev.clientY);
            const res = await this._pinDialog({ pin: { xPct, yPct }, isNew: true });
            if (!res || res === "cancel") return;
            if (res?.action !== "save") return;

            const pins = await loadPinsForTab(this.activeTab);
            pins.push({ id: foundry.utils.randomID(), xPct, yPct, coordV: 1, ...res.data });
            await savePinsForTab(this.activeTab, pins);
            await this.renderPins(this._htmlRef);
        });

        // Drag / edit pin
        html.find("#lr-map-wrap").on("pointerdown.lrMap", ".lr-pin", (ev) => {
            if (!this.placingPin) return;
            if (ev.button !== 0) return;

            ev.preventDefault();
            ev.stopPropagation();

            const pinEl = ev.currentTarget;
            const $pinEl = $(pinEl);
            const pinId = $pinEl.data("pinid");
            const pointerId = ev.pointerId;

            try {
                pinEl.setPointerCapture(pointerId);
            } catch { }

            this._pinDrag.active = true;
            this._pinDrag.pinId = pinId;
            this._pinDrag.startX = ev.clientX;
            this._pinDrag.startY = ev.clientY;
            this._pinDrag.didDrag = false;

            {
                const r = mapWrap.getBoundingClientRect();
                const pinXPx = parseFloat(pinEl.style.left) || 0;
                const pinYPx = parseFloat(pinEl.style.top)  || 0;
                const curXLayout = (ev.clientX - r.left) / r.width  * mapWrap.offsetWidth;
                const curYLayout = (ev.clientY - r.top)  / r.height * mapWrap.offsetHeight;
                this._pinDrag.offsetXPx = pinXPx - curXLayout;
                this._pinDrag.offsetYPx = pinYPx - curYLayout;
            }

            $pinEl.css("opacity", "0.6");

            const onMove = (ev2) => {
                if (!this._pinDrag.active) return;
                if (ev2.pointerId !== pointerId) return;

                const dx = ev2.clientX - this._pinDrag.startX;
                const dy = ev2.clientY - this._pinDrag.startY;
                if (!this._pinDrag.didDrag && Math.hypot(dx, dy) > 3) this._pinDrag.didDrag = true;

                const r = mapWrap.getBoundingClientRect();
                const xPx = clamp((ev2.clientX - r.left) / r.width  * mapWrap.offsetWidth  + this._pinDrag.offsetXPx, 0, mapWrap.offsetWidth);
                const yPx = clamp((ev2.clientY - r.top)  / r.height * mapWrap.offsetHeight + this._pinDrag.offsetYPx, 0, mapWrap.offsetHeight);
                $pinEl.css({ left: `${xPx}px`, top: `${yPx}px` });
            };

            const onUp = async (ev2) => {
                if (ev2.pointerId !== pointerId) return;

                $(document).off("pointermove.lrMapDrag", onMove);
                $(document).off("pointerup.lrMapDrag pointercancel.lrMapDrag", onUp);

                try {
                    pinEl.releasePointerCapture(pointerId);
                } catch { }

                $pinEl.css("opacity", "");

                const didDrag = this._pinDrag.didDrag;
                const r = mapWrap.getBoundingClientRect();
                const xPx = clamp((ev2.clientX - r.left) / r.width  * mapWrap.offsetWidth  + this._pinDrag.offsetXPx, 0, mapWrap.offsetWidth);
                const yPx = clamp((ev2.clientY - r.top)  / r.height * mapWrap.offsetHeight + this._pinDrag.offsetYPx, 0, mapWrap.offsetHeight);
                const ir  = computeImageRect(mapWrap.offsetWidth, mapWrap.offsetHeight, this._imgNaturalW, this._imgNaturalH);
                const xPct = clamp(((xPx - ir.offsetX) / ir.displayW) * 100, 0, 100);
                const yPct = clamp(((yPx - ir.offsetY) / ir.displayH) * 100, 0, 100);

                this._pinDrag.active = false;
                this._pinDrag.pinId = null;

                const pins = await loadPinsForTab(this.activeTab);
                const idx = pins.findIndex((p) => p.id === pinId);
                if (idx === -1) return;

                if (didDrag) {
                    pins[idx].xPct   = xPct;
                    pins[idx].yPct   = yPct;
                    pins[idx].coordV = 1;
                    await savePinsForTab(this.activeTab, pins);
                    await this.renderPins(this._htmlRef);
                    return;
                }

                const pin = pins[idx];
                const res = await this._pinDialog({ pin, isNew: false });
                if (!res || res === "cancel") return;

                if (res?.action === "delete") {
                    const ok = await Dialog.confirm({
                        title: game.i18n.localize("lore-reference-board.Pin.RemoveTitle"),
                        content: `<p>${game.i18n.localize("lore-reference-board.Pin.RemoveContent")}</p>`,
                    });
                    if (!ok) return;

                    await clearLoreForImages(collectPinImages(pin));
                    await clearAllImageJournalLinksForPin(pin.id);
                    pins.splice(idx, 1);
                    await savePinsForTab(this.activeTab, pins);
                    await this.renderPins(this._htmlRef);
                    return;
                }

                if (res?.action === "save") {
                    pins[idx] = { ...pins[idx], ...res.data };
                    await savePinsForTab(this.activeTab, pins);
                    await this.renderPins(this._htmlRef);
                }
            };

            $(document).on("pointermove.lrMapDrag", onMove);
            $(document).on("pointerup.lrMapDrag pointercancel.lrMapDrag", onUp);
        });

        // Right-click delete
        html.find("#lr-map-wrap").on("contextmenu.lrMap", ".lr-pin", async (ev) => {
            if (!this.placingPin) return;

            ev.preventDefault();
            ev.stopPropagation();

            const pinId = $(ev.currentTarget).data("pinid");
            const ok = await Dialog.confirm({
                title:   game.i18n.localize("lore-reference-board.Pin.RemoveTitle"),
                content: game.i18n.localize("lore-reference-board.Pin.RemoveContent"),
            });
            if (!ok) return;

            const pins = await loadPinsForTab(this.activeTab);
            const pinToDelete = pins.find(p => p.id === pinId);
            if (pinToDelete) await clearLoreForImages(collectPinImages(pinToDelete));
            if (pinToDelete) await clearAllImageJournalLinksForPin(pinToDelete.id);
            await savePinsForTab(this.activeTab, pins.filter((p) => p.id !== pinId));
            await this.renderPins(this._htmlRef);
        });

        if (this._cachedActiveTabImg) {
            const _img = new Image();
            _img.onload = () => {
                this._imgNaturalW = _img.naturalWidth;
                this._imgNaturalH = _img.naturalHeight;
                if (!this._mapResizeObs) {
                    const viewport = html.find(".lr-map-viewport")[0];
                    if (viewport) {
                        this._mapResizeObs = new ResizeObserver(() => {
                            if (this._panzoom) this._panzoom.reset({ animate: false });
                            this.renderPins(this._htmlRef).catch(() => {});
                        });
                        this._mapResizeObs.observe(viewport);
                    }
                }
                this.renderPins(this._htmlRef).catch(err =>
                    console.error("[lore-reference-board] renderPins failed", err)
                );
            };
            _img.onerror = () => {
                this._imgNaturalW = 0;
                this._imgNaturalH = 0;
                this.renderPins(this._htmlRef).catch(err =>
                    console.error("[lore-reference-board] renderPins failed", err)
                );
            };
            _img.src = this._cachedActiveTabImg;
        } else {
            this._imgNaturalW = 0;
            this._imgNaturalH = 0;
        }
    }

    // Document tab rendering
    async _setupDocumentTab(html, tab) {
        const pane = html.find("#lr-doc-pane")[0];
        if (!pane) return;

        const tabId   = tab.id;
        const docType = tab.docType ?? null;
        const docRef  = tab.docRef  ?? null;

        const saveDocToTab = async (newDocType, newDocRef) => {
            const all = await loadTabs();
            const idx = all.findIndex(t => t.id === tabId);
            if (idx === -1) return;
            all[idx].docType = newDocType;
            all[idx].docRef  = newDocRef;
            await saveTabs(all);
        };

        // STATE 1: Unlinked
        if (!docType) {
            pane.innerHTML = `
              <div class="lrt-doc-dropzone" id="lrt-doc-dz-${tabId}">
                <div class="lrt-doc-dz-section lrt-doc-dz-journal">
                  <i class="fas fa-book-open lrt-doc-drop-icon"></i>
                  <p class="lrt-doc-drop-primary">${game.i18n.localize("lore-reference-board.DocumentTab.DropText")}</p>
                </div>
                <div class="lrt-doc-section-divider">
                  <span>${game.i18n.localize("lore-reference-board.DocumentTab.OrCreate")}</span>
                </div>
                <div class="lrt-doc-dz-section">
                  <button type="button" class="lrt-doc-create-btn" id="lrt-doc-create-${tabId}">
                    <i class="fas fa-plus"></i>
                    ${game.i18n.localize("lore-reference-board.DocumentTab.CreateEntry")}
                  </button>
                </div>
                <div class="lrt-doc-section-divider">
                  <span>${game.i18n.localize("lore-reference-board.DocumentTab.OrBrowse")}</span>
                </div>
                <div class="lrt-doc-dz-section">
                  <p class="lrt-doc-browse-label">${game.i18n.localize("lore-reference-board.DocumentTab.LoadFileLabel")}</p>
                  <p class="lrt-doc-browse-types">${game.i18n.localize("lore-reference-board.DocumentTab.SupportedTypes")}</p>
                  <button type="button" class="lrt-doc-browse-btn" id="lrt-doc-browse-${tabId}">
                    <i class="fas fa-folder-open"></i>
                    ${game.i18n.localize("lore-reference-board.DocumentTab.BrowseFile")}
                  </button>
                  <p class="lrt-doc-paste-hint">${game.i18n.localize("lore-reference-board.DocumentTab.PastePathHint")}</p>
                  <div class="lrt-doc-path-row">
                    <input type="text" class="lrt-doc-path-input" id="lrt-doc-path-${tabId}"
                           placeholder="${game.i18n.localize("lore-reference-board.DocumentTab.PathPlaceholder")}" />
                    <button type="button" class="lrt-doc-load-btn" id="lrt-doc-load-${tabId}">
                      ${game.i18n.localize("lore-reference-board.DocumentTab.BtnLoad")}
                    </button>
                  </div>
                </div>
              </div>
            `;

            const dz = pane.querySelector(`#lrt-doc-dz-${tabId}`);

            // Journal drag-drop with depth counter
            let dragDepth = 0;
            dz.addEventListener("dragenter", ev => { ev.preventDefault(); dragDepth++; dz.classList.add("lrt-drop-active"); });
            dz.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dz.classList.remove("lrt-drop-active"); });
            dz.addEventListener("dragover",  ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = "link"; });
            dz.addEventListener("drop", async ev => {
                ev.preventDefault();
                dragDepth = 0;
                dz.classList.remove("lrt-drop-active");

                let data;
                try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                catch { ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.DropReadFail")); return; }

                let journalId = null;
                if (data.type === "JournalEntry") {
                    const entry = await fromUuid(data.uuid ?? "").catch(() => null);
                    journalId = entry?.id ?? null;
                } else if (data.type === "JournalEntryPage") {
                    const page = await fromUuid(data.uuid ?? "").catch(() => null);
                    journalId = page?.parent?.id ?? null;
                }

                if (!journalId) { ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.DropWarn")); return; }
                await saveDocToTab("journal", journalId);
                await this.render(true);
            });

            // Create new journal entry button.
            pane.querySelector(`#lrt-doc-create-${tabId}`)?.addEventListener("click", async () => {
                const defaultName = tab.name || game.i18n.localize("lore-reference-board.Pin.LoreEntryDefault");
                const nameUid     = foundry.utils.randomID();
                const nameInputId = `lrt-dn-${nameUid}`;

                let chosenName;
                try {
                    chosenName = await new Promise((resolve, reject) => {
                        let clicked = false;
                        new Dialog({
                            title: game.i18n.localize("lore-reference-board.Lore.NameEntryTitle"),
                            content: `<form>
                                <div style="padding:6px 0">
                                    <label style="display:block;margin-bottom:4px;font-weight:bold">
                                        ${game.i18n.localize("lore-reference-board.Lore.JournalEntryName")}
                                    </label>
                                    <input id="${nameInputId}" name="${nameInputId}" type="text"
                                           value="${escapeHtml(defaultName)}"
                                           style="width:100%" autofocus />
                                </div>
                            </form>`,
                            buttons: {
                                create: {
                                    label: game.i18n.localize("lore-reference-board.Common.Create"),
                                    callback: (dlgHtml) => {
                                        clicked = true;
                                        resolve(dlgHtml[0].querySelector(`#${nameInputId}`)?.value?.trim() || defaultName);
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
                        text: { content: "", format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML },
                    }],
                });
                if (!entry) return;

                await saveDocToTab("journal", entry.id);
                await this.render(true);
                entry.sheet.render(true);
            });

            // File browse button
            pane.querySelector(`#lrt-doc-browse-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath();
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) {
                    await saveDocToTab(newType, picked);
                    await this.render(true);
                } else {
                    ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
                }
            });

            // Manual path input, handles all types including HTML, DOCX, and URLs.
            const loadPath = async () => {
                const input = pane.querySelector(`#lrt-doc-path-${tabId}`);
                const rawPath = normalizeLrbPath(input?.value ?? "");
                if (!rawPath) return;
                const newType = _lrbIsUrl(rawPath) ? "url" : _lrbDocTypeForExt(rawPath.split(".").pop());
                if (newType) {
                    await saveDocToTab(newType, rawPath);
                    await this.render(true);
                } else {
                    ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
                }
            };
            pane.querySelector(`#lrt-doc-load-${tabId}`)?.addEventListener("click", loadPath);
            pane.querySelector(`#lrt-doc-path-${tabId}`)?.addEventListener("keydown", ev => {
                if (ev.key === "Enter") { ev.preventDefault(); loadPath(); }
            });

            return;
        }

        // STATE 2: Journal linked
        if (docType === "journal") {
            let entry = game.journal.get(docRef);
            if (!entry) {
                try { entry = await fromUuid(`JournalEntry.${docRef}`); } catch { entry = null; }
            }

            if (!entry) {
                pane.innerHTML = `
                  <div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${game.i18n.localize("lore-reference-board.DocumentTab.NotFound")}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-unlink-${tabId}">
                      <i class="fas fa-unlink"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Unlink")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-unlink-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await this.render(true);
                });
                return;
            }

            // Render first page, type sorted
            const pages     = getJournalPages(entry);
            const firstPage = pages[0] ?? null;
            let enriched;
            try { enriched = await enrichJournalPage(firstPage, entry); }
            catch { enriched = '<p style="color:#888;font-style:italic">Could not render page.</p>'; }

            const pageNavHtml = pages.length > 1 ? `
              <div class="lrt-doc-page-nav">
                <i class="fas fa-book-open" style="color:#888;font-size:11px;flex-shrink:0"></i>
                <select class="lrt-doc-page-sel" id="lrt-doc-psel-${tabId}">
                  ${pages.map((p, i) => `<option value="${i}">${escapeHtml(p.name || `Page ${i + 1}`)}</option>`).join("")}
                </select>
              </div>` : "";

            pane.innerHTML = `
              <div class="lrt-doc-linked-bar">
                <i class="fas fa-book lrt-doc-linked-icon"></i>
                <span class="lrt-doc-linked-title">${escapeHtml(entry.name)}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--edit" id="lrt-doc-edit-${tabId}">
                  <i class="fas fa-edit"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Edit")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-unlink-${tabId}">
                  <i class="fas fa-unlink"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Unlink")}
                </button>
              </div>
              ${pageNavHtml}
              <div class="lrt-doc-journal-content" id="lrt-doc-content-${tabId}">${enriched}</div>`;

            pane.querySelector(`#lrt-doc-edit-${tabId}`)?.addEventListener("click", () => entry.sheet.render(true));
            pane.querySelector(`#lrt-doc-unlink-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await this.render(true);
            });

            // enrichJournal Page switcher
            let currentPageIndex = 0;
            pane.querySelector(`#lrt-doc-psel-${tabId}`)?.addEventListener("change", async ev => {
                currentPageIndex = parseInt(ev.target.value) || 0;
                const page = pages[currentPageIndex];
                let enriched2;
                try { enriched2 = await enrichJournalPage(page, entry); }
                catch { enriched2 = '<p style="color:#888;font-style:italic">Could not render page.</p>'; }
                const contentEl = pane.querySelector(`#lrt-doc-content-${tabId}`);
                if (contentEl) contentEl.innerHTML = enriched2;
            });

            // Live update when any page in this journal changes
            const hookId = Hooks.on("updateJournalEntryPage", async (updatedPage) => {
                if (updatedPage.parent?.id !== docRef) return;
                if (updatedPage.id !== pages[currentPageIndex]?.id) return;
                let enriched3;
                try { enriched3 = await enrichJournalPage(updatedPage, entry); }
                catch { enriched3 = '<p style="color:#888;font-style:italic">Could not render page.</p>'; }
                const contentEl = pane.querySelector(`#lrt-doc-content-${tabId}`);
                if (contentEl) contentEl.innerHTML = enriched3;
            });
            // Clean up hook when board re-renders.
            Hooks.once("renderLoreReferenceBoardApp", () => Hooks.off("updateJournalEntryPage", hookId));
            return;
        }

        // STATE 3: PDF embedded
        if (docType === "pdf") {
            let blobUrl = null;
            try {
                const resp = await fetch(docRef);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const blob = await resp.blob();
                blobUrl = URL.createObjectURL(blob);
            } catch {
                pane.innerHTML = `<div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${game.i18n.localize("lore-reference-board.DocumentTab.LoadFail")}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                      <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await this.render(true);
                });
                return;
            }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-file-pdf lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-pdf-wrapper">
                <iframe class="lrt-doc-pdf-frame" src="${blobUrl}" title="${escapeHtml(docRef.split("/").pop())}"></iframe>
              </div>`;

            // Revoke the blob URL when the board re-renders
            Hooks.once("renderLoreReferenceBoardApp", () => {
                if (blobUrl) URL.revokeObjectURL(blobUrl);
            });

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 4: embedded txt
        if (docType === "txt") {
            let fileContent = "";
            try {
                const resp = await fetch(docRef);
                if (!resp.ok) throw new Error("fetch failed");
                fileContent = await resp.text();
            } catch {
                pane.innerHTML = `<div class="lrt-doc-not-found"><p>${game.i18n.localize("lore-reference-board.DocumentTab.LoadFail")}</p></div>`;
                return;
            }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-file-alt lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-txt-wrapper">
                <pre class="lrt-doc-txt-content">${escapeHtml(fileContent)}</pre>
              </div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 5: Standalone image
        if (docType === "image") {
            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-image lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-image-wrapper">
                <img class="lrt-doc-standalone-img" src="${escapeHtml(docRef)}" alt="${escapeHtml(docRef.split("/").pop())}" />
              </div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 6: Markdown
        if (docType === "md") {
            let mdText = "";
            try {
                const resp = await fetch(docRef);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                mdText = await resp.text();
            } catch {
                pane.innerHTML = `<div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${game.i18n.localize("lore-reference-board.DocumentTab.LoadFail")}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                      <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await this.render(true);
                });
                return;
            }

            let htmlContent;
            try { htmlContent = window.marked?.parse(mdText) ?? `<pre>${escapeHtml(mdText)}</pre>`; }
            catch { htmlContent = `<pre>${escapeHtml(mdText)}</pre>`; }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-file-lines lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-journal-content lrt-doc-md-content">${htmlContent}</div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 7: HTML file
        if (docType === "html") {
            let blobUrl = null;
            try {
                const resp = await fetch(docRef);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const htmlText = await resp.text();
                const blob = new Blob([htmlText], { type: "text/html" });
                blobUrl = URL.createObjectURL(blob);
            } catch {
                pane.innerHTML = `<div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${game.i18n.localize("lore-reference-board.DocumentTab.LoadFail")}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                      <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await this.render(true);
                });
                return;
            }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-code lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-pdf-wrapper">
                <iframe class="lrt-doc-pdf-frame" src="${blobUrl}" title="${escapeHtml(docRef.split("/").pop())}"></iframe>
              </div>`;

            Hooks.once("renderLoreReferenceBoardApp", () => { if (blobUrl) URL.revokeObjectURL(blobUrl); });

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { if (blobUrl) URL.revokeObjectURL(blobUrl); await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 8: DOCX
        if (docType === "docx") {
            let htmlContent = "";
            try {
                const resp = await fetch(docRef);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const arrayBuffer = await resp.arrayBuffer();
                if (!window.mammoth) throw new Error("mammoth.js not yet loaded,  reload Foundry and try again");
                const result = await window.mammoth.convertToHtml({ arrayBuffer });
                htmlContent = result.value || '<p style="color:#888;font-style:italic">Document appears to be empty.</p>';
            } catch (err) {
                const msg = err?.message ?? game.i18n.localize("lore-reference-board.DocumentTab.LoadFail");
                pane.innerHTML = `<div class="lrt-doc-not-found">
                    <i class="fas fa-exclamation-triangle lrt-doc-warn-icon"></i>
                    <p>${escapeHtml(msg)}</p>
                    <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                      <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                    </button>
                  </div>`;
                pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                    await saveDocToTab(null, null); await this.render(true);
                });
                return;
            }

            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-file-word lrt-doc-file-icon"></i>
                <span class="lrt-doc-file-name">${escapeHtml(docRef.split("/").pop())}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-change-${tabId}">
                  <i class="fas fa-folder-open"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Change")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <div class="lrt-doc-journal-content lrt-doc-docx-content">${htmlContent}</div>`;

            pane.querySelector(`#lrt-doc-change-${tabId}`)?.addEventListener("click", async () => {
                const picked = await pickDocFilePath(docRef);
                if (!picked) return;
                const newType = _lrbDocTypeForExt(picked.split(".").pop());
                if (newType) { await saveDocToTab(newType, picked); await this.render(true); }
                else ui.notifications.warn(game.i18n.localize("lore-reference-board.DocumentTab.UnsupportedFile"));
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null); await this.render(true);
            });
            return;
        }

        // STATE 9: Web URL,  iframe
        if (docType === "url") {
            const shortUrl = docRef.length > 60 ? docRef.slice(0, 57) + "…" : docRef;
            pane.innerHTML = `
              <div class="lrt-doc-file-bar">
                <i class="fas fa-globe lrt-doc-file-icon"></i>
                <span class="lrt-doc-url-label" title="${escapeHtml(docRef)}">${escapeHtml(shortUrl)}</span>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--open-url" id="lrt-doc-openurl-${tabId}">
                  <i class="fas fa-external-link-alt"></i>
                  ${game.i18n.localize("lore-reference-board.DocumentTab.BtnOpenInBrowser")}
                </button>
                <button type="button" class="lrt-doc-btn lrt-doc-btn--unlink" id="lrt-doc-remove-${tabId}">
                  <i class="fas fa-times"></i> ${game.i18n.localize("lore-reference-board.DocumentTab.Remove")}
                </button>
              </div>
              <iframe class="lrt-doc-url-frame" src="${escapeHtml(docRef)}"
                      title="${escapeHtml(docRef)}"></iframe>`;

            pane.querySelector(`#lrt-doc-openurl-${tabId}`)?.addEventListener("click", () => {
                window.open(docRef, "_blank");
            });
            pane.querySelector(`#lrt-doc-remove-${tabId}`)?.addEventListener("click", async () => {
                await saveDocToTab(null, null);
                await this.render(true);
            });
            return;
        }
    }

    // Reference Tab Render
    static REF_DOC_CFG = {
        Actor:        { icon: "fa-person",     badgeKey: "TypeBadgeActor",     imgFn: d => d.img,                        buttons: ["open"] },
        Cards:        { icon: "fa-layer-group",badgeKey: "TypeBadgeCards",     imgFn: d => d.img,                        buttons: ["open", "shuffle", "deal"] },
        Item:         { icon: "fa-suitcase",   badgeKey: "TypeBadgeItem",      imgFn: d => d.img,                        buttons: ["open"] },
        JournalEntry: { icon: "fa-book-open",  badgeKey: "TypeBadgeJournal",   imgFn: d => null,                         buttons: ["open"] },
        Macro:        { icon: "fa-code",       badgeKey: "TypeBadgeMacro",     imgFn: d => d.img,                        buttons: ["open", "execute"] },
        Playlist:     { icon: "fa-music",      badgeKey: "TypeBadgePlaylist",  imgFn: d => null,                         buttons: ["open"] },
        RollTable:    { icon: "fa-table-list", badgeKey: "TypeBadgeRollTable", imgFn: d => d.img,                        buttons: ["open", "roll"] },
        Scene:        { icon: "fa-map",        badgeKey: "TypeBadgeScene",     imgFn: d => d.thumb ?? d.background?.src, buttons: ["open", "activate"] },
    };

    static REF_ACCEPTED_TYPES = new Set(["Actor", "Cards", "Item", "JournalEntry", "JournalEntryPage", "Macro", "Playlist", "RollTable", "Scene"]);

    async _setupReferenceTab(html, tab) {
        const pane = html.find("#lr-ref-pane")[0];
        if (!pane) return;

        const COLS  = 4;
        const tabId = tab.id;
        const L  = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);
        const LG = key => game.i18n.localize(`lore-reference-board.ReferenceGrid.${key}`);

        let cells = Array.isArray(tab.cells) ? tab.cells : [];
        if (cells.length === 0 && tab.docUuid) {
            cells = [{
                id: foundry.utils.randomID(),
                row: 1, col: 1, rowSpan: 1, colSpan: 1,
                docUuid: tab.docUuid, docType: tab.docType,
            }];
            const all = await loadTabs();
            const idx = all.findIndex(t => t.id === tabId);
            if (idx !== -1) {
                all[idx].cells = cells;
                delete all[idx].docUuid;
                delete all[idx].docType;
                await saveTabs(all);
            }
        }

        // Resolve all docs in parallel
        const resolved = await Promise.all(cells.map(async cell => {
            if (!cell.docUuid) return { cell, doc: null };
            let doc = null;
            try { doc = await fromUuid(cell.docUuid); } catch {}
            return { cell, doc };
        }));
        const docMap = new Map(resolved.map(({ cell, doc }) => [cell.id, doc]));

        // Calculate grid dimensions
        let maxRow = 0;
        for (const c of cells) maxRow = Math.max(maxRow, c.row + c.rowSpan - 1);
        const gridRows = maxRow + 3; // three extra empty rows at bottom

        // Build occupied-position set
        const buildOccupied = (cellList, excludeId = null) => {
            const set = new Set();
            for (const c of cellList) {
                if (c.id === excludeId) continue;
                for (let r = c.row; r < c.row + c.rowSpan; r++)
                    for (let cc = c.col; cc < c.col + c.colSpan; cc++)
                        set.add(`${r},${cc}`);
            }
            return set;
        };
        const occupied = buildOccupied(cells);

        // Empty positions
        const emptyPositions = [];
        for (let r = 1; r <= gridRows; r++)
            for (let c = 1; c <= COLS; c++)
                if (!occupied.has(`${r},${c}`)) emptyPositions.push({ row: r, col: c });

        // Render occupied cells
        const INLINE_TYPES = new Set(["JournalEntry", "RollTable"]);

        const cellsHtml = resolved.map(({ cell, doc }) => {
            const gs = `grid-column:${cell.col}/span ${cell.colSpan};grid-row:${cell.row}/span ${cell.rowSpan};`;

            // PDF / TXT / Markdown
            if (cell.docType === "file") {
                const fileName  = (cell.filePath ?? "").split("/").pop() || "File";
                const fType     = cell.fileType ?? "txt";
                const typeKey   = `file-${fType}`;
                const badgeLabel = fType === "pdf" ? LG("FileCellBadgePdf")
                                 : fType === "md"  ? LG("FileCellBadgeMd")
                                 :                   LG("FileCellBadgeTxt");
                return `
                <div class="lrt-ref-cell lrt-ref-cell--inline-content" style="${gs}" data-cell-id="${cell.id}">
                  <div class="lrt-ref-cell-header">
                    <span class="lrt-ref-type-badge lrt-ref-badge--${escapeHtml(typeKey)}">${escapeHtml(badgeLabel)}</span>
                    <span class="lrt-ref-cell-hdr-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</span>
                    <div class="lrt-ref-cell-hdr-btns"></div>
                    <button type="button" class="lrt-ref-cell-edit-btn" data-cell-id="${cell.id}" title="${LG("EditCellTitle")}">
                      <i class="fas fa-pencil-alt"></i>
                    </button>
                  </div>
                  <div class="lrt-ref-cell-content lrt-ref-cell-content--file" data-cell-id="${cell.id}" data-file-type="${escapeHtml(fType)}">
                    <p style="color:#555;font-style:italic;font-size:11px;padding:4px 0">Loading…</p>
                  </div>
                </div>`;
            }

            if (!cell.docUuid || !doc) {
                return `
                <div class="lrt-ref-cell lrt-ref-cell--error" style="${gs}" data-cell-id="${cell.id}">
                  <div class="lrt-ref-cell-header">
                    <i class="fas fa-exclamation-triangle lrt-ref-cell-warn"></i>
                    <button type="button" class="lrt-ref-cell-edit-btn" data-cell-id="${cell.id}" title="${LG("EditCellTitle")}">
                      <i class="fas fa-pencil-alt"></i>
                    </button>
                  </div>
                  <div class="lrt-ref-cell-body">
                    <p class="lrt-ref-cell-error-msg">${L("NotFound")}</p>
                  </div>
                </div>`;
            }

            const cfg     = LoreReferenceBoardApp.REF_DOC_CFG[cell.docType] ??
                { icon: "fa-link", badgeKey: "TypeBadgeActor", imgFn: () => null, buttons: ["open"] };
            const badge   = L(cfg.badgeKey);
            const typeKey = cell.docType ?? "unknown";

            // Inline-content variant: Journal + RollTable
            if (INLINE_TYPES.has(cell.docType)) {
                let hdrBtnsHtml = "";
                if (cell.docType === "JournalEntry") {
                    hdrBtnsHtml = `<button type="button" class="lrt-ref-hdr-btn lrt-ref-hdr-btn--open" data-cell-id="${cell.id}" title="${L("BtnOpen")}"><i class="fas fa-external-link-alt"></i> ${L("BtnOpen")}</button>`;
                } else if (cell.docType === "RollTable") {
                    hdrBtnsHtml = `
                        <button type="button" class="lrt-ref-hdr-btn lrt-ref-hdr-btn--roll" data-cell-id="${cell.id}" title="${L("BtnRoll")}"><i class="fas fa-dice-d20"></i> ${L("BtnRoll")}</button>
                        <button type="button" class="lrt-ref-hdr-btn lrt-ref-hdr-btn--open" data-cell-id="${cell.id}" title="${L("BtnOpen")}"><i class="fas fa-external-link-alt"></i></button>`;
                }
                return `
                <div class="lrt-ref-cell lrt-ref-cell--inline-content" style="${gs}" data-cell-id="${cell.id}">
                  <div class="lrt-ref-cell-header">
                    <span class="lrt-ref-type-badge lrt-ref-badge--${typeKey}">${escapeHtml(badge)}</span>
                    <span class="lrt-ref-cell-hdr-name" title="${escapeHtml(doc.name ?? "")}">${escapeHtml(doc.name ?? "")}</span>
                    <div class="lrt-ref-cell-hdr-btns">${hdrBtnsHtml}</div>
                    <button type="button" class="lrt-ref-cell-edit-btn" data-cell-id="${cell.id}" title="${LG("EditCellTitle")}">
                      <i class="fas fa-pencil-alt"></i>
                    </button>
                  </div>
                  <div class="lrt-ref-cell-content" data-cell-id="${cell.id}" data-doc-type="${typeKey}">
                    <p style="color:#555;font-style:italic;font-size:11px;padding:4px 0">Loading…</p>
                  </div>
                </div>`;
            }

            // Standard card variant: Actor, Item, Macro, Playlist, Scene, Cards
            const imgSrc  = cfg.imgFn(doc);
            const showImg = !!imgSrc && cell.rowSpan >= 2;

            const btnHtml = cfg.buttons.map(b => {
                switch (b) {
                    case "open":     return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--open"     data-cell-id="${cell.id}"><i class="fas fa-external-link-alt"></i> ${L("BtnOpen")}</button>`;
                    case "execute":  return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--exec"     data-cell-id="${cell.id}"><i class="fas fa-play"></i> ${L("BtnExecute")}</button>`;
                    case "roll":     return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--roll"     data-cell-id="${cell.id}"><i class="fas fa-dice-d20"></i> ${L("BtnRoll")}</button>`;
                    case "activate": return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--activate" data-cell-id="${cell.id}"><i class="fas fa-eye"></i> ${L("BtnActivateScene")}</button>`;
                    case "shuffle":  return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--shuffle lrt-ref-cell-btn--icon" data-cell-id="${cell.id}" title="${L("BtnShuffle")}"><i class="fas fa-shuffle"></i></button>`;
                    case "deal":     return `<button type="button" class="lrt-ref-cell-btn lrt-ref-cell-btn--deal    lrt-ref-cell-btn--icon" data-cell-id="${cell.id}" title="${L("BtnDeal")}"><i class="fas fa-hand-holding"></i></button>`;
                    default: return "";
                }
            }).join("");

            return `
            <div class="lrt-ref-cell" style="${gs}" data-cell-id="${cell.id}">
              <div class="lrt-ref-cell-header">
                <span class="lrt-ref-type-badge lrt-ref-badge--${typeKey}">${escapeHtml(badge)}</span>
                <button type="button" class="lrt-ref-cell-edit-btn" data-cell-id="${cell.id}" title="${LG("EditCellTitle")}">
                  <i class="fas fa-pencil-alt"></i>
                </button>
              </div>
              <div class="lrt-ref-cell-body">
                ${showImg ? `<div class="lrt-ref-cell-img-wrap"><img class="lrt-ref-cell-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(doc.name ?? "")}" /></div>` : ""}
                <div class="lrt-ref-cell-info">
                  <div class="lrt-ref-cell-name">${escapeHtml(doc.name ?? "")}</div>
                  <div class="lrt-ref-cell-actions">${btnHtml}</div>
                </div>
              </div>
            </div>`;
        }).join("");

        // Render empty placeholder cells
        const emptyCellsHtml = emptyPositions.map(pos =>
            `<div class="lrt-ref-empty-cell" style="grid-column:${pos.col};grid-row:${pos.row};" data-row="${pos.row}" data-col="${pos.col}">
               <button type="button" class="lrt-ref-add-btn" data-row="${pos.row}" data-col="${pos.col}">
                 <i class="fas fa-plus"></i>
               </button>
             </div>`
        ).join("");

        pane.innerHTML = `<div class="lrt-ref-grid" id="lrt-ref-grid-${tabId}">${cellsHtml}${emptyCellsHtml}</div>`;

        // Async: inject inline content for Journal, RollTable, and file cells
        for (const { cell, doc } of resolved) {
            // File cells have no doc,  handle before the doc guard below.
            if (cell.docType === "file") {
                const contentEl = pane.querySelector(`.lrt-ref-cell-content[data-cell-id="${cell.id}"]`);
                if (!contentEl) continue;
                const fPath = cell.filePath ?? "";
                const fType = cell.fileType ?? "txt";
                (async () => {
                    try {
                        const resp = await fetch(fPath);
                        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                        if (fType === "pdf") {
                            const blob   = await resp.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            contentEl.innerHTML = `<iframe class="lrt-ref-cell-iframe" src="${blobUrl}" title="${escapeHtml(fPath.split("/").pop())}"></iframe>`;
                            Hooks.once("renderLoreReferenceBoardApp", () => URL.revokeObjectURL(blobUrl));
                        } else if (fType === "md") {
                            const mdText = await resp.text();
                            let html;
                            try   { html = window.marked?.parse(mdText) ?? `<pre>${escapeHtml(mdText)}</pre>`; }
                            catch { html = `<pre>${escapeHtml(mdText)}</pre>`; }
                            contentEl.innerHTML = html;
                        } else {
                            // txt (and any other unrecognised type)
                            const text = await resp.text();
                            contentEl.innerHTML = `<pre class="lrt-doc-txt-content">${escapeHtml(text)}</pre>`;
                        }
                    } catch {
                        contentEl.innerHTML = `<p class="lrt-ref-cell-load-fail">${LG("FileCellLoadFail")}</p>`;
                    }
                })().catch(err =>
                    console.error("[lore-reference-board] File cell render error:", err));
                continue;
            }

            if (!doc) continue;
            const contentEl = pane.querySelector(`.lrt-ref-cell-content[data-cell-id="${cell.id}"]`);
            if (!contentEl) continue;   // not an inline-content cell

            if (cell.docType === "JournalEntry") {
                (async () => {
                    const pages     = getJournalPages(doc);
                    const firstPage = pages[0] ?? null;
                    contentEl.innerHTML = await enrichJournalPage(firstPage, doc);
                    // Inject page-nav bar above the content area if the journal has multiple pages.
                    // Pass doc.uuid so compendium journals (e.g. Compendium.pf2e.journals.JournalEntry.xxx)
                    // are resolved correctly,  game.journal.get() only finds world entries.
                    await wirePageNav(contentEl, doc.uuid);
                })().catch(err =>
                    console.error("[lore-reference-board] Journal cell render error:", err));
            } else if (cell.docType === "RollTable") {
                contentEl.innerHTML = _renderRollTableHtml(doc);
            }
        }

        // Wire action buttons (standard card cells)
        pane.querySelectorAll(".lrt-ref-cell-btn--open").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.sheet.render(true));
        });
        pane.querySelectorAll(".lrt-ref-cell-btn--exec").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.execute?.({}));
        });
        pane.querySelectorAll(".lrt-ref-cell-btn--roll").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.draw?.());
        });
        pane.querySelectorAll(".lrt-ref-cell-btn--activate").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.activate?.());
        });
        pane.querySelectorAll(".lrt-ref-cell-btn--shuffle").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.shuffle?.());
        });
        pane.querySelectorAll(".lrt-ref-cell-btn--deal").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => this._dealCardsDialog(doc));
        });

        // Wire inline header buttons (Journal / RollTable cells)
        pane.querySelectorAll(".lrt-ref-hdr-btn--open").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", () => doc.sheet.render(true));
        });
        pane.querySelectorAll(".lrt-ref-hdr-btn--roll").forEach(btn => {
            const doc = docMap.get(btn.dataset.cellId);
            if (doc) btn.addEventListener("click", async () => {
                await doc.draw?.();
                // Refresh the table display to reflect newly drawn entries
                const contentEl = pane.querySelector(`.lrt-ref-cell-content[data-cell-id="${btn.dataset.cellId}"]`);
                if (contentEl) contentEl.innerHTML = _renderRollTableHtml(doc);
            });
        });

        // Wire edit buttons
        pane.querySelectorAll(".lrt-ref-cell-edit-btn").forEach(btn => {
            btn.addEventListener("click", () =>
                this._editRefCellDialog(tabId, btn.dataset.cellId));
        });

        // Wire add buttons
        pane.querySelectorAll(".lrt-ref-add-btn").forEach(btn => {
            btn.addEventListener("click", () =>
                this._addRefCellDialog(tabId, parseInt(btn.dataset.row), parseInt(btn.dataset.col)));
        });
    }

    // Helper: build span-picker HTML,  shows the actual 4-column grid
    // existingCells: current cells array (to mark occupied positions)
    // maxRows: number of rows to show in the picker
    // excludeId: cell id to treat as free (used in edit dialog for the cell being edited)
    _buildSpanPickerHtml(existingCells, maxRows, excludeId = null) {
        const COLS = 4;
        const occupied = new Set();
        for (const c of existingCells) {
            if (c.id === excludeId) continue;
            for (let r = c.row; r < c.row + c.rowSpan; r++)
                for (let cc = c.col; cc < c.col + c.colSpan; cc++)
                    occupied.add(`${r},${cc}`);
        }
        let html = "";
        for (let r = 1; r <= maxRows; r++)
            for (let c = 1; c <= COLS; c++) {
                const occ = occupied.has(`${r},${c}`) ? " lrt-span-cell--occupied" : "";
                html += `<div class="lrt-span-cell${occ}" data-row="${r}" data-col="${c}"></div>`;
            }
        return html;
    }

    // Helper: wire span-picker interaction
    // Two-click: first click sets the anchor corner, second click sets the opposite corner.
    // Any free rectangle can be drawn,  not anchored to the "+" cell position.
    // Returns { getSpan() } → { row, col, rowSpan, colSpan } | null
    _initSpanPicker(pickerEl, sizeEl, existingCells, initialRow, initialCol, excludeId = null) {
        const occupied = new Set();
        for (const c of existingCells) {
            if (c.id === excludeId) continue;
            for (let r = c.row; r < c.row + c.rowSpan; r++)
                for (let cc = c.col; cc < c.col + c.colSpan; cc++)
                    occupied.add(`${r},${cc}`);
        }

        const isFreeRect = (r1, c1, r2, c2) => {
            for (let r = r1; r <= r2; r++)
                for (let c = c1; c <= c2; c++)
                    if (occupied.has(`${r},${c}`)) return false;
            return true;
        };

        const allCells = Array.from(pickerEl.querySelectorAll(".lrt-span-cell"));
        const freeCells = allCells.filter(c => !c.classList.contains("lrt-span-cell--occupied"));

        let anchorRow = null, anchorCol = null;
        // Default selection: 1×1 at the suggested position (if free), else null
        let sel = (!occupied.has(`${initialRow},${initialCol}`))
            ? { row: initialRow, col: initialCol, rowSpan: 1, colSpan: 1 }
            : null;

        const updateLabel = () => {
            if (!sizeEl) return;
            if (!sel) { sizeEl.textContent = ""; return; }
            const { colSpan: cs, rowSpan: rs } = sel;
            sizeEl.textContent = `${cs} col${cs > 1 ? "s" : ""} × ${rs} row${rs > 1 ? "s" : ""}`;
        };

        const repaint = (hoverRow = null, hoverCol = null) => {
            allCells.forEach(cell => {
                const r = +cell.dataset.row, c = +cell.dataset.col;
                if (cell.classList.contains("lrt-span-cell--occupied")) return;
                cell.classList.remove("lrt-span-selected", "lrt-span-preview",
                                      "lrt-span-anchor", "lrt-span-invalid");

                // Confirmed selection
                if (sel && r >= sel.row && r < sel.row + sel.rowSpan &&
                           c >= sel.col && c < sel.col + sel.colSpan) {
                    cell.classList.add("lrt-span-selected");
                }

                // Hover preview (only while anchor is set)
                if (anchorRow !== null && hoverRow !== null) {
                    const r1 = Math.min(anchorRow, hoverRow), r2 = Math.max(anchorRow, hoverRow);
                    const c1 = Math.min(anchorCol, hoverCol), c2 = Math.max(anchorCol, hoverCol);
                    if (r >= r1 && r <= r2 && c >= c1 && c <= c2) {
                        cell.classList.remove("lrt-span-selected");
                        cell.classList.add(isFreeRect(r1, c1, r2, c2)
                            ? "lrt-span-preview" : "lrt-span-invalid");
                    }
                }

                // Anchor dot (on top of everything)
                if (anchorRow !== null && r === anchorRow && c === anchorCol) {
                    cell.classList.remove("lrt-span-preview", "lrt-span-invalid",
                                          "lrt-span-selected");
                    cell.classList.add("lrt-span-anchor");
                }
            });
        };

        freeCells.forEach(cell => {
            const r = +cell.dataset.row, c = +cell.dataset.col;
            cell.addEventListener("mouseenter", () => repaint(r, c));
            cell.addEventListener("click", () => {
                if (anchorRow === null) {
                    // First click → set anchor, default to 1×1 selection here
                    anchorRow = r; anchorCol = c;
                    sel = { row: r, col: c, rowSpan: 1, colSpan: 1 };
                    updateLabel();
                    repaint(r, c);
                } else {
                    // Second click → confirm rectangle
                    const r1 = Math.min(anchorRow, r), r2 = Math.max(anchorRow, r);
                    const c1 = Math.min(anchorCol, c), c2 = Math.max(anchorCol, c);
                    anchorRow = null; anchorCol = null;
                    if (isFreeRect(r1, c1, r2, c2)) {
                        sel = { row: r1, col: c1, rowSpan: r2 - r1 + 1, colSpan: c2 - c1 + 1 };
                    }
                    updateLabel();
                    repaint();
                }
            });
        });

        pickerEl.addEventListener("mouseleave", () => repaint());

        repaint();
        updateLabel();

        return { getSpan: () => sel };
    }

    // Helper: collision check
    _refCellCollides(cells, excludeId, row, col, rowSpan, colSpan) {
        const COLS = 4;
        if (col + colSpan - 1 > COLS) return "overflow";
        for (const c of cells) {
            if (c.id === excludeId) continue;
            for (let r = c.row; r < c.row + c.rowSpan; r++)
                for (let cc = c.col; cc < c.col + c.colSpan; cc++)
                    for (let tr = row; tr < row + rowSpan; tr++)
                        for (let tc = col; tc < col + colSpan; tc++)
                            if (r === tr && cc === tc) return "collision";
        }
        return null;
    }

    // Add Cell Dialog
    async _addRefCellDialog(tabId, startRow, startCol) {
        const uid  = foundry.utils.randomID();
        const L  = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);
        const LG = key => game.i18n.localize(`lore-reference-board.ReferenceGrid.${key}`);

        // Load current cells to show occupancy in the picker
        const allTabsInit = await loadTabs();
        const tabIdxInit  = allTabsInit.findIndex(t => t.id === tabId);
        const initCells   = tabIdxInit !== -1 ? (allTabsInit[tabIdxInit].cells ?? []) : [];

        // Calculate picker rows: current grid height + 2 empty rows for expansion
        let maxRow = 0;
        for (const c of initCells) maxRow = Math.max(maxRow, c.row + c.rowSpan - 1);
        const pickerRows = Math.max(maxRow + 3, startRow + 1);

        let pendingUuid     = null;
        let pendingType     = null;
        let pendingFilePath = null;
        let pendingFileType = null;
        let picker          = null;

        const content = `
          <div class="lrt-ref-cell-dialog">
            <div class="lrt-ref-cell-dz" id="lrt-rcd-dz-${uid}">
              <i class="fas fa-link lrt-ref-dz-icon" id="lrt-rcd-icon-${uid}"></i>
              <p class="lrt-ref-dz-primary" id="lrt-rcd-name-${uid}">${LG("DropToLink")}</p>
              <p class="lrt-ref-dz-sub"    id="lrt-rcd-sub-${uid}">${L("DropSubtext")}</p>
            </div>
            <div class="lrt-ref-file-section">
              <div class="lrt-ref-file-divider">${LG("FileCellDivider")}</div>
              <p class="lrt-ref-file-instruct">${LG("FileCellInstruct")}</p>
              <div class="lrt-ref-file-row">
                <input type="text" class="lrt-ref-file-path" id="lrt-rcd-fpath-${uid}"
                       placeholder="${LG("FileCellPathPlaceholder")}" />
                <button type="button" class="lrt-ref-file-browse-btn" id="lrt-rcd-fbrowse-${uid}">
                  <i class="fas fa-folder-open"></i> ${LG("FileCellBrowse")}
                </button>
              </div>
            </div>
            <div class="lrt-ref-span-section">
              <p class="lrt-ref-span-label">${LG("SpanPickerLabel")}</p>
              <p class="lrt-ref-span-hint">${LG("SpanPickerHint")}</p>
              <div class="lrt-span-picker" id="lrt-span-picker-${uid}">${this._buildSpanPickerHtml(initCells, pickerRows)}</div>
              <p class="lrt-span-size-label" id="lrt-span-size-${uid}"></p>
            </div>
          </div>`;

        const result = await new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title:   LG("AddCellTitle"),
                content,
                buttons: {
                    add:    { label: game.i18n.localize("lore-reference-board.Common.Add"),    callback: () => { clicked = true; resolve("add");    } },
                    cancel: { label: game.i18n.localize("lore-reference-board.Common.Cancel"), callback: () => { clicked = true; resolve("cancel"); } },
                },
                default: "add",
                close:  () => { if (!clicked) reject(); },
                render: (jqHtml) => {
                    const root = jqHtml[0];
                    picker = this._initSpanPicker(
                        root.querySelector(`#lrt-span-picker-${uid}`),
                        root.querySelector(`#lrt-span-size-${uid}`),
                        initCells, startRow, startCol
                    );

                    // Drop zone
                    const dz = root.querySelector(`#lrt-rcd-dz-${uid}`);
                    let depth = 0;
                    dz.addEventListener("dragenter",  ev => { ev.preventDefault(); depth++; dz.classList.add("lrt-drop-active"); });
                    dz.addEventListener("dragleave",  () => { if (!--depth) dz.classList.remove("lrt-drop-active"); });
                    dz.addEventListener("dragover",   ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = "link"; });
                    dz.addEventListener("drop", async ev => {
                        ev.preventDefault(); depth = 0; dz.classList.remove("lrt-drop-active");
                        let data;
                        try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                        catch { ui.notifications.warn(L("DropReadFail")); return; }
                        if (!LoreReferenceBoardApp.REF_ACCEPTED_TYPES.has(data.type)) { ui.notifications.warn(L("DropWarn")); return; }
                        let doc; try { doc = await fromUuid(data.uuid ?? ""); } catch { doc = null; }
                        if (!doc) { ui.notifications.warn(L("DropWarn")); return; }
                        const rd = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
                        const rt = rd?.documentName ?? null;
                        if (!rt || !LoreReferenceBoardApp.REF_DOC_CFG[rt]) { ui.notifications.warn(L("DropWarn")); return; }
                        pendingUuid = rd.uuid; pendingType = rt;
                        // Clear any pending file when a doc is linked
                        pendingFilePath = null; pendingFileType = null;
                        const fpathElDrop = root.querySelector(`#lrt-rcd-fpath-${uid}`);
                        if (fpathElDrop) fpathElDrop.value = "";
                        const cfg = LoreReferenceBoardApp.REF_DOC_CFG[rt];
                        dz.classList.add("lrt-ref-dz--linked");
                        root.querySelector(`#lrt-rcd-icon-${uid}`).className = `fas ${cfg.icon} lrt-ref-dz-icon lrt-ref-dz-icon--linked`;
                        root.querySelector(`#lrt-rcd-name-${uid}`).textContent = rd.name ?? "";
                        root.querySelector(`#lrt-rcd-sub-${uid}`).textContent  = L(cfg.badgeKey);
                    });

                    // File section wiring
                    const fpathEl   = root.querySelector(`#lrt-rcd-fpath-${uid}`);
                    const fbrowseEl = root.querySelector(`#lrt-rcd-fbrowse-${uid}`);

                    const applyFilePath = (path) => {
                        if (!path) return;
                        const ext  = path.split(".").pop().toLowerCase();
                        const type = ext === "pdf" ? "pdf" : ext === "md" ? "md" : "txt";
                        fpathEl.value   = path;
                        pendingFilePath  = path;
                        pendingFileType  = type;
                        // Unlink drop zone when a file is chosen
                        pendingUuid = null; pendingType = null;
                        dz.classList.remove("lrt-ref-dz--linked");
                        root.querySelector(`#lrt-rcd-icon-${uid}`).className = "fas fa-link lrt-ref-dz-icon";
                        root.querySelector(`#lrt-rcd-name-${uid}`).textContent = LG("DropToLink");
                        root.querySelector(`#lrt-rcd-sub-${uid}`).textContent  = L("DropSubtext");
                    };

                    fpathEl?.addEventListener("change", () => {
                        const path = normalizeLrbPath(fpathEl.value);
                        if (path) applyFilePath(path);
                        else { pendingFilePath = null; pendingFileType = null; }
                    });
                    fbrowseEl?.addEventListener("click", async () => {
                        const picked = await pickRefFilePath(fpathEl?.value || "modules/");
                        if (picked) applyFilePath(normalizeLrbPath(picked));
                    });
                },
            }, { width: 400, classes: ["app","window-app","dialog","lore-rb-dialog"] }).render(true);
        }).catch(() => "cancel");

        if (result !== "add" || (!pendingUuid && !pendingFilePath)) return;

        const span = picker?.getSpan();
        if (!span) { ui.notifications.warn(LG("SpanNotSelected")); return; }

        const { row, col, rowSpan, colSpan } = span;
        const allTabs = await loadTabs();
        const idx     = allTabs.findIndex(t => t.id === tabId);
        if (idx === -1) return;
        const cells   = allTabs[idx].cells ?? [];
        const problem = this._refCellCollides(cells, null, row, col, rowSpan, colSpan);
        if (problem === "overflow")   { ui.notifications.warn(LG("OverflowError"));   return; }
        if (problem === "collision")  { ui.notifications.warn(LG("CollisionError"));  return; }

        const newCell = pendingFilePath
            ? { id: foundry.utils.randomID(), row, col, rowSpan, colSpan, docType: "file", filePath: pendingFilePath, fileType: pendingFileType }
            : { id: foundry.utils.randomID(), row, col, rowSpan, colSpan, docUuid: pendingUuid, docType: pendingType };
        allTabs[idx].cells = [...cells, newCell];
        await saveTabs(allTabs);
        await this.render(true);
    }

    // Edit Cell Dialog
    async _editRefCellDialog(tabId, cellId) {
        const COLS = 4;
        const uid  = foundry.utils.randomID();
        const L  = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);
        const LG = key => game.i18n.localize(`lore-reference-board.ReferenceGrid.${key}`);

        // Load fresh data
        const allTabs = await loadTabs();
        const tabIdx  = allTabs.findIndex(t => t.id === tabId);
        if (tabIdx === -1) return;
        const cells = allTabs[tabIdx].cells ?? [];
        const cell  = cells.find(c => c.id === cellId);
        if (!cell) return;

        // Resolve current doc (file cells have no docUuid)
        const isFileCell = cell.docType === "file";
        let currentDoc = null;
        try { if (cell.docUuid) currentDoc = await fromUuid(cell.docUuid); } catch {}

        let pendingUuid     = cell.docUuid ?? null;
        let pendingType     = isFileCell ? null : (cell.docType ?? null);
        let pendingFilePath = isFileCell ? (cell.filePath ?? null) : null;
        let pendingFileType = isFileCell ? (cell.fileType ?? "txt") : null;
        let picker          = null;

        // Calculate picker rows: at least current cell's bottom + 2 extra rows
        let maxRow = 0;
        for (const c of cells) maxRow = Math.max(maxRow, c.row + c.rowSpan - 1);
        const pickerRows = maxRow + 3;

        // Initial drop-zone display
        const initLinked = !!currentDoc && !isFileCell;
        const initCfg    = LoreReferenceBoardApp.REF_DOC_CFG[cell.docType] ?? { icon: "fa-link", badgeKey: "TypeBadgeActor" };

        const content = `
          <div class="lrt-ref-cell-dialog">
            <div class="lrt-ref-cell-dz${initLinked ? " lrt-ref-dz--linked" : ""}" id="lrt-rcd-dz-${uid}">
              <i class="fas ${initCfg.icon} lrt-ref-dz-icon${initLinked ? " lrt-ref-dz-icon--linked" : ""}" id="lrt-rcd-icon-${uid}"></i>
              <p class="lrt-ref-dz-primary" id="lrt-rcd-name-${uid}">${initLinked ? escapeHtml(currentDoc.name ?? "") : LG("DropToLink")}</p>
              <p class="lrt-ref-dz-sub"    id="lrt-rcd-sub-${uid}">${initLinked ? escapeHtml(L(initCfg.badgeKey)) : L("DropSubtext")}</p>
            </div>
            <div class="lrt-ref-file-section">
              <div class="lrt-ref-file-divider">${LG("FileCellDivider")}</div>
              <p class="lrt-ref-file-instruct">${LG("FileCellInstruct")}</p>
              <div class="lrt-ref-file-row">
                <input type="text" class="lrt-ref-file-path" id="lrt-rcd-fpath-${uid}"
                       value="${escapeHtml(pendingFilePath ?? "")}"
                       placeholder="${LG("FileCellPathPlaceholder")}" />
                <button type="button" class="lrt-ref-file-browse-btn" id="lrt-rcd-fbrowse-${uid}">
                  <i class="fas fa-folder-open"></i> ${LG("FileCellBrowse")}
                </button>
              </div>
            </div>
            <div class="lrt-ref-span-section">
              <p class="lrt-ref-span-label">${LG("SpanPickerLabel")}</p>
              <p class="lrt-ref-span-hint">${LG("SpanPickerHint")}</p>
              <div class="lrt-span-picker" id="lrt-span-picker-${uid}">${this._buildSpanPickerHtml(cells, pickerRows, cellId)}</div>
              <p class="lrt-span-size-label" id="lrt-span-size-${uid}"></p>
            </div>
          </div>`;

        const result = await new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title:   LG("EditCellTitle"),
                content,
                buttons: {
                    save:   { label: game.i18n.localize("lore-reference-board.Common.Save"),   callback: () => { clicked = true; resolve("save");   } },
                    delete: { label: LG("DeleteCell"),                                          callback: () => { clicked = true; resolve("delete"); } },
                    cancel: { label: game.i18n.localize("lore-reference-board.Common.Cancel"), callback: () => { clicked = true; resolve("cancel"); } },
                },
                default: "save",
                close:  () => { if (!clicked) reject(); },
                render: (jqHtml) => {
                    const root = jqHtml[0];
                    // Exclude current cell from occupancy so the user can resize it freely
                    picker = this._initSpanPicker(
                        root.querySelector(`#lrt-span-picker-${uid}`),
                        root.querySelector(`#lrt-span-size-${uid}`),
                        cells, cell.row, cell.col, cellId
                    );

                    const dz = root.querySelector(`#lrt-rcd-dz-${uid}`);
                    let depth = 0;
                    dz.addEventListener("dragenter",  ev => { ev.preventDefault(); depth++; dz.classList.add("lrt-drop-active"); });
                    dz.addEventListener("dragleave",  () => { if (!--depth) dz.classList.remove("lrt-drop-active"); });
                    dz.addEventListener("dragover",   ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = "link"; });
                    dz.addEventListener("drop", async ev => {
                        ev.preventDefault(); depth = 0; dz.classList.remove("lrt-drop-active");
                        let data;
                        try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                        catch { ui.notifications.warn(L("DropReadFail")); return; }
                        if (!LoreReferenceBoardApp.REF_ACCEPTED_TYPES.has(data.type)) { ui.notifications.warn(L("DropWarn")); return; }
                        let doc; try { doc = await fromUuid(data.uuid ?? ""); } catch { doc = null; }
                        if (!doc) { ui.notifications.warn(L("DropWarn")); return; }
                        const rd = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
                        const rt = rd?.documentName ?? null;
                        if (!rt || !LoreReferenceBoardApp.REF_DOC_CFG[rt]) { ui.notifications.warn(L("DropWarn")); return; }
                        pendingUuid = rd.uuid; pendingType = rt;
                        // Clear file when a doc is linked
                        pendingFilePath = null; pendingFileType = null;
                        const fpathElDrop = root.querySelector(`#lrt-rcd-fpath-${uid}`);
                        if (fpathElDrop) fpathElDrop.value = "";
                        const cfg = LoreReferenceBoardApp.REF_DOC_CFG[rt];
                        dz.classList.add("lrt-ref-dz--linked");
                        root.querySelector(`#lrt-rcd-icon-${uid}`).className = `fas ${cfg.icon} lrt-ref-dz-icon lrt-ref-dz-icon--linked`;
                        root.querySelector(`#lrt-rcd-name-${uid}`).textContent = rd.name ?? "";
                        root.querySelector(`#lrt-rcd-sub-${uid}`).textContent  = L(cfg.badgeKey);
                    });

                    // File section wiring
                    const fpathEl   = root.querySelector(`#lrt-rcd-fpath-${uid}`);
                    const fbrowseEl = root.querySelector(`#lrt-rcd-fbrowse-${uid}`);

                    const applyFilePath = (path) => {
                        if (!path) return;
                        const ext  = path.split(".").pop().toLowerCase();
                        const type = ext === "pdf" ? "pdf" : ext === "md" ? "md" : "txt";
                        fpathEl.value   = path;
                        pendingFilePath  = path;
                        pendingFileType  = type;
                        // Unlink drop zone when a file is chosen
                        pendingUuid = null; pendingType = null;
                        dz.classList.remove("lrt-ref-dz--linked");
                        root.querySelector(`#lrt-rcd-icon-${uid}`).className = "fas fa-link lrt-ref-dz-icon";
                        root.querySelector(`#lrt-rcd-name-${uid}`).textContent = LG("DropToLink");
                        root.querySelector(`#lrt-rcd-sub-${uid}`).textContent  = L("DropSubtext");
                    };

                    fpathEl?.addEventListener("change", () => {
                        const path = normalizeLrbPath(fpathEl.value);
                        if (path) applyFilePath(path);
                        else { pendingFilePath = null; pendingFileType = null; }
                    });
                    fbrowseEl?.addEventListener("click", async () => {
                        const picked = await pickRefFilePath(fpathEl?.value || "modules/");
                        if (picked) applyFilePath(normalizeLrbPath(picked));
                    });
                },
            }, { width: 400, classes: ["app","window-app","dialog","lore-rb-dialog"] }).render(true);
        }).catch(() => "cancel");

        if (result === "cancel") return;

        if (result === "delete") {
            allTabs[tabIdx].cells = cells.filter(c => c.id !== cellId);
            await saveTabs(allTabs);
            await this.render(true);
            return;
        }

        if (result === "save") {
            if (!pendingUuid && !pendingFilePath) return;
            const span = picker?.getSpan();
            if (!span) { ui.notifications.warn(LG("SpanNotSelected")); return; }
            const { row, col, rowSpan, colSpan } = span;
            const problem = this._refCellCollides(cells, cellId, row, col, rowSpan, colSpan);
            if (problem === "overflow")  { ui.notifications.warn(LG("OverflowError"));  return; }
            if (problem === "collision") { ui.notifications.warn(LG("CollisionError")); return; }
            const updatedCell = pendingFilePath
                ? { id: cell.id, row, col, rowSpan, colSpan, docType: "file", filePath: pendingFilePath, fileType: pendingFileType }
                : { id: cell.id, row, col, rowSpan, colSpan, docUuid: pendingUuid, docType: pendingType };
            allTabs[tabIdx].cells = cells.map(c => c.id === cellId ? updatedCell : c);
            await saveTabs(allTabs);
            await this.render(true);
        }
    }

    // Deal Cards Dialog
    async _dealCardsDialog(deck) {
        const L  = key => game.i18n.localize(`lore-reference-board.ReferenceTab.${key}`);

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
                  ${hands.map(h => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.name)}</option>`).join("")}
                </select>
              </div>
              <div>
                <label style="display:block;margin-bottom:4px;font-weight:bold">${L("DealCountLabel")}</label>
                <input type="number" name="dealCount" value="1" min="1" max="${maxCards}"
                       style="width:100%;box-sizing:border-box" />
              </div>
            </div>
          </form>`;

        const result = await new Promise((resolve, reject) => {
            let clicked = false;
            new Dialog({
                title: L("DealTitle"),
                content,
                buttons: {
                    deal: {
                        label: L("DealBtn"),
                        callback: (html) => {
                            clicked = true;
                            const form = html[0].querySelector("form")?.elements;
                            resolve({
                                handId: form?.targetHand?.value ?? null,
                                count:  Math.max(1, parseInt(form?.dealCount?.value) || 1),
                            });
                        },
                    },
                    cancel: {
                        label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                        callback: () => { clicked = true; resolve("cancel"); },
                    },
                },
                default: "deal",
                close: () => { if (!clicked) reject(); },
            }, { width: 340, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
        }).catch(() => "cancel");

        if (result === "cancel" || !result?.handId) return;

        const targetHand = game.cards.get(result.handId);
        if (!targetHand) return;

        await deck.deal([targetHand], result.count);
    }


    // Pin Rendering
    async buildPinElement(pin, zoom = 1, imgRect = null, containerW = 0, containerH = 0) {
        const PIN_PX = 15;
        const $el = $(`<div class="lr-pin" data-pinid="${pin.id}"></div>`);
        let leftPx, topPx;
        if (pin.coordV === 1 && imgRect && imgRect.displayW > 0) {
            leftPx = imgRect.offsetX + (pin.xPct / 100) * imgRect.displayW;
            topPx  = imgRect.offsetY + (pin.yPct / 100) * imgRect.displayH;
        } else {
            leftPx = (pin.xPct / 100) * containerW;
            topPx  = (pin.yPct / 100) * containerH;
        }
        $el.css({
            left: `${leftPx}px`,
            top: `${topPx}px`,
            position: "absolute",
            width: `${PIN_PX}px`,
            height: `${PIN_PX}px`,
            "font-size": `${PIN_PX}px`,
            "line-height": `${PIN_PX}px`,
            "text-align": "center",
            "transform-origin": "50% 100%",
            transform: `translate(-50%, -100%) scale(${1 / zoom})`,
            cursor: "pointer",
            color: pin.color || "#e74c3c",
            "z-index": 40,
            "pointer-events": "auto",
            "user-select": "none",
        });

        if (pin.icon) {
            if (isSvgIcon(pin.icon)) {
                const OLD_SVG_PREFIX = "modules/lore-reference-board/assets/ui-icons/";
                const iconUrl = pin.icon.startsWith(OLD_SVG_PREFIX)
                    ? `icons/svg/${pin.icon.slice(OLD_SVG_PREFIX.length)}`
                    : pin.icon;

                const svgData = await fetchSvgData(iconUrl);
                if (svgData) {
                    $el.html(`<span class="lr-pin-svg-wrap"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${svgData.viewBox}" class="lr-pin-svg-icon">${svgData.inner}</svg></span>`);
                }
            } else if (String(pin.icon).startsWith("fas")) {
                $el.html(`<i class="${pin.icon}"></i>`);
            }
        }
        $el.attr("title", `${pin.title || ""}\n${pin.description || ""}`.trim());
        return $el;
    }


    async renderPins(html) {
        if (!html || typeof html.find !== "function") return;

        const mapWrapEl  = html.find("#lr-map-wrap")[0];
        const containerW = mapWrapEl?.offsetWidth  ?? 0;
        const containerH = mapWrapEl?.offsetHeight ?? 0;
        const imgRect    = computeImageRect(containerW, containerH, this._imgNaturalW, this._imgNaturalH);

        const pins = await loadPinsForTab(this.activeTab);

        let migrated = false;
        for (const pin of pins) {
            if (!pin.coordV && containerW > 0 && imgRect.displayW > 0) {
                const oldXPx = (pin.xPct / 100) * containerW;
                const oldYPx = (pin.yPct / 100) * containerH;
                pin.xPct   = Math.min(100, Math.max(0, ((oldXPx - imgRect.offsetX) / imgRect.displayW) * 100));
                pin.yPct   = Math.min(100, Math.max(0, ((oldYPx - imgRect.offsetY) / imgRect.displayH) * 100));
                pin.coordV = 1;
                migrated   = true;
            }
        }
        if (migrated) await savePinsForTab(this.activeTab, pins);

        let pinLayer = html.find("#lr-pin-layer");
        if (!pinLayer.length) {
            pinLayer = $(`
        <div id="lr-pin-layer"
             style="position:absolute;top:0;left:0;width:100%;height:100%;
                    pointer-events:auto;z-index:30;">
        </div>
      `);
            html.find("#lr-map-wrap").append(pinLayer);
        }

        pinLayer.find(".lr-pin").remove();

        const zoom = this._panzoom?.getScale?.() ?? 1;
        for (const pin of pins) {
            pinLayer.append(await this.buildPinElement(pin, zoom, imgRect, containerW, containerH));
        }
    }

    async close(options) {
        if (!this._skipPosSave) {
        const pos = this.position;
        if (pos?.width && pos?.height) {
            try {
                await game.settings.set(MODULE_SCOPE, "windowPos", {
                    left:   pos.left,
                    top:    pos.top,
                    width:  pos.width,
                    height: pos.height,
                });
            } catch { }
        }
        }
        return super.close(options);
    }
}
