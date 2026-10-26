# Witcher 3 — 100% Tracker

One place instead of juggling the Map Genie map and the progress spreadsheet.
No accounts, no 50-item cap, no ads. Everything stored on your own device.

## Put it on your phone

It's an installable PWA. **Installing needs HTTPS**, so it has to be deployed —
a phone on your wifi hitting `http://192.168.1.46:5173` can use the app, but Chrome
won't offer to install it.

```bash
npm run build
```

Drag the `dist/` folder onto https://app.netlify.com/drop. You get a URL in
seconds. Open it in Chrome on the phone and take **⋮ → Add to Home screen**
(Chrome usually prompts by itself). Android builds a real app from it: launcher
icon, its own window, no browser chrome, and it works with no signal at all
once installed. Redeploying updates the installed app on next launch.

## Run it locally

```bash
npm install
npm run dev
```

http://localhost:5173, or http://192.168.1.46:5173 from your phone on the same
wifi with the Mac awake.

## What's in it

One headline completion figure; tap it for the per-category breakdown.

**100% = 458 quests + 79 trophies + 187 distinct Gwent cards + 153 witcher gear
pieces = 877 items.** Alchemy recipes and the guide's trivia lines are
reference, deliberately left out of the figure.

Five pages, bottom nav:

- **Now** — where you are, what to do next, what's closing soon, what you're
  already behind on, and quick wins at your level.
- **Map** — markers, filters, level filter, marker detail sheet.
- **Quests** — zone first, split into *order matters* and *any time*.
- **Collect** — gear, Gwent and trophies in one place.
- **Settings** — player state, backup, fixes.

The lists behind them:

- **Quests** — all 458 in the guide's optimal order, each with its extra details
  as separate checkboxes. 266 are order-critical, 192 can be done any time;
  filter to just the order-critical ones.
- **Witcher gear** — 170 scavenger hunt entries across 7 hunts: 153 gear pieces
  with separate *found* and *made* boxes, plus 17 map purchases.
- **Gwent** — 265 card copies across 3 factions with where each comes from,
  counted as 187 distinct cards since copies aren't separate collectibles.
- **Trophies** — 79, with MISSABLE flags and spoilers blurred until asked for.
- **Alchemy** — 166 recipes with ingredients. Reference only.

**Player state** (level, zone, story stage) is what makes Now work. Zone is
where you're standing; stage is how far the main story has taken you, and can be
ahead of it. Anything order-critical in a zone behind your stage is flagged as
*already behind*; anything order-critical in your current zone is *closing
soon*. These come from the guide's ordering, not from hard game rules — treat
them as a prompt to check, not as certainty.

**Zone is the join** between quests and markers: `VELEN`, `NOVIGRAD/OXENFURT`
and `HEARTS OF STONE` all map to the *Velen & Novigrad* map, and so on. It needs
no extra data, and it's what lets a quest jump to the right map.

## Links from the guide

The spreadsheet carries hyperlinks that the first import ignored. They're now
extracted and surfaced:

- **457 of 458 quests** link to their wiki page — a *Wiki* button in the drawer.
  (The one without is *The Sad Tale of the Grossbart Brothers*; the sheet has no
  link on it.)
- **447 detail notes** carry a source, mostly timestamped YouTube — a small
  icon beside each note, which stays visible while the note text is blurred.
- **79 of 79 trophies** link to the wiki.
- **149 of 170 gear entries** link to a wiki map image showing where that
  diagram is — the most directly useful of the lot, and a map icon on the row.

## Progress

Browser storage, seeded from the spreadsheet's own checkbox state. **Export**
writes a JSON file; **Import** restores one.

Progress is per-device. To carry the Mac's state to the phone: Export here,
send yourself the file, Import there. Do that once, then treat the phone as the
source of truth — Import overwrites everything, so a stray import the other way
loses whatever was newer.

## Map markers

**2,804 real markers across 5 regions** — Velen & Novigrad 1,301, Skellige 813,
Toussaint 445, White Orchard 185, Kaer Morhen 60 — in 39 categories. Tap a pin
once to see what it is, twice to open it.

**540 carry their real name** rather than a generic category, pulled from the
map's own locale files. **144 carry enemy levels and 135 the monsters guarding
them**, merged from the original witcher3map repo by exact coordinate — the
fork has the breadth, the original has the enemy detail, and they are different
datasets rather than versions of one.

Coordinates come from [witcher3map](https://github.com/witcher3map/witcher3map)
by untamed0, CC BY-NC-SA, **non-commercial use only, attribution required** —
which is why the credit sits on the map and must stay there. The icons are
drawn in `src/components/Icons.tsx` rather than taken from the game, since the
game's own icon art can't be redistributed.

Markers are navigation aids, deliberately **not** counted toward 100%.

## Map tiles

Tiles are served through jsDelivr from the `psychodracon/witcher3map` fork,
which commits all 16,411 tiles to the repo. CORS enabled, no hotlink
protection, proper CDN caching, and the service worker keeps every tile you
view so a browsed region works offline.

`witcher3map.com`'s own server can't be used: it returns `403` to any request
carrying a cross-origin `Referer`. That's deliberate hotlink protection, so the
app doesn't try to defeat it. The fork is the same CC BY-NC-SA project, and
Velen's tiles live under `hos_velen` (the Hearts of Stone updated map) in the
same coordinate space — verified by checking that `hos_velen/3/3/6.jpg` is
Novigrad, matching the marker data.

Regions don't share a coordinate system: Velen, Toussaint and Kaer Morhen are
flat pixel maps (`CRS.Simple`), while Skellige and White Orchard use the default
geographic CRS with negative lat/lng. Leaflet can't change CRS after
construction, so the map is rebuilt when you switch between them.

Stock `CRS.Simple` transforms latitude to **negative** y, so Leaflet asks for
tiles at y = -1..-8 and every request 404s — a blank map. The flat regions
therefore use a shifted transformation, `y = north - lat`, which keeps y
positive with north still at the top. Verified by taking Novigrad's marker
coordinates (lat 210, lng 110), running them through the transformation and the
TMS flip to `velen/3/3/6.png`, and confirming that tile is the city.

## Known gaps
- `src/data/landmarks.json` holds 34 candidate landmarks parsed from the Gwent
  and scavenger location text. Superseded by the real markers for navigation,
  but still the way to link sheet items to places.
- **187 quest→marker links arrive seeded**, covering 178 of the 458 quests.
  They are derived by matching the map's marker labels against quest names —
  contracts matched 97%, side quests 75%, and the marker's region agreed with
  the quest's zone on all 187. The rest are still built by hand: open a quest,
  *Set location*, tap a marker. A link you set or clear yourself always wins
  over the seeded one.
- A suggested route still needs more links than the seeded 39% to be worth
  computing.
- Marker authoring is behind `?dev=1` — a seeding tool, not a feature.
- The Gwent tab covers 3 of 5 factions (no Monsters or Neutral); the sheet
  doesn't have them. It also starts empty on purpose — the sheet arrived with
  all 265 boxes ticked while quests sat at 4.8%, so those were template state,
  not progress. Seeding from them put a fresh device at a false 23.1%.
- The sheet has no formula locations: 157 of 166 alchemy rows say `Location`.
- Five `ENHANCED … OIL` recipes have no checkbox in the sheet. They get one here.

## Data

`src/data/*.json` is generated from `../Witcher 3 my guide .xlsx`. Quest type
comes from the cell fill colour in the sheet; the import is validated against
the sheet's own `TOTAL QUEST COMPLETION` figure (4.8%).

Guide data by ChrisRi, with extra details by xLetalis. Personal use.
