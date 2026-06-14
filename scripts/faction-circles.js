
const loreRefBoard_FACTION_CIRCLE_DEFAULT_RADIUS = 80;
const loreRefBoard_FACTION_CIRCLE_MIN_RADIUS = 30;
const loreRefBoard_FACTION_CIRCLE_MAX_RADIUS = 400;
const loreRefBoard_FACTION_CIRCLE_DEFAULT_COLOR = "#c869e8";

const loreRefBoard_FACTION_ENTITY_TOKEN_SIZE = 40;
const loreRefBoard_FACTION_ENTITY_GAP = 6;
const loreRefBoard_FACTION_ENTITY_HEADER_RESERVE = 76;
const loreRefBoard_FACTION_ENTITY_BOTTOM_RESERVE = 12;

const loreRefBoard_FACTION_ENTITY_SIDE_INSET = 36;

function _loreRefBoard_factionEntityRowLayout(r) {
    const cell = loreRefBoard_FACTION_ENTITY_TOKEN_SIZE + loreRefBoard_FACTION_ENTITY_GAP;
    const top = loreRefBoard_FACTION_ENTITY_HEADER_RESERVE;
    const bottom = r * 2 - loreRefBoard_FACTION_ENTITY_BOTTOM_RESERVE;
    const maxChord = r * 2 - loreRefBoard_FACTION_ENTITY_SIDE_INSET;
    const rows = [];

    for (let y = top; y < bottom; y += cell) {
        const rowBottom = y + cell;
        const farY = Math.abs(y - r) > Math.abs(rowBottom - r) ? y : rowBottom;
        const dy = Math.abs(farY - r);
        const chordSq = r * r - dy * dy;
        const chord = chordSq > 0 ? Math.min(2 * Math.sqrt(chordSq), maxChord) : 0;
        const cols = Math.max(0, Math.floor((chord + loreRefBoard_FACTION_ENTITY_GAP) / cell));
        if (cols > 0) rows.push({ width: cols * cell - loreRefBoard_FACTION_ENTITY_GAP, cols });
    }

    if (!rows.length) rows.push({ width: loreRefBoard_FACTION_ENTITY_TOKEN_SIZE, cols: 1 });
    return rows;
}

function _loreRefBoard_factionMaxVisibleEntities(r) {
    return Math.max(1, _loreRefBoard_factionEntityRowLayout(r).reduce((sum, row) => sum + row.cols, 0));
}

function _loreRefBoard_factionCircleEntityHtml(entity) {
    return `
      <div class="lrt-faction-circle-entity-token" data-uuid="${loreRefBoard_escapeHtml(entity.uuid)}" data-doctype="${loreRefBoard_escapeHtml(entity.type)}" title="${loreRefBoard_escapeHtml(entity.name ?? "")}">
        <img src="${loreRefBoard_escapeHtml(entity.img)}" />
        <div class="lrt-faction-circle-entity-remove" title="${game.i18n.localize("lore-reference-board.Faction.Circle.Entity.Remove")}">
          <i class="fas fa-xmark"></i>
        </div>
      </div>
    `;
}

function _loreRefBoard_factionCircleEntityOverflowHtml(count) {
    return `
      <div class="lrt-faction-circle-entity-token lrt-faction-circle-entity-overflow" title="${game.i18n.localize("lore-reference-board.Faction.Circle.Entity.MoreTitle")}">
        +${count}
      </div>
    `;
}

