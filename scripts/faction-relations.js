const loreRefBoard_FACTION_REL_LINE_WIDTH = 3;
const loreRefBoard_FACTION_REL_HIT_WIDTH = 14;
const loreRefBoard_FACTION_REL_DEFAULT_COLOR = "#888888";

function _loreRefBoard_factionStyleLabelKey(style) {
    return { solid: "Solid", dashed: "Dashed", dotted: "Dotted", "dash-dot": "DashDot" }[style] ?? "Solid";
}

function _loreRefBoard_trimToFactionCircleEdge(cx, cy, r, towardX, towardY) {
    const dx = towardX - cx;
    const dy = towardY - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: cx + (dx / len) * r, y: cy + (dy / len) * r };
}

function _loreRefBoard_factionRelGroupKey(a, b) {
    return [a, b].sort().join("::");
}

async function loreRefBoard_renderFactionRelationships(app, html) {
    const svg = html.find("#lrt-faction-lines")[0];
    if (!svg) return;

    svg.innerHTML = "";

    const data = await loreRefBoard_loadFactionDataForTab(app.activeTab);
    const types = await loreRefBoard_loadRelationshipTypes();
    const circles = data.circles;

    app._factionCircleGeom = new Map();
    for (const c of circles) {
        app._factionCircleGeom.set(c.id, { x: c.x, y: c.y, r: c.r ?? loreRefBoard_FACTION_CIRCLE_DEFAULT_RADIUS });
    }
    app._factionRelLines = [];

    const groups = new Map();
    for (const rel of data.relationships) {
        const key = _loreRefBoard_factionRelGroupKey(rel.from, rel.to);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(rel);
    }

    for (const rels of groups.values()) {
        const total = rels.length;
        rels.forEach((rel, index) => {
            const from = circles.find((c) => c.id === rel.from);
            const to = circles.find((c) => c.id === rel.to);
            if (!from || !to) return;

            const type = types.find((t) => t.id === rel.typeId);
            const color = type?.color || loreRefBoard_FACTION_REL_DEFAULT_COLOR;
            const dash = loreRefBoard_lineDashArray(type?.lineStyle);

            const fromR = from.r ?? loreRefBoard_FACTION_CIRCLE_DEFAULT_RADIUS;
            const toR = to.r ?? loreRefBoard_FACTION_CIRCLE_DEFAULT_RADIUS;
            const e1 = _loreRefBoard_trimToFactionCircleEdge(from.x, from.y, fromR, to.x, to.y);
            const e2 = _loreRefBoard_trimToFactionCircleEdge(to.x, to.y, toR, from.x, from.y);
            const offset = loreRefBoard_offsetLineEndpoints(e1.x, e1.y, e2.x, e2.y, index, total, 10);

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "lrt-faction-rel-line");
            g.setAttribute("data-relid", rel.id);

            const hit = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hit.setAttribute("class", "lrt-faction-rel-line-hit");
            hit.setAttribute("x1", offset.x1);
            hit.setAttribute("y1", offset.y1);
            hit.setAttribute("x2", offset.x2);
            hit.setAttribute("y2", offset.y2);
            hit.setAttribute("stroke-width", loreRefBoard_FACTION_REL_HIT_WIDTH);

            const visible = document.createElementNS("http://www.w3.org/2000/svg", "line");
            visible.setAttribute("class", "lrt-faction-rel-line-visible");
            visible.setAttribute("x1", offset.x1);
            visible.setAttribute("y1", offset.y1);
            visible.setAttribute("x2", offset.x2);
            visible.setAttribute("y2", offset.y2);
            visible.setAttribute("stroke", color);
            visible.setAttribute("stroke-width", loreRefBoard_FACTION_REL_LINE_WIDTH);
            visible.setAttribute("stroke-dasharray", dash);

            g.appendChild(hit);
            g.appendChild(visible);
            svg.appendChild(g);

            app._factionRelLines.push({ relId: rel.id, fromId: rel.from, toId: rel.to, index, total, hitEl: hit, visibleEl: visible });
        });
    }

    _loreRefBoard_bindFactionRelationshipEvents(app, html);
}

