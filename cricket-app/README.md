# PitchCode — Cricket Scoring & Auction Platform

A static, no-build web app for running a cricket tournament end to end: custom
formats, schedule generation, ball-by-ball live scoring, and an IPL-style
player auction with live bidding, sealed bids, and a hidden-category batch
auction with automatic recommendations.

This is the **fully static version** — data currently lives in each browser's
`localStorage`. It's built so that swapping in Firebase for real cross-device
real-time sync later is a drop-in change to one file (`js/db.js`), not a
rewrite. See **"Adding Firebase later"** below.

## Running it

No build step, no server required.

**Locally:**
```bash
cd cricket-app
python3 -m http.server 8000
# open http://localhost:8000
```
(Opening `index.html` directly via `file://` also works for most of it, but a
local server is safer since some browsers restrict `localStorage` on `file://`.)

**On GitHub Pages:**
1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → Deploy from branch → `main` / root.
3. Visit `https://<username>.github.io/<repo>/`.

## What's included

| File | Purpose |
|---|---|
| `index.html` | Landing page — role selection, search by code |
| `tournament.html` | Organizer dashboard: create tournament, teams, players, schedule, standings, leaderboard |
| `scorer.html` | Ball-by-ball live scoring with undo, wicket/extras handling, live scoreboard |
| `bidder-setup.html` | Create an auction room: categories, base prices, purses, player pool |
| `bidder.html` | Auction Head control panel: live bidding, sealed-bid resolution, hidden-category batch auction, direct sell, team management |
| `owner.html` | Team owner dashboard: register team, bid live, submit sealed/hidden bids |
| `viewer.html` | Public read-only view: search any tournament or auction code |
| `js/db.js` | Firebase-shaped persistence layer (currently backed by `localStorage`) |
| `js/utils.js` | Shared helpers (IDs, codes, Fisher-Yates shuffle, formatting) |
| `js/scheduling.js` | Round-robin (circle method), group split, knockout bracket generation |
| `js/scoring-engine.js` | Ball-by-ball event log (stack + queue), innings/match state |
| `js/stats.js` | Player stats aggregation (HashMap) + top-N leaderboards (Min-Heap) |
| `js/auction-engine.js` | Bidding, sealed-bid resolution, greedy hidden-category recommendation |

See `cricket_app_dsa_design.md` (the earlier design doc) for the full
data-structure/algorithm rationale behind each piece — the summary table in
its Section 8 maps every feature to what it uses under the hood.

## Known simplifications (by design, for this static pass)

- **Cross-device sync isn't real yet.** Everything currently runs against
  `localStorage`, so a scorer/bidder/owner/viewer only stay in sync if
  they're using the **same browser** (tabs sync via the native `storage`
  event). Multi-device live sync needs the Firebase swap described below.
- **Undo is score-accurate but doesn't rewind selection state.** Undoing a
  ball correctly reverts runs/wickets/overs, but if that ball also triggered
  a strike rotation, a new-batter prompt, or an end-of-over bowler change,
  you may need to manually re-fix the striker/bowler using the "Manual
  corrections" buttons on the scorer page.
- **No-ball/wide extra runs** default to a flat +1; if batters run further off
  a wide/no-ball, use the run buttons in addition (a small manual step rather
  than a separate compound-extras UI).
- **Playing XI selection** isn't a separate formal step — any player in the
  squad can be selected as batter/bowler at any time. Add a "confirm XI"
  screen later if you want to restrict this.

## Adding Firebase later

Everything in the app calls `DB.get`, `DB.set`, `DB.update`, `DB.push`,
`DB.on`, `DB.off` with slash-paths (e.g. `tournaments/ABC123/matches`) —
deliberately shaped like the Firebase Realtime Database client SDK. To
switch:

1. Add the Firebase SDK `<script>` tags and your config to each HTML page (or
   a shared `firebase-init.js`).
2. In `js/db.js`, replace the body of each method with the equivalent
   `firebase.database()` call, keeping the same method names/signatures:
   - `DB.get(path)` → `get(ref(db, path))`
   - `DB.set(path, value)` → `set(ref(db, path), value)`
   - `DB.on(path, cb)` → `onValue(ref(db, path), snap => cb(snap.val()))`
   - etc.
3. Nothing in any HTML page needs to change, since they only ever talk to
   `DB.*`, never to `localStorage` directly.
4. Add Firebase security rules so owners can only write their own bids and
   the bidder is the only writer for `teams/*` (a sketch is in the design
   doc, Section 4).

## DSA summary (quick reference)

| Feature | Data Structure | Algorithm |
|---|---|---|
| Schedule generation | Graph (complete graph K_n) | Circle-method round robin; Fisher–Yates shuffle for random draws |
| Ball-by-ball scoring & undo | Stack + Queue | Event sourcing |
| Live stats & leaderboards | HashMap | O(1) amortized updates; Min-Heap for O(n log k) top-N |
| Sealed-bid resolution | HashMap | Single-pass max/second-max scan |
| Hidden-category recommendation | — | Sort-and-greedy assignment (domain-correct, not an approximation) |
| Tournament/room lookup | Hash Table | O(1) average lookup by code |

## License

Built for coursework — use and adapt freely.
