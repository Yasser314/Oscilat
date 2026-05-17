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


## Creative Visual Enhancements

The project has been upgraded with **6 creative visual enhancements** focused on emulating retro analog CRT hardware, organic dissipation, and advanced math modeling:

1. **Velocity-Based Beam Intensity**: Simulates true analog CRT cathode-ray behavior. The trace glows intensely where the electron beam moves slowly (e.g. loops, intersections) and fades during fast sweeps. Includes an intensity falloff curve slider.
2. **FFT Spectral Audio Bands**: Incorporates a dedicated FFT frequency analyser splitting audio into bass, mid, and treble bands. The bass triggers global scale pulsations, and the treble introduces fine-grained surface noise to mathematical shapes.
3. **Dynamic HSL Color Cycling**: Extends the coloring engine with three selectable modes:
   - **Static**: Choose a single flat trace color.
   - **Rainbow Cycle**: Slow, time-driven color shifts with configurable speed.
   - **Audio Reactive**: Maps real-time audio bass to hue and treble to saturation.
4. **Strange Attractors (Lorenz & Clifford)**: Adds advanced 3D and 2D chaotic system models:
   - **Lorenz Attractor**: 3D chaotic ODE projected with perspective.
   - **Clifford Attractor**: 2D iterated algebraic map.
   - Both react to audio bass for dynamic, live parameter distortion.
5. **CRT Barrel Distortion**: Uses GPU-accelerated 3D CSS perspective transforms and a radial gradient vignette overlay to simulate curved glass tube monitors without the high CPU cost of pixel manipulation.
6. **Perlin Flow-Field Feedback**: Implements a lightweight 2D noise generator to warp persistent feedback traces via a 32x32 tile grid. Creates organic, smoke-like dissipation trails.

---
