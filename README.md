# Lore Reference Board

[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://patreon.com/Elemor)
[![Foundry Version](https://img.shields.io/badge/Foundry-v13%20%7C%20v14-informational?style=for-the-badge)](https://foundryvtt.com)
[![Module Version](https://img.shields.io/badge/Version-2.0.0-success?style=for-the-badge)](https://github.com/ElemorSeru/lore-reference-board/releases/latest)
<img alt="GitHub Downloads (all assets, latest release)" src="https://img.shields.io/github/downloads/ElemorSeru/lore-reference-board/latest/total">

A system agnostic Foundry VTT module built for GMs who want an organized reference board that stores all your information as well as image references of your favorite art. Keep your maps, image references, documents, and world documents organized and accessible in one window that stays consistent no matter which scene or scenario you're running.

---

## History / Reasoning

I run fairly complex campaigns. Between session prep I found myself constantly flipping between file explorer windows, journal entries, actor sheets, roll tables, and reference PDFs while trying to run encounters or narrate moments. There was no good way to have everything visible and ready in one place without leaving Foundry or opening ten separate applications/windows.

The Lore Reference Board started as a way to keep a campaign map open with clickable pins tied to images and journal entries. It grew from there into something that covers most of what I needed: a window where I can pin notes to a map, see the images I have related to that area, keep a full-width document open, or build a dashboard of anything I would need for the games.

All data is stored world-scoped (not tied to any scene) so the board is always where you left it, regardless of which scene you or your players are viewing.

---

## Tab Types

The board supports four types of tabs. You can have as many tabs as you need and mix types freely.

Tabs can be pinned to keep them grouped at the start of the tab bar (separated by a divider from the rest), and reordered via drag-and-drop using the reorder toggle in the toolbar.

Each tab is color-coded by type (blue for Image, coral for Document, purple for Reference, amber for Faction), so you can tell at a glance what kind of tab you are looking at.

### Image Tabs
<img width="1788" height="1194" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/ImageTabWPins.png" />
A full-view image viewer (mostly for maps of any kind, but can be any image you want to put references on) with placeable pins. The image supports pan and zoom via mouse wheel and drag. Each pin can be:

- Given a title, description, color, and icon (from a default selectable icon set)
- Linked to any journal entry in your world or compendiums
- A pin gallery with image folders imported from your data directory so you can see all your references quickly

Clicking a pin opens a preview dialog to help you describe things. If a journal is linked, it renders the journal content on this screen with multi-page navigation. The preview window also allows you to add additional Journals/lore to the image, copy the image location to clipboard, create the image as a token, and create it as a scene.

If the GM Tools: Encounter Forge module is active, creating a token offers a choice between a blank actor or a fully generated NPC (via Encounter Forge's generator, pre-loaded with the image as portrait and token).
<img width="1678" height="1044" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/PinGallery.png" />

<img width="480" height="809" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/PinImagePreview.png" />

### Document Tabs

A full-pane document viewer. Drop or browse for any of the following and it renders directly in the tab:

- PDF files (new and improved)
- Markdown files
- Plain text files
- HTML files
- DOCX files
- Image files
- Any URL or web page (limited based on iframe limits and anything requiring authentication)
- World or compendium journal entries (with multi-page navigation)

The document stays loaded in the tab. You can unlink and swap to a different document at any time using the tab's header bar.

### Reference Tabs
<img width="1778" height="1188" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/ReferencesTab.png" />
A 4-column grid dashboard. Each cell links to a Foundry document or embeds a file. Cells can span multiple columns and rows. The grid scrolls and expands vertically as you add more content. To support a more system agnostic setup, I had to cut some visual functionality within the grid, but it still acts as a quick load dashboard to keep things organized.

Supported document types per cell:

| Type | What it does in the grid |
|---|---|
| Actor | Card with portrait (when tall enough) and Open Sheet button |
| Item | Card with portrait and Open Sheet button |
| JournalEntry | Inline scrollable content with multi-page navigation and Open button |
| Macro | Card with Execute button |
| Playlist | Card with Play/Stop controls |
| RollTable | Inline table of all results with a Roll button that marks drawn entries |
| Scene | Card with Activate Scene button |
| Cards | Card with Shuffle and Deal buttons |
| PDF file | Embedded infinite scroll canvas viewer filling the cell |
| TXT file | Preformatted text content |
| Markdown file | Rendered Markdown HTML |

Each cell has a small pencil button in the header that opens the edit dialog. You can re-link it to a different document, swap to a file, or resize the cell without deleting and re-adding it.

#### Cell Placement Picker

When you add or edit a cell, a visual grid picker shows the current layout and lets you draw a rectangle for where the cell should go. Click once to set the start corner, hover to preview the selection, click again to confirm. Occupied cells are shown with a striped overlay and cannot be selected. Invalid overlapping selections turn red. Editing a cell you've already placed can be done from the pencil icon in the top-right corner of each cell header.

### Faction Tabs
<img width="1788" height="1194" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/FactionMapWPartyStanding.png" />
A freeform relationship map for tracking factions, NPCs, and how they all feel about each other and the party. Each faction is a draggable, resizable circle on a pannable and zoomable canvas.

- Add factions with the Add Faction (plus) button. Each gets a name, a color, and a party standing rating
- Drag a faction to reposition it, or hover over the circle to see a double arrow symbol and drag it from the corner arrows handle to resize it
- Adjust a faction's rating with the +/- buttons, or type directly into the rating box. You can enter a plain number, or use `+N` / `-N` to adjust the current value, or `=N` to set it exactly
- Drag any Actor, Item, Journal Entry, or other Foundry document onto a faction circle to link it as a member. Linked entities show as small portrait tokens you can click to open their sheet; an overflow button appears if there are too many to fit within the circle
- Use Add Relationship (link icon) to enter link mode, then click two factions to draw a relationship line between them and choose its type
- Click an existing relationship line to change its type or delete it
- Relationship Types (palette icon) lets you add, edit, or remove the line styles and colors used for relationships. The module has a default set (Allies, Rivals, Trade Partners, Vassal/Liege, Blood Feud, Truce/Ceasefire, Mentor & Student, Spy Network) but you can add, modify, or delete any that you wish.
- Standing Tiers (sliders icon) lets you configure the rating ranges and labels used to describe a faction's standing. Initially built to be against players, but you can modify it to whatever makes sense for your campaign.
- Party Standing (handshake icon) opens a side panel listing every faction on all faction tabs with its current standing label

---

## Search *(New in v2.0)*
<img width="1876" height="1179" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/SearchWindow.png" />

Click the magnifying glass button in the toolbar to open the search panel. The panel slides in and displays on the right side of the main board window and can be resized by dragging the divider (up to a point).

Type at least two characters to search. Results are grouped by tab or cell, with a snippet showing the matched text in context. Click any result to jump directly to it: the board switches to the right tab, scrolls to the correct page or location, and highlights the matched text.

**What gets indexed in the search:**
- Document tabs: PDF (all pages), TXT, Markdown, HTML, DOCX, and Journal entries (all pages)
- Reference cells: PDF, TXT, Markdown, and Journal entries

Indexing runs automatically when items are added, changed, or deleted. PDF pages are read from the file directly, not from what you have scrolled through, so the entire document is searchable immediately after it is loaded.

The module settings panel includes an **Index All** button to force a full re-index of everything if results ever seem off.

---

## Screenshots

> <img width="1876" height="1179" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/PinEditorWToggledOn.png" />
<img width="1195" height="1363" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/GameSettings.png" />
<img width="480" height="809" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/ReferenceBoardConfig.png" />

---

## Installation

**Method 1: Manifest URL**

In Foundry's module manager, paste the manifest URL:

```
https://github.com/ElemorSeru/lore-reference-board/releases/latest/download/module.json
```

**Method 2: Manual**

Download the latest release zip, extract it into your `Data/modules/` directory, and restart Foundry.

---

## Compatibility

| | |
|---|---|
| Foundry VTT | v13, v14 | (V12 ended on 1.2)
| Game Systems | System-agnostic (no system dependency) |

The module is system-agnostic. It does not read or write any game system data and works with any system installed in Foundry.

---

## Data Storage

All board data is stored in **world-scoped game settings**, not scene flags. This means:

- The board persists across scene changes
- Data is not lost when switching active scenes
- All GMs in the same world share the same board data

You can export and import the full board state (tabs, pins, cell links) from the module settings panel. This is useful for backups or moving a board between worlds. Links are stored by UUID and file path, so if the folder structure or document names differ in the destination world, those links will not load correctly.

The board also remembers its window size and position between sessions. Each user stores their own position independently. If the window ever ends up off-screen or at an unusable size, there is a **Reset Window Position** button in the module settings panel that closes the board and clears the saved position.

---

## Languages

The module ships with translations for:

- English
- (Other languages to follow in later builds)

---

## About

Built and maintained by [Elemor](https://patreon.com/Elemor).

If you find this useful and want to support continued development, the Patreon link above is the best way to do that.

Bug reports and feature requests are welcome via the Issues tab.