function _loreRefBoard_factionCircleEntitiesHtml(entities, r) {
    if (!entities.length) return "";

    const rows = _loreRefBoard_factionEntityRowLayout(r);
    const maxVisible = Math.max(1, rows.reduce((sum, row) => sum + row.cols, 0));

    let items;
    if (entities.length <= maxVisible) {
        items = entities.map(_loreRefBoard_factionCircleEntityHtml);
    } else {
        const visible = entities.slice(0, Math.max(maxVisible - 1, 0));
        const overflowCount = entities.length - visible.length;
        items = visible.map(_loreRefBoard_factionCircleEntityHtml);
        items.push(_loreRefBoard_factionCircleEntityOverflowHtml(overflowCount));
    }

    let out = "";
    let idx = 0;
    for (const row of rows) {
        if (idx >= items.length) break;
        const rowItems = items.slice(idx, idx + row.cols);
        idx += rowItems.length;
        out += `<div class="lrt-faction-circle-entity-row" style="width:${row.width}px;">${rowItems.join("")}</div>`;
    }
    return out;
}

function _loreRefBoard_factionCircleHtml(circle) {
    const r = circle.r ?? loreRefBoard_FACTION_CIRCLE_DEFAULT_RADIUS;
    const color = circle.color || loreRefBoard_FACTION_CIRCLE_DEFAULT_COLOR;
    const entities = Array.isArray(circle.entities) ? circle.entities : [];
    return `
      <div class="lrt-faction-circle lrt-faction-entity" data-circleid="${circle.id}"
           style="left:${circle.x - r}px; top:${circle.y - r}px; width:${r * 2}px; height:${r * 2}px; border-color:${color}; background-color:${color}33;">
        <div class="lrt-faction-circle-settings-btn" title="${game.i18n.localize("lore-reference-board.Faction.Circle.Settings.Title")}">
          <i class="fas fa-gear"></i>
        </div>
        <div class="lrt-faction-rating-box">
          <button type="button" class="lrt-faction-rating-btn lrt-faction-rating-dec">-</button>
          <input type="text" class="lrt-faction-rating-input" value="${circle.rating ?? 0}" title="${game.i18n.localize("lore-reference-board.Faction.RatingInputHint")}" />
          <button type="button" class="lrt-faction-rating-btn lrt-faction-rating-inc">+</button>
        </div>
        <div class="lrt-faction-circle-name">${loreRefBoard_escapeHtml(circle.name ?? "")}</div>
        <div class="lrt-faction-circle-entities">
          ${_loreRefBoard_factionCircleEntitiesHtml(entities, r)}
        </div>
        <div class="lrt-faction-resize-handle"><i class="fas fa-up-right-and-down-left-from-center"></i></div>
      </div>
    `;
}

async function loreRefBoard_renderFactionCircles(app, html) {
    const canvasEl = html.find("#lrt-faction-canvas")[0];
    if (!canvasEl) return;

    canvasEl.querySelectorAll(".lrt-faction-circle").forEach((el) => el.remove());

    const data = await loreRefBoard_loadFactionDataForTab(app.activeTab);
    for (const circle of data.circles) {
        canvasEl.insertAdjacentHTML("beforeend", _loreRefBoard_factionCircleHtml(circle));
    }

    _loreRefBoard_bindFactionCircleEvents(app, html);
}

async function _loreRefBoard_persistFactionCircleGeometry(app, el, circleId) {
    const data = await loreRefBoard_loadFactionDataForTab(app.activeTab);
    const circle = data.circles.find((c) => c.id === circleId);
    if (!circle) return;

    const width = parseFloat(el.style.width) || loreRefBoard_FACTION_CIRCLE_DEFAULT_RADIUS * 2;
    const left = parseFloat(el.style.left) || 0;
    const top = parseFloat(el.style.top) || 0;

    circle.r = width / 2;
    circle.x = left + circle.r;
    circle.y = top + circle.r;
    await loreRefBoard_saveFactionDataForTab(app.activeTab, data);
}

async function _loreRefBoard_updateFactionCircleRating(app, circleId, value) {
    const data = await loreRefBoard_loadFactionDataForTab(app.activeTab);
    const circle = data.circles.find((c) => c.id === circleId);
    if (!circle) return;

    circle.rating = value;
    await loreRefBoard_saveFactionDataForTab(app.activeTab, data);
}

