# Custom Start Engine

A single-file, offline-first startpage with Google and Gemini search bars, quick-launch shortcuts, themes, custom backgrounds and a full visual customizer.

**Version:** 2.4.0 “Aurora”

## Live site

**[Open Custom Start Engine →](https://nika-ez.github.io/custom-start-engine/)**

Direct link: <https://nika-ez.github.io/custom-start-engine/>

The old `https://nika-ez.github.io/` address redirects to the new link.

## Use locally

Open `index.html` in any modern browser. There is no build step or server required at runtime.

## Features

- Google search and Gemini prompt bars with auto-growing textareas
- Single-key shortcuts and quick-launch chips
- Dark, light and AMOLED themes with a custom accent color
- Aurora, mesh, solid and image backgrounds
- Clock, greeting, 12/24-hour time and compact layout options
- Save, revert and unsaved-change protection in the customizer
- Config export, import, clipboard copy and factory reset
- Keyboard shortcuts: `/`, `Ctrl+,`, `Ctrl+S`, `Esc`
- Local-only storage: no accounts, analytics or backend

## Development

`index.html` is assembled from the source files in `parts/`. After editing a part, rebuild with:

```powershell
python build.py
```

## Privacy

All settings, shortcuts and drafts are stored in the browser’s `localStorage` on the device. Nothing is uploaded by the page. Search queries are only sent to the search engine you choose.
