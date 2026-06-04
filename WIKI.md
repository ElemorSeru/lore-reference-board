This guide covers how to use every part of the Lore Reference Board. If something is not covered here, check the Issues tab on GitHub.

---

## Table of Contents

- [Opening the Board](#opening-the-board)
- [Managing Tabs](#managing-tabs)
- [Image Tabs](#image-tabs)
  - [Adding Pins](#adding-pins)
  - [Pin Icons](#pin-icons)
  - [Linking a Journal to a Pin](#linking-a-journal-to-a-pin)
  - [Pin Galleries](#pin-galleries)
- [Document Tabs](#document-tabs)
  - [Supported File Types](#supported-file-types)
  - [Linking a Journal Entry](#linking-a-journal-entry)
  - [Loading a URL](#loading-a-url)
- [Reference Tabs](#reference-tabs)
  - [Adding a Cell](#adding-a-cell)
  - [The Span Picker](#the-span-picker)
  - [Cell Types and What They Do](#cell-types-and-what-they-do)
  - [Editing or Deleting a Cell](#editing-or-deleting-a-cell)
  - [File Cells (PDF, TXT, Markdown)](#file-cells-pdf-txt-markdown)
- [Settings](#settings)
  - [Max Tab Rows](#max-tab-rows)
  - [Import and Export](#import-and-export)
  - [Reset Window Position](#reset-window-position)

---

## Opening the Board

The board opens from the toolbar on the left side of the Foundry UI. Look for the Lore Reference Board button (the two theater masks button). Click it to open the window.

The window is resizable and can be maximized using the maximize button in the top-right corner of the toolbar. The board remembers your tabs and content across sessions as long as the world data is intact.

---

## Managing Tabs

The tab bar runs along the top of the board window. Tabs can wrap to multiple rows if you have many of them (visible rows is configurable in the module settings).

**Adding a tab**

Click the `+` button at the far right of the tab bar. A dialog will appear asking you to pick a tab type:

- **Image Tab** - For maps/images you want to place pins on and use that functionlity
- **Document Tab** - For a single full-pane document or file
- **Reference Tab** - For a grid-based dashboard of documents/game objects (Journals, Actors, Roll Tables, Macros, etc.)

After selecting a type, a second dialog will ask for a name (and an image path, if you selected the Image Tab type, and if you want to load a specific folder to start. You can always do this later). The name field must be filled before the Add button becomes active.

**Renaming or deleting a tab**

Click the settings/gear button that appears on the right side of the main window. Your current active tab settings will open the tab settings dialog. From there you can rename the tab or delete it. Deleting a tab also removes all associated pins or cell data, so be careful.

**Reordering tabs (not implemented)**
This feature is not implemented yet, but in the future, I plan to put something in to reorder the tabs.

---

## Image Tabs

An Image tab shows a single image that you can pan and zoom. It is designed for campaign maps but works with any image.

**Pan and zoom**

- Scroll the mouse wheel to zoom in and out while your cursor is within the module window/image area
- Click and drag on the image (not on a pin) to pan
- Use the Reset button in the toolbar to return to the default view/zoom level

**Replacing the image**

As a warning, currently, if you change the image and have pins/galleries, it will delete it (I may change this or prompt in a future build). Open tab settings (use the settings icon in the toolbar). The image path field accepts a new path. Use the Browse button to pick from your Foundry data directory. 

---

### Adding Pins

To place a pin, click the pin placement toggle button in the toolbar (it turns blue when active). Then click anywhere on the image to place a pin at that location.

A dialog will open immediately so you can fill in the pin details. Once you save, the pin appears on the map.

To disable placement mode, click the toggle button again (this allows you to edit the gallery associated with the pin).

You can move the pin later by toggling the pin button on, and then left clicking and dragging the icon somewhere else.
---

### Pin Icons

The color picker and icon selector both update a live preview at the top of the pin dialog so you can see exactly what the pin will look like before saving.

---

### Linking a Journal to a Pin

Inside the pin dialog, the right panel is the journal linking area.

**To link a journal:**

Drag a journal entry from the Foundry journal sidebar and drop it onto the drop zone in the right panel. The panel will update to show the journal name and render the first page of content below it.

If the journal has multiple pages, a page navigation bar appears with previous and next arrow buttons and a page selector dropdown.

**To create a new journal and link it at the same time:**

Click the "Create Lore Entry" button inside the drop zone. You will be prompted for a name. A new blank journal entry is created in your world, linked to the pin, and the journal sheet opens automatically so you can start writing.

**To edit the linked journal:**

Click the Edit button in the linked state panel. This opens the journal sheet.

**To unlink:**

Click the Unlink button. You will be asked to confirm. The journal entry itself is not deleted.

---

### Pin Galleries

Each pin can have its own image gallery organized into folders. This is useful for keeping NPC portraits, location references, or item art associated with a specific pin; Really, any image you like.

**Opening the gallery**

When your pin placement is toggled off, just left click the pin. This opens the Pin Gallery window associated with that pin.

**Adding a folder**

Click "Add Folder" in the gallery window (to the right of the Save Name button). You will be asked for a folder name, then prompted to select a folder from your Foundry data directory (optional). All image files found in that folder are imported automatically.

You can also add individual images to a folder using the `+` button next to the folder name, or import all images from the folder's path using the folder button nest to the `+`.

**Removing an image**

Right-click any thumbnail in the gallery to remove it from the folder. The file itself is not deleted from your data directory.

**Clicking an image**

Left clicking a thumbnail opens a larger preview of the image in a dialog. From there you have options to add specific lore for that token, copy the file path to clipboard, create the image as a Foundry token, or create a new scene using the image.

---

## Document Tabs

A Document tab gives you a full-pane viewer tied to a single file or journal. The content fills the entire tab area.

When the tab has nothing linked yet, you will see a drop zone with two ways to load something:

1. **Drag and drop** a journal entry from the sidebar onto the drop zone
2. **Browse** using the file browser button to pick a file from your data directory

Once something is loaded, a header bar appears at the top of the tab showing what is linked. You can use the Unlink button in that bar to disconnect it and return to the empty state.

**Note:** V12 currently has a web browser/html loading function. I am working through how to move that to Version 13+ more cleanly.

---

### Supported File Types

| Extension | How it renders |
|---|---|
| `.pdf` | Embedded PDF viewer |
| `.md` | Rendered Markdown |
| `.txt` | Preformatted plain text |
| `.html` / `.htm` | Rendered HTML page in V12 Only |
| `.docx` | Converted to readable HTML (via mammoth.js) |
| `.png` / `.jpg` / `.webp` / `.gif` / `.svg` / `.bmp` / `.avif` | Centered image viewer |
| Journal Entry (world or compendium) | Rendered journal content with page navigation |
| `http://` / `https://` URL | Web page in V12 Only |

**Note on URLs in V12:** Whether a URL loads depends on whether the target site allows being embedded in an iframe. Many sites block this. If you see a blank frame or an error, the site does not permit embedding.

**Note on DOCX files:** The module is converting DOCX files into HTML. Complex formatting like tables, multi-column layouts, and certain styles may not convert perfectly. Simple documents with headings and paragraphs work well.

---

### Linking a Journal Entry

Drag any journal entry from the Foundry sidebar (Journals or Compendium Journals) and drop it onto the Document tab's drop zone. The will render and stay with the linked item.

If the journal has more than one page, a navigation bar appears at the top of the content area with previous/next buttons and a page dropdown. Pages are listed in their sorted order from the journal.

---

### Loading a URL (V12 Build Only, for now)

Type or paste a full URL (starting with `http://` or `https://`) into the path input at the bottom of the drop zone and click Load. The URL is loaded into the tab.

Some sites will refuse to load inside an iframe (what I'm using to load the page) due to their own security headers. If this happens there is no workaround from within Foundry or this Module.

---

## Reference Tabs

A Reference tab shows a 4-column grid of cells. Each cell links to one Foundry document or one file. The grid expands downward as you add more cells, and scrolls vertically.

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

The picker initializes with a 1x1 default selection at the grid position of the `+` button you clicked to open the dialog, so if you just want a single-size cell in that exact spot you can click Add immediately without interacting with the picker. You can also just pick a completely new set of cells from this window. You arent bound to which cell you started with.

---

### Cell Types and What They Do
For system agnostic functionality (I wanted to support more systems), some cells load/link to a shortcut of that added item according to their designated system module.

**Actor**

Shows the actor's portrait (when the cell is at least 2 rows tall) alongside the actor's name and an "Open Sheet" button that opens the actor sheet directly.

**Item**

Same layout as Actor. Shows portrait and an Open Sheet button.

**Journal Entry**

Renders the journal content inline inside the cell, including formatted text, images, and tables. If the journal has multiple pages, a navigation bar appears at the top of the cell with previous/next buttons and a page dropdown. An "Open" button in the cell header opens the full journal sheet.

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

**PDF cells** embed the file directly as an iframe inside the cell. The PDF viewer is the browser's native one. The cell needs to be reasonably tall for this to be usable, so consider using a span of at least 3 rows.

**TXT cells** display the file content as preformatted text, preserving line breaks and spacing. Good for quick reference notes stored as plain files.

**Markdown cells** fetch the file and render it as formatted HTML. Images in Markdown files will only display if the image path is a full URL or a path accessible from Foundry's system.

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

---

## Settings

Open Foundry's module settings (Game Settings > Configure Settings > Module Settings) and find Lore Reference Board.

---

### Max Tab Rows

Controls how many rows of tabs are shown before the tab bar stops growing and starts scrolling vertically within its current height. Default is 4.

Set this to 0 to allow unlimited rows (the tab bar will grow as tall as it needs to, but doesn't look great).

This is a per-client setting, so each GM (if multiple) can set their own preference independently.

---

### Import and Export

The module settings panel includes Import and Export buttons for the full board state.

**Export** saves a JSON file containing all your tabs, all pin data, all cell links, and all gallery folder paths. Download this file and keep it somewhere safe as a backup.

**Import** reads a previously exported JSON file and merges or replaces the current board state with the imported data.

One important thing to keep in mind: document links in cells and pins are stored by UUID and file path, not by copying the content. If you import a board into a different world that does not have the same actors, journals, or compendium packs, those links will show as broken until the matching documents exist in that world. File path links (PDFs, images, etc.) will also break if the file is not present at the same path in the new world's data directory.

---

### Reset Window Position

The board remembers its window size and position for each user between sessions. This is stored per-client, so different GMs can each have their own preferred layout.

If the window ever ends up off-screen, at an unusable size, or otherwise inaccessible, use the **Reset Window Position** button in the module settings panel.

Clicking it does two things: clears the saved position and size, and closes the board window if it is currently open. After that, re-open the board using the toolbar button and it will appear at its default size and position. From that point on, any new size or position you set will be saved again on close.