async function _loreRefBoard_addEntityToFactionCircle(app, html, circleId, entity) {
    const data = await loreRefBoard_loadFactionDataForTab(app.activeTab);
    const circle = data.circles.find((c) => c.id === circleId);
    if (!circle) return;

    if (!Array.isArray(circle.entities)) circle.entities = [];
    if (circle.entities.some((e) => e.uuid === entity.uuid)) {
        ui.notifications.warn(game.i18n.localize("lore-reference-board.Faction.Circle.Entity.AlreadyAdded"));
        return;
    }

    circle.entities.push(entity);
    await loreRefBoard_saveFactionDataForTab(app.activeTab, data);
    await loreRefBoard_renderFactionCircles(app, html);
}

async function _loreRefBoard_removeEntityFromFactionCircle(app, html, circleId, uuid) {
    const data = await loreRefBoard_loadFactionDataForTab(app.activeTab);
    const circle = data.circles.find((c) => c.id === circleId);
    if (!circle || !Array.isArray(circle.entities)) return;

    circle.entities = circle.entities.filter((e) => e.uuid !== uuid);
    await loreRefBoard_saveFactionDataForTab(app.activeTab, data);
    await loreRefBoard_renderFactionCircles(app, html);
}

async function _loreRefBoard_openFactionEntitySheet(uuid) {
    const doc = await fromUuid(uuid);
    if (!doc) {
        ui.notifications.warn(game.i18n.localize("lore-reference-board.Faction.Circle.Entity.OpenError"));
        return;
    }
    doc.sheet?.render(true);
}

