# Lore Reference Board

[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://patreon.com/Elemor)
[![Foundry Version](https://img.shields.io/badge/Foundry-v12%20%7C%20v13%20%7C%20v14-informational?style=for-the-badge)](https://foundryvtt.com)
[![Module Version](https://img.shields.io/badge/Version-2.3.0-success?style=for-the-badge)](https://github.com/ElemorSeru/lore-reference-board/releases/latest)
<img alt="GitHub Downloads (all assets, latest release)" src="https://img.shields.io/github/downloads/ElemorSeru/lore-reference-board/latest/total">

A system agnostic Foundry VTT module built for GMs who want an organized reference board that stores all your information as well as image references of your favorite art. Keep your maps, image references, documents, and world documents organized and accessible in one window that stays consistent no matter which scene or scenario you're running.

Open the board from its scene controls button or with **Ctrl+B** (rebindable in Configure Controls). Neither requires an active scene.

Supports Foundry v12 (again, but build 12.328 or later), v13, and v14 as of build 2.1.0.

---

## History / Reasoning

I run fairly complex campaigns. Between session prep I found myself constantly flipping between file explorer windows, journal entries, actor sheets, roll tables, and reference PDFs while trying to run encounters or narrate moments. There was no good way to have everything visible and ready in one place without leaving Foundry or opening ten separate applications/windows.

The Lore Reference Board started as a way to keep a campaign map open with clickable pins tied to images and journal entries. It grew from there into something that covers most of what I needed: a window where I can pin notes to a map, see the images I have related to that area, keep a full-width document open, or build a dashboard of anything I would need for the games.

All data is stored world-scoped (not tied to any scene) so the board is always where you left it, regardless of which scene you or your players are viewing.

---

## Tab Types

The board supports five types of tabs. You can have as many tabs as you need and mix types freely.

Tabs can be pinned to keep them grouped at the start of the tab bar (separated by a divider from the rest), and reordered via drag-and-drop using the reorder toggle in the toolbar.

Each tab is color-coded by type (blue for Image, coral for Document, purple for Reference, amber for Faction, green for Threads), so you can tell at a glance what kind of tab you are looking at.

### Image Tabs
<p align="center">
  <img src="assets/screenshots/ImageTabWPins.png" alt="image" width="520">
</p>
A full-view image viewer (mostly for maps of any kind, but can be any image you want to put references on) with placeable pins. The image supports pan and zoom via mouse wheel and drag. Each pin can be:

- Given a title, description, color, and icon (from a default selectable icon set)
- Linked to any journal entry in your world or compendiums
- A pin gallery with image folders imported from your data directory so you can see all your references quickly

Clicking a pin opens a preview dialog to help you describe things. If a journal is linked, it renders the journal content on this screen with multi-page navigation. The preview window also allows you to add additional Journals/lore to the image, copy the image location to clipboard, create the image as a token, and create it as a scene.

If the GM Tools: Encounter Forge module is active, creating a token offers a choice between a blank actor or a fully generated NPC (via Encounter Forge's generator, pre-loaded with the image as portrait and token).

**Pin layers.** Pins on an image tab are organized into stackable layers, each with its own name and color. A dropdown in the image toolbar switches the active layer, or shows "All" layers at once with a small color badge on each pin. Add, rename, recolor, reorder, duplicate, and delete layers from the tab settings. New pins go on the active layer, which is useful for tracking variants of an area, splitting prep between GMs, or keeping different passes of a map apart. Older boards without layer data are upgraded automatically: each image tab gets a default layer and its existing pins move onto it if orphaned from older builds.

**Using a scene as the image.** Instead of browsing for a file, an image tab can be based on one of your Foundry scenes, chosen from the world or a compendium. The board snapshots the scene's images and lets you cycle through them from a toolbar dropdown: the background, the foreground, and, on Foundry v14, each of the scene's levels. Pins share one fixed workspace across every image, so switching images never moves them. The tab settings offer Refresh (re-pull the scene) and Change or Reconnect (point the tab at a different or recreated scene). A scene-backed tab that lands in a world without that scene keeps working as a saved image list. See the wiki for the full detail on refreshing, reconnecting, and recreating scenes, and on how pins are kept or cleared when the image or scene changes.
<p align="center">
  <img src="assets/screenshots/SceneAndPinLayersTools.png" alt="image" width="520">
</p>
<p align="center">
  <img src="assets/screenshots/PinGallery.png" alt="image" width="520">
</p>

<p align="center">
  <img src="assets/screenshots/PinImagePreview.png" alt="image" width="340">
</p>

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
<p align="center">
  <img src="assets/screenshots/ReferencesTab.png" alt="image" width="520">
</p>
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
<p align="center">
  <img src="assets/screenshots/FactionMapWPartyStanding.png" alt="image" width="520">
</p>
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

### Threads Tabs
<p align="center">
  <img src="assets/screenshots/ThreadsTab.png" alt="image" width="520">
</p>
A running list of everything moving in the campaign: open plot hooks and ticking progress meters, side by side in one filterable view instead of two separate tab types.

Each row is one of two kinds:

- **Thread row** - a plot hook or open question with a status (Seed / Active / Resolved / Abandoned), a description, an optional linked journal entry, and a dated note log you can expand inline without opening a row edit dialog
- **Tracker row** - a current/max progress meter toward one or more named milestones, rendered as a **bar**, a **clock** (segmented dial), or a row of **pips**, whichever style fits the tracker. Bump progress with the +/- stepper directly on the row; no need to open the edit dialog just to advance a meter.
<p align="center">
  <img src="assets/screenshots/ThreadsMeters.png" alt="image" width="520">
</p>

Rows can be grouped into folders, reordered by drag-and-drop, and filtered by status with the toolbar's filter chips. Resolved and abandoned rows dim rather than disappear, so you can still find them later. Editing, deleting, and folder deletion are available from each row's kebab (three-dot) menu.

The same Threads list is also available per-pin from the pin gallery, as a toggle alongside the pin's linked journal, for tracking things specific to one location on the map.
<p align="center">
  <img src="assets/screenshots/ThreadsInGallery.png" alt="image" width="520">
</p>

---

## Cast Directory

<p align="center">
  <img src="assets/screenshots/LRB_GalleryCast.png" alt="Cast card generated for a pin, shown in the image gallery" width="520">
</p>

Create a custom or generate a quick NPC personality instead of improvising one on the spot. Toggle Cast on in a pin's preview dialog (Image Tabs -> Pin -> Image gallery) to generate a card: name, role, quote, quirks, voice, and hook on the front, secret, want, and free-form notes on the back. Reroll any single field with its dice button, regenerate the whole card at once, or undo back to the previous generation if you don't like the result.

Every card has a Species and Naming Style picker. The species list adapts to the active game system: a full roster for dnd5e & dnd4e, a matching roster for pf2e & pf1e (including several ancestries with no dnd5e equivalent, aliased to a related species' data rather than duplicating content), and a system-agnostic pool of common fantasy species for anything else. Name, voice, and quirks are generated per species using that species' own naming convention and personality flavor (a kenku's name comes from a mimicked phrase, a lizardfolk's from a deed name, etc). Role, quote, hook, secret, and want draw from one of eight thematic pools (civic, wild, aquatic, underground, planar, fey, undead, construct) matched to a species' likely context, so a duergar and a triton don't end up sounding like they came from the same small town.

All generated cards collect in the **Cast Directory**, grouped by the pin or image they're linked to. Open it from the toolbar button in the main board window, or bind the keybinding (unbound by default) in Configure Controls. Each card can be deleted, previewed, or shown to players from this Cast Directory.

---

## Search *(New in v2.0)*
<p align="center">
  <img src="assets/screenshots/SearchWindow.png" alt="image" width="520">
</p>

Click the magnifying glass button in the toolbar to open the search panel. The panel slides in and displays on the right side of the main board window and can be resized by dragging the divider (up to a point).

Type at least two characters to search. Results are grouped by tab or cell, with a snippet showing the matched text in context. Click any result to jump directly to it: the board switches to the right tab, scrolls to the correct page or location, and highlights the matched text.

**What gets indexed in the search:**
- Document tabs: PDF (all pages), TXT, Markdown, HTML, DOCX, and Journal entries (all pages)
- Reference cells: PDF, TXT, Markdown, and Journal entries

Indexing runs automatically when items are added, changed, or deleted. PDF pages are read from the file directly, not from what you have scrolled through, so the entire document is searchable immediately after it is loaded. While a large PDF indexes, its tab or cell shows a small progress badge with a cancel button.

The module settings panel includes an **Index All** button to force a full re-index of everything if results ever seem off, with a progress dialog that can be cancelled if things get stuck or take too long.

---

## Broken Links & Import Repair *(New in v2.1)*

Links break: journals get deleted, files move, boards get imported into other worlds. Instead of failing silently, the board marks broken links where they live and gives each one a repair path:

- Reference cells and document tabs show what the dead link pointed at, with a relink control
- Pins with a missing journal get a red badge on the map; the pin dialog, preview, and gallery all show the missing state with a drop zone to relink
- Faction members whose document is gone appear dimmed with a red outline; clicking one offers to remove it
- Gallery folders and map images that fail to load show the old path and a browse button to relocate them
- Scene image tabs keep working from their snapshot even when the source scene is missing; the tab settings offer a Reconnect control, and on import a scene of the same name can be suggested as a match

On import, a link check dialog resolves every link before anything is written. Broken document links get relink suggestions matched by name and type from the destination world and loaded compendiums, with a one-click "relink all exact matches" option. Broken file paths that share a folder prefix can be remapped in one step, with the dialog re-checking the new paths live. Exports record document names to make those suggestions possible. Whatever is left imports as a labeled broken-link state and can be fixed later. I attempted to give a cleaner path rather than force broken links.
<p align="center">
  <img src="assets/screenshots/ImportBoardLinkPanel.png" alt="image" width="520">
</p>

> **Note:** exports made with module versions before v2.1 do not contain document names, so the link check can only show raw IDs for them and cannot offer relink suggestions. To get the full repair experience, update the module in the source world and export again. The new export records a name for every link that still resolves there.

---

## Screenshots

> <img src="assets/screenshots/PinEditorWToggledOn.png" alt="image" width="520">
<p align="center">
  <img src="assets/screenshots/GameSettings.png" alt="image" width="340">
</p>
<p align="center">
  <img src="assets/screenshots/ReferenceBoardConfig.png" alt="image" width="340">
</p>

---

## Installation

**Method 1: Manifest URL**

In Foundry's module manager, paste the manifest URL:

```
https://github.com/ElemorSeru/lore-reference-board/releases/latest/download/module.json
```

**Method 2: Manual**

Download the latest release zip, extract it into your `Data/modules/` directory, and restart Foundry.

**After updating:** if things don't seem right, do a hard refresh (`Ctrl+F5`) in Foundry or just close and reload Foundry. The browser caches the module's internal files, and a normal reload can keep serving the previous version.

---

## Compatibility

| | |
|---|---|
| Foundry VTT | v12 (12.328+), v13, v14 |
| Game Systems | System-agnostic (no system dependency) |

The module is system-agnostic. It does not read or write any game system data and works with any system installed in Foundry.

---

## Data Storage

All board data is stored in **world-scoped game settings**, not scene flags. This means:

- The board persists across scene changes
- Data is not lost when switching active scenes
- All GMs in the same world share the same board data

You can export and import the full board state (tabs, pins and their layers, cell links, faction data, and scene image snapshots) from the module settings panel. This is useful for backups or moving a board between worlds. Links are stored by UUID and file path; scene-backed tabs also store a snapshot of the scene's images plus a link. The import link check (see above) repairs what it can, and anything else imports as a labeled broken-link state that can be relinked in place later. Boards from before pin layers existed are upgraded on load and on import so no pins are lost.

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
