import { loreRefBoard_FACTION_CIRCLE_DEFAULT_COLOR, loreRefBoard_renderFactionCircles } from "./faction-circles.js";
import { loreRefBoard_getFactionStandingCollapsed, loreRefBoard_getFactionStandingTiers, loreRefBoard_loadFactionDataForTab, loreRefBoard_loadTabs, loreRefBoard_saveFactionDataForTab, loreRefBoard_saveFactionStandingTiers, loreRefBoard_setFactionStandingCollapsed } from "./storage.js";
import { loreRefBoard_afterDialogRender, loreRefBoard_escapeHtml, loreRefBoard_parseRatingInput } from "./utils.js";

var { DialogV2 } = foundry.applications.api;

function _loreRefBoard_factionStandingLabel(value) {
    const n = Number(value) || 0;
    const tiers = loreRefBoard_getFactionStandingTiers();
    for (const t of tiers) {
        if (t.max === null || t.max === undefined || n <= t.max) return t.label;
    }
    return tiers[tiers.length - 1]?.label ?? "";
}

async function _loreRefBoard_getAllFactionStandings() {
    const tabs = (await loreRefBoard_loadTabs()).filter((t) => t.type === "faction");
    const out = [];

    for (const tab of tabs) {
        const data = await loreRefBoard_loadFactionDataForTab(tab.id);
        for (const circle of data.circles) {
            out.push({
                tabId: tab.id,
                tabName: tab.name,
                circleId: circle.id,
                name: circle.name ?? "",
                color: circle.color || loreRefBoard_FACTION_CIRCLE_DEFAULT_COLOR,
                rating: circle.rating ?? 0,
            });
        }
    }

    return out;
}

async function _loreRefBoard_updateFactionCircleRatingForTab(tabId, circleId, value) {
    const data = await loreRefBoard_loadFactionDataForTab(tabId);
    const circle = data.circles.find((c) => c.id === circleId);
    if (!circle) return;

    circle.rating = value;
    await loreRefBoard_saveFactionDataForTab(tabId, data);
}

function _loreRefBoard_updateFactionCollapseAllToggle(html, allCollapsed) {
    const btn = html.find("#lrt-faction-standing-collapse-all")[0];
    if (!btn) return;

    const icon = btn.querySelector("i");
    if (icon) icon.className = allCollapsed ? "fas fa-angles-up" : "fas fa-angles-down";

    btn.title = game.i18n.localize(allCollapsed
        ? "lore-reference-board.Faction.StandingPanel.ExpandAll"
        : "lore-reference-board.Faction.StandingPanel.CollapseAll");
}

function _loreRefBoard_factionStandingRowHtml(entry) {
    const name = entry.name.trim() || game.i18n.localize("lore-reference-board.Faction.StandingPanel.Unnamed");
    return `
      <div class="lrt-faction-standing-row" data-tabid="${loreRefBoard_escapeHtml(entry.tabId)}" data-circleid="${loreRefBoard_escapeHtml(entry.circleId)}">
        <div class="lrt-faction-standing-swatch" style="background-color:${loreRefBoard_escapeHtml(entry.color)};"></div>
        <div class="lrt-faction-standing-name" title="${loreRefBoard_escapeHtml(name)}">${loreRefBoard_escapeHtml(name)}</div>
        <div class="lrt-faction-rating-box">
          <button type="button" class="lrt-faction-rating-btn lrt-faction-rating-dec">-</button>
          <input type="text" class="lrt-faction-rating-input" value="${entry.rating}" title="${game.i18n.localize("lore-reference-board.Faction.RatingInputHint")}" />
          <button type="button" class="lrt-faction-rating-btn lrt-faction-rating-inc">+</button>
        </div>
        <div class="lrt-faction-standing-label">${_loreRefBoard_factionStandingLabel(entry.rating)}</div>
      </div>
    `;
}

