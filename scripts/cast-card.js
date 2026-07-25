import { loreRefBoard_CAST_NAMING_STYLES, loreRefBoard_CAST_SPECIES_LABELS, loreRefBoard_generateCastField, loreRefBoard_generateCastFields, loreRefBoard_getCastSpeciesList } from "./cast-generator.js";
import { loreRefBoard_loadCastDataMap, loreRefBoard_saveCastEntry } from "./storage.js";
import { loreRefBoard_escapeHtml } from "./utils.js";

const loreRefBoard_CAST_GENERATED_FIELDS = ["name", "role", "quote", "quirks", "voice", "hook", "secret", "want"];

function _loreRefBoard_snapshotGeneratedFields(entry) {
    const snap = {};
    for (const f of loreRefBoard_CAST_GENERATED_FIELDS) snap[f] = entry[f];
    return snap;
}

async function loreRefBoard_regenerateCastField(castId, field) {
    const map = await loreRefBoard_loadCastDataMap();
    const entry = map[castId];
    if (!entry) return null;
    entry.previousGeneration = _loreRefBoard_snapshotGeneratedFields(entry);
    entry[field] = loreRefBoard_generateCastField(field, { species: entry.species, namingStyle: entry.namingStyle });
    await loreRefBoard_saveCastEntry(castId, entry);
    return entry;
}

async function loreRefBoard_regenerateCastAll(castId) {
    const map = await loreRefBoard_loadCastDataMap();
    const entry = map[castId];
    if (!entry) return null;
    entry.previousGeneration = _loreRefBoard_snapshotGeneratedFields(entry);
    Object.assign(entry, loreRefBoard_generateCastFields({ species: entry.species, namingStyle: entry.namingStyle }));
    await loreRefBoard_saveCastEntry(castId, entry);
    return entry;
}

async function loreRefBoard_undoCastGeneration(castId) {
    const map = await loreRefBoard_loadCastDataMap();
    const entry = map[castId];
    if (!entry?.previousGeneration) return null;
    Object.assign(entry, entry.previousGeneration);
    entry.previousGeneration = null;
    await loreRefBoard_saveCastEntry(castId, entry);
    return entry;
}

async function loreRefBoard_updateCastEntryField(castId, field, value) {
    const map = await loreRefBoard_loadCastDataMap();
    const entry = map[castId];
    if (!entry) return null;
    entry[field] = field === "quirks"
        ? value.split(",").map(s => s.trim()).filter(Boolean)
        : value;
    await loreRefBoard_saveCastEntry(castId, entry);
    return entry;
}

function _loreRefBoard_fieldRow(field, label, value) {
    return `
        <div class="lrc-field-row lrc-field-row--stacked">
            <label>${loreRefBoard_escapeHtml(label)}</label>
            <textarea class="lrc-field-input" data-field="${field}" rows="1">${loreRefBoard_escapeHtml(value ?? "")}</textarea>
            <button type="button" class="lrc-reroll" data-field="${field}" title="${game.i18n.localize("lore-reference-board.Cast.Reroll")}">
                <i class="fas fa-dice"></i>
            </button>
        </div>`;
}

function loreRefBoard_renderCastFrontFields(entry) {
    const quirks = Array.isArray(entry.quirks) ? entry.quirks.join(", ") : "";
    return [
        _loreRefBoard_fieldRow("name", game.i18n.localize("lore-reference-board.Cast.FieldName"), entry.name),
        _loreRefBoard_fieldRow("role", game.i18n.localize("lore-reference-board.Cast.FieldRole"), entry.role),
        _loreRefBoard_fieldRow("quote", game.i18n.localize("lore-reference-board.Cast.FieldQuote"), entry.quote),
        _loreRefBoard_fieldRow("quirks", game.i18n.localize("lore-reference-board.Cast.FieldQuirks"), quirks),
        _loreRefBoard_fieldRow("voice", game.i18n.localize("lore-reference-board.Cast.FieldVoice"), entry.voice),
        _loreRefBoard_fieldRow("hook", game.i18n.localize("lore-reference-board.Cast.FieldHook"), entry.hook),
    ].join("");
}

function loreRefBoard_renderCastBackFields(entry) {
    const area = (field, label, value, rows, { reroll = false } = {}) => {
        const rerollBtn = reroll
            ? `<button type="button" class="lrc-reroll" data-field="${field}" title="${game.i18n.localize("lore-reference-board.Cast.Reroll")}">
                    <i class="fas fa-dice"></i>
                </button>`
            : "";
        return `
        <div class="lrc-field-row lrc-field-row--stacked">
            <label>${loreRefBoard_escapeHtml(label)}</label>
            <textarea class="lrc-field-textarea" data-field="${field}" rows="${rows}">${loreRefBoard_escapeHtml(value ?? "")}</textarea>
            ${rerollBtn}
        </div>`;
    };
    return [
        area("secret", game.i18n.localize("lore-reference-board.Cast.FieldSecret"), entry.secret, 2, { reroll: true }),
        area("want", game.i18n.localize("lore-reference-board.Cast.FieldWant"), entry.want, 2, { reroll: true }),
        area("notes", game.i18n.localize("lore-reference-board.Cast.FieldNotes"), entry.notes, 3),
    ].join("");
}