async function _loreRefBoard_showFactionEntityOverflowDialog(app, html, circleId) {
    const data = await loreRefBoard_loadFactionDataForTab(app.activeTab);
    const circle = data.circles.find((c) => c.id === circleId);
    if (!circle) return;

    const entities = Array.isArray(circle.entities) ? circle.entities : [];
    const listId = `lrt-faction-entity-list-${foundry.utils.randomID()}`;

    const rowHtml = (entity) => `
      <div class="lrt-faction-entity-row" data-uuid="${loreRefBoard_escapeHtml(entity.uuid)}">
        <img src="${loreRefBoard_escapeHtml(entity.img)}" />
        <span class="lrt-faction-entity-row-name">${loreRefBoard_escapeHtml(entity.name ?? "")}</span>
        <button type="button" class="lrt-faction-entity-row-open" title="${game.i18n.localize("lore-reference-board.Faction.Circle.Entity.Open")}">
          <i class="fas fa-up-right-from-square"></i>
        </button>
        <button type="button" class="lrt-faction-entity-row-remove" title="${game.i18n.localize("lore-reference-board.Faction.Circle.Entity.Remove")}">
          <i class="fas fa-xmark"></i>
        </button>
      </div>
    `;

    const content = `<div id="${listId}" class="lrt-faction-entity-list">${entities.map(rowHtml).join("")}</div>`;

    new Dialog({
        title: game.i18n.format("lore-reference-board.Faction.Circle.Entity.ListTitle", { name: circle.name ?? "" }),
        content,
        buttons: {
            close: { label: game.i18n.localize("lore-reference-board.Common.Close") },
        },
        default: "close",
    }, { width: 320, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);

    let tries = 0;
    const bind = () => {
        const list = document.getElementById(listId);
        if (!list) { if (++tries < 60) requestAnimationFrame(bind); return; }

        list.addEventListener("click", async (ev) => {
            const row = ev.target.closest(".lrt-faction-entity-row");
            if (!row) return;
            const uuid = row.dataset.uuid;

            if (ev.target.closest(".lrt-faction-entity-row-remove")) {
                await _loreRefBoard_removeEntityFromFactionCircle(app, html, circleId, uuid);
                row.remove();
                return;
            }

            await _loreRefBoard_openFactionEntitySheet(uuid);
        });
    };
    requestAnimationFrame(bind);
}

function _loreRefBoard_bindFactionCircleEvents(app, html) {
    const canvasEl = html.find("#lrt-faction-canvas")[0];
    if (!canvasEl) return;

    const $canvas = $(canvasEl);
    $canvas.off(".lrtfactioncircle");

    const getScale = () => app._factionPanzoom?.getScale?.() ?? 1;

    $canvas.on("mousedown.lrtfactioncircle", ".lrt-faction-circle", function (ev) {
        if (ev.button !== 0) return;
        if (ev.target.closest(".lrt-faction-rating-box") || ev.target.closest(".lrt-faction-circle-settings-btn") || ev.target.closest(".lrt-faction-circle-entity-token")) return;

        const el = this;
        const isResize = !!ev.target.closest(".lrt-faction-resize-handle");
        const circleId = el.dataset.circleid;

        if (app._factionRelMode) {
            ev.preventDefault();
            ev.stopPropagation();
            _loreRefBoard_handleCircleRelClick(app, html, circleId);
            return;
        }

        ev.preventDefault();
        ev.stopPropagation();

        const startX = ev.clientX;
        const startY = ev.clientY;
        const startLeft = parseFloat(el.style.left) || 0;
        const startTop = parseFloat(el.style.top) || 0;
        const startSize = parseFloat(el.style.width) || loreRefBoard_FACTION_CIRCLE_DEFAULT_RADIUS * 2;

        const startCenterX = startLeft + startSize / 2;
        const startCenterY = startTop + startSize / 2;

        const onMove = (mv) => {
            const scale = getScale();
            const dx = (mv.clientX - startX) / scale;
            const dy = (mv.clientY - startY) / scale;

            let centerX = startCenterX;
            let centerY = startCenterY;
            let r = startSize / 2;

            if (isResize) {
                const delta = Math.max(dx, dy);
                const newSize = Math.min(loreRefBoard_FACTION_CIRCLE_MAX_RADIUS * 2, Math.max(loreRefBoard_FACTION_CIRCLE_MIN_RADIUS * 2, startSize + delta));
                r = newSize / 2;
                el.style.width = `${newSize}px`;
                el.style.height = `${newSize}px`;
                el.style.left = `${centerX - r}px`;
                el.style.top = `${centerY - r}px`;
            } else {
                centerX = startCenterX + dx;
                centerY = startCenterY + dy;
                el.style.left = `${startLeft + dx}px`;
                el.style.top = `${startTop + dy}px`;
            }

            _loreRefBoard_updateRelationshipLinesForCircle(app, circleId, centerX, centerY, r);
        };

        const onUp = async () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            await _loreRefBoard_persistFactionCircleGeometry(app, el, circleId);
            if (isResize) await loreRefBoard_renderFactionCircles(app, html);
            await loreRefBoard_renderFactionRelationships(app, html);
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    });

    $canvas.on("mousedown.lrtfactioncircle click.lrtfactioncircle", ".lrt-faction-rating-box, .lrt-faction-rating-input", (ev) => ev.stopPropagation());

    $canvas.on("click.lrtfactioncircle", ".lrt-faction-rating-dec, .lrt-faction-rating-inc", async function (ev) {
        ev.stopPropagation();
        const el = this.closest(".lrt-faction-circle");
        const circleId = el.dataset.circleid;
        const input = el.querySelector(".lrt-faction-rating-input");
        const delta = this.classList.contains("lrt-faction-rating-inc") ? 1 : -1;
        const next = (Number(input.value) || 0) + delta;
        input.value = next;
        await _loreRefBoard_updateFactionCircleRating(app, circleId, next);
        if (app._factionStandingPanelOpen) await _loreRefBoard_renderFactionStandingPanel(app, html);
    });

    $canvas.on("focus.lrtfactioncircle", ".lrt-faction-rating-input", function () {
        this.dataset.lastValue = this.value;
        this.select();
    });

    $canvas.on("change.lrtfactioncircle", ".lrt-faction-rating-input", async function () {
        const el = this.closest(".lrt-faction-circle");
        const circleId = el.dataset.circleid;
        const current = Number(this.dataset.lastValue ?? this.value) || 0;
        const next = loreRefBoard_parseRatingInput(current, this.value);
        this.value = next;
        this.dataset.lastValue = next;
        await _loreRefBoard_updateFactionCircleRating(app, circleId, next);
        if (app._factionStandingPanelOpen) await _loreRefBoard_renderFactionStandingPanel(app, html);
    });

    $canvas.on("click.lrtfactioncircle", ".lrt-faction-circle-settings-btn", async function (ev) {
        ev.stopPropagation();
        const el = this.closest(".lrt-faction-circle");
        await _loreRefBoard_factionCircleSettingsDialog(app, html, el.dataset.circleid);
    });

    $canvas.on("dragover.lrtfactioncircle", ".lrt-faction-circle", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.originalEvent?.dataTransfer) ev.originalEvent.dataTransfer.dropEffect = "copy";
        this.classList.add("lrt-faction-circle--drop-target");
    });

    $canvas.on("dragleave.lrtfactioncircle", ".lrt-faction-circle", function () {
        this.classList.remove("lrt-faction-circle--drop-target");
    });

    $canvas.on("drop.lrtfactioncircle", ".lrt-faction-circle", async function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.classList.remove("lrt-faction-circle--drop-target");

        const circleId = this.dataset.circleid;
        const entity = await loreRefBoard_resolveDroppedFactionEntity(ev.originalEvent);
        if (!entity) return;

        await _loreRefBoard_addEntityToFactionCircle(app, html, circleId, entity);
    });

    $canvas.on("mousedown.lrtfactioncircle click.lrtfactioncircle", ".lrt-faction-circle-entity-token", (ev) => ev.stopPropagation());

    $canvas.on("click.lrtfactioncircle", ".lrt-faction-circle-entity-remove", async function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const token = this.closest(".lrt-faction-circle-entity-token");
        const circleEl = this.closest(".lrt-faction-circle");
        await _loreRefBoard_removeEntityFromFactionCircle(app, html, circleEl.dataset.circleid, token.dataset.uuid);
    });

    $canvas.on("click.lrtfactioncircle", ".lrt-faction-circle-entity-token", async function (ev) {
        if (ev.target.closest(".lrt-faction-circle-entity-remove")) return;
        if (this.classList.contains("lrt-faction-circle-entity-overflow")) return;
        await _loreRefBoard_openFactionEntitySheet(this.dataset.uuid);
    });

    $canvas.on("click.lrtfactioncircle", ".lrt-faction-circle-entity-overflow", async function (ev) {
        ev.stopPropagation();
        const circleEl = this.closest(".lrt-faction-circle");
        await _loreRefBoard_showFactionEntityOverflowDialog(app, html, circleEl.dataset.circleid);
    });
}

