# Third-party notices

## liquidglass

Copyright (c) 2026 gentpan.

Inkroam includes the liquidglass core and adapts its control interaction patterns from [gentpan/liquidglass](https://github.com/gentpan/liquidglass), pinned revision `068ad226f53e1ca62d857f78bdc32f58f3c5fce7`, under the MIT License. The complete license and copyright notice are retained in [LICENSE](app/vendor/liquidglass/LICENSE).

The vendored core is located in `app/vendor/liquidglass/liquid-glass.js`; its control adapter is `app/utils/glass-controls.ts`. Inkroam's implementation notes are in the [vendored core README](app/vendor/liquidglass/README.md).

## AndroidLiquidGlass

Copyright 2025 Kyant.

Portions of the optional `circular` indicator profile in `liquid-glass.js`, and the indicator interaction in `app/utils/glass-controls.ts`, are adapted from Kyant0/AndroidLiquidGlass, revision `65ab177e90e5c1d8c62e70cf7755841982da65f6`, licensed under Apache License 2.0. The complete license is included in [LICENSE-KYANT](app/vendor/liquidglass/LICENSE-KYANT).

Sources:

- `backdrop/src/commonMain/kotlin/com/kyant/backdrop/internal/Shaders.kt`
- `app/src/commonMain/kotlin/com/kyant/backdrop/catalog/components/LiquidBottomTabs.kt`
- `app/src/commonMain/kotlin/com/kyant/backdrop/catalog/utils/DampedDragAnimation.kt`

Repository: https://github.com/Kyant0/AndroidLiquidGlass

Inkroam modifications (2026-10-30): translated circular refraction and expanded-radius normal calculations to a cached SVG displacement-map renderer; added symmetric normal-based highlights and animated rim opacity; translated damping ratios to unit-mass springs, scaled lens dimensions to each DOM control, and retained existing variable-width selection and DOM lifecycle ownership. Original material recipes and the non-indicator optical model remain unchanged. The original gentpan engine retains its MIT license in [LICENSE](app/vendor/liquidglass/LICENSE).
