# FuelTrack

FuelTrack is a personal, offline-first tracker for food consumed, protein intake, and food spending.

## Run & Operate

- `pnpm --filter @workspace/fueltrack run dev` — run the FuelTrack web app
- `pnpm --filter @workspace/fueltrack run typecheck` — typecheck the app
- `PORT=22670 BASE_PATH=/ pnpm --filter @workspace/fueltrack run build` — create the production bundle

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + TypeScript + Vite
- Storage: browser localStorage only
- Delivery: static production bundle with PWA manifest and service worker

## Where things live

- `artifacts/fueltrack/src/App.tsx` — app shell, screens, dialogs, and user actions
- `artifacts/fueltrack/src/lib/storage.ts` — local data model, seeded foods, parsing, persistence, and calculations
- `artifacts/fueltrack/src/index.css` — FuelTrack visual tokens and responsive styling
- `artifacts/fueltrack/public/manifest.webmanifest` and `public/sw.js` — installable/offline PWA surface

## Architecture decisions

- Data intentionally stays in localStorage; there is no account, API, database, or cloud sync.
- Food defaults are reference values only; each logged meal can override cost without mutating the saved food.
- Future-day logs require selecting the date explicitly with the date picker; arrow browsing alone does not unlock logging.

## Product

- Today: date navigation, add/edit/delete meals, protein progress, spend, meal grouping, repeat actions.
- Stats: monthly protein and spending summaries, budget projection, target days, and category bars.
- Purchases: actual grocery price records, optional brands, recent purchases, and average paid history.
- Settings: editable targets, dark mode, food database, JSON export/import, and clear-data confirmation.

## User preferences

- Keep the app simple and personal. Do not add auth, social features, AI, subscriptions, ads, or cloud sync unless explicitly requested.

## Gotchas

- FuelTrack's data lives in the browser that opened it. Use Export before clearing browser data or switching devices.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