function _loreRefBoard_genOptionsHtml(entry) {
    const speciesValue = entry.species || "any";
    const speciesOpts = [`<option value="any"${speciesValue === "any" ? " selected" : ""}>${game.i18n.localize("lore-reference-board.Cast.SpeciesAny")}</option>`]
        .concat(loreRefBoard_getCastSpeciesList().map(id =>
            `<option value="${id}"${speciesValue === id ? " selected" : ""}>${loreRefBoard_escapeHtml(loreRefBoard_CAST_SPECIES_LABELS[id])}</option>`
        )).join("");

    const styleValue = entry.namingStyle || "any";
    const styleOpts = ["any", ...loreRefBoard_CAST_NAMING_STYLES].map(id => {
        const key = `Naming${id.charAt(0).toUpperCase()}${id.slice(1)}`;
        return `<option value="${id}"${styleValue === id ? " selected" : ""}>${game.i18n.localize(`lore-reference-board.Cast.${key}`)}</option>`;
    }).join("");

    return `
        <div class="lrc-gen-options">
            <div class="lrc-gen-option">
                <label>${game.i18n.localize("lore-reference-board.Cast.FieldSpecies")}</label>
                <select class="lrc-species-select">${speciesOpts}</select>
            </div>
            <div class="lrc-gen-option">
                <label>${game.i18n.localize("lore-reference-board.Cast.FieldNamingStyle")}</label>
                <select class="lrc-naming-select">${styleOpts}</select>
            </div>
        </div>`;
}

function loreRefBoard_renderCastCard(entry, { showBack = false } = {}) {
    const flipLabel = showBack
        ? game.i18n.localize("lore-reference-board.Cast.ShowFront")
        : game.i18n.localize("lore-reference-board.Cast.ShowBack");
    const undoBtn = entry.previousGeneration
        ? `<button type="button" class="lrc-undo" title="${game.i18n.localize("lore-reference-board.Cast.Undo")}"><i class="fas fa-rotate-left"></i></button>`
        : "";
    return `
        <div class="lrc-card">
            <div class="lrc-card-header">
                <button type="button" class="lrc-flip">
                    <i class="fas fa-rotate"></i> ${flipLabel}
                </button>
                <button type="button" class="lrc-regen-all" title="${game.i18n.localize("lore-reference-board.Cast.RegenAll")}">
                    <i class="fas fa-dice-d20"></i>
                </button>
                ${undoBtn}
            </div>
            ${_loreRefBoard_genOptionsHtml(entry)}
            <div class="lrc-card-body">
                ${showBack ? loreRefBoard_renderCastBackFields(entry) : loreRefBoard_renderCastFrontFields(entry)}
            </div>
        </div>`;
}

const loreRefBoard_CAST_FIELD_MAX_HEIGHT = 140;

function _loreRefBoard_autoGrowField(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, loreRefBoard_CAST_FIELD_MAX_HEIGHT) + "px";
}

function loreRefBoard_wireCastCardEvents(container, castId, { onChange, onFlip } = {}) {
    if (!container) return;
    const $c = $(container);

    const $growFields = $c.find(".lrc-field-input, .lrc-field-textarea");
    $growFields.each((_i, el) => _loreRefBoard_autoGrowField(el));
    $growFields.off("input.lrcGrow").on("input.lrcGrow", (ev) => _loreRefBoard_autoGrowField(ev.currentTarget));

    $c.find(".lrc-field-input, .lrc-field-textarea").off("change").on("change", async (ev) => {
        const field = ev.currentTarget.dataset.field;
        await loreRefBoard_updateCastEntryField(castId, field, ev.currentTarget.value);
        onChange?.();
    });

    $c.find(".lrc-reroll").off("click").on("click", async (ev) => {
        const field = ev.currentTarget.dataset.field;
        await loreRefBoard_regenerateCastField(castId, field);
        onChange?.();
    });

    $c.find(".lrc-regen-all").off("click").on("click", async () => {
        await loreRefBoard_regenerateCastAll(castId);
        onChange?.();
    });

    $c.find(".lrc-undo").off("click").on("click", async () => {
        await loreRefBoard_undoCastGeneration(castId);
        onChange?.();
    });

    $c.find(".lrc-flip").off("click").on("click", () => {
        onFlip?.();
    });

    $c.find(".lrc-species-select").off("change").on("change", async (ev) => {
        await loreRefBoard_updateCastEntryField(castId, "species", ev.currentTarget.value);
        onChange?.();
    });

    $c.find(".lrc-naming-select").off("change").on("change", async (ev) => {
        await loreRefBoard_updateCastEntryField(castId, "namingStyle", ev.currentTarget.value);
        onChange?.();
    });
}

export {
    loreRefBoard_regenerateCastField,
    loreRefBoard_regenerateCastAll,
    loreRefBoard_undoCastGeneration,
    loreRefBoard_updateCastEntryField,
    loreRefBoard_renderCastFrontFields,
    loreRefBoard_renderCastBackFields,
    loreRefBoard_renderCastCard,
    loreRefBoard_wireCastCardEvents,
};
