let _loreRefBoard_ddOpen = null;

export function loreRefBoard_enhanceSelect(select) {
    if (!select || select.multiple || select.size > 1 || select.dataset.lrbDropdown) return select;
    select.dataset.lrbDropdown = "1";
    select.addEventListener("mousedown", event => {
        if (event.button !== 0) return;
        event.preventDefault();
        if (_loreRefBoard_ddOpen?.select === select) _loreRefBoard_ddClose();
        else _loreRefBoard_ddShow(select);
    });
    select.addEventListener("keydown", event => _loreRefBoard_ddKey(select, event));
    return select;
}

function _loreRefBoard_ddShow(select) {
    if (select.disabled) return;
    _loreRefBoard_ddClose();
    select.focus();
    const style = getComputedStyle(select);
    const list = document.createElement("div");
    list.className = "lrb-dropdown";
    list.setAttribute("role", "listbox");
    list.style.fontSize = style.fontSize;
    list.style.fontFamily = style.fontFamily;
    list.style.color = style.color;
    list.style.setProperty("--lrb-dd-bg", style.backgroundColor);
    list.style.setProperty("--lrb-dd-border", style.borderColor);
    const accent = style.getPropertyValue("--lrb-accent").trim();
    if (accent) list.style.setProperty("--lrb-dd-accent", accent);

    const items = [];
    const addOption = (option, parent) => {
        const row = document.createElement("div");
        row.className = "lrb-dropdown-option";
        row.setAttribute("role", "option");
        row.textContent = option.textContent;
        if (option.dataset.note) row.appendChild(Object.assign(document.createElement("span"), { className: "lrb-dropdown-note", textContent: option.dataset.note }));
        if (option.disabled || parent?.disabled) row.classList.add("disabled");
        if (option.selected) row.classList.add("selected");
        row.setAttribute("aria-selected", String(option.selected));
        const index = items.length;
        row.addEventListener("pointermove", () => _loreRefBoard_ddActivate(index, false));
        row.addEventListener("click", () => _loreRefBoard_ddPick(index));
        items.push({ row, option, disabled: row.classList.contains("disabled") });
        list.appendChild(row);
    };
    for (const child of select.children) {
        if (child.tagName === "OPTGROUP") {
            const head = document.createElement("div");
            head.className = "lrb-dropdown-group";
            if (child.dataset.tone) head.dataset.tone = child.dataset.tone;
            if (child.dataset.icon) head.appendChild(Object.assign(document.createElement("i"), { className: child.dataset.icon }));
            head.appendChild(document.createTextNode(child.label));
            list.appendChild(head);
            for (const option of child.children) addOption(option, child);
        } else if (child.tagName === "OPTION") addOption(child, null);
    }
    if (!items.length) return;

    document.body.appendChild(list);
    _loreRefBoard_ddOpen = { select, list, items, active: -1, typed: "", typedAt: 0 };
    _loreRefBoard_ddActivate(Math.max(0, items.findIndex(i => i.option.selected)), true);
    _loreRefBoard_ddPlace();
    document.addEventListener("pointerdown", _loreRefBoard_ddOutside, true);
    window.addEventListener("resize", _loreRefBoard_ddClose);
    const follow = () => {
        if (_loreRefBoard_ddOpen?.list !== list) return;
        if (!select.isConnected || !select.offsetParent) { _loreRefBoard_ddClose(); return; }
        _loreRefBoard_ddPlace();
        requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
}

function _loreRefBoard_ddPlace() {
    const { select, list } = _loreRefBoard_ddOpen;
    const rect = select.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const wanted = Math.min(list.scrollHeight, 320);
    const up = below < wanted && above > below;
    list.style.minWidth = rect.width + "px";
    list.style.maxHeight = Math.max(80, Math.min(320, up ? above : below)) + "px";
    const width = list.offsetWidth;
    list.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - width - 4)) + "px";
    list.style.top = up ? Math.max(4, rect.top - list.offsetHeight - 2) + "px" : (rect.bottom + 2) + "px";
}

function _loreRefBoard_ddActivate(index, scroll) {
    const open = _loreRefBoard_ddOpen;
    if (!open || index < 0 || index >= open.items.length) return;
    open.items[open.active]?.row.classList.remove("active");
    open.active = index;
    open.items[index].row.classList.add("active");
    if (scroll) open.items[index].row.scrollIntoView({ block: "nearest" });
}

function _loreRefBoard_ddStep(from, by) {
    const { items } = _loreRefBoard_ddOpen;
    let i = from;
    for (let n = 0; n < items.length; n++) {
        const next = i + by;
        if (next < 0 || next >= items.length) return i;
        i = next;
        if (!items[i].disabled) return i;
    }
    return from;
}

function _loreRefBoard_ddPick(index) {
    const open = _loreRefBoard_ddOpen;
    const item = open?.items[index];
    if (!item || item.disabled) return;
    const { select } = open;
    _loreRefBoard_ddClose();
    select.focus();
    if (select.value === item.option.value && item.option.selected) return;
    item.option.selected = true;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
}

function _loreRefBoard_ddKey(select, event) {
    const open = _loreRefBoard_ddOpen?.select === select ? _loreRefBoard_ddOpen : null;
    const key = event.key;
    if (!open) {
        if (key === "Enter" || key === " " || key === "ArrowDown" || key === "ArrowUp" || (event.altKey && key === "ArrowDown")) {
            event.preventDefault();
            _loreRefBoard_ddShow(select);
        }
        return;
    }
    const page = 8;
    const moves = {
        ArrowDown: () => _loreRefBoard_ddStep(open.active, 1),
        ArrowUp: () => _loreRefBoard_ddStep(open.active, -1),
        PageDown: () => _loreRefBoard_ddStep(Math.min(open.items.length - 1, open.active + page - 1), 1),
        PageUp: () => _loreRefBoard_ddStep(Math.max(0, open.active - page + 1), -1),
        Home: () => _loreRefBoard_ddStep(-1, 1),
        End: () => _loreRefBoard_ddStep(open.items.length, -1)
    };
    if (moves[key]) {
        event.preventDefault();
        _loreRefBoard_ddActivate(moves[key](), true);
    } else if (key === "Enter" || key === " ") {
        event.preventDefault();
        _loreRefBoard_ddPick(open.active);
    } else if (key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        _loreRefBoard_ddClose();
    } else if (key === "Tab") {
        _loreRefBoard_ddClose();
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const now = Date.now();
        open.typed = (now - open.typedAt > 700 ? "" : open.typed) + key.toLowerCase();
        open.typedAt = now;
        const hit = open.items.findIndex(i => !i.disabled && i.option.textContent.trim().toLowerCase().startsWith(open.typed));
        if (hit !== -1) _loreRefBoard_ddActivate(hit, true);
    }
}

function _loreRefBoard_ddOutside(event) {
    const open = _loreRefBoard_ddOpen;
    if (!open || open.list.contains(event.target) || event.target === open.select) return;
    _loreRefBoard_ddClose();
}

function _loreRefBoard_ddClose() {
    const open = _loreRefBoard_ddOpen;
    if (!open) return;
    _loreRefBoard_ddOpen = null;
    open.list.remove();
    document.removeEventListener("pointerdown", _loreRefBoard_ddOutside, true);
    window.removeEventListener("resize", _loreRefBoard_ddClose);
}
