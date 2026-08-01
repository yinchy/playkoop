# playkoop

A compact 3D, Space Trader-inspired WebXR trading game for mobile, desktop, and VR headsets.

## Run locally

Install dependencies and start the Vite dev server:

```bash
cd /home/runner/work/playkoop/playkoop
npm install
npm run dev
```

Then open the local URL printed by Vite in a WebXR-capable browser. Use orbit controls plus the HUD on desktop/mobile, or enter VR with the built-in WebXR button and use controller rays with the floating cockpit panel.

## Build

```bash
npm run build
```

The production files are emitted to `dist/`.

## Public deployment

This repository is configured to deploy automatically to GitHub Pages from the `dist/` build output.

Expected public URL:

`https://yinchy.github.io/playkoop/`

## Test

```bash
npm test
```