function _loreRefBoard_updateRelationshipLinesForCircle(app, circleId, newX, newY, newR) {
    if (!app._factionCircleGeom || !app._factionRelLines) return;
    app._factionCircleGeom.set(circleId, { x: newX, y: newY, r: newR });

    for (const line of app._factionRelLines) {
        if (line.fromId !== circleId && line.toId !== circleId) continue;

        const from = app._factionCircleGeom.get(line.fromId);
        const to = app._factionCircleGeom.get(line.toId);
        if (!from || !to) continue;

        const e1 = _loreRefBoard_trimToFactionCircleEdge(from.x, from.y, from.r, to.x, to.y);
        const e2 = _loreRefBoard_trimToFactionCircleEdge(to.x, to.y, to.r, from.x, from.y);
        const offset = loreRefBoard_offsetLineEndpoints(e1.x, e1.y, e2.x, e2.y, line.index, line.total, 10);

        line.hitEl.setAttribute("x1", offset.x1);
        line.hitEl.setAttribute("y1", offset.y1);
        line.hitEl.setAttribute("x2", offset.x2);
        line.hitEl.setAttribute("y2", offset.y2);
        line.visibleEl.setAttribute("x1", offset.x1);
        line.visibleEl.setAttribute("y1", offset.y1);
        line.visibleEl.setAttribute("x2", offset.x2);
        line.visibleEl.setAttribute("y2", offset.y2);
    }
}

function loreRefBoard_toggleFactionRelationshipMode(app, html) {
    app._factionRelMode = !app._factionRelMode;
    app._factionRelFirst = null;
    html.find(".lrt-faction-circle--rel-selected").removeClass("lrt-faction-circle--rel-selected");
    html.find("#lrt-faction-add-relationship").toggleClass("active", app._factionRelMode);
    html.find("#lrt-faction-canvas").toggleClass("lrt-faction-canvas--rel-mode", app._factionRelMode);

    if (app._factionRelMode) {
        ui.notifications.info(game.i18n.localize("lore-reference-board.Faction.Relationship.ModeHint"));
    }
}

async function _loreRefBoard_handleCircleRelClick(app, html, circleId) {
    if (!app._factionRelFirst) {
        app._factionRelFirst = circleId;
        html.find(`.lrt-faction-circle[data-circleid="${circleId}"]`).addClass("lrt-faction-circle--rel-selected");
        return;
    }

    if (app._factionRelFirst === circleId) {
        html.find(`.lrt-faction-circle[data-circleid="${circleId}"]`).removeClass("lrt-faction-circle--rel-selected");
        app._factionRelFirst = null;
        return;
    }

    const fromId = app._factionRelFirst;
    const toId = circleId;

    html.find(".lrt-faction-circle--rel-selected").removeClass("lrt-faction-circle--rel-selected");
    app._factionRelFirst = null;

    const types = await loreRefBoard_loadRelationshipTypes();
    if (!types.length) {
        ui.notifications.warn(game.i18n.localize("lore-reference-board.Faction.Relationship.NoTypes"));
        return;
    }

    const result = await _loreRefBoard_factionRelationshipDialog(types, null);
    if (!result || result === "cancel") return;

    const data = await loreRefBoard_loadFactionDataForTab(app.activeTab);
    data.relationships.push({ id: foundry.utils.randomID(), from: fromId, to: toId, typeId: result.typeId });
    await loreRefBoard_saveFactionDataForTab(app.activeTab, data);
    await loreRefBoard_renderFactionRelationships(app, html);
}

