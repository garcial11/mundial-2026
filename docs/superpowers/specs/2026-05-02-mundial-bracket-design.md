# Mundial 2026 Bracket Picker — Design

**Date:** 2026-05-02
**Status:** Approved design, ready for implementation plan

## Goal

A mobile-friendly web page where the user's son can predict the entire 2026 FIFA World Cup: pick winners (and draws) for every group-stage match, manually advance the 8 best third-place teams, then pick winners through the knockout rounds (R32 → R16 → QF → SF → Final + 3rd-place match) all the way to the champion. Runs locally as static files; deploys to GitHub Pages.

## Constraints & Decisions

- **Format:** 2026 FIFA World Cup — 48 teams, 12 groups (A–L) of 4, top 2 + 8 best third-place advance to Round of 32, single-elimination through the Final and 3rd-place match (104 matches total).
- **Group stage interaction:** kid picks the result of all 72 group-stage matches; draws are allowed (W=3, D=1, L=0).
- **Tiebreakers:** when teams tie on points within a group, the kid manually orders the tied cluster via an inline tiebreaker widget (no goal-difference data exists since picks are win/draw/loss only).
- **Third-place advancement:** kid manually selects 8 of the 12 third-place teams to advance.
- **Knockout pairings:** hard-coded from FIFA's published rule for matches 73–88 (R32) and the deterministic chain through R16/QF/SF/Final.
- **UI language:** English.
- **Visual style:** modern sports broadcast — dark background, sleek cards, gold accents, World Cup-style typography.
- **Tech stack:** plain HTML/CSS/vanilla JS. No framework, no build step.
- **Persistence:** `localStorage` (key `mundial2026`), auto-saved on every pick. "Reset bracket" button wipes state.
- **Editing:** picks are always editable; changing a pick prompts a confirm dialog and clears all downstream picks that depended on the changed team.
- **Mobile-first:** responsive layout via CSS Grid/Flexbox, fluid units, tap targets ≥44px, no hover-only interactions.
- **Flag images:** hotlinked from `flagcdn.com` (e.g. `https://flagcdn.com/w160/<iso>.png`); no local downloads.
- **Deploy target:** GitHub Pages (main branch, root folder).

## Architecture

Single-page static site. All logic in a handful of vanilla JS modules. State held in a single object, persisted to `localStorage`, with derived data (standings, bracket pairings) recomputed on each render.

```
mundial/
├── index.html
├── tests.html              (manual test harness, console assertions)
├── css/
│   └── style.css
├── js/
│   ├── app.js              (entry point: render, event wiring)
│   ├── data.js             (TEAMS, GROUPS, R32 pairing rules, R16/QF/SF/Final chain)
│   ├── state.js            (load/save/reset localStorage; schema versioning)
│   ├── standings.js        (compute group standings + tiebreaker resolution)
│   └── bracket.js          (build R32 from group results, advance through rounds)
└── README.md               (local run + GitHub Pages deploy steps)
```

### Module responsibilities

- **`data.js`** — pure data. Exports `TEAMS` (id → {name, isoCode}), `GROUPS` (A–L → [team ids]), `R32_PAIRINGS` (16 entries mapping group winners/runners-up/third-place slots to match ids), and the deterministic `KNOCKOUT_CHAIN` for R16/QF/SF/Final. As of writing, some 2026 playoff slots may be TBD; those teams are placeholders rendered as "TBD A1" / "TBD B2" with a generic flag.
- **`state.js`** — `load()`, `save(state)`, `reset()`, `migrate(oldState)` keyed off `version`. Returns a default empty state if nothing is stored or `localStorage` is unavailable.
- **`standings.js`** — `computeGroup(matches, manualRanking)` → `{ ranked: [team ids 1st..4th], tiedClusters: [...] }`. Pure function.
- **`bracket.js`** — `buildR32(groupRankings, thirdPlaceAdvancing)` → list of R32 match cards with both slots filled (or null if upstream incomplete). `advance(round, picks)` → next-round match cards.
- **`app.js`** — renders sections, wires tap handlers, handles confirm dialogs for cascading clears.

## Data Model

### Static (`data.js`)

```js
TEAMS = {
  'mex': { name: 'Mexico',        code: 'mx' },
  'usa': { name: 'United States', code: 'us' },
  // ... 48 entries (some may be TBD placeholders)
}

GROUPS = {
  A: ['mex', 'tbd_a1', 'tbd_a2', 'tbd_a3'],  // pulled from official FIFA draw at build time
  B: [...],
  // ...
  L: [...]
}

R32_PAIRINGS = [
  { id: 'm73', slotA: '2A',         slotB: '2B' },
  { id: 'm74', slotA: '1E',         slotB: '3rd-of-ABCDF' },
  // ... 16 entries from FIFA's published table
]
```

### Live (`localStorage` key `mundial2026`)

```js
{
  version: 1,
  groupResults: {
    A: {
      matches: {                 // 6 entries per group; key is the two team ids
                                 // joined with "-", sorted alphabetically by id
        'mex-tbd_a1': 'mex',     // value = winner team id, or 'draw'
        'mex-tbd_a2': 'draw',
        // ...
      },
      manualRanking: null        // null = use auto sort; or full ordered [1st, 2nd, 3rd, 4th]
                                 // team ids when any tie affecting top-3 ranking is resolved
    },
    // B..L
  },
  thirdPlaceAdvancing: [],       // array of 8 team ids selected by kid
  knockout: {
    r32:   { 'm73': null, 'm74': null, ... },   // match id → winner team id
    r16:   { ... },
    qf:    { ... },
    sf:    { ... },
    final: { 'final': null, 'third': null }
  }
}
```

