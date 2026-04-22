# Theater Tool Builder

React/Vite editor for building theater-style scene posts with character portraits, rich text, preview, HTML export, shared templates, dark/light themes, and undo/redo.

The preview can be exported as a long PNG capture of the centered post body,
excluding the side gutters around the preview.

## Local Development

Use offline Netlify Dev for normal local testing because template saving runs
through `netlify/functions/templates.mjs`.

```powershell
npm.cmd install
npm.cmd run dev
```

Open the Netlify Dev URL, normally `http://localhost:8888`.

After logging in with `npx.cmd netlify login`, use the authenticated mode when
you need Netlify account environment variables:

```powershell
npm.cmd run dev:netlify:auth
```

For frontend-only work that does not need Netlify Functions:

```powershell
npm.cmd run dev:vite -- --port 5173
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
- Local Netlify Dev port: `8888`
- Vite target port behind Netlify Dev: `5173`

Template saves use Netlify Blobs through `netlify/functions/templates.mjs`.

Users enter an access code of 6+ characters. The same code opens the same shared template list across browsers and PCs. Korean access codes are supported because the server stores templates under a SHA-256 hash of the normalized code.

## Release Flow

1. Edit and test locally with `npm.cmd run dev`.
2. Validate the production build with `npm.cmd run build`.
3. Commit and push stable changes to GitHub.
4. Deploy manually from Netlify when the pushed version is ready for production.

```powershell
git status --short
git add .
git commit -m "Describe the stable change"
git push origin main
```

Netlify is linked to the GitHub `main` branch, but automatic deploys are kept
disabled. Use the Netlify dashboard to trigger a deploy from the connected repo
after pushing a stable version.

Manual CLI deploy scripts are available as a fallback after `npx.cmd netlify
login`:

```powershell
npm.cmd run deploy:preview
npm.cmd run deploy:prod
```
