# Družina: three locally bundled site enhancements

Source only; the static GitHub Pages website remains unchanged architecturally.
Build source into public \`druzina/viz/\` assets before packaging.

1. Motion (mini) animates only the club hero and rank overview.
2. Anime.js animates the existing benefit/rank cards sequentially.
3. Recharts v3 with copied/adapted shadcn/ui ChartContainer and tooltip
   powers a six-language chart of the **published** B/C/K/A rule categories.

The graph is not attendance, member numbers, awarded qualification or income.
The static HTML fallback works without JavaScript. No analytics, remote runtime
CDN, new API, data collection, pricing or registration logic.

Build (Node 22): \`npm --prefix site-viz install --no-audit --no-fund &&
npm --prefix site-viz run build && npm --prefix site-viz test\`.
Production compiles itself; sources outside public directory. Reduced-motion
disables optional animation. Rollback: revert merge, republish previous Pages.

Licences: React, Recharts, Motion, Anime.js and adapted shadcn/ui source: MIT.
