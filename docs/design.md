# How the app looks

One look across every screen, in light and dark, in five color themes you pick in Settings
(Night sky by default, Ocean, Forest, Sunset, Classic). The themes are in `src/shared/theme/themes.ts`;
every screen reads its colors from `useTheme()`, so nothing else needs editing.

## Colors (`src/shared/theme/themes.ts`)
- `page` behind everything; `surface` for sections, cards and sheets; `surfaceAlt` for inputs and
  selected rows; `line` for borders and dividers; `track` for empty bars and switches.
- Text: `ink` for headings and numbers, `text` for body, `muted` for secondary, `faint` for hints.
- `primary` for buttons, links and selected things (`primarySoft` behind selected items). In Forest
  and Sunset it is wood brown and orange, so a button never looks like money in or out.
- `bar` fills the top bar and the tab bar (`onBar` / `onBarMuted` for what's on it), the same on
  every page. `panel` is the dashboard's summary panel.
- Money means the same in every theme: `good` / `incomeMark` green for money in, `bad` / `spendMark`
  red for money out and over budget, `saved` / `savedMark` violet for savings, `warn` / `warnMark`
  amber for getting close to a limit, `move` grey for transfers between your own accounts. The
  `…Mark` colors are for bars and charts (checked for color-blind separation); the others for text.
- Budget bars: `paceMark` (the theme's color) on track, amber from 85% of the plan, red when over.
- Transaction types use `typeColors(type, c)` (soft background + colored text), shown with `<TypeBadge>`.
- Never hard-code a hex color in a screen; use the palette so themes and dark mode work.
- To add a theme, copy one in `src/shared/theme/themes.ts`, change its colors and add it to `THEME_LIST`.

## Moving background (`src/shared/theme/background.ts`, `src/features/appearance/`)

A starry sky behind every page, chosen in Settings: Stars, Warp or Nebula (or None), with speed, how many
stars, color, and optional shooting stars and planets. Stars and Nebula also have bright sparkling
stars and a faint Milky Way band of star dust (painted once, then reused each frame). It's saved on each device. When it's on, `backdrop` from `useTheme()` is see-through so
the sky shows; sections and cards stay solid so text is easy to read. Page backgrounds should use
`backdrop`, not `c.page`. It holds still if the device is set to reduce motion, and runs at about 30
frames a second. New colors go in `TINTS` and `TINT_COLORS` in `src/shared/theme/background.ts`.

## Type and spacing
- Page titles 26 bold; section titles 18 bold; body 14 to 15; secondary 12 to 13.
- Sentence case everywhere. No ALL-CAPS labels, no emoji in the interface.
- Amounts use `tabular` so digits line up; format with `formatMoney` (`-$270.00`, never `$-270`).
- Dates read "Oct 6" (add the year only when it isn't this year).
- Sections: radius 14, padding 20, 1px `line` border. Inputs and buttons: radius 10. Chips: round.
- Pages use `<Page>` (max width, 16px margins on phones, 28px on computers).

## Building blocks (`src/shared/ui/ui.tsx`)
`Page`, `PageTitle`, `Section`, `Button` (primary, secondary, danger, ghost), `Field`, `Chip`,
`Segmented`, `TypeBadge`, `EmptyState`, `useIsWide()`.

## Phones
Below 900px wide everything is one column; nothing scrolls sideways unless it's a deliberately
scrollable table. Forms that sit beside a list on a computer open as a sheet on a phone.

## Words
Plain verbs; buttons say what happens ("Save changes", "Add transaction"). Errors say what went
wrong and how to fix it. Empty screens say what to do next.
