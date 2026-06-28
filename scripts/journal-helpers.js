function loreRefBoard_getJournalPages(entry) {
    return entry.pages.contents.slice().sort((a, b) => a.sort - b.sort);
}

async function loreRefBoard_enrichJournalPage(page, entry) {
    if (!page) {
        return '<p style="color:#888;font-style:italic;padding:8px 0">No pages found.</p>';
    }

    if (page.type === "image") {
        const src = page.src ?? "";
        const caption = page.image?.caption ?? "";
        if (!src) return '<p style="color:#888;font-style:italic;padding:8px 0">No image source set.</p>';
        return `<div class="lrt-doc-image-page">
            <img class="lrt-doc-page-img" src="${loreRefBoard_escapeHtml(src)}" alt="${loreRefBoard_escapeHtml(page.name ?? "")}" />
            ${caption ? `<p class="lrt-doc-page-caption">${loreRefBoard_escapeHtml(caption)}</p>` : ""}
        </div>`;
    }

    // PDF pages in iframe
    if (page.type === "pdf") {
        const src = page.src ?? "";
        if (!src) return '<p style="color:#888;font-style:italic;padding:8px 0">No PDF source set.</p>';
        return `<iframe src="${loreRefBoard_escapeHtml(src)}"
            style="width:100%;height:100%;min-height:400px;border:none;display:block"></iframe>`;
    }

    // Video pages in iframe
    if (page.type === "video") {
        const vsrc = page.src ?? page.video?.url ?? "";
        if (!vsrc) return '<p style="color:#888;font-style:italic;padding:8px 0">No video source set.</p>';
        const isExternal = /^https?:\/\//i.test(vsrc);
        if (isExternal) {
            return `<iframe src="${loreRefBoard_escapeHtml(vsrc)}" allowfullscreen
                style="width:100%;height:100%;min-height:300px;border:none;display:block"></iframe>`;
        }
        return `<video controls style="width:100%;max-height:400px;display:block;background:#000">
            <source src="${loreRefBoard_escapeHtml(vsrc)}">
        </video>`;
    }

    // System types (spells, rule, class, etc.)
    if (page.type !== "text") {
        const iconMap = { map: "fa-map" };
        const icon = iconMap[page.type] ?? "fa-file";
        const TE = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
        const uuidLink = `@UUID[${page.uuid}]{${loreRefBoard_escapeHtml(page.name ?? "Open in Journal")}}`;
        let linkHtml = "";
        try { linkHtml = await TE.enrichHTML(uuidLink, { relativeTo: entry, rollData: {} }); }
        catch { linkHtml = `<em style="font-size:11px">Open the full journal to view it.</em>`; }
        return `<div style="text-align:center;padding:24px 12px;color:#888">
            <i class="fas ${icon}" style="font-size:2em;display:block;margin-bottom:10px;color:#555"></i>
            <span style="font-style:italic">This page is type <strong>${loreRefBoard_escapeHtml(page.type)}</strong>.</span><br>
            <span style="font-size:11px;display:block;margin-top:8px">${linkHtml}</span>
        </div>`;
    }
    const raw = page.text?.content ?? "";
    if (!raw.trim()) {
        return '<p style="color:#888;font-style:italic;padding:8px 0">No content yet, click Edit to start writing.</p>';
    }
    try {
        const TE = foundry.applications.ux?.TextEditor?.implementation ?? TextEditor;
        return await TE.enrichHTML(raw, { relativeTo: entry, rollData: {} });
    } catch {
        return raw;
    }
}

