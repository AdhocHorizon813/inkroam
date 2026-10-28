# liquidglass (vendored core)

Source: https://github.com/gentpan/liquidglass
Pinned commit: `068ad226f53e1ca62d857f78bdc32f58f3c5fce7`
Imported: 2026-10-27
License: MIT, copyright 2026 gentpan (see LICENSE).

`liquid-glass.js` is the upstream `lib/liquid-glass.js` with one documented Inkroam extension: `edgeSoftness` (default 0) adds an inward alpha coverage ramp in CSS pixels to the lens map. It is included in map cache keys. Zero retains upstream pixel generation; enabling the appearance AA option uses 1.25 CSS px plus bounded supersampling. This is optical-edge antialiasing, not whole-page blur. `liquid-glass.d.ts` types the consumed API. No upstream widget styles are imported. `glass-controls.ts` adapts the MIT component motion/content-copy patterns while preserving Inkroam controls. Runtime is lazy-loaded; no CDN requests.

Before updating, review upstream changes to resize/decode scheduling, filter cleanup, browser detection, and the optics. Re-run off/on/rapid-toggle/resize checks. Do not remove the license.
