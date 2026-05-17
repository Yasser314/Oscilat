<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bc163f67-e6a0-4236-af12-9a7204ba1046

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Code Documentation

Below is a concise overview of the main source files and their exported components/functions in this project.

| File | Exported Component / Function | Description |
|------|------------------------------|-------------|
| `src/App.tsx` | `App` (default export) | Root React component that composes the UI, manages global state, audio handling, and renders the main canvas and control panel. |
| `src/components/TektronixVectorScope.tsx` | `TektronixVectorScope` | Renders the animated vector oscilloscope visualizer with multiple display modes (3D sphere, spiral, XY, etc.) and supports audio‑driven effects. |
| `src/components/TektronixVectorScope.tsx` | `VUMeter` | Small component displaying a vertical LED‑style meter for left/right audio RMS levels. |
| `src/components/TektronixVectorScope.tsx` | `Knob` | Rotary‑style input widget used throughout the UI to adjust numeric parameters (e.g., persistence, speed, brightness). |
| `src/main.tsx` | (bootstrap) | Entry point that mounts the `App` component into the DOM. |
| `src/index.css` | (styles) | Minimal CSS reset and custom scrollbar styling for the application. |

These components are styled using Tailwind‑like utility classes and rely on the Web Audio API for audio analysis. No API keys or secrets are embedded in the source code.

---
