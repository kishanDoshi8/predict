---
name: tailwind-theming
description: How to style UI in this repo with Tailwind CSS v4 and the theme tokens in global.css. Use whenever writing or changing className, inline styles, colors, gradients, glows, shadows, or dark/light mode in apps/web, and before adding any new color.
---

# Tailwind theming

Tailwind CSS v4 with shadcn-style CSS variables. Colors come from theme
tokens, so the theme can change in one place and light and dark mode both
work. Prefer, in order: token classes → token variables → literal colors
(last resort only).

## Where the theme lives

`apps/web/src/shared/assets/styles/global.css`. There is no `tailwind.config`.

- `:root { --primary: ... }`: light mode values
- `.dark { --primary: ... }`: dark mode values
- `@theme inline { --color-primary: var(--primary); }`: exposes the token as
  Tailwind utilities (`bg-primary`, `text-primary`, `border-primary`, ...)

Dark mode is class based: `@custom-variant dark (&:is(.dark *))`.

## Tokens

| Purpose | Utilities |
| --- | --- |
| Page | `bg-background` `text-foreground` |
| Raised surfaces | `bg-card` `text-card-foreground`, `bg-popover` |
| Quiet fills and secondary text | `bg-muted` `text-muted-foreground`, `bg-secondary` |
| Brand action / live (rose) | `bg-primary` `text-primary-foreground` |
| Supporting emphasis (orange) | `bg-accent` `text-accent-foreground` |
| Errors | `text-destructive` `bg-destructive/10` |
| Lines and focus | `border-border` `border-input` `ring-ring` |
| Game results | `text-win` `text-loss` `text-live` `text-hot` |
| Activity signal (cyan) | `bg-activity` `text-activity-foreground` |
| Podium | `text-rank-1` `text-rank-2` `text-rank-3` |
| Charts | `fill-chart-1` ... `fill-chart-5` |

Use win/loss/rank tokens only for game meaning, not as decoration
(see `apps/web/DESIGN.md`).

## Rules

- Use token classes wherever possible. Avoid hex, `rgb()`, `hsl()` and
  `oklch()` in components, including arbitrary values (`to-[#171717]`) and
  `style={{ color: "#fff" }}`.
- Avoid raw palette classes (`bg-zinc-900`, `text-red-500`, `from-cyan-500/15`).
  Pick the token that means the same thing.
- Tints, glows and gradients use opacity modifiers on tokens:
  `bg-accent/10`, `border-primary/30`, `from-primary/15 to-accent/10`,
  `shadow-[0_0_30px] shadow-accent/15`.
- For gradients written as arbitrary values, reference the variable:
  `bg-[radial-gradient(circle_at_top_left,var(--color-accent),transparent_60%)]`,
  with `opacity-*` on the layer to soften it.
- Inline `style` is for computed geometry (sizes, transforms, progress
  widths). If it needs a color, use `var(--primary)` etc.

## When a class won't work

Tailwind only generates classes it finds written out in full in the source, so
`bg-${color}` or `text-rank-${place}` built at runtime produce no CSS. In order
of preference:

1. Map values to complete class strings:
   `const tone = { win: "text-win", loss: "text-loss" }[result]`.
2. Use the token as a variable in `style` or an SVG attribute:
   ``style={{ color: `var(--rank-${place})` }}``, `fill="var(--chart-1)"`,
   `twColor("rank-1", 0.1)` from `@/shared/lib/utils` (alpha via `color-mix`).
   Third-party components that take a `color` prop usually accept `var(--...)` too.
3. Literal color, only when CSS variables can't reach it, with a comment saying
   why. Known cases:
   - Canvas / WebGL: `ctx.fillStyle = "var(--x)"` is ignored. Resolve the token
     with `getComputedStyle(document.documentElement).getPropertyValue("--primary")`
     where possible; building `rgba(...)` strings from it is fine.
   - Third-party brand marks with official colors (e.g. `GoogleButton.tsx`).
   - Places outside CSS: `public/manifest.json` `theme_color`, `<meta
     name="theme-color">`, OG image templates, emails.
- Don't add `dark:` overrides to fix a color. If a token looks wrong in one
  mode, fix its value in `:root` or `.dark`.
- `text-white` / `bg-black` are fine for overlays on images and media; on app
  surfaces use `text-foreground` / `text-primary-foreground`.
- Merge classes with `cn()` from `@/shared/lib/utils`.
- Tailwind v4 names: `bg-linear-to-br` (not `bg-gradient-to-br`),
  `outline-hidden`, opacity via `/NN` (no `bg-opacity-*`).

## Adding a token

When no token fits, add one in all three places in `global.css`, then use it:

```css
:root      { --streak: oklch(0.72 0.17 50); }
.dark      { --streak: oklch(0.78 0.16 50); }
@theme inline { --color-streak: var(--streak); }
```

Check contrast against `--background` and `--card` in both modes. Add the token
to the table in `apps/web/DESIGN.md`.

## Shareable images

Cards under `src/features/share/` are captured to PNG with `html-to-image` and
must look the same whatever theme the sharer uses. `ShareSheet` renders them
inside a `.dark` wrapper, so theme variables resolve to dark values;
`html-to-image` copies the resolved computed styles. The cards use inline
styles from `src/features/share/tokens.ts`, which point at the variables
(`var(--card)`), plus `twColor()` for tints. Keep new values there as
variables, not hex.

## Remaining literals

Intentional, with a reason: `GoogleButton.tsx` (brand colors), the canvas in
`shared/ui/animations/electric-border.tsx`, the `[stroke='#ccc']` selectors in
`shared/ui/charts.tsx` (they target Recharts' defaults), `bg-black/50` dialog
scrims and `text-white` on destructive buttons in shadcn primitives.
`apps/web/og/` and `public/manifest.json` are outside CSS and keep literals.
