# Mundial 2026 — Bracket Picker

A simple web page to predict the entire 2026 FIFA World Cup: pick winners for every group-stage match, advance the 8 best third-place teams, then pick winners through the full knockout bracket — Round of 32 → Round of 16 → Quarterfinals → Semifinals → Final + 3rd-place match.

Mobile-friendly. No build step. Static files only.

## Run locally

Open `index.html` in any modern browser.

```bash
open index.html      # macOS
xdg-open index.html  # Linux
start index.html     # Windows
```

Picks save automatically in your browser's local storage. Click **Reset bracket** to start over.

## Run the test suite

Open `tests.html` the same way. The page shows a green count of passed assertions; failures (if any) are listed below.

You can also start a local server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/tests.html`.

## Mobile testing on a real device

```bash
python3 -m http.server 8000
```

Find your computer's local IP (System Settings → Network on macOS) and visit `http://<your-ip>:8000` from a phone on the same Wi-Fi.

## Deploy to GitHub Pages

1. Create a new public repo on GitHub (e.g. `mundial-2026`).
2. From this folder:

   ```bash
   git remote add origin https://github.com/<your-username>/mundial-2026.git
   git branch -M main
   git push -u origin main
   ```

3. On the repo page → **Settings** → **Pages** → **Source** → **Deploy from a branch**, branch **main**, folder **/** (root). Save.
4. Wait ~1 minute. Site is live at `https://<your-username>.github.io/mundial-2026/`.

## Files

- `index.html` — main page
- `tests.html` — assertion-based test page
- `css/style.css` — styles (dark + gold theme)
- `js/dom.js` — DOM helpers (no innerHTML)
- `js/data.js` — teams, groups, R32 pairings, knockout chain
- `js/state.js` — localStorage persistence
- `js/standings.js` — group standings calculation
- `js/bracket.js` — knockout pairing logic
- `js/app.js` — UI rendering and event wiring

## Format reference

- 48 teams in 12 groups of 4 (groups A–L)
- Top 2 of each group + 8 best third-place teams = 32 advance to knockouts
- R32 → R16 → QF → SF → Final + 3rd-place match
- Win = 3 pts, Draw = 1 pt, Loss = 0 pts
- When teams tie on points within a group, the user manually orders them via the inline tiebreaker widget
- The 8 best third-place teams are also picked manually by the user (since we don't track goal differential)

## Flags

Flag images are hot-linked from [flagcdn.com](https://flagcdn.com/) — no images are stored in the repo.