async function loreRefBoard_addFactionCircle(app, html) {
    const data = await loreRefBoard_loadFactionDataForTab(app.activeTab);
    const idx = data.circles.length;

    const circle = {
        id: foundry.utils.randomID(),
        name: game.i18n.localize("lore-reference-board.Faction.Circle.DefaultName"),
        x: 160 + (idx % 4) * 220,
        y: 160 + Math.floor(idx / 4) * 220,
        r: loreRefBoard_FACTION_CIRCLE_DEFAULT_RADIUS,
        rating: 0,
        color: loreRefBoard_FACTION_CIRCLE_DEFAULT_COLOR,
    };

    data.circles.push(circle);
    await loreRefBoard_saveFactionDataForTab(app.activeTab, data);
    await loreRefBoard_renderFactionCircles(app, html);
    if (app._factionStandingPanelOpen) await _loreRefBoard_renderFactionStandingPanel(app, html);
}

async function _loreRefBoard_factionCircleSettingsDialog(app, html, circleId) {
    const data = await loreRefBoard_loadFactionDataForTab(app.activeTab);
    const circle = data.circles.find((c) => c.id === circleId);
    if (!circle) return;

    const uid = foundry.utils.randomID();
    const nameInputId = `lrt-faction-cs-name-${uid}`;
    const colorInputId = `lrt-faction-cs-color-${uid}`;

    const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.Faction.Circle.Settings.LabelName")}
            </label>
            <input type="text" id="${nameInputId}" name="circleName" value="${loreRefBoard_escapeHtml(circle.name ?? "")}"
                   style="width:100%" autofocus />
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.Faction.Circle.Settings.LabelColor")}
            </label>
            <input type="color" id="${colorInputId}" name="circleColor" value="${loreRefBoard_escapeHtml(circle.color || loreRefBoard_FACTION_CIRCLE_DEFAULT_COLOR)}"
                   style="width:100%;height:32px;padding:0;border:none;background:none" />
          </div>
        </div>
      </form>
    `;

    const result = await new Promise((resolve) => {
        let clicked = false;
        new Dialog({
            title: game.i18n.localize("lore-reference-board.Faction.Circle.Settings.Title"),
            content,
            buttons: {
                save: {
                    label: game.i18n.localize("lore-reference-board.Common.Save"),
                    callback: (html) => {
                        clicked = true;
                        const form = html[0].querySelector("form")?.elements;
                        resolve({
                            action: "save",
                            name: (form?.circleName?.value ?? "").trim(),
                            color: form?.circleColor?.value ?? loreRefBoard_FACTION_CIRCLE_DEFAULT_COLOR,
                        });
                    },
                },
                delete: {
                    label: game.i18n.localize("lore-reference-board.Faction.Circle.Settings.BtnDelete"),
                    callback: () => { clicked = true; resolve({ action: "delete" }); },
                },
                cancel: {
                    label: game.i18n.localize("lore-reference-board.Common.Cancel"),
                    callback: () => { clicked = true; resolve("cancel"); },
                },
            },
            default: "save",
            close: () => { if (!clicked) resolve("cancel"); },
        }, { width: 360, classes: ["app", "window-app", "dialog", "lore-rb-dialog"] }).render(true);
    });

    loreRefBoard_attachDialogValidation(nameInputId, "save", ["circleName"]);

    if (!result || result === "cancel") return;

    if (result.action === "delete") {
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("lore-reference-board.Faction.Circle.Settings.DeleteTitle"),
            content: `<p>${game.i18n.format("lore-reference-board.Faction.Circle.Settings.DeleteContent", { name: loreRefBoard_escapeHtml(circle.name ?? "") })}</p>`,
        });
        if (!confirmed) return;

        data.circles = data.circles.filter((c) => c.id !== circleId);
        data.relationships = (data.relationships ?? []).filter((r) => r.from !== circleId && r.to !== circleId);
        await loreRefBoard_saveFactionDataForTab(app.activeTab, data);
        await loreRefBoard_renderFactionCircles(app, html);
        await loreRefBoard_renderFactionRelationships(app, html);
        if (app._factionStandingPanelOpen) await _loreRefBoard_renderFactionStandingPanel(app, html);
        return;
    }

    const name = (result.name ?? "").trim();
    if (!name) return ui.notifications.warn(game.i18n.localize("lore-reference-board.Faction.Circle.Settings.NameRequired"));

    circle.name = name;
    circle.color = result.color || loreRefBoard_FACTION_CIRCLE_DEFAULT_COLOR;
    await loreRefBoard_saveFactionDataForTab(app.activeTab, data);
    await loreRefBoard_renderFactionCircles(app, html);
    await loreRefBoard_renderFactionRelationships(app, html);
    if (app._factionStandingPanelOpen) await _loreRefBoard_renderFactionStandingPanel(app, html);
}
