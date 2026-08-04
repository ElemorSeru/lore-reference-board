import { loreRefBoard_enrichJournalPage, loreRefBoard_getJournalPages, loreRefBoard_resolveJournalRef, loreRefBoard_wirePageNav } from "./journal-helpers.js";
import { loreRefBoard_LAYER_PALETTE } from "./pin-layers.js";
import { loreRefBoard_loadThreadsForTab, loreRefBoard_saveThreadsForTab } from "./storage.js";
import { loreRefBoard_afterDialogRender, loreRefBoard_escapeHtml } from "./utils.js";

const { DialogV2 } = foundry.applications.api;

const loreRefBoard_THREADS_STATUSES = ["seed", "active", "resolved", "abandoned"];
const loreRefBoard_THREADS_STYLES = ["bar", "clock", "pips"];
const loreRefBoard_THREADS_ACCEPTED_TYPES = new Set(["JournalEntry", "JournalEntryPage"]);

function _loreRefBoard_normalizeThreadGroup(g, idx = 0) {
    return {
        id: g?.id ?? foundry.utils.randomID(),
        name: g?.name ?? "",
        sort: Number.isFinite(g?.sort) ? g.sort : 0,
        color: g?.color ?? loreRefBoard_LAYER_PALETTE[idx % loreRefBoard_LAYER_PALETTE.length],
    };
}

function _loreRefBoard_normalizeThreadRow(row) {
    const kind = row?.kind === "tracker" ? "tracker" : "thread";
    const status = loreRefBoard_THREADS_STATUSES.includes(row?.status) ? row.status : "active";
    const notes = Array.isArray(row?.notes) ? row.notes.filter(n => n?.text) : [];
    const base = {
        id: row?.id ?? foundry.utils.randomID(),
        kind, status, notes,
        title: row?.title ?? "",
        sort: Number.isFinite(row?.sort) ? row.sort : 0,
        groupId: typeof row?.groupId === "string" ? row.groupId : null,
    };
    if (kind === "tracker") {
        const max = Math.max(1, Number.isFinite(row?.max) ? row.max : 10);
        const current = Math.min(max, Math.max(0, Number.isFinite(row?.current) ? row.current : 0));
        const milestones = Array.isArray(row?.milestones)
            ? row.milestones.filter(m => Number.isFinite(m?.at)).map(m => ({ at: m.at, label: m?.label ?? "" }))
            : [];
        return { ...base, current, max, milestones, style: loreRefBoard_THREADS_STYLES.includes(row?.style) ? row.style : null, links: [] };
    }
    const links = Array.isArray(row?.links) ? row.links.filter(l => l?.kind === "journal" && l.uuid).slice(0, 1) : [];
    return { ...base, description: row?.description ?? "", links };
}

