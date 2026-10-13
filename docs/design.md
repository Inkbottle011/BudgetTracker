# How the app looks

One look across every screen, in light and dark. To change it, edit the values in
`lib/theme.tsx`; every screen reads its colors from there.

## Colors (`lib/theme.tsx`)
- `page` behind everything; `surface` for sections, cards and sheets; `surfaceAlt` for inputs and
  selected rows; `line` for borders and dividers; `track` for empty bars and switches.
- Text: `ink` for headings and numbers, `text` for body, `muted` for secondary, `faint` for hints.
- `primary` for buttons, links and selected things (`primarySoft` behind selected items).
- Money: `good` for money in / under budget, `bad` for over budget and errors, `move` (grey) for
  transfers between your own accounts. Each has a `…Soft` background.
- Transaction types use `typeColors(type, c)` (soft background + colored text), shown with
  `<TypeBadge>`.
- `panel` is the one dark summary panel (dashboard). Nothing else uses a solid dark or colored block.
- Never hard-code a hex color in a screen; use the palette so dark mode works.

## Moving background (`lib/background.ts`, `lib/spaceScene.ts`, `components/SpaceBackground.tsx`)

A starry sky behind every page, chosen in Settings: Stars, Warp or Nebula (or None), with speed, how many
stars, color, and optional shooting stars and planets. Stars and Nebula also have bright sparkling
stars and a faint Milky Way band of star dust (painted once, then reused each frame). It's saved on each device. When it's on, `backdrop` from `useTheme()` is see-through so
the sky shows; sections and cards stay solid so text is easy to read. Page backgrounds should use
`backdrop`, not `c.page`. It holds still if the device is set to reduce motion, and runs at about 30
frames a second. New colors go in `TINTS` and `TINT_COLORS` in `lib/background.ts`.

## Type and spacing
- Page titles 26 bold; section titles 18 bold; body 14 to 15; secondary 12 to 13.
- Sentence case everywhere. No ALL-CAPS labels, no emoji in the interface.
- Amounts use `tabular` so digits line up; format with `formatMoney` (`-$270.00`, never `$-270`).
- Dates read "Oct 6" (add the year only when it isn't this year).
- Sections: radius 14, padding 20, 1px `line` border. Inputs and buttons: radius 10. Chips: round.
- Pages use `<Page>` (max width, 16px margins on phones, 28px on computers).

## Building blocks (`components/ui.tsx`)
`Page`, `PageTitle`, `Section`, `Button` (primary, secondary, danger, ghost), `Field`, `Chip`,
`Segmented`, `TypeBadge`, `EmptyState`, `useIsWide()`.

## Phones
Below 900px wide everything is one column; nothing scrolls sideways unless it's a deliberately
scrollable table. Forms that sit beside a list on a computer open as a sheet on a phone.

## Words
Plain verbs; buttons say what happens ("Save changes", "Add transaction"). Errors say what went
wrong and how to fix it. Empty screens say what to do next.
