# Predikt

Private prediction game for friend groups. npm workspaces monorepo:

- `apps/web`: React 18 + Vite + TypeScript PWA, Tailwind CSS v4, shadcn/ui
  (Radix / Base UI), TanStack Query, React Router
- `supabase/`: Postgres schema (`schemas/`), migrations, edge functions, SQL tests

Read `apps/web/PRODUCT.md` and `apps/web/DESIGN.md` before UI work.

## Commands (run from the repo root)

- `npm run dev`: start the web app
- `npm run lint` / `npm run typecheck`: what CI runs; both must pass before pushing
- `npm run check`: lint + typecheck + build
- `npm run db:types`: regenerate `apps/web/src/shared/lib/supabase.types.ts` after schema changes

## Styling

- Colors come only from the theme tokens in
  `apps/web/src/shared/assets/styles/global.css` (`bg-card`,
  `text-muted-foreground`, `text-win`, `bg-accent/10`, ...).
- Never hardcode colors: no hex/`rgb()`/`oklch()`, no arbitrary color values
  (`[#...]`), no raw palette classes (`zinc-900`, `red-500`). Lint enforces this.
- Need a new color? Add a token (`:root`, `.dark`, `@theme inline`), don't inline it.
- Details and patterns: the `tailwind-theming` skill.

## Code layout

- Features live in `apps/web/src/features/<feature>`; import them through their
  public API (`@/features/<feature>`) or `pages/*`, not their internals.
- Shared UI is in `apps/web/src/shared/ui`; reuse it before writing new components.
