# Theater Tool Builder

React/Vite editor for building theater-style scene posts with character portraits, rich text, preview, HTML export, templates, dark/light themes, and undo/redo.

## Local Development

```powershell
npm.cmd install
npm.cmd run dev -- --port 5173 --host 0.0.0.0
```

## Build

```powershell
npm.cmd run build
```

The production output is generated in `dist/`.

## Netlify

Netlify uses `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist`

Template saves currently use browser `localStorage`, so saved templates persist per browser on the deployed site.
