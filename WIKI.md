This guide covers how to use every part of the Lore Reference Board. If something is not covered here, check the Issues tab on GitHub.

---

## Table of Contents

- [Opening the Board](#opening-the-board)
- [Managing Tabs](#managing-tabs)
  - [Tab Colors](#tab-colors)
- [Image Tabs](#image-tabs)
  - [Adding Pins](#adding-pins)
  - [Pin Icons](#pin-icons)
  - [Linking a Journal to a Pin](#linking-a-journal-to-a-pin)
  - [Pin Galleries](#pin-galleries)
- [Document Tabs](#document-tabs)
  - [Supported File Types](#supported-file-types)
  - [PDF Viewer](#pdf-viewer)
  - [Linking a Journal Entry](#linking-a-journal-entry)
  - [Loading a URL](#loading-a-url)
- [Reference Tabs](#reference-tabs)
  - [Adding a Cell](#adding-a-cell)
  - [The Span Picker](#the-span-picker)
  - [Cell Types and What They Do](#cell-types-and-what-they-do)
  - [Editing or Deleting a Cell](#editing-or-deleting-a-cell)
  - [File Cells (PDF, TXT, Markdown)](#file-cells-pdf-txt-markdown)
- [Faction Tabs](#faction-tabs)
  - [Adding and Arranging Factions](#adding-and-arranging-factions)
  - [Faction Settings](#faction-settings)
  - [Tracking Standing](#tracking-standing)
  - [Linking Entities to a Faction](#linking-entities-to-a-faction)
  - [Relationships](#relationships)
  - [Relationship Types](#relationship-types)
  - [Standing Tiers](#standing-tiers)
  - [Party Standing Panel](#party-standing-panel)
- [Search](#search)
  - [Opening the Search Panel](#opening-the-search-panel)
  - [How Search Works](#how-search-works)
  - [Navigating to a Result](#navigating-to-a-result)
  - [What Gets Indexed](#what-gets-indexed)
  - [Indexing Status](#indexing-status)
- [Settings](#settings)
  - [Max Tab Rows](#max-tab-rows)
  - [Index All](#index-all)
  - [Import and Export](#import-and-export)
  - [Reset Window Position](#reset-window-position)

---

## Opening the Board

The board opens from the toolbar on the left side of the Foundry UI. Look for the Lore Reference Board button (the two theater masks button). Click it to open the window.

The board can also be toggled with a keybinding, **Ctrl+B** by default. Rebind it under Game Settings > Configure Controls > Lore Reference Board. Both the toolbar button and the keybinding work whether or not a scene is active since not all system load default scenes.

The window is resizable and can be maximized using the maximize button in the top-right corner of the toolbar. The board remembers your tabs and content across sessions as long as the world data is intact.

---

## Managing Tabs

The tab bar runs along the top of the board window. Tabs can wrap to multiple rows if you have many of them (visible rows is configurable in the module settings).

**Adding a tab**

Click the `+` button at the far right of the tab bar. A dialog will appear asking you to pick a tab type:

- **Image Tab** - For maps or images you want to place pins on
- **Document Tab** - For a single full-pane document or file
- **Reference Tab** - For a grid-based dashboard of documents and game objects (Journals, Actors, Roll Tables, Macros, etc.)
- **Faction Tab** - For a relationship map of factions, NPCs, and how they stand with each other and the party

After selecting a type, a second dialog will ask for a name (and an image path if you selected the Image Tab type, along with an optional folder to pre-load). The name field must be filled before the Add button becomes active.

**Renaming or deleting a tab**

Click the settings/gear button that appears on the right side of the main window. Your current active tab settings will open the tab settings dialog. From there you can rename the tab or delete it. Deleting a tab also removes all associated pins or cell data.

**Pinning a tab**

Hover over a tab to reveal a thumbtack icon, then click it to pin the tab. Pinned tabs move to the front of the tab bar and are separated from the rest by a small divider, keeping your most-used tabs in place no matter how many others you add. Click the thumbtack again to unpin.

**Reordering tabs**

Click the reorder button (four-arrow icon) in the toolbar to enter reorder mode. While active, drag any tab and drop it before or after another to change its position. Pinned and unpinned tabs are reordered separately so you can't drag a tab across the divider between the two groups. Click the reorder button again to exit reorder mode.

---

### Tab Colors

Each tab is tinted by its type so you can tell what kind of tab it is at a glance:

| Type | Color |
|---|---|
| Image | Blue |
| Document | Coral |
| Reference | Purple |
| Faction | Amber |

The tint gets stronger with state: faint on inactive tabs, stronger on hover, strongest on the active tab, which also gets an underline in its own type color. Each tab shows a small type icon next to its name, so the type stays readable without relying on color alone.

---

## Image Tabs

An Image tab shows a single image that you can pan and zoom. It is designed for campaign maps but works with any image.

**Pan and zoom**

- Scroll the mouse wheel to zoom in and out while your cursor is within the module window or image area
- Click and drag on the image (not on a pin) to pan
- A zoom bar at the bottom of the tab shows a slider, the current zoom percentage, and a reset view button
- Use the Reset button to return to the default view and zoom level

**Replacing the image**

As a warning, if you change the image and have pins or galleries set up, changing the image will clear them. Open tab settings (use the settings icon in the toolbar). The image path field accepts a new path. Use the Browse button to pick from your Foundry data directory.

---

### Adding Pins

To place a pin, click the pin placement toggle button in the toolbar (it turns blue when active). Then click anywhere on the image to place a pin at that location.

A dialog will open immediately so you can fill in the pin details. Once you save, the pin appears on the map.

To disable placement mode, click the toggle button again (this is also required to open pin galleries by clicking a pin).

You can move an existing pin by toggling the pin button on, then left-clicking and dragging the icon to a new position.

---

### Pin Icons

The color picker and icon selector both update a live preview at the top of the pin dialog so you can see exactly what the pin will look like before saving.

---

### Linking a Journal to a Pin

Inside the pin dialog, the right panel is the journal linking area.

**To link a journal:**

Drag a journal entry from the Foundry journal sidebar and drop it onto the drop zone in the right panel. Compendium journal entries work too, just drag them from an open compendium. The panel will update to show the journal name and render the first page of content below it.

If the journal has multiple pages, a page navigation bar appears with previous and next arrow buttons and a page selector dropdown.

**To create a new journal and link it at the same time:**

Click the "Create Lore Entry" button inside the drop zone. You will be prompted for a name. A new blank journal entry is created in your world, linked to the pin, and the journal sheet opens automatically so you can start writing.

**To edit the linked journal:**

Click the Edit button in the linked state panel. This opens the journal sheet.

**To unlink:**

Click the Unlink button. You will be asked to confirm. The journal entry itself is not deleted.

**If the linked journal is missing:**

When a pin's journal no longer exists (deleted, or the pin was imported from another world), the pin shows a small red badge on the map. The pin dialog shows the stored journal name marked as missing, with Unlink available to reset it. The pin preview and gallery windows show the same warning with an active drop zone, so you can link a replacement directly from either.

---

### Pin Galleries

Each pin can have its own image gallery organized into folders. This is useful for keeping NPC portraits, location references, or item art associated with a specific pin; any image you would like to reference or use.

**Opening the gallery**

When pin placement is toggled off, left-click any pin to open the Pin Gallery window for that pin.

**Adding a folder**

Click "Add Folder" in the gallery window (to the right of the Save Name button). You will be asked for a folder name, then prompted to select a folder from your Foundry data directory (optional). All image files found in that folder are imported automatically.

You can also add individual images to a folder using the `+` button next to the folder name, or import all images from the folder path using the folder button next to the `+`.

**Removing an image**

Right-click any thumbnail in the gallery to remove it from the folder. The file itself is not deleted from your data directory.

**Clicking an image**

Left-clicking a thumbnail opens a larger preview of the image in a dialog. From there you have options to add specific lore for that image, copy the file path to clipboard, create a new scene using the image, or create the image as a Foundry token. If the Encounter Forge module is active, creating a token will first ask whether to create a blank actor or generate a full NPC with stats. The generator opens pre-loaded with this image as the portrait and token art.

**Missing folders and journals**

If a folder's path no longer exists, a warning icon appears next to the struck-through path; use the folder's import button to re-point it at a new location. If an image's linked journal is missing, its thumbnail shows a small warning icon. Open the image and link a new journal from the preview.

---

## Document Tabs

A Document tab gives you a full-pane viewer tied to a single file, journal, or html/website. The content fills the entire tab area.

When the tab has nothing linked yet, you will see a drop zone with two ways to load something:

1. **Drag and drop** a journal entry from the sidebar onto the drop zone
2. **Browse** using the file browser button to pick a file from your data directory
3. **Select** load a website or html file stored locally into the tab. (Subject to iframe limitations and website security)

Once something is loaded, a header bar appears at the top of the tab showing what is linked. You can use the Unlink button in that bar to disconnect it and return to the empty state.

If a linked journal can no longer be found (deleted, or imported from another world), the tab shows the stored journal name and id with a **Choose New Document** button. If a linked file fails to load, the missing path is shown alongside the Remove button.

---

### Supported File Types

| Extension | How it renders |
|---|---|
| `.pdf` | Infinite scroll canvas viewer (see PDF Viewer section below) |
| `.md` | Rendered Markdown |
| `.txt` | Preformatted plain text |
| `.html` / `.htm` | Rendered HTML page |
| `.docx` | Converted to readable HTML via mammoth.js |
| `.png` / `.jpg` / `.webp` / `.gif` / `.svg` / `.bmp` / `.avif` | Centered image viewer |
| Journal Entry (world or compendium) | Rendered journal content with page navigation |
| `http://` / `https://` URL | Web page via iframe |

**Note on URLs:** Whether a URL loads depends on whether the target site allows being embedded in an iframe. Many sites block this. If you see a blank frame or an error, the site does not permit embedding.

**Note on DOCX files:** The module converts DOCX files into HTML. Complex formatting like tables, multi-column layouts, and certain styles may not convert perfectly. Simple documents with headings and paragraphs work well.

---

### PDF Viewer

PDFs use an infinite scroll canvas renderer. All pages are available immediately and load progressively as you scroll down, so you do not need to flip through pages one at a time.

**Page navigation**

There is a page number input within the header bar. Type a page number and press Enter to jump directly to that page.

**Sidebar**

Click the list icon in the header to open the sidebar. The sidebar starts collapsed by default. Depending on whether the PDF includes an outline (table of contents), the sidebar shows either:

- **Table of Contents** - Click any entry to jump to that section
- **Page Thumbnails** - Click any thumbnail to jump to that page; the active page is highlighted as you scroll

Click the list icon again to collapse the sidebar. Because reference cells can be small, using the sidebar may be more practical when the cell is expanded wide or when the full board window is widened.

**Search highlighting**

When you click a search result that points to a PDF, the viewer scrolls to the correct page and highlights the matched text on that page.

---

### Linking a Journal Entry

Drag any journal entry from the Foundry sidebar (Journals or Compendium Journals) and drop it onto the Document tab's drop zone. The content will render and stay linked.

If the journal has more than one page, a navigation bar appears at the top of the content area with previous and next buttons and a page dropdown. Pages are listed in their sorted order from the journal.

---

### Loading a URL

Type or paste a full URL (starting with `http://` or `https://`) into the path input at the bottom of the drop zone and click Load. The URL is loaded into the tab via iframe.

Some sites will refuse to load inside an iframe due to their own security headers. If this happens there is no workaround from within Foundry or this module.

---

## Reference Tabs

A Reference tab shows a 4-column grid of cells. Each cell links to one Foundry document or one file. The grid expands downward as you add more cells and scrolls vertically. You'll always have more cells to create more content on the reference tab. 

When a Reference tab is first created it is entirely empty. Every grid position shows a dashed placeholder with a `+` button.

---

### Adding a Cell

Click the `+` button in any empty placeholder cell. The "Add Cell" dialog opens.

The dialog has three sections:

**1. Drop Zone (top)**

Drag a document from any Foundry sidebar (Actors, Items, Journals, Compendiums, etc.) and drop it here. When a document is successfully linked, the drop zone changes color and shows the document's name and type. Dropping a new document replaces the previous one.

Accepted document types: Actor, Item, Journal Entry, Journal Entry Page(s), Macro, Playlist, Roll Table, Scene, Cards deck.

**2. File Section (middle)**

As an alternative to linking a document, you can load a file instead. Type or paste a file path into the input, or click Browse to use the file picker. Only PDF, TXT, and Markdown files are supported in Reference cells.

Linking a file clears the drop zone link, and dropping a document clears the file path. Only one can be active at a time per cell.

**3. Span Picker (bottom)**

This is where you choose where the cell goes and how large it is. See the next section for details.

Click **Add** to save the cell. The Add button only works if either a document is linked or a file path is set.

---

### The Span Picker

The span picker shows a miniature version of the current grid layout. Occupied positions are shown with a slightly dimmed striped background and cannot be selected.

**To place a cell:**

1. Click on any free cell to set the starting corner. It highlights in blue.
2. Move your mouse to another free cell. The rectangle between the two points previews in lighter blue.
3. Click again to confirm the selection.

If any cell in the rectangle is occupied by an existing cell, the preview turns red and clicking will not confirm the selection. You need to pick a rectangle that is entirely free.

A size readout below the picker shows the current selection as "X cols x Y rows".

The picker initializes with a 1x1 default selection at the grid position of the `+` button you clicked to open the dialog. If you just want a single-size cell in that exact spot you can click Add immediately without interacting with the picker. You can also just pick a completely new set of cells from this window. You arent bound to which cell you started with.

---

### Cell Types and What They Do

For system-agnostic functionality, cells load and link to a shortcut view of the added item rather than a full sheet.

**Actor**

Shows the actor's portrait (when the cell is at least 2 rows tall) alongside the actor's name and an "Open Sheet" button that opens the actor sheet directly.

**Item**

Same layout as Actor. Shows portrait and an Open Sheet button.

**Journal Entry**

Renders the journal content inline inside the cell, including formatted text, images, and tables. If the journal has multiple pages, a navigation bar appears at the top of the cell with previous and next buttons and a page dropdown. An "Open" button in the cell header opens the full journal sheet.

**Macro**

Shows the macro name and an "Execute" button that runs the macro.

**Playlist**

Shows the playlist name and playback controls.

**Roll Table**

Renders the full table inline showing all result rows with their range values. Results that have already been drawn appear crossed out. A "Roll" button in the header draws from the table and refreshes the display. An icon-only Open button also appears so you can open the full table sheet.

**Scene**

Shows the scene name and an "Activate Scene" button.

**Cards**

Shows the card deck name with two icon buttons: Shuffle (randomizes the deck order) and Deal (opens a small dialog to deal a set number of cards to a chosen hand).

---

### File Cells (PDF, TXT, Markdown)

**PDF cells** use the same infinite scroll canvas viewer as Document tabs. All pages load as you scroll to conserve resources. A page number input lets you jump directly to any page, and a collapsible sidebar is available for the table of contents or page thumbnails. The sidebar starts collapsed by default. For PDF cells, consider using a span of at least 3 rows so the viewer has enough room to be usable. Expanding the board window width also helps when using the sidebar.

**TXT cells** display the file content as preformatted text, preserving line breaks and spacing.

**Markdown cells** fetch the file and render it as formatted HTML. Images in Markdown files will only display if the image path is a full URL or a path accessible from Foundry.

File type is detected automatically from the file extension. You do not need to select a type manually.

The cell header badge shows "PDF", "Text File", or "Markdown" in a color-coded label so you can identify the type at a glance.

---

### Editing or Deleting a Cell

Every cell has a small pencil icon in the top-right corner of its header. Click it to open the Edit Cell window.

The Edit Cell window is the same as the Add Cell dialog with two differences:

- The drop zone starts pre-filled with the current link (or the file section is pre-filled if it is a file cell)
- There is a **Delete** button in the footer alongside Save and Cancel

**To re-link:** Drop a new document onto the drop zone or enter a new file path. The existing link is replaced.

**To resize:** Use the span picker to draw a new rectangle. The cell being edited is shown as free in the picker so you can expand or shrink it freely. If the new size would overlap another cell, the selection turns red and Save will warn you.

**To delete:** Click the Delete button. The cell is removed from the grid and the space it occupied becomes available again.

**Broken links**

If a cell's document no longer exists, the cell shows a warning with the name it was linked to (or the raw id for links created before names were stored). Use the pencil to relink; the edit dialog shows a "Previously linked" line with the old name so you know what you are replacing.

---

## Faction Tabs

A Faction tab is a pannable, zoomable canvas for mapping out factions, NPCs, and how they relate to each other and the party. Factions appear as colored circles that you can freely arrange.

Use the toolbar buttons across the top of the tab to add factions and relationships, configure relationship types and standing tiers, and open the party standing panel. A zoom slider, zoom percentage readout, and reset view button sit at the bottom of the canvas, the same as on Image tabs.

---

### Adding and Arranging Factions

Click the **Add Faction** button (circle with a plus) in the toolbar to drop a new faction circle onto the canvas.

- **Move** a faction by clicking and dragging it anywhere on the canvas
- **Resize** a faction by dragging the small arrow handle at its corner (visible when you hover over the circle)
- Relationship lines connected to a faction follow it automatically as you move or resize it

---

### Faction Settings

Click the settings (gear) button on a faction circle to open its settings dialog. From here you can change:

- **Name** - the label shown on the circle
- **Color** - the circle's color, picked from a color picker

You can also delete the faction from this dialog. Deleting a faction also removes any relationships connected to it and cannot be undone.

---

### Tracking Standing

Each faction circle has a rating box with `-` and `+` buttons for nudging its standing rating up or down by 1.

You can also type directly into the rating box:

- A plain number (e.g. `15`) sets the rating to that value
- `+N` or `-N` (e.g. `+10`, `-5`) adds or subtracts from the current rating
- `=N` (e.g. `=-20`) sets the rating exactly, useful if you want to type a negative number that would otherwise be read as an adjustment

The rating is used to determine which [Standing Tier](#standing-tiers) the faction currently falls into.

---

### Linking Entities to a Faction

Drag any Actor, Item, Journal Entry, or other supported Foundry document from a sidebar or compendium and drop it onto a faction circle to link it as a member of that faction.

- Linked entities appear as small portrait tokens inside the circle
- Click a token to open that document's sheet
- Click the small remove (trashcan) button on a token to unlink it from the faction (the document itself is not deleted)
- If there are more entities than fit in the circle, an overflow button appears. Click it to see the full list and open any of them
- If a member's document no longer exists (deleted, or imported from another world), its token appears dimmed with a red outline. Clicking it offers to remove it from the faction

---

### Relationships

Click **Add Relationship** (link chain) in the toolbar to enter relationship mode (the button is highlighted while active). Then:

1. Click a faction to select it as the first end of the relationship
2. Click a second, different faction to connect to
3. A dialog opens asking you to pick the relationship type; choose one and confirm

A line is drawn between the two factions, styled and colored according to the relationship type you picked. Click the button again to exit relationship mode.

**Editing or deleting a relationship**

Click an existing relationship line to reopen the relationship dialog. From there you can change its type or delete the relationship entirely.

Relationship lines currently connect exactly two factions each. There is no support yet for a single line representing a relationship between more than two factions.

---

### Relationship Types

Click the **Relationship Types** button (palette icon) to manage the list of relationship types available when connecting factions. Each type has:

- A **name**
- A **line style** - Solid, Dashed, Dotted, or Dash-Dot
- A **color**

You can add new types, edit existing ones, or remove types you don't need. The module has a default set included: Allies, Rivals, Trade Partners, Vassal/Liege, Blood Feud, Truce/Ceasefire, Mentor & Student, and Spy Network. You can add, modify, or remove any as you'd like.

If no relationship types exist, you will be prompted to add one before you can create a relationship.

---

### Standing Tiers

Click the **Standing Tiers** button (sliders icon) to configure the rating ranges used to label faction standing (e.g. "Hostile" or "Allied").

Each tier has a label and a minimum/maximum rating range. The default tiers are:

| Tier | Range |
|---|---|
| Hostile | -41 and below |
| Unfriendly | -40 to -21 |
| Neutral | -20 to 20 |
| Friendly | 21 to 40 |
| Allied | 41 and above |

You can add or remove tiers and edit the labels and ranges. Ranges must be contiguous with no gaps and no overlaps. Every tier needs both a label and a min/max value, or the dialog will show an error explaining what to fix.

---

### Party Standing Panel

Click **Party Standing** (handshake icon) to open a side panel listing every faction on all faction tabs along with its current standing tier label (based on its rating and the configured [Standing Tiers](#standing-tiers)).

- Double-click a tab's name listed above the factions of that tab within this side panel to collapse or expand its details
- Use **Collapse All** / **Expand All** in the panel header to manage everything at once
- Click the X in the panel header to close it

---

## Search

### Opening the Search Panel

Click the magnifying glass button in the board's toolbar to open or close the search panel. The panel displays on right side of the main board window. Drag the divider on the left edge of the panel to resize it.

---

### How Search Works

Type at least two characters into the search input to start a search. Results update as you type (sometimes with a short delay depending on content size).

Results are grouped by the document or cell they belong to. Each result shows a text snippet with the matched word highlighted. Groups can be collapsed or expanded using the chevron on each group header. Use the **Collapse All** and **Expand All** buttons in the panel header to manage all groups at once.

Click the X button (beside the search box) to clear the search and close the panel. The search persists through reloads/refreshes. It only clears when you close it via the X.

---

### Navigating to a Result

Click any result row to navigate to it. The board will:

1. Switch to the tab containing that document or cell (if it is not already active)
2. Scroll to the page or location where the match appears
3. Highlight the matched text in the content

For PDF documents, the viewer scrolls to the correct page and highlights the matched text in the rendered text layer. For journals and HTML content, the matched section is scrolled into view and the text is highlighted inline.

---

### What Gets Indexed

| Source | What is read |
|---|---|
| Document tab - PDF | All pages, read directly from the file |
| Document tab - TXT, Markdown, HTML | Full file text |
| Document tab - DOCX | Converted text content |
| Document tab - Journal Entry | All pages in sorted order |
| Reference cell - PDF | All pages, read directly from the file |
| Reference cell - TXT, Markdown | Full file text |
| Reference cell - Journal Entry | All pages in sorted order |
| URL tabs | Not searchable (content not indexed) |
| Image tabs | Not searchable |
| Faction tabs | Not searchable |

PDF pages are indexed from the file directly rather than from what you have scrolled through, so the full document is searchable as soon as it is loaded.

Indexing runs automatically:
- When a tab or cell is first loaded
- When the file or document linked to a tab or cell changes
- When a tab or cell is deleted (the entry is removed so it no longer appears in results)

The search index is cached in localStorage so results are available immediately on subsequent sessions without re-reading files. The cache is invalidated automatically when file content changes.

---

### Indexing Status

While documents are being indexed in the background (especially large PDFs), a status bar at the top of the results list shows how many items are indexed versus still pending. Once all items are indexed the bar disappears.

While a PDF indexes, the document tab or cell it belongs to shows a small progress badge with the current page count and a cancel button. Cancelling skips that document for the session; it stays fully usable and can be indexed later with Index All in the module settings.

If results ever seem stale or incomplete, use the **Index All** button in the module settings panel to force a full re-index of all tabs and cells.

---

## Settings

Open Foundry's module settings (Game Settings > Configure Settings > Module Settings) and find Lore Reference Board.

---

### Max Tab Rows

Controls how many rows of tabs are shown before the tab bar stops growing and starts scrolling vertically within its current height. Default is 4.

Set this to 0 to allow unlimited rows (the tab bar will grow as tall as it needs to). Just be mindful that the window does become difficult to manage when the tabs are not restricted beyond a certain point.

This is a per-client setting, so each GM can set their own preference independently (if you have more than one GM user).

---

### Index All

Forces a full re-index of every document tab and reference cell. Use this if search results seem out of date after making changes outside of a normal session, or as a troubleshooting step if results look wrong.

A progress dialog shows how many items have been processed, with a Cancel button. Closing the dialog also cancels. Documents already indexed remain searchable either way.

---

### Import and Export

The module settings panel includes Import and Export buttons for the full board state.

**Export** saves a JSON file into your world folder containing all tabs, pin data, cell links, faction data, and gallery folder paths. The export also records the display name of every linked document; the import link check uses those names to offer repairs.

**Import** reads a previously exported JSON file and merges or replaces the current board state.

**The link check**

Before anything is imported, the module resolves every document link and file path in the file. If everything resolves, the import proceeds directly. If links are broken, a link check dialog lists them by name and offers repairs:

- If a document with the same name and type exists in the destination world or a loaded compendium, the row shows a **Relink** button, or a dropdown when there are several candidates (world folders and compendium names are shown to tell them apart). A **Relink all exact matches** button accepts every unambiguous suggestion at once.
- If several broken file links share a folder prefix, a **Fix file paths** section appears. Enter or browse to the new location and the dialog re-checks the affected paths as you type, reporting how many the remap repairs.
- The summary counts update as you accept fixes, and rows strike through as they are resolved. Fixes are applied to the imported data only when you confirm the import; Cancel discards everything, including accepted fixes.

Anything still broken after the link check imports anyway and shows up as a labeled broken-link state on its tab (see the Broken links notes in the sections above), so it can be relinked later.

> **Note:** exports made with module versions before v2.1 do not contain document names. Importing one of those files still works, but the link check can only show raw IDs for broken links and cannot offer relink suggestions. If you still have the source world, update the module there and export again. The new file records a name for every link that still resolves, and the link check uses those names to find matches.

---

### Reset Window Position

The board remembers its window size and position for each user between sessions. This is stored per-client, so different GMs can each have their own preferred layout.

If the window ever ends up off-screen, at an unusable size, or otherwise inaccessible, use the **Reset Window Position** button in the module settings panel.

Clicking it does two things: clears the saved position and size, and closes the board window if it is currently open. After that, re-open the board using the toolbar button and it will appear at its default size and position. From that point on, any new size or position you set will be saved again on close.