### Computed (not stored)

- Group standings (recomputed from `matches` + `manualRanking` on every render)
- R32 slot fills (derived from group rankings + `thirdPlaceAdvancing`)
- R16 / QF / SF / Final slot fills (derived by walking the knockout chain)

## User Flow

```
┌─────────────────────────────────────────┐
│  MUNDIAL 2026 — YOUR BRACKET           │   Hero: dark bg, gold accent, [Reset] button
├─────────────────────────────────────────┤
│  Sticky nav: Groups · 3rd · R32 · R16 · QF · SF · Final
├─────────────────────────────────────────┤
│  GROUPS (12 cards, A–L)                 │   Each card:
│                                         │     • 4 team rows
│                                         │     • 6 match pickers (W/D/L tap)
│                                         │     • live standings table
│                                         │     • tiebreaker widget when tied
├─────────────────────────────────────────┤
│  BEST THIRD-PLACE TEAMS                 │   Locked until all 12 groups complete.
│                                         │   Lists 12 third-place teams; kid picks 8.
├─────────────────────────────────────────┤
│  KNOCKOUTS                              │   R32 → R16 → QF → SF → Final + 3rd
│                                         │   Each match = card with 2 flags;
│                                         │   tap a team to pick winner.
├─────────────────────────────────────────┤
│  CHAMPION                               │   Revealed when final pick is made.
└─────────────────────────────────────────┘
```

### Group match interaction

Each group card shows the 6 matches. Each match has three tappable rows: `Team A wins` / `Draw` / `Team B wins`. Tap selects; tap again deselects. Standings table below recomputes immediately.

### Tiebreaker widget

When the standings have a points-tie that affects positions 1, 2, or 3 (4th is always eliminated, so a 3rd–4th tie still matters because the 3rd-place team becomes a candidate for the 8-best-thirds pool), an inline list appears: the tied teams stacked with ↑/↓ arrows. Kid orders them. The full resolved 1st–4th order is saved as `manualRanking`.

### Third-place selection

Once all 12 groups are complete, the section unlocks. Lists 12 third-place teams as checkboxes labeled with group letter. Kid checks exactly 8. The 8 selected are mapped to the correct R32 slots according to FIFA's third-place allocation table (e.g. R32 match 74 takes the best 3rd from A/B/C/D/F). If the 8 picks don't satisfy a valid combo from FIFA's table, an explanatory message shows the valid combos and asks the kid to adjust. (Rare; the FIFA table covers all common scenarios.)

### Knockout interaction

Each match card stacks two team rows. Tap a row → gold border + checkmark on it, the other dims. Tap the other team to switch. Picking a winner immediately fills that team into the next round's match card.

## Edit Behavior

Picks are always editable. When the kid changes any pick:
- If the change invalidates downstream picks (e.g. a team that was advancing now isn't), show a confirm dialog: **"This will clear your later picks. Continue?"**
- If confirmed: clear all knockout picks that referenced the now-orphaned team, plus any group-level `manualRanking` entries that referenced the changed match.
- If canceled: revert.

This keeps state always consistent rather than trying to surgically preserve partial downstream picks.

## Visual Style

- Dark background (`#0a0e1a` range), gold accents (`#d4a017` range) for selected/winning teams and headlines
- Sans-serif display font for headings (`Inter` or similar via Google Fonts), system fallback
- Card-based layout with subtle shadows; selected state = gold border + slight scale-up
- Mobile breakpoints: single column < 600px, 2-column groups 600–900px, 3-column 900px+
- Knockout bracket on mobile: vertical scroll, one round per screen with horizontal scroll between rounds; on desktop, horizontal bracket layout

## Testing Strategy

`tests.html` — a plain HTML page that imports `standings.js` and `bracket.js` and runs a list of `assert(...)` checks, logging pass/fail to the console and rendering a summary count on the page.

Test coverage:
- **Standings:** all teams win once each (3-way tie at top), all matches drawn, one team sweeps, two teams tied on points with one head-to-head winner, three teams tied
- **Tiebreaker resolution:** with `manualRanking` set, ranking respects it
- **Bracket:** given known group rankings + third-place advancing list, R32 pairings match FIFA spec exactly
- **State:** save → load round-trip preserves all fields
- **Edit cascade:** changing a group match clears the right downstream knockout picks and leaves unrelated ones intact

Manual smoke test: complete a full bracket on desktop and on a phone (DevTools mobile emulation + real phone via local network) before declaring done.

## Edge Cases

- **TBD playoff teams:** rendered as "TBD A1" / "TBD A2" etc. with a generic placeholder flag. Kid can still pick around them; picks for unresolved teams stored normally (the team id is just `tbd_a1`).
- **localStorage unavailable / private mode:** app still works in-memory; banner says "Picks won't be saved — enable storage."
- **Schema migrations:** `version: 1` field at the root. If a future change needs a different shape, `state.js` migrates or wipes.
- **Browser refresh during pick:** auto-save on every state change means at most one click is lost.
- **Resize / orientation change:** handled by CSS media queries; no JS listener.

## Out of Scope

- Multiple users / sharing brackets
- Server-side anything (no backend, no auth)
- Real-time sync with actual tournament results
- Exporting bracket as image or PDF
- Internationalization beyond English

## Deploy

1. `git init`, commit all files, push to a new public GitHub repo (e.g. `mundial-2026`).
2. Repo → Settings → Pages → Source: `main` branch, root folder.
3. Site live at `https://<username>.github.io/mundial-2026/` within ~1 minute.

README will document both local run (`open index.html`) and the GitHub Pages steps.
