This guide covers how to use every part of the Lore Reference Board. If something is not covered here, check the Issues tab on GitHub.

---

## Table of Contents

- [Opening the Board](#opening-the-board)
- [Managing Tabs](#managing-tabs)
  - [Tab Colors](#tab-colors)
- [Image Tabs](#image-tabs)
  - [Using a Scene as the Image](#using-a-scene-as-the-image)
  - [Cycling Through Scene Images](#cycling-through-scene-images)
  - [Refreshing, Reconnecting, and Recreating Scenes](#refreshing-reconnecting-and-recreating-scenes)
  - [Changing the Image or Scene](#changing-the-image-or-scene)
  - [Pin Layers](#pin-layers)
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
- [Threads Tabs](#threads-tabs)
  - [Adding Thread and Tracker Rows](#adding-thread-and-tracker-rows)
  - [Tracker Visual Styles](#tracker-visual-styles)
  - [Filtering by Status](#filtering-by-status)
  - [Notes Log](#notes-log)
  - [Linking a Journal to a Thread](#linking-a-journal-to-a-thread)
  - [Grouping Rows into Folders](#grouping-rows-into-folders)
  - [Row Actions](#row-actions)
  - [Threads in the Pin Gallery](#threads-in-the-pin-gallery)
- [Cast Directory](#cast-directory)
  - [Generating a Cast Card](#generating-a-cast-card)
  - [Species and Naming Style](#species-and-naming-style)
  - [Thematic Field Pools](#thematic-field-pools)
  - [Rerolling and Undo](#rerolling-and-undo)
  - [The Cast Directory Window](#the-cast-directory-window)
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

The board can also be toggled with a keybinding, **Ctrl+B** by default. Rebind it under Game Settings > Configure Controls > Lore Reference Board. Both the toolbar button and the keybinding work whether or not a scene is active since not all systems load one by default.

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
- **Threads Tab** - For a running list of plot hooks and progress trackers

After selecting a type, a second dialog will ask for a name (and, for an Image tab, an image path with a Browse button, or a **Select from Scene** option to base the tab on a Foundry scene instead of a file). The name field must be filled before the Add button becomes active.

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
| Threads | Green |

The tint gets stronger with state: faint on inactive tabs, stronger on hover, strongest on the active tab, which also gets an underline in its own type color. Each tab shows a small type icon next to its name, so the type stays readable without relying on color alone.

---

## Image Tabs

An Image tab shows a single image that you can pan and zoom. It is designed for campaign maps but works with any image.

**Pan and zoom**

- Scroll the mouse wheel to zoom in and out while your cursor is within the module window or image area
- Click and drag on the image (not on a pin) to pan
- A zoom bar at the bottom of the tab shows a slider, the current zoom percentage, and a reset view button
- Use the Reset button to return to the default view and zoom level

### Using a Scene as the Image

When you create an Image tab you can either browse for an image file or click **Select from Scene** to base the tab on one of your Foundry scenes. The scene picker lists your scenes in groups: **World Scenes** first, then one group per Scene compendium you have installed. Each scene shows its thumbnail and name; click one to select it and confirm with **Load Scene**.

Choosing a scene does not copy or change the scene. The board reads the scene's images, stores a snapshot of them on the tab, and keeps a link back to the scene. A world scene is linked by its world id; a compendium scene is linked by its compendium id, which stays valid across worlds (see below).

You can switch or reconnect a scene-backed tab later from the tab settings, covered under [Refreshing, Reconnecting, and Recreating Scenes](#refreshing-reconnecting-and-recreating-scenes).

---

### Cycling Through Scene Images

A scene can hold more than one image. Every scene has a background and, optionally, a foreground, and on Foundry v14 a scene can also have multiple **levels**, each with its own background and foreground. When a tab is based on a scene, a second dropdown appears in the image tab toolbar, to the left of the pin-layer bar, listing every image the scene provides: `Background`, `Foreground`, and, for a multi-level scene, one entry per level and slot (for example `Basement - Background`, `Basement - Foreground`, `Downstairs - Background`). Pick an entry to display that image.

All of a scene's images share one fixed workspace, sized to the largest image, so **pins stay in exactly the same place no matter which image you are viewing**. This is intended for the levels or the foreground/background of the same map, which line up naturally. If a scene mixes images of genuinely different dimensions, the smaller ones are letterboxed inside the fixed workspace and pins stay put in that workspace.

The dropdown reflects the images stored in the tab's snapshot, which is a point-in-time copy. If you edit the scene in Foundry (rename a level, add a floor, change a background), the tab does not change until you Refresh it via the available button.

---

### Refreshing, Reconnecting, and Recreating Scenes

Scene tabs are built to survive being moved between worlds and computers. The core idea: the snapshot on the tab is enough to display and cycle images on its own, and the live scene link is only needed to pull fresh images. So the tab always works, whether or not its scene is present.

The tab settings show one of two states, decided by whether the linked scene resolves in the current world:

- **Linked (the scene is present).** You get a **Refresh from Scene** button and a **Change Scene** button. Refresh re-pulls the linked scene's current images and updates the dropdown, keeping your pins. 
- **Not linked (the scene is not in this world).** The panel notes the scene is not in this world and gives you a **Reconnect to Scene** button instead of Refresh. The tab still works as a saved image list; reconnecting only restores the ability to refresh.

**Reconnecting or changing the scene.** Both buttons open the same scene picker. When you pick a scene, the board decides whether it is the *same* scene you already had or a *different* one, and only asks about your pins when it is genuinely different:

- If the picked scene matches the tab's stored scene by id, it is treated as the same scene and your pins are kept with no prompt to discard or save pins.
- If the id does not match but the scene's **name and floor structure** match (the same level names and the same background/foreground layout), it is also treated as the same and pins are kept. This is what lets a recreated or shared scene reconnect cleanly: a friend's copy, or a scene you rebuilt after a drive failure, will have different file paths and a different id but the same floors, and the board gives it the benefit of the doubt.
- Otherwise the scene is treated as a change and you are asked whether to **Keep** or **Clear** the pins (see [Changing the Image or Scene](#changing-the-image-or-scene)).

**Why name and structure, not files.** A faithful recreation almost never has the same file paths, so matching on paths would defeat the purpose I was going for. Instead the board compares the floor names you typed and the background/foreground layout. Floor names are matched exactly as written and are not translated, so this holds up across languages. If the new scene's images fail to load at all, the board cannot verify them and will prompt you, noting that the images did not load so you can go fix the paths.

**Cross-world identity.** A world scene's id changes when it is imported into another world, so a world-linked tab will not auto-resolve there even if "the same" scene is present; reconnect it by name using the picker. A **compendium** scene is different: its compendium id is stable across worlds, so a tab linked to a compendium scene keeps refreshing in any world that has the pack/compendium.

Once you reconnect or change to a scene, that scene becomes the tab's current link. The board does not keep the previous scene's data; from that point everything verifies against the new scene so you can export and handle it from that new point in time.

---

### Changing the Image or Scene

Changing what an image tab shows can affect its pins, so the board asks what to do with them rather than discarding them like in previous versions.

- **Changing a file image** (in tab settings, by editing the image path): if the tab has pins, you are asked to **Keep Pins**, **Clear Pins**, or **Cancel**. Keep is the default because it I figured it's reversible; you can always delete pins afterward.
- **Changing to a different scene** (via Change Scene or Reconnect, when the pick is judged as a real change): the same Keep / Clear / Cancel choice, shown with the new scene's name and source, how many images it has compared to the current tab, and the pin count. If the new scene's images could not be verified, a note says so.

Clearing pins removes every pin on the tab along with its gallery lore and journal links, but leaves your pin layers in place. Keeping pins leaves them exactly where they are in the tab's workspace.

---

### Pin Layers

Pins on an image tab live on **layers**. Every image tab has at least one layer (a default "Layer 1"), and each layer has a name and a color you can change later.

**Selecting a layer.** The layer dropdown in the image toolbar picks the active layer, and new pins are placed on it. Choose **All** to see every layer's pins at once; in the All view, each pin shows a small color badge for the layer it belongs to, and pin placement is disabled until you pick a specific layer. A quick add-layer button sits next to the dropdown.

**Managing layers.** Open the tab settings to manage layers. From there you can:

- **Add** a layer
- **Rename** a layer and change its **color**
- **Reorder** layers up or down in the list
- **Duplicate** a layer, which copies all of its pins (and their journal links) onto a new layer
- **Delete** a layer, which also deletes the pins on it (a tab always keeps at least one layer, so the last one cannot be deleted)

Deleting a layer asks for confirmation and tells you how many pins and gallery images it will remove. If other GMs are connected, the confirmation notes their presence and they get a heads-up notification when a layer is deleted.

**Who can delete layers.** Full GMs can always delete layers. Assistant GMs can only delete layers if a GM enables **Allow Assistant Layer Delete** in the module settings.

**Older boards.** Boards created or exported before layers existed are upgraded automatically, on load and on import: each image tab gets a "Layer 1" and any pins that had no layer are moved onto it, so nothing is lost.

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

## Threads Tabs

A Threads tab is a single list mixing two kinds of rows: open plot hooks and numeric, visual, progress trackers. Both share one filterable list so you can see everything currently moving in the campaign in one place, rather than hunting across separate tabs.

---

### Adding Thread and Tracker Rows

Click the **+** button in the toolbar. You will be asked to choose a type of row first:

- **Thread row** - a plot hook or open question. Gives it a title, a status, a description, and an optional linked journal entry.
- **Tracker row** - a numeric visual progress meter. Gives it a title, a status, a current/max value, a visual style, and one or more named milestones.

Both kinds are edited the same way later: click a row's **pencil** icon to reopen its edit dialog.

---

### Tracker Visual Styles

Each tracker renders as one of three styles:

- **Bar** - a linear meter with milestones listed beneath it
- **Clock** - a segmented circular dial, one wedge per point of the max value, with reached milestones outlined
- **Pips** - a row of small boxes, one per point of the max value, filled left to right

Pick a style per tracker from its edit dialog. Whichever style is active, a +/- stepper sits directly on the row so you can bump progress without opening the edit dialog.

---

### Filtering by Status

Every row, thread or tracker, has a status: **Seed**, **Active**, **Resolved**, or **Abandoned**. Use the filter chips in the toolbar to show only rows in a particular status. Resolved and abandoned rows dim rather than disappearing from the list, so you can still find them later.

---

### Notes Log

Thread (Threads and Trackers) rows carry a dated note log. Click the note icon and caret in the bottom-right of a thread row to expand or collapse the log inline to the row. Add a new dated note from the expanded panel.

---

### Linking a Journal to a Thread

Thread rows (not trackers) can link a single journal entry. Open the row's edit dialog via the **pencil**; the right side is a journal panel matching the pin gallery's journal pane. Drag a journal entry from the sidebar onto the drop zone, or click **Create Lore Entry** to create and link a new one. The linked journal renders inline with page navigation if it has multiple pages, and can be unlinked from the same panel.

If a linked journal no longer resolves, the panel shows the stored name marked as missing with an active drop zone to relink it.

---

### Grouping Rows into Folders

Rows can be grouped into named folders to keep related threads and trackers together. Drag rows and folders to reorder them. A folder can be renamed or deleted from its kebab (three-dot) menu.

---

### Row Actions

Each row has a kebab (three-dot) menu on the right, offering **Edit** and **Delete**. Deleting a row asks for confirmation, with the confirming button.

---

### Threads in the Pin Gallery

Every pin's gallery window also has its own Threads (Threads and Trackers) list, independent of any tab-level Threads tab. Use the toggle at the top-right of the gallery's panel to switch between the pin's linked journal and its Threads list, useful for tracking things specific to one location on the map.

---

## Cast Directory

Create a custom or generate a quick NPC personality generator for the moment you need a name and a hook without stopping to improvise one. Cast cards are created from pin gallery images and collected in a browsable cast directory.

---

### Generating a Cast Card

Open a pin's preview dialog (Image Tabs -> Pin -> Image gallery) and toggle **Cast** on via the top right button. This generates a card with a name, role, quote, quirks, voice, and hook on the front, and a secret, want, and free-form notes on the back. Click the card to flip between front and back.

---

### Species and Naming Style

Every card has a **Species** and **Naming Style** dropdown. The species list adapts to the active game system:

- **dnd5e & dnd4e** - the full species roster, including setting-specific ancestries from official sourcebooks
- **pf2e & pf1e** - a matching roster built for Pathfinder, including several ancestries with no dnd5e equivalent (leshy, ratfolk, kitsune, catfolk, and more).
- **Any other system** - a system-agnostic pool of common fantasy species, so the feature isn't unusable outside dnd and pf.

Name, voice, and quirks are generated per species using that species' own naming convention and personality flavor. A handful of species use a naming mechanic instead of constructed syllables where it's truer to their concept: a kenku's name is a mimicked phrase picked up from somewhere, and a lizardfolk's is a deed name in the "Fights-Two-Bears" style. Species with no cultural basis for gendered naming (constructs like warforged and autognome) draw from one shared pool regardless of which naming style is picked.

---

### Thematic Field Pools

Role, quote, hook, secret, and want are not tied to a single species each. They draw from one of eight thematic pools, matched to where that species most plausibly lives or operates: **civic**, **wild**, **aquatic**, **underground**, **planar**, **fey**, **undead**, and **construct**. A species can be tagged to more than one pool (an elf might pull from civic or fey, for example), and which pool is used is picked at random each time a field is generated, so a duergar and a triton don't end up sounding like they came from the same small town, and repeated generations for the same species still feel varied.

---

### Rerolling and Undo

Each field has its own dice button to reroll just that field. The **Regenerate All** button (the larger dice icon in the card header) rerolls every field at once. If a regeneration wasn't what you wanted, the **Undo** button restores the card's previous generation (just one step).

---

### The Cast Directory Window

Open the Cast Directory from the toolbar button in the main board window, or bind the **Open Cast Directory** keybinding (unbound by default) in Configure Controls. Cards are grouped by the pin or image they're linked to, with an "Orphaned" group for any that lost their link. Click a group header to collapse or expand it. Each card tile has a kebab (three-dot) menu to preview, delete, or show the card to players.

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

**Export** saves a JSON file into your world folder containing all tabs, pin data (including pin layers), cell links, faction data, gallery folder paths, and any scene links with their snapshotted image lists. The export also records the display name of every linked document; the import link check uses those names to offer repairs.

**Import** reads a previously exported JSON file and merges or replaces the current board state.

**The link check**

Before anything is imported, the module resolves every document link and file path in the file. If everything resolves, the import proceeds directly. If links are broken, a link check dialog lists them by name and offers repairs:

- If a document with the same name and type exists in the destination world or a loaded compendium, the row shows a **Relink** button, or a dropdown when there are several candidates (world folders and compendium names are shown to tell them apart). A **Relink all exact matches** button accepts every unambiguous suggestion at once.
- If several broken file links share a folder prefix, a **Fix file paths** section appears. Enter or browse to the new location and the dialog re-checks the affected paths as you type, reporting how many the remap repairs.
- Scene image tabs are checked image by image, so a moved asset folder can be remapped in one step. If the tab's linked scene is not in the destination world but a scene of the same name is, the row offers to reconnect the tab to it. Either way the tab still works from its snapshot after import, and its scene can be reconnected later from the tab settings.
- The summary counts update as you accept fixes, and rows strike through as they are resolved. Fixes are applied to the imported data only when you confirm the import; Cancel discards everything, including accepted fixes.

Anything still broken after the link check imports anyway and shows up as a labeled broken-link state on its tab (see the Broken links notes in the sections above), so it can be relinked later.

> **Note:** exports made with module versions before v2.1 do not contain document names. Importing one of those files still works, but the link check can only show raw IDs for broken links and cannot offer relink suggestions. If you still have the source world, update the module there and export again. The new file records a name for every link that still resolves, and the link check uses those names to find matches.

> **Note:** Boards imported from before pin layers existed are upgraded automatically. Every image tab is given a default "Layer 1" and any pins without a layer are moved onto it, so no pins are lost.

---

### Reset Window Position

The board remembers its window size and position for each user between sessions. This is stored per-client, so different GMs can each have their own preferred layout.

If the window ever ends up off-screen, at an unusable size, or otherwise inaccessible, use the **Reset Window Position** button in the module settings panel.

Clicking it does two things: clears the saved position and size, and closes the board window if it is currently open. After that, re-open the board using the toolbar button and it will appear at its default size and position. From that point on, any new size or position you set will be saved again on close.
