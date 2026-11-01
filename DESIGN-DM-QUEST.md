# DRUŽINA MORAVY / CESTA — Visual system (18 October 2026)

Source: https://aliaksei-chareshneu.github.io/alchareshneu/druzina/cesty/
Capture: Firecrawl live branding + full-page screenshot on 2026-10-18, viewport 1365 × 850, dark mode. Root homepage + club page adopt its language, not its entire DOM.

## Observed tokens
- Background \`#10151c\`; inset/nav \`#111923\`; card surface \`#192330\` / \`#172330\`.
- Primary reading text \`#f8f1e5\`; secondary text \`#b8c2ce\`.
- Primary gold \`#e4ba76\`; pale gold for secondary links \`#ffdfac\`.
- Border soft grey-blue \`rgba(179,195,218,.28)\`.
- Display titles use **Georgia** regular/bold; body \`system-ui, -apple-system, Segoe UI\`.
- Cards are restrained dark/navy gradients and rounded 13–17 px; bright gold CTA with 9px radius.
- Atmospheric graphic: thin constellation lines and stars above a navy vignette; original hand-authored SVG reused as \`images/quest-constellation.svg\`.
- Original tree uses a two-column dual-path selection, stacked on mobile; role colours warm gold (shield) and subdued green (bow).

## Implemented adaptation
\`quest-theme.css\` is scoped by \`body.quest-site\` on root and club. This avoids silently rewriting nested Academy, Walkers or existing payment forms. Keeps nav, cards and layout from root site while adopting the tree's palette, Georgia title proportions, button styling and atmospheric constellation. Different images in existing sections remain and must be verified on desktop and mobile.
The skills page intentionally remains self-contained; its latest approved compact copy is shorter than this specification.

## Audio
\`media/druzina-quest-ambient.ogg\` is an **original, programmatically synthesized** minor-key atmospheric instrumental. Generated only with oscillators and deterministic noise by \`tools/compose-quest-audio.py\`. No Skyrim soundtrack, MIDI/soundfont samples, third-party recordings or melody was used. Loop opt-in by user click, no autoplay, volume limited, pause available. Do not represent as Bethesda licensed music.

## Safety and conversion
Do not hide mandatory consent, child/guardian safety, provider-qualification disclaimers or the HEMA paid-enquiry-only gate. Tree is a preview, not a skill tracker or training appointment confirmation. Hero messaging and tree: ONE common foundation on the FIRST VISIT, ONE active specialisation STARTING ON THE SECOND VISIT; Starter4 is a commercial option, NOT curriculum prerequisite.