async function loreRefBoard_wirePageNav(contentEl, journalId) {
    if (!contentEl || !journalId) return;

    let entry = null;

    if (journalId.includes(".")) {
        try { entry = await fromUuid(journalId); } catch { entry = null; }
    }

    // Fall back to bare ID lookup in the world journal collection.
    if (!entry) entry = game.journal.get(journalId) ?? null;

    // Construct a world UUID from a bare ID.
    if (!entry) {
        try { entry = await fromUuid(`JournalEntry.${journalId}`); } catch { entry = null; }
    }

    if (!entry) return;

    const pages = loreRefBoard_getJournalPages(entry);
    if (pages.length <= 1) return;   

    // Build nav bar
    const nav = document.createElement("div");
    nav.className = "lrb-page-nav";
    nav.innerHTML = `
        <button class="lrb-pg-prev" title="Previous page" disabled>&#8249;</button>
        <select class="lrb-pg-select">
            ${pages.map((p, i) =>
                `<option value="${loreRefBoard_escapeHtml(p.id)}">${i + 1}. ${loreRefBoard_escapeHtml(p.name)}</option>`
            ).join("")}
        </select>
        <button class="lrb-pg-next" title="Next page">&#8250;</button>
    `;
    contentEl.parentElement.insertBefore(nav, contentEl);

    const prevBtn = nav.querySelector(".lrb-pg-prev");
    const nextBtn = nav.querySelector(".lrb-pg-next");
    const selectEl = nav.querySelector(".lrb-pg-select");

    let currentIdx = 0;

    const loadPage = async (idx) => {
        currentIdx = idx;
        prevBtn.disabled = (idx === 0);
        nextBtn.disabled = (idx === pages.length - 1);
        selectEl.value = pages[idx].id;
        contentEl.innerHTML =
            "<p style='color:#888;font-style:italic;padding:8px'>Loading…</p>";
        contentEl.innerHTML = await loreRefBoard_enrichJournalPage(pages[idx], entry);
    };

    selectEl.addEventListener("change", ev => {
        const idx = pages.findIndex(p => p.id === ev.target.value);
        if (idx !== -1) loadPage(idx);
    });
    prevBtn.addEventListener("click", () => {
        if (currentIdx > 0) loadPage(currentIdx - 1);
    });
    nextBtn.addEventListener("click", () => {
        if (currentIdx < pages.length - 1) loadPage(currentIdx + 1);
    });

    prevBtn.disabled = true;
    nextBtn.disabled = (pages.length <= 1);
}

// Render Rolltable/Results
function _loreRefBoard_renderRollTableHtml(doc) {
    const results = doc.results?.contents ?? [];
    const sorted = results.slice().sort((a, b) => (a.range?.[0] ?? 0) - (b.range?.[0] ?? 0));
    const formula = (doc.formula ?? "").trim();
    const desc = (doc.description ?? "").replace(/<[^>]*>/g, "").trim();

    if (!sorted.length) {
        return '<p class="lrt-rt-empty">No results defined.</p>';
    }

    const formulaHtml = formula
        ? `<div class="lrt-rt-formula"><i class="fas fa-dice-d20"></i> ${loreRefBoard_escapeHtml(formula)}</div>`
        : "";
    const descHtml = desc
        ? `<div class="lrt-rt-desc">${loreRefBoard_escapeHtml(desc)}</div>`
        : "";

    const rows = sorted.map(r => {
        const rangeMin = r.range?.[0] ?? 0;
        const rangeMax = r.range?.[1] ?? 0;
        const rangeStr = rangeMin === rangeMax ? `${rangeMin}` : `${rangeMin}–${rangeMax}`;
        const imgHtml = r.img
            ? `<img class="lrt-rt-result-img" src="${loreRefBoard_escapeHtml(r.img)}" alt="" />`
            : "";
        const drawnClass = r.drawn ? " lrt-rt-row--drawn" : "";
        return `<tr class="lrt-rt-row${drawnClass}">
            <td class="lrt-rt-range">${loreRefBoard_escapeHtml(rangeStr)}</td>
            <td class="lrt-rt-text"><span class="lrt-rt-text-inner">${imgHtml}${loreRefBoard_escapeHtml(r.name || r.description || "")}</span></td>
        </tr>`;
    }).join("");

    return `${formulaHtml}${descHtml}<table class="lrt-rt-table"><tbody>${rows}</tbody></table>`;
}
