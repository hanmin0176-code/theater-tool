# Theater Tool Builder

React/Vite editor for building theater-style scene posts with character portraits, rich text, preview, HTML export, shared templates, dark/light themes, and undo/redo.

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

Template saves use Netlify Blobs through `netlify/functions/templates.mjs`.

Users enter an access code of 6+ characters. The same code opens the same shared template list across browsers and PCs. Korean access codes are supported because the server stores templates under a SHA-256 hash of the normalized code.
