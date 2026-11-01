# liquidglass (vendored core)

Source: https://github.com/gentpan/liquidglass
Pinned commit: `068ad226f53e1ca62d857f78bdc32f58f3c5fce7`
Imported: 2026-10-27
License: MIT, copyright 2026 gentpan (see LICENSE).

Third-party attribution: [THIRD_PARTY_NOTICES.md](../../../../THIRD_PARTY_NOTICES.md).

`liquid-glass.js` is a modified copy of upstream `lib/liquid-glass.js`. Inkroam additions include optical-edge alpha coverage (`edgeSoftness`, currently .8 CSS px when enabled), bounded panel refraction, viewport bleed, circular control optics and animated rim opacity, stable Blink filter IDs, cached-map reuse and configurable update/settle scheduling. `liquid-glass.d.ts` describes the consumed API. Sampling combines explicit resolution (including .25×), optional AA multiplier, pixel budget and maximum side; map resolution is not the resolution of the sampled page.

Control optics and springs also adapt Kyant0/AndroidLiquidGlass revision `65ab177e90e5c1d8c62e70cf7755841982da65f6` under Apache-2.0; see `LICENSE-KYANT` and the root notices. Original labels and hit targets remain in Inkroam's DOM. Optical projections may escape a filtered owner to sample its completed backdrop, but never create a second visible range-thumb cap. No upstream widget styles or fonts are imported. Runtime is lazy-loaded; no CDN requests.

Current architecture and verification: [closeout](../../../../docs/liquid-glass-closeout-2026-11-01.md). This is an optical approximation, not a physical caustics renderer or a pixel-identical Android/Apple implementation.

Before updating, review upstream changes to resize/decode scheduling, filter cleanup, browser detection, and the optics. Re-run off/on/rapid-toggle/resize checks. Do not remove the license.
