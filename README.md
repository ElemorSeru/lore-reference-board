# Lore Reference Board

[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://patreon.com/Elemor)
[![Foundry Version](https://img.shields.io/badge/Foundry-v12-informational?style=for-the-badge)](https://foundryvtt.com)
<img alt="GitHub Downloads (all assets, latest release)" src="https://img.shields.io/github/downloads/ElemorSeru/lore-reference-board/latest/total">

A system agnostic Foundry VTT module built for GMs who want an organized reference board that stored all your information as well as image references of your favorite art. Keep your maps, image references,, documents, and world documents organized and accessible in one window that stays consistent no matter which scene or scenario you're running.

---

## History / Reasoning

I run fairly complex campaigns. Between session prep I found myself constantly flipping between file explorer windows, journal entries, actor sheets, roll tables, and reference PDFs while trying to run encounters or narrate moments. There was no good way to have everything visible and ready in one place without leaving Foundry or opening ten separate applications/windows.

The Lore Reference Board started as a way to keep a campaign map open with clickable pins tied to images and journal entries. It grew from there into something that covers most of what I needed: a window where I can pin notes to a map, see the images I have related to that area, keep a full-width document open, or build a dashboard of anything I would need for the games.

All data is stored world-scoped (not tied to any scene) so the board is always where you left it, regardless of which scene you or your players are viewing.

---

## Tab Types

The board supports three types of tabs. You can have as many tabs as you need and mix types freely.

### Image Tabs
<img width="1788" height="1194" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/ImageTabWPins.png" />
A full-view image viewer (mostly for maps of any kind, but can be any image you want to put references on) with placeable pins. The image/map supports pan and zoom via mouse wheel and drag. Each pin can be:

- Given a title, description, color, and icon (Default selectable icon set list)
- Linked to any journal entry in your world or compendiums journals
- A pin gallery with image folders imported from your data directory so you can see all your references quickly

Clicking a pin opens a preview dialog to help you describe things. If a journal is linked, it renders the journal content on this screen with multi-page navigation. The preview window also allows you to add additional Journals/Lore to the image, copy the image location to clipboard to be used elsewhere, create this image as a token, and/or create it as a scene.  
<img width="1678" height="1044" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/PinGallery.png" />

<img width="480" height="809" alt="image" src="https://github.com/ElemorSeru/lore-reference-board/blob/master/assets/screenshots/PinImagePreview.png" />

### Document Tabs

A full-pane document viewer. Drop or browse for any of the following and it renders directly in the tab:

- PDF files 
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
A 4-column grid dashboard. Each cell links to a Foundry document or embeds a file. Cells can span multiple columns and rows. The grid scrolls and expands vertically as you add more content. To support system agnostic settings, I had to cut some visual functionality, but still act as a quick load dashboard.

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
| PDF file | Embedded PDF filling the cell |
| TXT file | Preformatted text content |
| Markdown file | Rendered Markdown HTML |

Each cell has a small pencil button in the header that opens the edit dialog. You can re-link it to a different document, swap to a file, or resize the cell without deleting and re-adding it.

#### Cell Placement Picker

When you add or edit a cell, a visual grid picker shows the current layout and lets you draw a rectangle for where the cell should go. Click once to set the start corner, hover to preview the selection, click again to confirm. Occupied cells are shown with a striped overlay and cannot be selected. Invalid overlapping selections turn red. You can also (while editing) change the dimensions of existing cells with the pencil icon in the header.

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
| Foundry VTT | v12 |
| Game Systems | System-agnostic (no system dependency) |

The module is **system-agnostic**. It does not read or write any game system data and works with any system installed in Foundry (that I've tested anyway).

---

## Data Storage

All board data is stored in **world-scoped game settings**, not scene flags. This means:

- The board persists across scene changes
- Data is not lost when switching active scenes
- All GMs in the same world share the same board data

You can export and import the full board state (tabs, pins, cell links) from the module settings panel. This is useful for backups or moving a board between worlds. Just keep in mind that links are created via reference, so if the folder structure/names differ, it wont load those things. 

---

## Languages

The module ships with translations for:

- English
- French
- Spanish
- Russian
- Armenian
- Japanese
- Chinese (Simplified)

---

## About

Built and maintained by [Elemor](https://patreon.com/Elemor).

If you find this useful and want to support continued development, the Patreon link above is the best way to do that.

Bug reports and feature requests are welcome via the Issues tab.
