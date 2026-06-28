async function loreRefBoard_pinDialog({ pin, isNew }) {
        const L = key => game.i18n.localize(`lore-reference-board.Pin.Icons.${key}`);
        const faIcons = [
            { value: "fas fa-location-dot", label: L("LocationDot") },
            { value: "fas fa-dragon", label: L("Dragon") },
            { value: "fas fa-book", label: L("Book") },
            { value: "fas fa-shield-alt", label: L("Shield") },
            { value: "fas fa-scroll", label: L("Scroll") },
            { value: "fas fa-treasure-chest", label: L("TreasureChest") },
            { value: "fas fa-map-pin", label: L("MapPin") },
            { value: "fas fa-skull", label: L("Skull") },
            { value: "fas fa-dungeon", label: L("Dungeon") },
            { value: "fas fa-tower-observation", label: L("TowerObservation") },
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

        const uid = foundry.utils.randomID();
        const idColor = `lr-pin-color-${uid}`;
        const idIcon = `lr-pin-icon-${uid}`;
        const idPreview = `lr-pin-preview-${uid}`;
        const idUnlinked = `lr-pin-ju-${uid}`;
        const idLinked = `lr-pin-jl-${uid}`;
        const idJTitle = `lr-pin-jt-${uid}`;
        const idJContent = `lr-pin-jc-${uid}`;
        const idBtnCreate = `lr-pin-bc-${uid}`;
        const idBtnEdit = `lr-pin-be-${uid}`;
        const idBtnUnlink = `lr-pin-bu-${uid}`;

        const content = `
      <form>
        <div class="pd-layout">

          <!-- Left column: pin fields -->
          <div class="pd-left">

            <div class="pd-preview-wrap">
              <div id="${idPreview}" class="pd-preview-icon"></div>
            </div>

            <div class="pd-row">
              <div class="pd-field pd-field-flex">
                <label>Title</label>
                <input type="text" name="pTitle" value="${loreRefBoard_escapeHtml(current.title)}"
                       style="width:100%;box-sizing:border-box" />
              </div>
              <div class="pd-field pd-field-color">
                <label>Color</label>
                <input id="${idColor}" type="color" name="pColor"
                       value="${loreRefBoard_escapeHtml(current.color)}" />
              </div>
            </div>

            <div class="pd-field">
              <label>Icon</label>
              <select id="${idIcon}" name="pIcon" style="width:100%;box-sizing:border-box">
                ${[...faIcons, ...svgIcons].map(ic =>
                    `<option value="${loreRefBoard_escapeHtml(ic.value)}"${ic.value === current.icon ? " selected" : ""}>${loreRefBoard_escapeHtml(ic.label)}</option>`
                ).join("")}
              </select>
            </div>

            <div class="pd-field">
              <label>Description</label>
              <textarea name="pDesc" rows="5"
                        style="width:100%;box-sizing:border-box;resize:vertical">${loreRefBoard_escapeHtml(current.description)}</textarea>
            </div>

          </div><!-- /pd-left -->

          <!-- Right column: journal linking panel -->
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
                <div class="pd-drop-or">, or, </div>
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
                <em style="color:#666;font-size:12px">Loading...</em>
              </div>
            </div>

          </div><!-- /pd-right -->

        </div><!-- /pd-layout -->
      </form>
    `;

        const _pinBtns = [
            {
                action: "save",
                label: game.i18n.localize("lore-reference-board.Common.Save"),
                default: true,
                callback: (_ev, btn) => {
                    const form = btn.closest("dialog")?.querySelector("form")?.elements;
                    return {
                        action: "save",
                        data: {
                            icon: form?.pIcon?.value ?? current.icon,
                            color: form?.pColor?.value ?? current.color,
                            title: (form?.pTitle?.value ?? "").trim(),
                            description: (form?.pDesc?.value ?? "").trim(),
                            journal: pinJournalId,
                        },
                    };
                },
            },
            { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
        ];
        if (!isNew) _pinBtns.push({ action: "delete", label: game.i18n.localize("lore-reference-board.Common.Delete"), callback: () => ({ action: "delete" }) });

        const waitPromise = DialogV2.wait({
            window: { title: game.i18n.localize(isNew ? "lore-reference-board.Pin.DialogTitleNew" : "lore-reference-board.Pin.DialogTitleEdit") },
            classes: ["lore-rb-dialog", "lore-rb-pin-dialog"],
            position: { width: 760, height: 600 },
            content,
            buttons: _pinBtns,
            rejectClose: true,
        });

        const setupDialog = async () => {
            const colorInput = document.getElementById(idColor);
            if (!colorInput) return false;

            const iconSelect = document.getElementById(idIcon);
            const preview = document.getElementById(idPreview);
            const unlinkedEl = document.getElementById(idUnlinked);
            const linkedEl = document.getElementById(idLinked);
            const journalTitle = document.getElementById(idJTitle);
            const journalCont = document.getElementById(idJContent);
            const btnCreate = document.getElementById(idBtnCreate);
            const btnEdit = document.getElementById(idBtnEdit);
            const btnUnlink = document.getElementById(idBtnUnlink);
            if (!iconSelect || !preview || !unlinkedEl || !linkedEl) return false;

            // Live Pin Preview
            const updatePreview = () => {
                const iconVal = iconSelect.value;
                const colorVal = colorInput.value;
                if (loreRefBoard_isSvgIcon(iconVal)) {
                    preview.style.color = "";
                    preview.innerHTML = `<span class="pd-preview-svg-mask" style="background-color:${colorVal};-webkit-mask-image:url('${iconVal}');mask-image:url('${iconVal}')"></span>`;
                } else {
                    preview.style.color = colorVal;
                    preview.innerHTML = `<i class="${iconVal}"></i>`;
                }
            };
            iconSelect.addEventListener("change", updatePreview);
            colorInput.addEventListener("input", updatePreview);
            updatePreview();

            // Footer buttons and capped column heights
            const _dialogEl = colorInput.closest(".application, .app, .dialog-v2, [data-appid]");
            const _footer = _dialogEl?.querySelector("footer") ?? _dialogEl?.querySelector(".form-footer");
            if (_footer) {
                _footer.style.display = "flex";
                _footer.style.justifyContent = "center";
                _footer.style.gap = "12px";
            }
            const _pdLeft = preview.closest(".pd-left");
            const _pdRight = preview.closest(".pd-layout")?.querySelector(".pd-right");
            const _pdLayout = preview.closest(".pd-layout");
            if (_pdLeft && _pdRight && _pdLayout) {
                const _capCols = () => {
                    const _wc = _pdLayout.closest(".window-content");
                    if (!_wc) return;
                    const _wcCS = getComputedStyle(_wc);
                    const _plCS = getComputedStyle(_pdLayout);
                    const _btnBar = _dialogEl?.querySelector("footer") ?? _dialogEl?.querySelector(".form-footer") ?? _dialogEl?.querySelector(".dialog-buttons");
                    const _btnH = _btnBar ? _btnBar.offsetHeight : 0;
                    const _colH = _wc.clientHeight
                        - parseFloat(_wcCS.paddingTop)  - parseFloat(_wcCS.paddingBottom)
                        - parseFloat(_plCS.paddingTop)  - parseFloat(_plCS.paddingBottom)
                        - _btnH - 20;
                    _pdLeft.style.height = _colH + "px";
                    _pdRight.style.maxHeight = _colH + "px";
                };
                _capCols();
                const _colsObs = new ResizeObserver(_capCols);
                _colsObs.observe(_pdLayout.closest(".window-content") ?? _pdLeft);
            }

            // Journal state helpers
            const showLinked = async (journalId) => {
                let entry = game.journal.get(journalId);
                if (!entry) {
                    try { entry = await fromUuid(`JournalEntry.${journalId}`); }
                    catch { entry = null; }
                }
                unlinkedEl.style.display = "none";
                linkedEl.style.display = "flex";
                journalTitle.textContent = entry?.name ?? "(Unknown Journal)";

                linkedEl.querySelectorAll(".lrb-page-nav").forEach(el => el.remove());

                if (entry) {
                    // Render first page
                    const pages = loreRefBoard_getJournalPages(entry);
                    const firstPage = pages[0] ?? null;
                    journalCont.innerHTML = await loreRefBoard_enrichJournalPage(firstPage, entry);

                    await loreRefBoard_wirePageNav(journalCont, journalId);
                } else {
                    journalCont.innerHTML =
                        '<em style="color:#666;font-size:12px">Journal entry not found.</em>';
                }
            };

            const showUnlinked = () => {
                pinJournalId = null;
                linkedEl.style.display = "none";
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
                const defaultName = titleFieldVal || current.title || game.i18n.localize("lore-reference-board.Pin.LoreEntryDefault");
                const nameUid = foundry.utils.randomID();
                const nameInputId = `pd-name-${nameUid}`;

                let chosenName;
                try {
                    chosenName = await DialogV2.wait({
                        window: { title: game.i18n.localize("lore-reference-board.Lore.NameEntryTitle") },
                        classes: ["lore-rb-dialog"],
                        content: `<form>
                                <div style="padding:6px 0">
                                    <label style="display:block;margin-bottom:4px;font-weight:bold">
                                        ${game.i18n.localize("lore-reference-board.Lore.JournalEntryName")}
                                    </label>
                                    <input id="${nameInputId}" name="${nameInputId}" type="text"
                                           value="${loreRefBoard_escapeHtml(defaultName)}"
                                           style="width:100%" autofocus />
                                </div>
                            </form>`,
                        buttons: [
                            {
                                action: "create",
                                label: game.i18n.localize("lore-reference-board.Common.Create"),
                                default: true,
                                callback: (_ev, btn) => btn.closest("dialog")?.querySelector(`#${nameInputId}`)?.value?.trim() || defaultName,
                            },
                            { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
                        ],
                        rejectClose: true,
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
                const confirmed = await DialogV2.confirm({
                    window: { title: game.i18n.localize("lore-reference-board.Pin.UnlinkTitle") },
                    content: `<p>${game.i18n.localize("lore-reference-board.Pin.UnlinkPinContent")}</p>`,
                    rejectClose: false,
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

        loreRefBoard_attachDialogValidation(idColor, "save", ["pTitle"]);

        try {
            return await waitPromise;
        } catch {
            return "cancel";
        }
    }


// Add Tab & Settings
async function loreRefBoard_setupImageTab(app, html) {
        // Map image
        html.find("#lr-map-image").css({ "background-image": "" });

        if (app._mapResizeObs) {
            app._mapResizeObs.disconnect();
            app._mapResizeObs = null;
        }
        if (app._panzoom) {
            try {
                app._mapWrapEl?.removeEventListener("wheel", app._panzoom.zoomWithWheel);
            } catch { }
            try {
                app._panzoom.destroy();
            } catch { }
            app._panzoom = null;
            app._mapWrapEl = null;
        }

        const mapWrapEl = html.find("#lr-map-wrap")[0];
        if (mapWrapEl && window.PanzoomLoaded && window.Panzoom) {
            app._mapWrapEl = mapWrapEl;
            app._panzoom = Panzoom(mapWrapEl, {
                maxScale: 5,
                minScale: 0.5,
                contain: "outside",
                excludeClass: "lr-pin",
            });
            mapWrapEl.addEventListener("wheel", app._panzoom.zoomWithWheel);
            mapWrapEl.addEventListener("panzoomchange", () => {
                const zoom = app._panzoom?.getScale?.() ?? 1;
                $(app._mapWrapEl).find(".lr-pin").css(
                    "transform", `translate(-50%, -100%) scale(${1 / zoom})`
                );
                loreRefBoard_syncMapZoomBar(html, zoom);
            });
            loreRefBoard_syncMapZoomBar(html, app._panzoom.getScale());
        }

        // Clear handlers
        html.find("#lr-map-wrap").off(".lrMap");
        $(document).off(".lrMapDrag");

        const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

        const mapWrap = html.find("#lr-map-wrap")[0];
        const clientToMapPct = (clientX, clientY) => {
            const r = mapWrap.getBoundingClientRect();
            const xLayout = (clientX - r.left) / r.width  * mapWrap.offsetWidth;
            const yLayout = (clientY - r.top)  / r.height * mapWrap.offsetHeight;
            const ir = loreRefBoard_computeImageRect(mapWrap.offsetWidth, mapWrap.offsetHeight, app._imgNaturalW, app._imgNaturalH);
            return {
                xPct: clamp(((xLayout - ir.offsetX) / ir.displayW) * 100, 0, 100),
                yPct: clamp(((yLayout - ir.offsetY) / ir.displayH) * 100, 0, 100),
            };
        };

        // Open gallery when placement is OFF and user clicks an existing pin
        html.find("#lr-map-wrap").on("click.lrMap", ".lr-pin", async (ev) => {
            if (app.placingPin) return;
            ev.stopPropagation();
            const pinId = $(ev.currentTarget).data("pinid");
            const pins = await loreRefBoard_loadPinsForTab(app.activeTab);
            const pin = pins.find(p => p.id === pinId);
            if (!pin) return;
            new LoreRefBoardPinGalleryApp({ pin, tabId: app.activeTab, boardApp: this }).render(true);
        });

        // Add pin placement is ON, click on empty map space
        html.find("#lr-map-wrap").on("click.lrMap", async (ev) => {
            if (!app.placingPin) return;
            if ($(ev.target).closest(".lr-pin").length) return;

            const { xPct, yPct } = clientToMapPct(ev.clientX, ev.clientY);
            const res = await loreRefBoard_pinDialog({ pin: { xPct, yPct }, isNew: true });
            if (!res || res === "cancel") return;
            if (res?.action !== "save") return;

            const pins = await loreRefBoard_loadPinsForTab(app.activeTab);
            pins.push({ id: foundry.utils.randomID(), xPct, yPct, coordV: 1, ...res.data });
            await loreRefBoard_savePinsForTab(app.activeTab, pins);
            await loreRefBoard_renderPins(app, app._htmlRef);
        });

        // Drag / edit pin
        html.find("#lr-map-wrap").on("pointerdown.lrMap", ".lr-pin", (ev) => {
            if (!app.placingPin) return;
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

            app._pinDrag.active = true;
            app._pinDrag.pinId = pinId;
            app._pinDrag.startX = ev.clientX;
            app._pinDrag.startY = ev.clientY;
            app._pinDrag.didDrag = false;

            {
                const r = mapWrap.getBoundingClientRect();
                const pinXPx = parseFloat(pinEl.style.left) || 0;
                const pinYPx = parseFloat(pinEl.style.top)  || 0;
                const curXLayout = (ev.clientX - r.left) / r.width  * mapWrap.offsetWidth;
                const curYLayout = (ev.clientY - r.top)  / r.height * mapWrap.offsetHeight;
                app._pinDrag.offsetXPx = pinXPx - curXLayout;
                app._pinDrag.offsetYPx = pinYPx - curYLayout;
            }

            $pinEl.css("opacity", "0.6");

            const onMove = (ev2) => {
                if (!app._pinDrag.active) return;
                if (ev2.pointerId !== pointerId) return;

                const dx = ev2.clientX - app._pinDrag.startX;
                const dy = ev2.clientY - app._pinDrag.startY;
                if (!app._pinDrag.didDrag && Math.hypot(dx, dy) > 3) app._pinDrag.didDrag = true;

                const r = mapWrap.getBoundingClientRect();
                const xPx = clamp((ev2.clientX - r.left) / r.width  * mapWrap.offsetWidth  + app._pinDrag.offsetXPx, 0, mapWrap.offsetWidth);
                const yPx = clamp((ev2.clientY - r.top)  / r.height * mapWrap.offsetHeight + app._pinDrag.offsetYPx, 0, mapWrap.offsetHeight);
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

                const didDrag = app._pinDrag.didDrag;
                const r = mapWrap.getBoundingClientRect();
                const xPx = clamp((ev2.clientX - r.left) / r.width  * mapWrap.offsetWidth  + app._pinDrag.offsetXPx, 0, mapWrap.offsetWidth);
                const yPx = clamp((ev2.clientY - r.top)  / r.height * mapWrap.offsetHeight + app._pinDrag.offsetYPx, 0, mapWrap.offsetHeight);
                const ir = loreRefBoard_computeImageRect(mapWrap.offsetWidth, mapWrap.offsetHeight, app._imgNaturalW, app._imgNaturalH);
                const xPct = clamp(((xPx - ir.offsetX) / ir.displayW) * 100, 0, 100);
                const yPct = clamp(((yPx - ir.offsetY) / ir.displayH) * 100, 0, 100);

                app._pinDrag.active = false;
                app._pinDrag.pinId = null;

                const pins = await loreRefBoard_loadPinsForTab(app.activeTab);
                const idx = pins.findIndex((p) => p.id === pinId);
                if (idx === -1) return;

                if (didDrag) {
                    pins[idx].xPct = xPct;
                    pins[idx].yPct = yPct;
                    pins[idx].coordV = 1;
                    await loreRefBoard_savePinsForTab(app.activeTab, pins);
                    await loreRefBoard_renderPins(app, app._htmlRef);
                    return;
                }

                const pin = pins[idx];
                const res = await loreRefBoard_pinDialog({ pin, isNew: false });
                if (!res || res === "cancel") return;

                if (res?.action === "delete") {
                    const ok = await DialogV2.confirm({
                        window: { title: game.i18n.localize("lore-reference-board.Pin.RemoveTitle") },
                        content: `<p>${game.i18n.localize("lore-reference-board.Pin.RemoveContent")}</p>`,
                        rejectClose: false,
                    });
                    if (!ok) return;

                    await loreRefBoard_clearLoreForImages(loreRefBoard_collectPinImages(pin));
                    await loreRefBoard_clearAllImageJournalLinksForPin(pin.id);
                    pins.splice(idx, 1);
                    await loreRefBoard_savePinsForTab(app.activeTab, pins);
                    await loreRefBoard_renderPins(app, app._htmlRef);
                    return;
                }

                if (res?.action === "save") {
                    pins[idx] = { ...pins[idx], ...res.data };
                    await loreRefBoard_savePinsForTab(app.activeTab, pins);
                    await loreRefBoard_renderPins(app, app._htmlRef);
                }
            };

            $(document).on("pointermove.lrMapDrag", onMove);
            $(document).on("pointerup.lrMapDrag pointercancel.lrMapDrag", onUp);
        });

        // Right-click delete
        html.find("#lr-map-wrap").on("contextmenu.lrMap", ".lr-pin", async (ev) => {
            if (!app.placingPin) return;

            ev.preventDefault();
            ev.stopPropagation();

            const pinId = $(ev.currentTarget).data("pinid");
            const ok = await DialogV2.confirm({
                window: { title: game.i18n.localize("lore-reference-board.Pin.RemoveTitle") },
                content: game.i18n.localize("lore-reference-board.Pin.RemoveContent"),
                rejectClose: false,
            });
            if (!ok) return;

            const pins = await loreRefBoard_loadPinsForTab(app.activeTab);
            const pinToDelete = pins.find(p => p.id === pinId);
            if (pinToDelete) await loreRefBoard_clearLoreForImages(loreRefBoard_collectPinImages(pinToDelete));
            if (pinToDelete) await loreRefBoard_clearAllImageJournalLinksForPin(pinToDelete.id);
            await loreRefBoard_savePinsForTab(app.activeTab, pins.filter((p) => p.id !== pinId));
            await loreRefBoard_renderPins(app, app._htmlRef);
        });

        if (app._cachedActiveTabImg) {
            const _imgSrc = app._cachedActiveTabImg;
            const _img = new Image();
            app._naturalSizeImg = _img;
            _img.src = _imgSrc;
            const _setupAfterDecode = () => {
                if (_imgSrc !== app._cachedActiveTabImg) return;
                app._imgNaturalW = _img.naturalWidth;
                app._imgNaturalH = _img.naturalHeight;
                app._naturalSizeImg = null;
                html.find("#lr-map-image").css({
                    "background-image": `url('${_imgSrc}')`,
                    "background-size": "contain",
                    "background-position": "center",
                    "background-repeat": "no-repeat",
                });
                if (!app._mapResizeObs) {
                    const viewport = html.find(".lr-map-viewport")[0];
                    if (viewport) {
                        let _rsTimer = null;
                        app._mapResizeObs = new ResizeObserver(() => {
                            if (app._panzoom) app._panzoom.reset({ animate: false });
                            clearTimeout(_rsTimer);
                            _rsTimer = setTimeout(() => {
                                loreRefBoard_renderPins(app, app._htmlRef).catch(() => {});
                            }, 100);
                        });
                        app._mapResizeObs.observe(viewport);
                    }
                }
                loreRefBoard_renderPins(app, app._htmlRef).catch(err =>
                    console.error("[lore-reference-board] renderPins failed", err)
                );
            };
            const _decodePromise = _img.decode
                ? _img.decode()
                : new Promise((res, rej) => { _img.onload = res; _img.onerror = rej; });
            _decodePromise.then(_setupAfterDecode).catch(_setupAfterDecode);
        } else {
            app._imgNaturalW = 0;
            app._imgNaturalH = 0;
        }
}

async function loreRefBoard_buildPinElement(app, pin, zoom = 1, imgRect = null, containerW = 0, containerH = 0) {
        const PIN_PX = 15;
        const $el = $(`<div class="lr-pin" data-pinid="${pin.id}"></div>`);
        let leftPx, topPx;
        if (pin.coordV === 1 && imgRect && imgRect.displayW > 0) {
            leftPx = imgRect.offsetX + (pin.xPct / 100) * imgRect.displayW;
            topPx = imgRect.offsetY + (pin.yPct / 100) * imgRect.displayH;
        } else {
            leftPx = (pin.xPct / 100) * containerW;
            topPx = (pin.yPct / 100) * containerH;
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
            if (loreRefBoard_isSvgIcon(pin.icon)) {
                const OLD_SVG_PREFIX = "modules/lore-reference-board/assets/ui-icons/";
                const iconUrl = pin.icon.startsWith(OLD_SVG_PREFIX)
                    ? `icons/svg/${pin.icon.slice(OLD_SVG_PREFIX.length)}`
                    : pin.icon;

                const svgData = await loreRefBoard_fetchSvgData(iconUrl);
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

async function loreRefBoard_renderPins(app, html) {
        if (!html || typeof html.find !== "function") return;

        const mapWrapEl = html.find("#lr-map-wrap")[0];
        const containerW = mapWrapEl?.offsetWidth  ?? 0;
        const containerH = mapWrapEl?.offsetHeight ?? 0;
        const imgRect = loreRefBoard_computeImageRect(containerW, containerH, app._imgNaturalW, app._imgNaturalH);

        const pins = await loreRefBoard_loadPinsForTab(app.activeTab);

        let migrated = false;
        for (const pin of pins) {
            if (!pin.coordV && containerW > 0 && imgRect.displayW > 0) {
                const oldXPx = (pin.xPct / 100) * containerW;
                const oldYPx = (pin.yPct / 100) * containerH;
                pin.xPct = Math.min(100, Math.max(0, ((oldXPx - imgRect.offsetX) / imgRect.displayW) * 100));
                pin.yPct = Math.min(100, Math.max(0, ((oldYPx - imgRect.offsetY) / imgRect.displayH) * 100));
                pin.coordV = 1;
                migrated = true;
            }
        }
        if (migrated) await loreRefBoard_savePinsForTab(app.activeTab, pins);

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

        const zoom = app._panzoom?.getScale?.() ?? 1;
        for (const pin of pins) {
            pinLayer.append(await loreRefBoard_buildPinElement(app, pin, zoom, imgRect, containerW, containerH));
        }
    }
