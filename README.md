# Chaucer's Class Compendium

A homebrew class builder for 5th-edition games. Fill in the tabs, then use **Print / PDF** to get a book-style PDF.

Plain HTML, CSS and JavaScript: no build step, no server, no accounts.

## Putting it on GitHub Pages

1. Create a new repository on GitHub and push this folder's contents to it (so `index.html` is at the top level).
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch", pick `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

## Running it locally

The site uses JavaScript modules, which browsers won't load from a double-clicked file. From this folder run:

```
python3 -m http.server 8000
```

then open http://localhost:8000. The VS Code "Live Server" extension works too.

## How saving works

- Everything autosaves to the browser's `localStorage` (key `chaucer:v1:class`). Nothing is sent anywhere.
- **Download save** writes a `.json` file; **Open save…** loads one. This is the real backup, and how to move a class between devices.
- Save files carry a `schema` number. If you change the data structure later, bump `SCHEMA_VERSION` in `js/data.js` and add an upgrade step in `migrate()` in `js/state.js` so old saves still open.

## Files

| Path | What it does |
|---|---|
| `index.html` | Page shell, top bar, settings dialog (saving info and credits) |
| `js/data.js` | Game data: skills, spell slot tables, count presets, default class, image lists |
| `js/state.js` | Autosave, JSON download/upload, validation and migration |
| `js/editor.js` | The six tabs and all form controls |
| `js/render.js` | Builds the document used for the preview and the PDF |
| `js/app.js` | Wires everything together; printing and settings |
| `css/app.css` | Editor styling and the parchment/sepia palette |
| `css/doc.css` | Document styling, including the two-column print layout |
| `css/fonts.css`, `fonts/` | Bundled fonts (SIL Open Font License) |
| `img/` | Woodcuts, cleaned and tinted sepia |
| `vendor/` | marked (Markdown) and DOMPurify (sanitising), MIT/Apache licensed |

## Common changes

- **Colours:** the variables at the top of `css/app.css`.
- **Add a woodcut:** put a transparent PNG in `img/`, then add it to `IMAGES.headers` (wide bands) or `IMAGES.spots` (illustrations) in `js/data.js`. The key is the filename without `.png`; the value is the label shown in the dropdown.
- **Tab images:** `IMAGES.tabs` in `js/data.js`.
- **Preset numbers:** `COUNT_PRESETS` and `SLOT_PRESETS` in `js/data.js`. Worth checking against the SRD before relying on them.

## Credits and licensing

- Unofficial fan content, not approved or endorsed by Wizards of the Coast.
- Includes material from the System Reference Document 5.1 and 5.2 by Wizards of the Coast LLC, licensed under CC-BY-4.0. The credit line in each PDF changes with the ruleset selected.
- Woodcuts courtesy of the Museum Plantin-Moretus, Antwerp. Keep a note of each image's object number and licence from the museum site.
- Fonts: EB Garamond, IM Fell English, IM Fell English SC, UnifrakturMaguntia, under the SIL Open Font License (licence files in `fonts/`).
- marked (MIT) and DOMPurify (Apache-2.0 / MPL-2.0); licence files in `vendor/`.