async function _loreRefBoard_factionRelationshipDialog(types, existing) {
    const uid = foundry.utils.randomID();
    const selectId = `lrt-faction-rel-type-${uid}`;

    const options = types.map((t) =>
        `<option value="${t.id}" ${existing?.typeId === t.id ? "selected" : ""}>${loreRefBoard_escapeHtml(t.label)}</option>`
    ).join("");

    const content = `
      <form>
        <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">
              ${game.i18n.localize("lore-reference-board.Faction.Relationship.LabelType")}
            </label>
            <select id="${selectId}" name="relType" style="width:100%">${options}</select>
          </div>
        </div>
      </form>
    `;

    const _btns = [
        {
            action: "save",
            label: game.i18n.localize("lore-reference-board.Common.Save"),
            default: true,
            callback: (_ev, btn) => {
                const form = btn.closest("dialog")?.querySelector("form")?.elements;
                return { action: "save", typeId: form?.relType?.value };
            },
        },
    ];
    if (existing) _btns.push({ action: "delete", label: game.i18n.localize("lore-reference-board.Faction.Relationship.BtnDelete"), callback: () => ({ action: "delete" }) });
    _btns.push({ action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") });

    return DialogV2.wait({
        window: { title: game.i18n.localize("lore-reference-board.Faction.Relationship.Title") },
        classes: ["lore-rb-dialog"],
        position: { width: 360 },
        content,
        buttons: _btns,
        rejectClose: false,
    }).then(r => r ?? "cancel");
}

function _loreRefBoard_bindFactionRelationshipEvents(app, html) {
    const svg = html.find("#lrt-faction-lines")[0];
    if (!svg) return;

    $(svg).off(".lrtfactionrel").on("click.lrtfactionrel", ".lrt-faction-rel-line", async function (ev) {
        ev.stopPropagation();
        const relId = this.dataset.relid;

        const data = await loreRefBoard_loadFactionDataForTab(app.activeTab);
        const rel = data.relationships.find((r) => r.id === relId);
        if (!rel) return;

        const types = await loreRefBoard_loadRelationshipTypes();
        const result = await _loreRefBoard_factionRelationshipDialog(types, rel);
        if (!result || result === "cancel") return;

        const fresh = await loreRefBoard_loadFactionDataForTab(app.activeTab);
        if (result.action === "delete") {
            fresh.relationships = fresh.relationships.filter((r) => r.id !== relId);
        } else {
            const r = fresh.relationships.find((r) => r.id === relId);
            if (r) r.typeId = result.typeId;
        }
        await loreRefBoard_saveFactionDataForTab(app.activeTab, fresh);
        await loreRefBoard_renderFactionRelationships(app, html);
    });
}

function _loreRefBoard_factionRelTypeRowHtml(type) {
    const styleOptions = Object.keys(loreRefBoard_LINE_DASH).map((key) =>
        `<option value="${key}" ${type.lineStyle === key ? "selected" : ""}>${game.i18n.localize(`lore-reference-board.Faction.RelationshipTypes.Style.${_loreRefBoard_factionStyleLabelKey(key)}`)}</option>`
    ).join("");

    return `
      <div class="lrt-faction-reltype-row" data-typeid="${type.id}">
        <input type="text" name="label" value="${loreRefBoard_escapeHtml(type.label)}" placeholder="${game.i18n.localize("lore-reference-board.Faction.RelationshipTypes.LabelName")}" />
        <select name="lineStyle">${styleOptions}</select>
        <input type="color" name="color" value="${type.color || loreRefBoard_FACTION_REL_DEFAULT_COLOR}" />
        <button type="button" class="lrt-faction-reltype-remove" title="${game.i18n.localize("lore-reference-board.Faction.RelationshipTypes.BtnDeleteType")}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
}

function _loreRefBoard_collectFactionRelTypeRows(h) {
    const rows = h.find(".lrt-faction-reltype-row").toArray();
    const types = [];
    for (const row of rows) {
        const $row = $(row);
        const label = ($row.find('[name="label"]').val() ?? "").trim();
        if (!label) continue;
        types.push({
            id: row.dataset.typeid || foundry.utils.randomID(),
            label,
            lineStyle: $row.find('[name="lineStyle"]').val() || "solid",
            color: $row.find('[name="color"]').val() || loreRefBoard_FACTION_REL_DEFAULT_COLOR,
        });
    }
    return types;
}

async function loreRefBoard_manageFactionRelationshipTypesDialog(app, html) {
    const types = await loreRefBoard_loadRelationshipTypes();

    const content = `
      <form>
        <div class="lrt-faction-reltype-list">
          ${types.map(_loreRefBoard_factionRelTypeRowHtml).join("")}
        </div>
        <button type="button" class="lrt-faction-reltype-add">
          <i class="fas fa-plus"></i> ${game.i18n.localize("lore-reference-board.Faction.RelationshipTypes.BtnAddType")}
        </button>
      </form>
    `;

    const _relTypePromise = DialogV2.wait({
        window: { title: game.i18n.localize("lore-reference-board.Faction.RelationshipTypes.Title") },
        classes: ["lore-rb-dialog"],
        position: { width: 480 },
        content,
        buttons: [
            {
                action: "save",
                label: game.i18n.localize("lore-reference-board.Common.Save"),
                default: true,
                callback: (_ev, btn) => {
                    const $dlg = $(btn.closest("dialog"));
                    return _loreRefBoard_collectFactionRelTypeRows($dlg);
                },
            },
            { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
        ],
        rejectClose: false,
    });

    let _rltTries = 0;
    const _rltSetup = () => {
        const addBtn = document.querySelector(".lrt-faction-reltype-add");
        if (!addBtn) { if (++_rltTries < 60) requestAnimationFrame(_rltSetup); return; }
        const $dlg = $(addBtn.closest("dialog"));
        const $list = $dlg.find(".lrt-faction-reltype-list");
        addBtn.addEventListener("click", () => {
            const row = $(_loreRefBoard_factionRelTypeRowHtml({ id: foundry.utils.randomID(), label: "", lineStyle: "solid", color: loreRefBoard_FACTION_REL_DEFAULT_COLOR }));
            $list.append(row);
        });
        $list[0]?.addEventListener("click", (ev) => {
            const removeBtn = ev.target.closest(".lrt-faction-reltype-remove");
            if (removeBtn) $(removeBtn).closest(".lrt-faction-reltype-row").remove();
        });
    };
    requestAnimationFrame(_rltSetup);

    const result = (await _relTypePromise) ?? "cancel";

    if (!result || result === "cancel") return;

    await loreRefBoard_saveRelationshipTypes(result);
    await loreRefBoard_renderFactionRelationships(app, html);
}