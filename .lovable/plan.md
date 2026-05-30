# IntellectMail — IIT Webmail Intelligence Dashboard

Frontend-only build using the **Elite Academic Glass** direction. Mock data lives in a typed module; structure ready for backend API swap later.

## Design tokens (src/styles.css)
- Fonts: Plus Jakarta Sans + JetBrains Mono (Google Fonts import)
- Semantic tokens in oklch:
  - `--accent` blue (#2563eb), `--success` green (#059669), `--warning` amber (#d97706), `--low` slate (#94a3b8), `--academic` slate-900
- Light theme primary; subtle slate-50 background; soft shadows; rounded-2xl cards

## Routes (file-based, TanStack Router)
```
src/routes/
  __root.tsx           shell + QueryClient + Toaster
  index.tsx            landing / sign-in (public)
  _app.tsx             dashboard layout (sidebar + topbar + Outlet)
  _app/dashboard.tsx   overview (stats + priority stream + insights)
  _app/important.tsx   important emails list
  _app/low-priority.tsx low priority list (compact)
  _app/calendar.tsx    month calendar + upcoming sidebar
  _app/archive.tsx     notes-style archive grid
  _app/settings.tsx    summary length, notif prefs, calendar sync
  _app/email.$id.tsx   email detail view
```

## Shared components (src/components/)
- `AppSidebar.tsx` — nav with active state via `useRouterState`
- `AppTopbar.tsx` — search, sync status badge, profile avatar
- `EmailCard.tsx` — variants: important (bordered/accent), low-priority (compact, dimmed)
- `CategoryBadge.tsx` — color-coded (important/low/deadline/exam/lab)
- `StatCard.tsx` — KPI tiles
- `DeadlineList.tsx` — date pills + event
- `CategoryBreakdown.tsx` — dark card with bars
- `EmptyState.tsx`, `LoadingSkeleton.tsx`
- `ConfirmDialog.tsx` (shadcn AlertDialog wrapper)

## Mock data (src/lib/mock-data.ts)
Typed `Email` interface matching the spec (id, sender, subject, body, receivedAt, category, summary, extractedDates[], tags[], unread, priorityScore). ~15 sample emails spanning academic/exam/lab/event/promo. Helper selectors: `getImportant`, `getLowPriority`, `getWithDates`, `getById`.

## Pages

**Landing (`/`)**
Centered hero: badge "IIT Webmail Intelligence", H1 "Signal over noise. Academic mail, triaged.", subcopy, primary "Sign in with college account" button → navigates to `/dashboard` (mock auth, no real OAuth). Mini feature row (3 cards: triage, extract dates, archive noise). Clean white surface on slate-50.

**Dashboard (`/dashboard`)**
Matches selected prototype exactly: 4 stat cards (Scanned Today, Important, Deadlines Found, Time Saved), then 3-column grid → left 2/3 "Academic Priority Stream" with filter chips (All / Important / Low priority / With dates / Unread) + email card list; right 1/3 sticky column with Critical Deadlines, Intelligence Summary (dark card with progress bars), Archived Low Priority callout.

**Email detail (`/email/$id`)**
Back link, sender + subject header, AI-summary callout (italic, accent), extracted-dates timeline (vertical with date pills), action buttons row: Add to Calendar / Save Note / Mark Important / Mark Low Priority. Low-priority variant: compact 2-line summary, smaller layout.

**Important / Low priority / Archive**
List views with appropriate density. Archive renders note cards in a masonry-ish 3-col grid with tag chips and search.

**Calendar (`/calendar`)**
Month grid with deadline pills on dates; right sidebar lists upcoming events; clicking a date filters the sidebar to that day's email context.

**Settings**
Form: summary length (slider: short/medium/detailed), notification toggles, calendar sync toggle + connected account display.

## UX details
- Toasts via `sonner` on Mark Important / Add to Calendar / Save Note
- `ConfirmDialog` for archive/delete actions
- Loading skeletons (shadcn Skeleton) shown on initial mount via short setTimeout in mock fetcher
- Empty states with icon + message + CTA
- Compact/detailed view toggle in topbar (persisted to localStorage)
- Mobile: sidebar collapses to icon strip via shadcn Sidebar

## Tech notes
- Uses existing shadcn components (Button, Card, Badge, Input, Dialog, AlertDialog, Skeleton, Sidebar, Tabs, Switch, Slider)
- `sonner` Toaster mounted in `__root.tsx`
- All data flows through `src/lib/mock-data.ts` — single point to later swap with `createServerFn` calls
- No backend, no auth wiring — "Sign in" is a navigate
- Fully responsive (sidebar hides under md, stat grid stacks, detail panel becomes full-width)

## Out of scope
- Real OAuth, real email fetching, AI summarization
- Persistent storage (state is in-memory React state)
- Dark mode toggle (light theme only, matching chosen direction)
