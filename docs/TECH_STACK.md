# Technology Stack Rationale

| Layer | Choice | Rationale |
|---|---|---|
| Core Framework | React 19 + TypeScript + Vite 8 | Fast SPA bundling, strict compile-time safety across physics, terrain, and UI state. |
| Styling | Tailwind CSS v4 | Utility-first layout and responsive HUD sizing without inline style bloat or separate CSS stylesheets. |
| 3D Engine | Direct Three.js (imperative controllers) | Direct control over WebGLRenderer pixel ratio, `PMREMGenerator`, `InstancedMesh` buffers, dynamic `BufferGeometry` terrain ribbons, and `afterDraw` software-GL throttling with zero React reconciler overhead during the 60fps/180Hz game loop. |
| UI Icons | `lucide-react` + custom inline `<svg>` | Crisp vector UI controls paired with bespoke mechanical upgrade parts, coins, gems, fuel cans, and vehicle silhouettes. |
| Audio | Web Audio API (`SoundEngine`) | Zero-asset procedural synthesis for dual-oscillator RPM engine notes, filtered nitro jet noise, combo coin chimes, and crash impacts. |
| Persistence | `localStorage` | Instant offline-capable save persistence across sessions with zero login wall. |