async function loreRefBoard_setupThreadsView(host) {
    const pane = host.pane;
    if (!pane) return;

    const st = host.state;
    const L = key => game.i18n.localize(`lore-reference-board.ThreadsTab.${key}`);
    const F = (key, data) => game.i18n.format(`lore-reference-board.ThreadsTab.${key}`, data);
    const esc = loreRefBoard_escapeHtml;
    const defaultStyle = host.defaultStyle ?? loreRefBoard_THREADS_STYLES[0];

    const loaded = await host.load();
    let groups = loaded.groups.map(_loreRefBoard_normalizeThreadGroup);
    let rows = loaded.rows.map(_loreRefBoard_normalizeThreadRow);

    st._threadsFilter = st._threadsFilter ?? "all";
    st._threadsExpanded = st._threadsExpanded ?? new Set();
    st._threadsGroupCollapsed = st._threadsGroupCollapsed ?? new Set();
    st._threadsGroupRenamingId = st._threadsGroupRenamingId ?? null;

    const rerender = async () => {
        st._threadsScrollTop = pane.querySelector(".lrt-threads-list")?.scrollTop ?? 0;
        await host.requestRender();
    };

    const persistAndRefresh = async () => {
        rows.sort((a, b) => a.sort - b.sort);
        groups.sort((a, b) => a.sort - b.sort);
        await host.save({ groups, rows });
        await rerender();
    };

    const openStatusDropdown = (statusDd) => {
        const listEl = statusDd.querySelector(".lrt-threads-status-list");
        if (!listEl) return;
        statusDd.classList.add("is-open");
        listEl.style.transform = "translateX(-50%)";
        const pad = 8;
        const rect = listEl.getBoundingClientRect();
        let shift = 0;
        if (rect.left < pad) shift = pad - rect.left;
        else if (rect.right > window.innerWidth - pad) shift = (window.innerWidth - pad) - rect.right;
        if (shift !== 0) listEl.style.transform = `translateX(calc(-50% + ${shift}px))`;
    };

    const maxTopSort = () => Math.max(-1, ...groups.map(g => g.sort), ...rows.filter(r => !r.groupId).map(r => r.sort));

    const buildTopLevelItems = () => {
        const items = [
            ...groups.map(g => ({ type: "group", sort: g.sort, group: g })),
            ...rows.filter(r => !r.groupId).map(r => ({ type: "row", sort: r.sort, row: r })),
        ];
        return items.sort((a, b) => a.sort - b.sort);
    };

    const journalChipHtml = async (link, rowId) => {
        const doc = await loreRefBoard_resolveJournalRef(link.uuid);
        if (!doc) {
            return `<button type="button" class="lrt-threads-chip lrt-threads-chip--broken" data-act="open-broken-link" data-row-id="${esc(rowId)}" title="${esc(L("BtnFixLink"))}">
                <i class="fas fa-triangle-exclamation"></i> ${esc(F("MissingJournalNamed", { name: link.label || L("MissingJournal") }))}
            </button>`;
        }
        return `<button type="button" class="lrt-threads-chip lrt-threads-chip--journal" data-act="open-journal" data-journal-uuid="${esc(doc.uuid)}" title="${esc(L("BtnOpenJournal"))}">
            <i class="fas fa-book-open"></i> ${esc(doc.name)} <i class="fas fa-up-right-from-square lrt-threads-chip-open-icon"></i>
        </button>`;
    };

    const trackerVisualHtml = (row) => {
        const style = row.style ?? defaultStyle;
        const pct = row.max > 0 ? Math.min(100, (row.current / row.max) * 100) : 0;
        const milestoneListHtml = row.milestones.length
            ? `<div class="lrt-threads-milestone-list">${row.milestones.map(m => {
                const reached = row.current >= m.at;
                const icon = reached ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-circle lrt-threads-ms-unreached-dot"></i>';
                return `<div class="lrt-threads-ms-entry${reached ? " is-reached" : ""}">${icon} ${m.at} &mdash; ${esc(m.label || "")}</div>`;
            }).join("")}</div>`
            : "";

        if (style === "clock") {
            const seg = row.max > 0 ? 360 / row.max : 360;
            const fillDeg = pct * 3.6;
            const clockTicksHtml = row.milestones.map(m => {
                const angle = row.max > 0 ? (m.at / row.max) * 360 : 0;
                const reached = row.current >= m.at;
                return `<span class="lrt-threads-clock-tick${reached ? " is-reached" : ""}" style="transform:rotate(${angle}deg)"></span>`;
            }).join("");
            return `
              <div class="lrt-threads-clockwrap">
                <div class="lrt-threads-clock" style="background:
                  repeating-conic-gradient(from 0deg, rgba(0,0,0,0.55) 0deg 1.2deg, transparent 1.2deg ${seg}deg),
                  conic-gradient(from 0deg, #4a9e6f 0deg ${fillDeg}deg, var(--lrb-bg-3) ${fillDeg}deg 360deg);"></div>
                ${clockTicksHtml}
                <div class="lrt-threads-clock-label">${row.current}/${row.max}</div>
              </div>
              ${milestoneListHtml}`;
        }

        if (style === "pips") {
            const pips = [];
            for (let i = 1; i <= row.max; i++) {
                const filled = i <= row.current;
                const isMilestone = row.milestones.some(m => m.at === i);
                pips.push(`<span class="lrt-threads-pip${filled ? " is-filled" : ""}${isMilestone ? " is-milestone" : ""}"></span>`);
            }
            return `<div class="lrt-threads-pip-wrap"><div class="lrt-threads-pip-track">${pips.join("")}</div><div class="lrt-threads-track-count">${row.current}/${row.max}</div></div>${milestoneListHtml}`;
        }

        const ticks = row.milestones.map(m => {
            const left = row.max > 0 ? Math.min(100, (m.at / row.max) * 100) : 0;
            const reached = row.current >= m.at;
            return `<span class="lrt-threads-bar-tick${reached ? " is-reached" : ""}" style="left:${left}%"></span>`;
        }).join("");
        return `
          <div class="lrt-threads-bar-wrap">
            <div class="lrt-threads-bar-track"><div class="lrt-threads-bar-fill" style="width:${pct}%"></div>${ticks}</div>
            <div class="lrt-threads-track-count">${row.current}/${row.max}</div>
          </div>
          ${milestoneListHtml}`;
    };

    const statusSelectHtml = (row) => {
        const optsHtml = loreRefBoard_THREADS_STATUSES.map(s => `
            <div class="lrt-threads-status-opt${row.status === s ? " is-selected" : ""}" data-act="status-opt" data-value="${s}" role="option" tabindex="0">${esc(L(`Status.${s}`))}</div>`).join("");
        return `
            <div class="lrt-threads-status-dd" data-act="status-dd">
              <button type="button" class="lrt-threads-status-trigger lrt-threads-pill lrt-threads-pill--${row.status}" data-act="status-toggle">
                ${esc(L(`Status.${row.status}`))}
                <i class="fas fa-chevron-down lrt-threads-status-caret"></i>
              </button>
              <div class="lrt-threads-status-list" role="listbox">${optsHtml}</div>
            </div>`;
    };

    const rowHtml = async (row) => {
        const expanded = st._threadsExpanded.has(row.id);
        const notesHtml = row.notes.map(n => `
              <div class="lrt-threads-note"><span class="lrt-threads-note-date">${esc(n.date)}</span><span>${esc(n.text)}</span></div>`).join("");
        const notesSectionHtml = `
            <div class="lrt-threads-notes">
              ${notesHtml}
              <div class="lrt-threads-note-add">
                <input type="text" class="lrt-threads-note-input" draggable="false" placeholder="${esc(L("NoteAddPlaceholder"))}" />
                <button type="button" class="lr-action-btn" data-act="add-note" title="${esc(L("BtnAddNote"))}"><i class="fas fa-plus"></i></button>
              </div>
            </div>`;

        const rowMenuHtml = `
          <div class="lrt-threads-overflow" data-act="row-menu">
            <button type="button" class="lr-action-btn" data-act="row-menu-toggle" title="${esc(L("BtnMore"))}"><i class="fas fa-ellipsis-vertical"></i></button>
            <div class="lrt-threads-overflow-menu">
              <div class="lrt-threads-overflow-item" data-act="edit" role="button" tabindex="0"><i class="fas fa-pencil-alt"></i> ${esc(L("BtnEdit"))}</div>
              <div class="lrt-threads-overflow-divider"></div>
              <div class="lrt-threads-overflow-item is-danger" data-act="delete" role="button" tabindex="0"><i class="fas fa-trash"></i> ${esc(L("BtnDelete"))}</div>
            </div>
          </div>`;
        const notesToggleHtml = `
          <div class="lrt-threads-notes-toggle" data-act="toggle-expand" role="button" tabindex="0" title="${esc(L("BtnToggleNotes"))}">
            <i class="fas fa-note-sticky"></i>
            <i class="fas fa-chevron-down lrt-threads-expand-caret"></i>
          </div>`;

        if (row.kind === "tracker") {
            return `
              <div class="lrt-threads-row lrt-threads-row--tracker lrt-threads-status-${row.status}${expanded ? " is-expanded" : ""}" data-row-id="${row.id}" draggable="true">
                <div class="lrt-threads-row-top">
                  <span class="lrt-threads-title">${esc(row.title)}</span>
                  ${statusSelectHtml(row)}
                  <span class="lrt-threads-row-actions">
                    <button type="button" class="lr-action-btn" data-act="step-down" title="${esc(L("BtnDecrement"))}"><i class="fas fa-minus"></i></button>
                    <button type="button" class="lr-action-btn" data-act="step-up" title="${esc(L("BtnIncrement"))}"><i class="fas fa-plus"></i></button>
                    ${rowMenuHtml}
                  </span>
                </div>
                <div class="lrt-threads-tracker-visual">${trackerVisualHtml(row)}</div>
                ${notesToggleHtml}
                ${notesSectionHtml}
              </div>`;
        }

        const linkChip = row.links[0] ? await journalChipHtml(row.links[0], row.id) : "";
        return `
          <div class="lrt-threads-row lrt-threads-row--thread lrt-threads-status-${row.status}${expanded ? " is-expanded" : ""}" data-row-id="${row.id}" draggable="true">
            <div class="lrt-threads-row-top">
              <span class="lrt-threads-title">${esc(row.title)}</span>
              ${statusSelectHtml(row)}
              <span class="lrt-threads-row-actions">
                ${rowMenuHtml}
              </span>
            </div>
            ${row.description ? `<p class="lrt-threads-desc">${esc(row.description)}</p>` : ""}
            ${linkChip ? `<div class="lrt-threads-chip-row">${linkChip}</div>` : ""}
            ${notesToggleHtml}
            ${notesSectionHtml}
          </div>`;
    };

    const groupSectionHtml = async (g, childRows, totalCount) => {
        const collapsed = st._threadsGroupCollapsed.has(g.id);
        const renaming = st._threadsGroupRenamingId === g.id;
        const countLabel = childRows.length === totalCount
            ? String(totalCount)
            : F("GroupCountFiltered", { shown: childRows.length, total: totalCount });
        const childHtml = collapsed ? "" : (childRows.length
            ? (await Promise.all(childRows.map(rowHtml))).join("")
            : `<p class="lrt-threads-group-empty">${esc(L("GroupEmpty"))}</p>`);
        const nameHtml = renaming
            ? `<input type="text" class="lrt-threads-group-name" draggable="false" value="${esc(g.name)}" />`
            : `<span class="lrt-threads-group-name-label">${esc(g.name)}</span>`;
        return `
          <div class="lrt-threads-group${collapsed ? " is-collapsed" : ""}" data-group-id="${g.id}" draggable="true" style="--lrt-group-color:${esc(g.color)}">
            <div class="lrt-threads-group-header">
              <i class="fas fa-chevron-down lrt-threads-group-caret" data-act="group-toggle"></i>
              <input type="color" class="lrt-threads-group-color" draggable="false" value="${esc(g.color)}" title="${esc(L("GroupColorTitle"))}" />
              ${nameHtml}
              <span class="lrt-threads-group-count">${esc(countLabel)}</span>
              <div class="lrt-threads-overflow" data-act="group-menu">
                <button type="button" class="lr-action-btn" data-act="group-menu-toggle" title="${esc(L("BtnMore"))}"><i class="fas fa-ellipsis-vertical"></i></button>
                <div class="lrt-threads-overflow-menu">
                  <div class="lrt-threads-overflow-item" data-act="group-rename-toggle" role="button" tabindex="0"><i class="fas fa-pencil-alt"></i> ${esc(L("BtnRename"))}</div>
                  <div class="lrt-threads-overflow-divider"></div>
                  <div class="lrt-threads-overflow-item is-danger" data-act="group-delete" role="button" tabindex="0"><i class="fas fa-trash"></i> ${esc(L("BtnDelete"))}</div>
                </div>
              </div>
            </div>
            <div class="lrt-threads-group-body">${childHtml}</div>
          </div>`;
    };

    const filterChipsHtml = () => {
        const opts = [["all", L("FilterAll")], ...loreRefBoard_THREADS_STATUSES.map(s => [s, L(`Status.${s}`)])];
        return opts.map(([key, label]) =>
            `<span class="lrt-threads-filter-chip${st._threadsFilter === key ? " is-on" : ""}" data-filter="${key}">${esc(label)}</span>`).join("");
    };

    const matchesFilter = (row) => st._threadsFilter === "all" || row.status === st._threadsFilter;

    const bodyParts = [];
    for (const item of buildTopLevelItems()) {
        if (item.type === "group") {
            const inGroup = rows.filter(r => r.groupId === item.group.id);
            const childRows = inGroup.filter(matchesFilter).sort((a, b) => a.sort - b.sort);
            bodyParts.push(await groupSectionHtml(item.group, childRows, inGroup.length));
        } else if (matchesFilter(item.row)) {
            bodyParts.push(await rowHtml(item.row));
        }
    }
    const rowsHtml = bodyParts.length ? bodyParts.join("") : `<p class="lrt-threads-empty">${esc(L("EmptyState"))}</p>`;

    pane.innerHTML = `
      <div class="lrt-threads-toolbar">
        <div class="lrt-threads-filters">${filterChipsHtml()}</div>
        <button type="button" class="lr-action-btn" id="lrt-threads-new" title="${esc(L("BtnNew"))}"><i class="fas fa-plus"></i></button>
        <div class="lrt-threads-overflow" data-act="overflow">
          <button type="button" class="lr-action-btn" data-act="overflow-toggle" title="${esc(L("BtnMore"))}"><i class="fas fa-bars"></i></button>
          <div class="lrt-threads-overflow-menu">
            <div class="lrt-threads-overflow-item" data-act="of-new-folder" role="button" tabindex="0"><i class="fas fa-folder-plus"></i> ${esc(L("BtnNewFolder"))}</div>
            ${groups.length ? `
            <div class="lrt-threads-overflow-item" data-act="of-collapse-all" role="button" tabindex="0"><i class="fas fa-angles-up"></i> ${esc(L("BtnCollapseAll"))}</div>
            <div class="lrt-threads-overflow-item" data-act="of-expand-all" role="button" tabindex="0"><i class="fas fa-angles-down"></i> ${esc(L("BtnExpandAll"))}</div>
            ` : ""}
          </div>
        </div>
      </div>
      <div class="lrt-threads-list">${rowsHtml}</div>`;

    const list = pane.querySelector(".lrt-threads-list");
    if (st._threadsPendingFocusGroupId) {
        const targetId = st._threadsPendingFocusGroupId;
        st._threadsPendingFocusGroupId = null;
        const groupEl = pane.querySelector(`.lrt-threads-group[data-group-id="${targetId}"]`);
        if (groupEl) {
            groupEl.scrollIntoView({ block: "nearest" });
            const input = groupEl.querySelector(".lrt-threads-group-name");
            input?.focus();
            input?.select();
        }
    } else if (list) {
        list.scrollTop = st._threadsScrollTop ?? 0;
    }

    const buildJournalPanelHtml = async (link) => {
        if (!link) {
            return `<div class="pgj-dropzone">
                <i class="fas fa-book pgj-drop-icon"></i>
                <p class="pgj-drop-primary">${esc(L("DropJournalPrimary"))}</p>
            </div>`;
        }
        const doc = await loreRefBoard_resolveJournalRef(link.uuid);
        if (!doc) {
            return `<div class="pgj-dropzone">
                <p class="plr-broken-note"><i class="fas fa-exclamation-triangle"></i> ${esc(F("MissingJournalNamed", { name: link.label || L("MissingJournal") }))}</p>
                <i class="fas fa-book pgj-drop-icon"></i>
                <p class="pgj-drop-primary">${esc(L("DropJournalPrimary"))}</p>
            </div>`;
        }
        const pages = loreRefBoard_getJournalPages(doc);
        const content = await loreRefBoard_enrichJournalPage(pages[0] ?? null, doc);
        return `
          <div class="pgj-linked-bar">
            <i class="fas fa-book-open pgj-linked-icon"></i>
            <span class="pgj-journal-title">${esc(doc.name)}</span>
            <button type="button" class="pgj-btn-unlink" data-act="journal-unlink" title="${esc(game.i18n.localize("lore-reference-board.Lore.BtnUnlinkTitle"))}">
                <i class="fas fa-unlink"></i> ${esc(game.i18n.localize("lore-reference-board.Lore.BtnUnlinkLabel"))}
            </button>
          </div>
          <div class="pgj-content" data-journal-id="${esc(doc.uuid)}">${content}</div>`;
    };

    const rowDialog = async (kind, existing) => {
        const uid = foundry.utils.randomID();
        const titleId = `tt-title-${uid}`;
        const isTracker = kind === "tracker";
        const statusOptsHtml = loreRefBoard_THREADS_STATUSES.map(s =>
            `<option value="${s}" ${existing?.status === s ? "selected" : ""}>${esc(L(`Status.${s}`))}</option>`).join("");
        const styleOptsHtml = loreRefBoard_THREADS_STYLES.map(s =>
            `<option value="${s}" ${(existing?.style ?? loreRefBoard_THREADS_STYLES[0]) === s ? "selected" : ""}>${esc(L(`Style.${s}`))}</option>`).join("");

        const milestonesListId = `tt-ms-list-${uid}`;
        const milestoneRowHtml = (m = { at: "", label: "" }) => `
          <div class="lrt-threads-ms-row">
            <input type="number" class="lrt-threads-ms-at" placeholder="${esc(L("MilestoneAtPlaceholder"))}" value="${m.at ?? ""}" min="0" style="width:70px" />
            <input type="text" class="lrt-threads-ms-label" placeholder="${esc(L("MilestoneLabelPlaceholder"))}" value="${esc(m.label ?? "")}" style="flex:1" />
            <button type="button" class="lr-action-btn" data-act="ms-remove" title="${esc(L("BtnDelete"))}"><i class="fas fa-xmark"></i></button>
          </div>`;

        const trackerFields = !isTracker ? "" : `
          <div style="display:flex;gap:8px">
            <div style="flex:1">
              <label style="display:block;margin-bottom:4px;font-weight:bold">${esc(L("LabelCurrent"))}</label>
              <input type="number" name="ttCurrent" value="${existing?.current ?? 0}" min="0" style="width:100%" />
            </div>
            <div style="flex:1">
              <label style="display:block;margin-bottom:4px;font-weight:bold">${esc(L("LabelMax"))}</label>
              <input type="number" name="ttMax" value="${existing?.max ?? 10}" min="1" style="width:100%" />
            </div>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">${esc(L("LabelStyle"))}</label>
            <select name="ttStyle" style="width:100%;color-scheme:dark">
              ${styleOptsHtml}
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:bold">${esc(L("LabelMilestones"))}</label>
            <div id="${milestonesListId}">${(existing?.milestones ?? []).map(m => milestoneRowHtml(m)).join("")}</div>
            <button type="button" class="lrt-layer-mini-btn" id="tt-ms-add-${uid}" style="margin-top:6px"><i class="fas fa-plus"></i> ${esc(L("BtnAddMilestone"))}</button>
          </div>`;

        const journalColId = `tt-journal-col-${uid}`;
        let linkedUuid = existing?.links?.[0]?.uuid ?? null;
        let linkedLabel = existing?.links?.[0]?.label ?? null;

        const leftColHtml = `
          <div style="display:flex;flex-direction:column;gap:12px;flex:1;min-width:0">
            <div>
              <label style="display:block;margin-bottom:4px;font-weight:bold">${esc(L("LabelTitle"))}</label>
              <input type="text" id="${titleId}" name="ttTitle" value="${esc(existing?.title ?? "")}" style="width:100%" autofocus />
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-weight:bold">${esc(L("LabelStatus"))}</label>
              <select name="ttStatus" style="width:100%;color-scheme:dark">${statusOptsHtml}</select>
            </div>
            ${isTracker ? "" : `
            <div>
              <label style="display:block;margin-bottom:4px;font-weight:bold">${esc(L("LabelDescription"))}</label>
              <textarea name="ttDesc" rows="4" style="width:100%;resize:vertical">${esc(existing?.description ?? "")}</textarea>
            </div>`}
            ${trackerFields}
          </div>`;

        const rightColHtml = isTracker ? "" : `
          <div class="lrt-threads-journal-col pg-journal-col" id="${journalColId}" style="flex:1;min-width:0">
            ${await buildJournalPanelHtml(existing?.links?.[0] ?? null)}
          </div>`;

        const content = `
          <form>
            <div style="display:flex;gap:16px;padding:6px 0">
              ${leftColHtml}
              ${rightColHtml}
            </div>
          </form>`;

        const kindLabel = L(isTracker ? "KindTracker" : "KindThread");

        const waitPromise = DialogV2.wait({
            window: { title: F(existing ? "EditTitle" : "NewTitle", { kind: kindLabel }) },
            classes: ["lore-rb-dialog"],
            position: { width: isTracker ? 460 : 780 },
            content,
            buttons: [
                {
                    action: "save",
                    label: game.i18n.localize("lore-reference-board.Common.Save"),
                    default: true,
                    callback: (_ev, btn) => {
                        const dialog = btn.closest("dialog");
                        const form = dialog?.querySelector("form")?.elements;
                        const out = {
                            title: (form?.ttTitle?.value ?? "").trim(),
                            status: loreRefBoard_THREADS_STATUSES.includes(form?.ttStatus?.value) ? form.ttStatus.value : "active",
                        };
                        if (isTracker) {
                            out.current = Math.max(0, parseInt(form?.ttCurrent?.value, 10) || 0);
                            out.max = Math.max(1, parseInt(form?.ttMax?.value, 10) || 1);
                            out.style = loreRefBoard_THREADS_STYLES.includes(form?.ttStyle?.value) ? form.ttStyle.value : loreRefBoard_THREADS_STYLES[0];
                            out.milestones = [...dialog.querySelectorAll(".lrt-threads-ms-row")].map(r => ({
                                at: parseInt(r.querySelector(".lrt-threads-ms-at")?.value, 10),
                                label: (r.querySelector(".lrt-threads-ms-label")?.value ?? "").trim(),
                            })).filter(m => Number.isFinite(m.at));
                        } else {
                            out.description = (form?.ttDesc?.value ?? "").trim();
                            out.links = linkedUuid ? [{ kind: "journal", uuid: linkedUuid, label: linkedLabel }] : [];
                        }
                        return { action: "save", ...out };
                    },
                },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel") },
            ],
            rejectClose: true,
        });

        loreRefBoard_afterDialogRender(() => {
            const addBtn = document.getElementById(`tt-ms-add-${uid}`);
            const list2 = document.getElementById(milestonesListId);
            if (isTracker && addBtn && list2) {
                addBtn.addEventListener("click", () => {
                    list2.insertAdjacentHTML("beforeend", milestoneRowHtml());
                });
                list2.addEventListener("click", (ev) => {
                    const btn = ev.target.closest('[data-act="ms-remove"]');
                    if (!btn) return;
                    btn.closest(".lrt-threads-ms-row")?.remove();
                });
            }

            if (!isTracker) {
                const col = document.getElementById(journalColId);
                if (!col) return true;

                // Rewired after every innerHTML swap since these get replaced each time.
                const wireJournalColContent = () => {
                    col.querySelector('[data-act="journal-unlink"]')?.addEventListener("click", async () => {
                        linkedUuid = null;
                        linkedLabel = null;
                        col.innerHTML = await buildJournalPanelHtml(null);
                        wireJournalColContent();
                    });
                    const contentEl = col.querySelector(".pgj-content");
                    if (contentEl) loreRefBoard_wirePageNav(contentEl, contentEl.dataset.journalId);
                };
                wireJournalColContent();

                let dragDepth = 0;
                col.addEventListener("dragenter", (ev) => {
                    ev.preventDefault();
                    dragDepth++;
                    col.classList.add("pgj-drop-active");
                });
                col.addEventListener("dragleave", () => {
                    dragDepth = Math.max(0, dragDepth - 1);
                    if (dragDepth === 0) col.classList.remove("pgj-drop-active");
                });
                col.addEventListener("dragover", (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "link"; });
                col.addEventListener("drop", async (ev) => {
                    ev.preventDefault();
                    dragDepth = 0;
                    col.classList.remove("pgj-drop-active");
                    let data;
                    try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
                    catch { return; }
                    if (!loreRefBoard_THREADS_ACCEPTED_TYPES.has(data?.type)) return;
                    let doc; try { doc = await fromUuid(data.uuid ?? ""); } catch { doc = null; }
                    if (!doc) return;
                    const journal = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
                    linkedUuid = journal.uuid;
                    linkedLabel = journal.name;
                    col.innerHTML = await buildJournalPanelHtml({ kind: "journal", uuid: linkedUuid, label: linkedLabel });
                    wireJournalColContent();
                });
            }
            return true;
        });

        let result;
        try { result = await waitPromise; } catch { return null; }
        if (!result || result === "cancel" || result?.action === "cancel") return null;
        if (!result.title) { ui.notifications.warn(game.i18n.localize("lore-reference-board.Tab.NameRequired")); return null; }
        return result;
    };

    const askKind = async () => {
        const result = await DialogV2.wait({
            window: { title: L("NewPickTitle") },
            classes: ["lore-rb-dialog"],
            position: { width: 380 },
            content: `<p style="margin:0 0 4px">${esc(L("NewPickPrompt"))}</p>`,
            buttons: [
                { action: "thread", label: L("KindThread"), default: true, callback: () => "thread" },
                { action: "tracker", label: L("KindTracker"), callback: () => "tracker" },
                { action: "cancel", label: game.i18n.localize("lore-reference-board.Common.Cancel"), callback: () => "cancel" },
            ],
            rejectClose: false,
        });
        return result ?? "cancel";
    };

    const addNoteFromRow = async (rowEl, row) => {
        const input = rowEl.querySelector(".lrt-threads-note-input");
        const text = (input?.value ?? "").trim();
        if (!text) return;
        row.notes.push({ date: new Date().toISOString().slice(0, 10), text });
        await persistAndRefresh();
    };

    pane.querySelector("#lrt-threads-new")?.addEventListener("click", async () => {
        const kind = await askKind();
        if (kind === "cancel") return;
        const res = await rowDialog(kind, null);
        if (!res) return;
        rows.push(_loreRefBoard_normalizeThreadRow({ ...res, kind, sort: maxTopSort() + 1 }));
        await persistAndRefresh();
    });

    const overflow = pane.querySelector('[data-act="overflow"]');
    const closeOverflow = () => overflow?.classList.remove("is-open");
    overflow?.querySelector('[data-act="overflow-toggle"]')?.addEventListener("click", (ev) => {
        ev.stopPropagation();
        overflow.classList.toggle("is-open");
    });

    const wireOverflowItem = (act, handler) => {
        const el = overflow?.querySelector(`[data-act="${act}"]`);
        const run = async () => { closeOverflow(); await handler(); };
        el?.addEventListener("click", (ev) => { ev.stopPropagation(); run(); });
        el?.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); run(); }
        });
    };

    wireOverflowItem("of-new-folder", async () => {
        const newGroup = _loreRefBoard_normalizeThreadGroup({ name: L("DefaultFolderName"), sort: maxTopSort() + 1 }, groups.length);
        groups.push(newGroup);
        groups.sort((a, b) => a.sort - b.sort);
        await host.save({ groups, rows });
        st._threadsPendingFocusGroupId = newGroup.id;
        await host.requestRender();
    });

    wireOverflowItem("of-collapse-all", async () => {
        groups.forEach(g => st._threadsGroupCollapsed.add(g.id));
        await rerender();
    });
    wireOverflowItem("of-expand-all", async () => {
        st._threadsGroupCollapsed.clear();
        await rerender();
    });

    pane.querySelectorAll(".lrt-threads-filter-chip").forEach(chip => {
        chip.addEventListener("click", async () => {
            st._threadsFilter = chip.dataset.filter;
            await rerender();
        });
    });

    pane.querySelectorAll(".lrt-threads-group").forEach(groupEl => {
        const groupId = groupEl.dataset.groupId;
        const g = groups.find(x => x.id === groupId);
        if (!g) return;

        const toggleGroupCollapsed = async () => {
            if (st._threadsGroupCollapsed.has(groupId)) st._threadsGroupCollapsed.delete(groupId);
            else st._threadsGroupCollapsed.add(groupId);
            await rerender();
        };

        groupEl.querySelector('[data-act="group-toggle"]')?.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            await toggleGroupCollapsed();
        });

        groupEl.querySelector(".lrt-threads-group-header")?.addEventListener("dblclick", async (ev) => {
            if (ev.target.closest('input, button, select, textarea, .lrt-threads-overflow, [data-act="group-toggle"]')) return;
            ev.preventDefault();
            ev.stopPropagation();
            await toggleGroupCollapsed();
        });

        groupEl.querySelector('[data-act="group-rename-toggle"]')?.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            st._threadsGroupRenamingId = groupId;
            st._threadsPendingFocusGroupId = groupId;
            await rerender();
        });

        const nameInput = groupEl.querySelector(".lrt-threads-group-name");
        nameInput?.addEventListener("click", ev => ev.stopPropagation());
        nameInput?.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); nameInput.blur(); } });
        nameInput?.addEventListener("blur", async () => {
            const val = nameInput.value.trim() || L("DefaultFolderName");
            st._threadsGroupRenamingId = null;
            if (val === g.name) { await rerender(); return; }
            g.name = val;
            await persistAndRefresh();
        });

        const colorInput = groupEl.querySelector(".lrt-threads-group-color");
        colorInput?.addEventListener("click", ev => ev.stopPropagation());
        colorInput?.addEventListener("input", () => { groupEl.style.setProperty("--lrt-group-color", colorInput.value); });
        colorInput?.addEventListener("change", async () => {
            if (colorInput.value === g.color) return;
            g.color = colorInput.value;
            await persistAndRefresh();
        });

        const groupMenu = groupEl.querySelector('[data-act="group-menu"]');
        const closeGroupMenu = () => groupMenu?.classList.remove("is-open");
        groupMenu?.querySelector('[data-act="group-menu-toggle"]')?.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const wasOpen = groupMenu.classList.contains("is-open");
            pane.querySelectorAll(".lrt-threads-overflow.is-open").forEach(el => el.classList.remove("is-open"));
            if (!wasOpen) groupMenu.classList.add("is-open");
        });
        groupMenu?.querySelectorAll('.lrt-threads-overflow-item').forEach(el => {
            el.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); el.click(); }
            });
        });

        groupEl.querySelector('[data-act="group-delete"]')?.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            closeGroupMenu();
            const childCount = rows.filter(r => r.groupId === groupId).length;
            const confirmed = await DialogV2.confirm({
                classes: ["lore-rb-dialog"],
                window: { title: L("DeleteFolderTitle") },
                content: `<p>${F("DeleteFolderConfirm", { name: esc(g.name), count: childCount })}</p>`,
                yes: { action: "delete", icon: "fas fa-trash" },
                rejectClose: false,
            });
            if (!confirmed) return;
            let nextSort = maxTopSort() + 1;
            for (const r of rows) if (r.groupId === groupId) { r.groupId = null; r.sort = nextSort++; }
            groups = groups.filter(x => x.id !== groupId);
            await persistAndRefresh();
        });
    });

    pane.querySelectorAll(".lrt-threads-row").forEach(rowEl => {
        const rowId = rowEl.dataset.rowId;
        const row = rows.find(r => r.id === rowId);
        if (!row) return;

        const toggleNotesExpand = async () => {
            if (st._threadsExpanded.has(rowId)) st._threadsExpanded.delete(rowId);
            else st._threadsExpanded.add(rowId);
            await rerender();
        };
        const notesToggleEl = rowEl.querySelector('[data-act="toggle-expand"]');
        notesToggleEl?.addEventListener("click", (ev) => { ev.stopPropagation(); toggleNotesExpand(); });
        notesToggleEl?.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); toggleNotesExpand(); }
        });

        rowEl.querySelector(".lrt-threads-row-top")?.addEventListener("dblclick", (ev) => {
            if (ev.target.closest('input, button, select, textarea, .lrt-threads-overflow')) return;
            ev.preventDefault();
            ev.stopPropagation();
            toggleNotesExpand();
        });

        const rowMenu = rowEl.querySelector('[data-act="row-menu"]');
        const closeRowMenu = () => rowMenu?.classList.remove("is-open");
        rowMenu?.querySelector('[data-act="row-menu-toggle"]')?.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const wasOpen = rowMenu.classList.contains("is-open");
            pane.querySelectorAll(".lrt-threads-overflow.is-open").forEach(el => el.classList.remove("is-open"));
            if (!wasOpen) rowMenu.classList.add("is-open");
        });
        rowMenu?.querySelectorAll('.lrt-threads-overflow-item').forEach(el => {
            el.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); el.click(); }
            });
        });

        const statusDd = rowEl.querySelector('[data-act="status-dd"]');
        statusDd?.querySelector('[data-act="status-toggle"]')?.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const wasOpen = statusDd.classList.contains("is-open");
            pane.querySelectorAll(".lrt-threads-status-dd.is-open").forEach(el => el.classList.remove("is-open"));
            if (!wasOpen) openStatusDropdown(statusDd);
        });
        statusDd?.querySelectorAll('[data-act="status-opt"]').forEach(optEl => {
            const chooseStatus = async () => {
                const value = optEl.dataset.value;
                statusDd.classList.remove("is-open");
                if (!loreRefBoard_THREADS_STATUSES.includes(value) || value === row.status) return;
                row.status = value;
                await persistAndRefresh();
            };
            optEl.addEventListener("click", (ev) => { ev.stopPropagation(); chooseStatus(); });
            optEl.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); chooseStatus(); }
            });
        });

        const openRowEditor = async () => {
            const res = await rowDialog(row.kind, row);
            if (!res) return;
            const idx = rows.findIndex(r => r.id === rowId);
            rows[idx] = _loreRefBoard_normalizeThreadRow({ ...row, ...res });
            await persistAndRefresh();
        };

        rowEl.querySelector('[data-act="edit"]')?.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            closeRowMenu();
            await openRowEditor();
        });

        rowEl.querySelector('[data-act="open-broken-link"]')?.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            await openRowEditor();
        });

        rowEl.querySelector('[data-act="delete"]')?.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            closeRowMenu();
            const confirmed = await DialogV2.confirm({
                classes: ["lore-rb-dialog"],
                window: { title: L("DeleteTitle") },
                content: `<p>${F("DeleteConfirm", { name: esc(row.title) })}</p>`,
                yes: { action: "delete", icon: "fas fa-trash" },
                rejectClose: false,
            });
            if (!confirmed) return;
            st._threadsExpanded.delete(rowId);
            rows = rows.filter(r => r.id !== rowId);
            await persistAndRefresh();
        });

        rowEl.querySelector('[data-act="step-up"]')?.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            row.current = Math.min(row.max, row.current + 1);
            await persistAndRefresh();
        });
        rowEl.querySelector('[data-act="step-down"]')?.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            row.current = Math.max(0, row.current - 1);
            await persistAndRefresh();
        });

        rowEl.querySelector('[data-act="add-note"]')?.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            await addNoteFromRow(rowEl, row);
        });
        const noteInput = rowEl.querySelector(".lrt-threads-note-input");
        noteInput?.addEventListener("keydown", async (ev) => {
            if (ev.key !== "Enter") return;
            ev.preventDefault();
            await addNoteFromRow(rowEl, row);
        });

        rowEl.querySelector('[data-act="open-journal"]')?.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            const uuid = ev.currentTarget.dataset.journalUuid;
            const doc = uuid ? await loreRefBoard_resolveJournalRef(uuid) : null;
            doc?.sheet?.render(true);
        });
    });

    if (st._threadsOutsideClickHandler) {
        document.removeEventListener("click", st._threadsOutsideClickHandler, true);
    }
    st._threadsOutsideClickHandler = (ev) => {
        if (!ev.target.closest?.(".lrt-threads-status-dd")) {
            pane.querySelectorAll(".lrt-threads-status-dd.is-open").forEach(el => el.classList.remove("is-open"));
        }
        if (!ev.target.closest?.(".lrt-threads-overflow")) {
            pane.querySelectorAll(".lrt-threads-overflow.is-open").forEach(el => el.classList.remove("is-open"));
        }
    };
    document.addEventListener("click", st._threadsOutsideClickHandler, true);

    let dragState = null;
    const clearDropHints = () => pane.querySelectorAll(".lrt-threads-drop-before, .lrt-threads-drop-after, .lrt-threads-drop-into")
        .forEach(el => el.classList.remove("lrt-threads-drop-before", "lrt-threads-drop-after", "lrt-threads-drop-into"));

    pane.addEventListener("dragstart", (ev) => {
        const draggable = ev.target.closest('[draggable="true"]');
        if (!draggable) { dragState = null; return; }
        if (draggable.classList.contains("lrt-threads-row")) {
            dragState = { kind: "row", id: draggable.dataset.rowId };
            ev.dataTransfer.effectAllowed = "move";
        } else if (draggable.classList.contains("lrt-threads-group")) {
            dragState = { kind: "group", id: draggable.dataset.groupId };
            ev.dataTransfer.effectAllowed = "move";
        } else {
            dragState = null;
        }
    });

    pane.addEventListener("dragover", (ev) => {
        if (!dragState) return;
        const groupHeaderEl = ev.target.closest(".lrt-threads-group-header");
        const rowEl = ev.target.closest(".lrt-threads-row[data-row-id]");
        const groupEl = ev.target.closest(".lrt-threads-group[data-group-id]");

        if (dragState.kind === "row" && groupHeaderEl) {
            ev.preventDefault();
            clearDropHints();
            groupHeaderEl.closest(".lrt-threads-group")?.classList.add("lrt-threads-drop-into");
            return;
        }
        if (rowEl && rowEl.dataset.rowId !== dragState.id) {
            ev.preventDefault();
            clearDropHints();
            const rect = rowEl.getBoundingClientRect();
            const before = ev.clientY < rect.top + rect.height / 2;
            rowEl.classList.add(before ? "lrt-threads-drop-before" : "lrt-threads-drop-after");
            return;
        }
        if (dragState.kind === "group" && groupEl && groupEl.dataset.groupId !== dragState.id) {
            ev.preventDefault();
            clearDropHints();
            const rect = groupEl.getBoundingClientRect();
            const before = ev.clientY < rect.top + rect.height / 2;
            groupEl.classList.add(before ? "lrt-threads-drop-before" : "lrt-threads-drop-after");
        }
    });

    pane.addEventListener("drop", async (ev) => {
        if (!dragState) return;
        ev.preventDefault();
        const groupHeaderEl = ev.target.closest(".lrt-threads-group-header");
        const rowEl = ev.target.closest(".lrt-threads-row[data-row-id]");
        const groupEl = ev.target.closest(".lrt-threads-group[data-group-id]");
        clearDropHints();

        if (dragState.kind === "row") {
            const draggedRow = rows.find(r => r.id === dragState.id);
            if (!draggedRow) { dragState = null; return; }

            if (groupHeaderEl) {
                const targetGroupId = groupHeaderEl.closest(".lrt-threads-group")?.dataset.groupId;
                if (targetGroupId && targetGroupId !== draggedRow.groupId) {
                    const siblingMax = rows.filter(r => r.groupId === targetGroupId).reduce((m, r) => Math.max(m, r.sort), -1);
                    draggedRow.groupId = targetGroupId;
                    draggedRow.sort = siblingMax + 1;
                    await persistAndRefresh();
                }
                dragState = null;
                return;
            }

            if (rowEl && rowEl.dataset.rowId !== dragState.id) {
                const targetRow = rows.find(r => r.id === rowEl.dataset.rowId);
                if (targetRow) {
                    const rect = rowEl.getBoundingClientRect();
                    const before = ev.clientY < rect.top + rect.height / 2;
                    draggedRow.groupId = targetRow.groupId ?? null;
                    const siblings = rows.filter(r => r.groupId === draggedRow.groupId && r.id !== draggedRow.id)
                        .sort((a, b) => a.sort - b.sort);
                    const targetIdx = siblings.findIndex(r => r.id === targetRow.id);
                    const insertAt = before ? targetIdx : targetIdx + 1;
                    siblings.splice(insertAt, 0, draggedRow);
                    siblings.forEach((r, i) => { r.sort = i; });
                    await persistAndRefresh();
                }
            }
            dragState = null;
            return;
        }

        if (dragState.kind === "group") {
            const draggedGroup = groups.find(g => g.id === dragState.id);
            if (!draggedGroup) { dragState = null; return; }
            const targetEl = rowEl ?? groupEl;
            if (targetEl) {
                const rect = targetEl.getBoundingClientRect();
                const before = ev.clientY < rect.top + rect.height / 2;
                const topItems = buildTopLevelItems().filter(item => !(item.type === "group" && item.group.id === draggedGroup.id));
                const targetId = rowEl ? rowEl.dataset.rowId : groupEl.dataset.groupId;
                const targetIdx = topItems.findIndex(item => (item.type === "row" ? item.row.id : item.group.id) === targetId);
                if (targetIdx !== -1) {
                    const insertAt = before ? targetIdx : targetIdx + 1;
                    topItems.splice(insertAt, 0, { type: "group", group: draggedGroup });
                    topItems.forEach((item, i) => { if (item.type === "group") item.group.sort = i; else item.row.sort = i; });
                    await persistAndRefresh();
                }
            }
            dragState = null;
        }
    });

    pane.addEventListener("dragend", () => { dragState = null; clearDropHints(); });
}

async function loreRefBoard_setupThreadsTab(app, html, tab) {
    const pane = html.find("#lr-threads-pane")[0];
    if (!pane) return;
    const tabId = tab.id;
    return loreRefBoard_setupThreadsView({
        pane,
        state: app,
        defaultStyle: loreRefBoard_THREADS_STYLES[0],
        load: () => loreRefBoard_loadThreadsForTab(tabId),
        save: (data) => loreRefBoard_saveThreadsForTab(tabId, data),
        requestRender: () => app.render(),
    });
}

export { loreRefBoard_setupThreadsTab, loreRefBoard_setupThreadsView };