async function _loreRefBoard_renderFactionStandingPanel(app, html) {
    const body = html.find("#lrt-faction-standing-panel-body")[0];
    if (!body) return;

    const entries = await _loreRefBoard_getAllFactionStandings();
    if (!entries.length) {
        body.innerHTML = `<div class="lrt-faction-standing-empty">${game.i18n.localize("lore-reference-board.Faction.StandingPanel.Empty")}</div>`;
        _loreRefBoard_updateFactionCollapseAllToggle(html, false);
        return;
    }

    const tabs = (await loreRefBoard_loadTabs()).filter((t) => t.type === "faction");
    const collapsed = loreRefBoard_getFactionStandingCollapsed();

    let out = "";
    let groupCount = 0;
    let collapsedCount = 0;
    for (const tab of tabs) {
        const rows = entries.filter((e) => e.tabId === tab.id);
        if (!rows.length) continue;

        groupCount++;
        const isCollapsed = !!collapsed[tab.id];
        if (isCollapsed) collapsedCount++;

        out += `<div class="lrt-faction-standing-group${isCollapsed ? " lrt-faction-standing-group--collapsed" : ""}" data-tabid="${loreRefBoard_escapeHtml(tab.id)}">`;
        out += `<div class="lrt-faction-standing-group-name"><i class="fas fa-chevron-down lrt-faction-standing-collapse-icon"></i>${loreRefBoard_escapeHtml(tab.name)}</div>`;
        out += `<div class="lrt-faction-standing-group-rows">${rows.map(_loreRefBoard_factionStandingRowHtml).join("")}</div>`;
        out += `</div>`;
    }

    body.innerHTML = out;
    _loreRefBoard_updateFactionCollapseAllToggle(html, groupCount > 0 && collapsedCount === groupCount);
}

function _loreRefBoard_bindFactionStandingPanelEvents(app, html) {
    const panelEl = html.find("#lrt-faction-standing-panel")[0];
    if (!panelEl) return;

    panelEl.addEventListener("wheel", (ev) => ev.stopPropagation());

    const $panel = $(panelEl);
    $panel.off(".lrtfactionstanding");

    $panel.on("click.lrtfactionstanding", ".lrt-faction-rating-dec, .lrt-faction-rating-inc", async function (ev) {
        ev.stopPropagation();
        const row = this.closest(".lrt-faction-standing-row");
        const tabId = row.dataset.tabid;
        const circleId = row.dataset.circleid;
        const input = row.querySelector(".lrt-faction-rating-input");
        const delta = this.classList.contains("lrt-faction-rating-inc") ? 1 : -1;
        const next = (Number(input.value) || 0) + delta;
        input.value = next;
        row.querySelector(".lrt-faction-standing-label").textContent = _loreRefBoard_factionStandingLabel(next);

        await _loreRefBoard_updateFactionCircleRatingForTab(tabId, circleId, next);
        if (tabId === app.activeTab) await loreRefBoard_renderFactionCircles(app, html);
    });

    $panel.on("focus.lrtfactionstanding", ".lrt-faction-rating-input", function () {
        this.dataset.lastValue = this.value;
        this.select();
    });

    $panel.on("change.lrtfactionstanding", ".lrt-faction-rating-input", async function () {
        const row = this.closest(".lrt-faction-standing-row");
        const tabId = row.dataset.tabid;
        const circleId = row.dataset.circleid;
        const current = Number(this.dataset.lastValue ?? this.value) || 0;
        const next = loreRefBoard_parseRatingInput(current, this.value);
        this.value = next;
        this.dataset.lastValue = next;
        row.querySelector(".lrt-faction-standing-label").textContent = _loreRefBoard_factionStandingLabel(next);

        await _loreRefBoard_updateFactionCircleRatingForTab(tabId, circleId, next);
        if (tabId === app.activeTab) await loreRefBoard_renderFactionCircles(app, html);
    });

    $panel.on("dblclick.lrtfactionstanding", ".lrt-faction-standing-group-name", async function () {
        const group = this.closest(".lrt-faction-standing-group");
        const tabId = group?.dataset.tabid;
        if (!tabId) return;

        const collapsed = loreRefBoard_getFactionStandingCollapsed();
        collapsed[tabId] = !collapsed[tabId];
        await loreRefBoard_setFactionStandingCollapsed(collapsed);
        await _loreRefBoard_renderFactionStandingPanel(app, html);
    });

    $panel.on("click.lrtfactionstanding", "#lrt-faction-standing-collapse-all", async function () {
        const entries = await _loreRefBoard_getAllFactionStandings();
        const tabs = (await loreRefBoard_loadTabs()).filter((t) => t.type === "faction");
        const groups = tabs.filter((t) => entries.some((e) => e.tabId === t.id));
        if (!groups.length) return;

        const collapsed = loreRefBoard_getFactionStandingCollapsed();
        const allCollapsed = groups.every((t) => collapsed[t.id]);

        const next = {};
        if (!allCollapsed) for (const t of groups) next[t.id] = true;

        await loreRefBoard_setFactionStandingCollapsed(next);
        await _loreRefBoard_renderFactionStandingPanel(app, html);
    });
}

