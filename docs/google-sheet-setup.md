# Google Sheet setup — World Cup Picks 2026 scoring

Quick-start guide using a Google Apps Script that builds everything for you.

> **Time to set up:** ~5 minutes. The script handles all the labels, dropdowns, formulas, and auto-sorted leaderboard.

---

## 1. Scoring rules

| What's correct | Points |
|---|---|
| Group match — correct winner | **1** |
| Group match — correct draw | **2** |
| Group 1st / 2nd / 3rd correct | **2** each |
| Each correctly advancing 3rd-place team | **3** each |
| Each team you picked in **R32** that actually made R32 | **3** each |
| Each team you picked in **R16** that actually made R16 | **5** each |
| Each team you picked in **QF** that actually made QF | **8** each |
| Each team you picked in **SF** that actually made SF | **12** each |
| Each team you picked in **Final** that's actually in the Final | **20** each |
| **Champion** correctly picked | **+25 bonus** |

Max ≈ 471 pts. Late rounds dominate; comebacks possible until the Final.

---

## 2. Build the sheet (one-time, ~5 min)

1. Go to https://sheets.new — a fresh blank Google Sheet opens.
2. **Extensions → Apps Script**.
3. Delete the default `function myFunction()` placeholder.
4. Paste the **entire contents** of [`world-cup-pool.gs`](world-cup-pool.gs) (in this repo's `docs/` folder).
5. Click the floppy-disk **Save** icon (Ctrl+S / Cmd+S). Give the project a name (anything works).
6. Close the Apps Script tab and reload the spreadsheet tab.
7. After ~5 seconds a new menu appears: **World Cup Pool**.
8. **World Cup Pool → Set up sheet (run once)**.
   - First-time auth dialog: Continue → choose your Google account → "Advanced" → "Go to (project name) (unsafe)" → Allow. (This warning is normal for self-written scripts.)
   - The script builds three tabs: **Master**, **Scoring**, **Leaderboard**.

What you get:
- **Master tab** — 191 pre-labelled rows. Column B has the actual results, with **dropdowns** so you can't typo:
  - Group matches: 3-option dropdown (`Mexico wins` / `South Africa wins` / `Draw`)
  - Group standings: 4-option dropdown (the 4 teams in that group)
  - Team-set sections (R32/R16/QF/SF/Finalists/Champion): 48-team dropdown
- **Scoring tab** — formulas already wired up for 25 participants. Just drop names in row 1 (the **Add participant** menu does this for you).
- **Leaderboard tab** — auto-sorted ranking, refreshes whenever a result is entered.

---

## 3. Add participants

For each player:

1. **World Cup Pool → Add participant** → type their name → OK.
   - Creates a tab named after them, and fills their name into the next free Scoring column.
2. They send you their CSV (downloaded from https://garcial11.github.io/mundial-2026/).
3. Open the participant's tab → **File → Import → Upload** → drop the CSV → **"Replace data starting at selected cell"** → **Import**.

The Scoring tab and Leaderboard light up automatically.

---

## 4. As games happen

1. Open the **Master** tab.
2. Pick the result of each match from the dropdown in column B.
3. After each round, also fill in:
   - The 4 group standings rows for any group that finished
   - The 8 "Actual 3rd place advancing" teams once group stage ends
   - The 32 "Actual R32 team" entries (just type names — order doesn't matter)
   - 16 R16, 8 QF, 4 SF, 2 Finalists, 1 Champion as the tournament progresses

Every dropdown selection triggers re-scoring. Open the Leaderboard tab to see the ranking shuffle.

---

## 5. Sharing

- **File → Share** the spreadsheet with everyone in your office.
  - **Edit** access for you (admin).
  - **Viewer** for participants — they can see their score and the leaderboard but can't edit picks.
- Pin the **Leaderboard** tab as the default view (right-click on the Leaderboard tab → "Move right" until it's first).

---

## 6. Optional polish

- **Conditional formatting** on Leaderboard: in Format → Conditional formatting, color row 2 gold, row 3 silver, row 4 bronze.
- **Slack digest:** after each round, screenshot the Leaderboard tab and post it to your `#mundial-pool` channel.
- **More than 25 players?** Open Apps Script, edit the line `var MAX_PARTICIPANTS = 25;` to a larger number, save, then re-run **Set up sheet**.

---

## 7. Troubleshooting

- **"#REF!" or "#NAME?" in Scoring cells?** Most likely cause: a participant's CSV wasn't pasted starting at A1 of their tab, or their tab name doesn't exactly match the header in row 1 of Scoring. Re-import the CSV; ensure the Scoring header text matches the tab name character-for-character.
- **Wrong score?** Check that Master column B values match the format used in user CSVs (e.g. `Mexico wins`, not just `Mexico`). The dropdowns enforce this; only break if you bypass them.
- **Re-running Set up sheet won't recreate participant tabs.** That's intentional — your data is safe. Only Master / Scoring / Leaderboard get rebuilt.
- **Need to change the scoring values?** Open Apps Script → search the file for the points (e.g. `3` for R32, `25` for Champion bonus) → adjust → re-run Set up sheet.

---

## Appendix — file reference

- **`docs/world-cup-pool.gs`** — the Google Apps Script you paste into the Sheet's Apps Script editor.
- **`docs/master-labels.csv`** — fallback if you want to build the sheet manually without the script. Has the 191 labels in column A; you create dropdowns and formulas yourself.

---

## Quick reference — what each user CSV row gets used for

| User CSV label | What it scores against in Master | Points |
|---|---|---|
| `Group X — TeamA vs TeamB` | Group match outcome row in Master | 1 (winner) / 2 (draw) |
| `Group X — Nth place` | Group standing row | 2 (1st/2nd/3rd) |
| `My 3rd place advancing` | Master's "Actual 3rd place advancing" set | 3 each |
| `My R32 team` | Master's "Actual R32 team" set | 3 each |
| `My R16 team` | "Actual R16 team" set | 5 each |
| `My QF team` | "Actual QF team" set | 8 each |
| `My SF team` | "Actual SF team" set | 12 each |
| `My Finalist` | "Actual Finalist" set | 20 each |
| `My Champion` | "Actual Champion" cell | 25 bonus |
| `R32 M73 (...)`, `R16 M89 (...)`, etc. | _ignored_ — only there for the printable PDF | — |