function _loreRefBoard_factionStandingTierRowHtml(tier) {
    return `
      <div class="lrt-faction-standingtier-row" data-tierid="${loreRefBoard_escapeHtml(tier.id ?? "")}">
        <input type="text" name="label" value="${loreRefBoard_escapeHtml(tier.label ?? "")}" placeholder="${game.i18n.localize("lore-reference-board.Faction.StandingTiers.LabelPlaceholder")}" />
        <input type="number" name="min" value="${tier.min ?? ""}" placeholder="${game.i18n.localize("lore-reference-board.Faction.StandingTiers.MinPlaceholder")}" />
        <span class="lrt-faction-standingtier-to">${game.i18n.localize("lore-reference-board.Faction.StandingTiers.To")}</span>
        <input type="number" name="max" value="${tier.max ?? ""}" placeholder="${game.i18n.localize("lore-reference-board.Faction.StandingTiers.MaxPlaceholder")}" />
        <button type="button" class="lrt-faction-standingtier-remove" title="${game.i18n.localize("lore-reference-board.Faction.StandingTiers.BtnDeleteTier")}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
}

function _loreRefBoard_refreshStandingTierRowStates(h) {
    const rows = h.find(".lrt-faction-standingtier-row").toArray();
    rows.forEach((row, i) => {
        const $row = $(row);
        $row.find('[name="min"]').prop("disabled", i === 0);
        $row.find('[name="max"]').prop("disabled", i === rows.length - 1);
    });
}

function _loreRefBoard_collectAndValidateStandingTiers(h) {
    const rows = h.find(".lrt-faction-standingtier-row").toArray();
    if (!rows.length) return { error: game.i18n.localize("lore-reference-board.Faction.StandingTiers.ErrorNone") };

    const tiers = [];
    for (let i = 0; i < rows.length; i++) {
        const $row = $(rows[i]);
        const isFirst = i === 0;
        const isLast = i === rows.length - 1;
        const label = ($row.find('[name="label"]').val() ?? "").trim();
        if (!label) return { error: game.i18n.format("lore-reference-board.Faction.StandingTiers.ErrorLabelRequired", { row: i + 1 }) };

        const minRaw = $row.find('[name="min"]').val();
        const maxRaw = $row.find('[name="max"]').val();
        const min = isFirst ? null : Number(minRaw);
        const max = isLast ? null : Number(maxRaw);

        if ((!isFirst && (minRaw === "" || Number.isNaN(min))) || (!isLast && (maxRaw === "" || Number.isNaN(max)))) {
            return { error: game.i18n.format("lore-reference-board.Faction.StandingTiers.ErrorRangeRequired", { row: i + 1 }) };
        }
        if (!isFirst && !isLast && min > max) {
            return { error: game.i18n.format("lore-reference-board.Faction.StandingTiers.ErrorMinGreaterThanMax", { row: i + 1 }) };
        }

        tiers.push({ id: rows[i].dataset.tierid || foundry.utils.randomID(), label, min, max });
    }

    for (let i = 0; i < tiers.length - 1; i++) {
        if (tiers[i + 1].min !== tiers[i].max + 1) {
            return { error: game.i18n.format("lore-reference-board.Faction.StandingTiers.ErrorGap", { row: i + 2 }) };
        }
    }

    return { tiers };
}

async function loreRefBoard_manageFactionStandingTiersDialog(app, html) {
    const tiers = loreRefBoard_getFactionStandingTiers();
    const uid = foundry.utils.randomID();

    const content = `
      <form>
        <div class="lrt-faction-standingtier-list" id="lrt-st-list-${uid}">
          ${tiers.map(_loreRefBoard_factionStandingTierRowHtml).join("")}
        </div>
        <button type="button" class="lrt-faction-standingtier-add" id="lrt-st-add-${uid}">
          <i class="fas fa-plus"></i> ${game.i18n.localize("lore-reference-board.Faction.StandingTiers.BtnAddTier")}
        </button>
        <p class="lrt-faction-standingtier-error" id="lrt-st-error-${uid}"></p>
      </form>
    `;

    let _savedTiers = null;

    const _stPromise = DialogV2.wait({
        window: { title: game.i18n.localize("lore-reference-board.Faction.StandingTiers.Title") },
        classes: ["lore-rb-dialog"],
        position: { width: 520 },
        content,
        buttons: [
            { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel"), default: true },
        ],
        rejectClose: false,
    });

    loreRefBoard_afterDialogRender(() => {
        const listEl = document.getElementById(`lrt-st-list-${uid}`);
        const addBtn = document.getElementById(`lrt-st-add-${uid}`);
        const errorEl = document.getElementById(`lrt-st-error-${uid}`);
        if (!listEl || !addBtn || !errorEl) return false;

        const $ctx = $(listEl.closest("dialog") ?? listEl.parentElement);

        _loreRefBoard_refreshStandingTierRowStates($ctx);

        addBtn.addEventListener("click", () => {
            const row = $(_loreRefBoard_factionStandingTierRowHtml({ id: foundry.utils.randomID(), label: "", min: "", max: "" }));
            $(listEl).append(row);
            _loreRefBoard_refreshStandingTierRowStates($ctx);
        });
        listEl.addEventListener("click", (ev) => {
            const removeBtn = ev.target.closest(".lrt-faction-standingtier-remove");
            if (!removeBtn) return;
            $(removeBtn).closest(".lrt-faction-standingtier-row").remove();
            _loreRefBoard_refreshStandingTierRowStates($ctx);
        });

        const saveBtn = $ctx.find('[data-action="cancel"]')[0];
        const origClick = saveBtn?.onclick;

        const saveEl = document.createElement("button");
        saveEl.type = "button";
        saveEl.className = "lrt-faction-st-save-btn";
        saveEl.textContent = game.i18n.localize("lore-reference-board.Common.Save");
        saveEl.style.cssText = "order:-1;";
        saveBtn?.parentElement?.prepend(saveEl);

        saveEl.addEventListener("click", () => {
            const { tiers: collected, error } = _loreRefBoard_collectAndValidateStandingTiers($ctx);
            if (error) { errorEl.textContent = error; return; }
            errorEl.textContent = "";
            _savedTiers = collected;
            saveBtn?.click();
        });
        return true;
    });

    await _stPromise;
    const result = _savedTiers;

    if (!result) return;

    await loreRefBoard_saveFactionStandingTiers(result);
    await _loreRefBoard_renderFactionStandingPanel(app, html);
    await loreRefBoard_renderFactionCircles(app, html);
}

export { _loreRefBoard_bindFactionStandingPanelEvents, _loreRefBoard_renderFactionStandingPanel, loreRefBoard_manageFactionStandingTiersDialog };
