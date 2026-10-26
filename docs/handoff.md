# Handoff — the restructure, recovered

Written 2026-10-25 after the build session (24–25 Oct) became unopenable. The
code is intact, and the in-flight spec below was recovered from the session's
compaction summary, which survived.

**Read with:** [`README.md`](../README.md) for what exists and why,
[`ux-audit.md`](ux-audit.md) for the product reasoning, `design/` for the
palette and reference image.

---

## Where it stopped

An 8-step plan was running. **All 8 steps are done (26 Oct).**

1. ✅ Re-extract markers from the fork with real names
2. ✅ Auto-link quests to markers by name — **done 26 Oct**, see below
3. ✅ Apply the lime/dark tokens and Manrope — **done 26 Oct**
4. ✅ Build Home insights screen — **done 26 Oct**
5. ✅ Rebuild Map as the tracking screen — **done 26 Oct**
6. ✅ Two-tap tooltip then drawer — **done 26 Oct**
7. ✅ Swipe rows to complete — **done 26 Oct**
8. ✅ Verify the flow end to end — **done 26 Oct**

## Step 2 result — auto-linking works

`src/data/quest-links.json`: **187 links covering 178 of 458 quests (39%)**,
generated 26 Oct. Every link resolved to a marker id already in
`markers.json`, nothing orphaned, and no marker's own name disagrees with its
link. 9 quests legitimately carry two markers.

All 2,804 fork labels resolve (not 284 — that was one category group). 559 are
specific names rather than generic category labels. Match rate by category:

| category | named | matched | |
|---|---|---|---|
| contracts | 37 | 36 | 97% |
| sidequests | 166 | 125 | 75% |
| event | 64 | 26 | 41% |
| poi / entrance / blacksmith | 64 | 0 | — |
| signpost | 228 | 4 | 2% |

Linked quests by type: side 118, contract 34, chance encounter 25, main 3,
treasure hunt 1.

**Signposts, poi and entrances are excluded on purpose.** Their 4 "matches"
(*Kaer Morhen*, *Bastion*, *Abandoned Sawmill*, *Coast of Wrecks*) are place
names that happen to equal a quest title — the signpost is the fast-travel
point, not the quest location. Including them would look like more coverage and
be wrong.

**Validation:** of 187 matches, the marker region agreed with the quest zone
**187 times, with zero disagreements.** Independent fields agreeing that
consistently is what makes this trustworthy rather than coincidental.

The remaining 136 named-but-unmatched markers are mostly multi-part random
encounters (*Looters I/II/III*, *Racists of Novigrad I/II*) that the guide
sheet doesn't carry as separate rows.

Still manual: the ~61% of quests with no named marker. The in-app "Set
location" flow stays useful for those.

## Step 1's result, and what it cost

`src/data/markers.json` was rebuilt at 22:45 on 25 Oct:

| | before | after |
|---|---|---|
| markers | 1,221 | **2,804** |
| categories | 32 | **39** |
| with a `name` | 0 | **540** |
| with `levels` | 145 | **10** |
| with `monsters` | 136 | **0** |

Named by category: Signpost 228, Side quest 147, Event 64, Point of interest
56, Contract 37, Entrance 7, Blacksmith 1.
By region: Velen & Novigrad 1,301 · Skellige 813 · Toussaint 445 ·
White Orchard 185 · Kaer Morhen 60.

**Resolved 26 Oct — see "Levels and monsters, merged back" below.** The rest of
this section records how it stood before that.

The names are the win and were the point. But `levels` and `monsters` **do not
exist in the fork at all** — they were parsed out of free-text popups in the
*original* `witcher3map/witcher3map` repo, which has ~172 level mentions against
the fork's ~10. The two repos are different datasets, not versions of one:
original = 381 labelled Velen entries with levels; fork = 1,295 with names.

So this isn't a script bug to fix, it's a **merge**: keep the fork for coverage
and names, and port `levels`/`monsters` from the original by coordinate match.
Until then, two things are silently not working:

- **The level filter is a no-op.** `App.tsx:103` reads
  `!m.levels?.length || Math.min(...m.levels) <= player.level + 2`. With 10
  markers carrying levels, all 2,804 pass. It looks like it works.
- **The marker sheet lost its detail line.** `MapView.tsx:205–208` builds it
  from `levels` and `monsters`.

Both fields are optional in `types.ts`, so the build stayed green. Restore them
in the extractor before step 3 — it's an unfinished step 1, not a design change.

**Source paths** (both re-downloadable; scratchpad copies get wiped):
- fork — `psychodracon/witcher3map/master/files/scripts/mapdata-*.js` and
  `files/locales/en/*.json`. Note `scripts/`, **not** `scripts/custom/`.
- original — `witcher3map/witcher3map/master/assets/scripts/custom/mapdata-*.js`
  and `assets/locales/en/*.json`. Here it *is* `custom/`.

Locale namespaces are per region: `v` Velen, `w` White Orchard, `s` Skellige,
`t` Toussaint, `k` Kaer Morhen, plus shared `general`. A label ref with no
`ns:` prefix resolves against `general`; assuming a `v:` prefix is the bug that
produced the earlier 0/0. Tiles are `.jpg`.

The resolver and matcher are at `docs/scripts/` so they survive this time.

---

## Steps 3–4 result — theme and Home

Verified in the browser at 375×812: background `#131313`, accent `#E9FF69`,
button 46px tall with 23px radius, stat cards 95px, Manrope loading, no
horizontal overflow.

- Tokens are swapped at `:root` in `styles.css`, so the whole app re-themed at
  once. Hardcoded warm tints were replaced; `--on-accent` is the dark text
  colour that sits on lime.
- Manrope comes from Google Fonts, with Workbox runtime caching for
  `fonts.googleapis.com` and `fonts.gstatic.com` — without those the installed
  PWA loses the face as soon as it is offline.
- `pages/Home.tsx` is new: avatar, LAST VISIT, INSIGHTS, 2-column stat grid
  (Quests, Gear, Trophies, Gwent, then Bandits, Nests, Treasures from marker
  categories) and the pinned "Start tracking" pill into the map.
- **LAST VISIT is real, not decoration.** `Progress.lastPlace` records the last
  marker opened, so Home reads e.g. "Mill". It falls back to the player's zone,
  title-cased, before anything has been opened.
- Marker sheets now title on the marker's real name, with the category demoted
  to the subtitle — the first payoff from step 1's names.

**Two bugs found and fixed while verifying**, both pre-existing from the step 1
rebuild, neither caught by the compiler:

1. The map page **crashed to a blank screen**. The rebuild introduced 7 new
   categories (Treasure, Hollow, Honeycomb, Boat, Scavenger, Event, Gwentquest)
   with no entry in `CATEGORY_ICON`, and `Icon` did `RAW[name].replace(...)` on
   undefined. All 7 now have icons and colours, and `Icon` falls back to
   `point-of-interest` rather than taking the app down.
2. `Marker.name` was never declared in `types.ts` despite being in the data.

**Still spec-pending on Home:** the avatar is a placeholder glyph, and the
design's photo has no source in the app yet.

**Design references** are now in `docs/design/`: `home-spec.png` is the Home
screen, `spec-1/2/3.png` the other three, `palette.png` the colour sheet. All
were recovered from the lost session's transcript.

## Step 5 result — the tracking screen

Built from `design/spec-1.png` (map), `spec-2.png` (list) and `spec-3.png`
(search results), all verified in the browser at 375×812.

- **Header**: back at the left, then Quests / Everything else / Info as 48px
  rounded-square buttons, `#1A1A1A`, radius 16. The old app bar is hidden on
  this screen — it was rendering as a second header.
- **Map** is inset 8px with a 16px radius below the header, per the mockup.
- **Active Quest card** at the bottom: label, the quest name in lime at 26px,
  then type / zone / level chips. It shows `standing.closing[0]`, falling back
  to the next open quest in the zone — so it is the next order-critical thing,
  not just any quest. Tapping it opens the quest.
- **Quests panel** (`pages/ListPage.tsx`): all 458 in the guide's order with
  "Search anything". **Deliberately not sortable** — the order is the product.
  No tabs here; tabs are for the other panel, which is what the spec asks.
- **Everything else panel**: the same component with Gear / Gwent / Trophies /
  Markers tabs.
- **Info panel** (`pages/Legend.tsx`): every pin type on the current map with
  its icon, colour and count — the spec's "question button that explains all
  the icons".

Panels are pushed state on the map screen (`panel`), not routes, so back always
returns to the map and the bottom nav hides while one is open.

### Open against the spec

1. **The marker filter toolbar has no home.** It still floats over the top of
   the map, and appears in none of the mockups. It is genuinely useful, so it
   was kept rather than dropped — but it needs a place, probably behind a
   control in the header.
2. **The bottom nav is still there.** The mockups show none, but Home →
   tracking is currently the only route, so removing it would orphan Now,
   Quests, Collect and Settings entirely. Navigation needs deciding as a whole.
3. **The middle header glyph in the mockup is Lucide's `ghost`** — almost
   certainly a placeholder. A trophy is used for "Everything else"; confirm
   what was intended.
4. **Gear, Gwent and Trophies rows don't open anything yet.** Quests and
   Markers do.
5. **The Active Quest card overlays the map** rather than sitting below it as
   in the mockup, so the map's bottom edge runs behind it.
6. `Treasure`, `Hollow` and `Hidden treasure` share the gem glyph.

## The missable model, rewritten (26 Oct)

**The warnings were wrong, not just badly placed.** `standing()` treated a
story stage as a zone and flagged anything in an "earlier" zone as missed. But
the guide interleaves zones — Velen spans order 20→320, Skellige 34→341,
Novigrad 119→334 — so a player following it perfectly was told they were
**137 quests behind** in Novigrad. Noise, in the one feature the app exists for.

It is now **position-based**. Position is the order of your furthest completed
**main** quest; `behind` is order-critical quests before it that are still
open; `closing` is the next 8 ahead.

Main quests, not any quest, because one side quest ticked far ahead drags the
frontier with it. The spreadsheet's own starting state does exactly that — a
side quest at order 96 among otherwise early ticks — which read as **53 missed
quests on a fresh install**. Against main quests the same state reads position
18, nothing behind.

Measured after the change:

| scenario | behind (before) | behind (after) |
|---|---|---|
| fresh install, sheet baseline | 53 | **0** |
| followed the guide to order 150 | 0 | **0** |
| followed the guide to order 300 | 0 | **0** |
| jumped to order 61 doing nothing first | — | **39, named correctly** |

So the rule is now: follow the order and it stays silent; skip something and it
says exactly what. Verified in the browser both ways.

Knock-ons:
- `Player.stage` is gone — it was hand-set and is now derived. Settings shows
  "you're at <quest>, step N of 458" instead of a stage picker.
- `storyStages()` is renamed `zonesInGuideOrder()`, because that is all it was
  ever good for; its old name implied a progress model that does not hold.
- `Standing.missed` is now `Standing.behind`, plus new `position`, `at` and
  `upcoming`.

**Still to place:** where the warnings surface. The nav decision is unmade —
see below.

## Navigation — decided (26 Oct): option A

Of the five bottom-nav items, three (Quests, Collect, and the map itself) are
already reachable from the tracking header, so only **Now** and **Settings**
are genuinely homeless. The options put to George:

- **A — no bottom nav** (matches the mockups): Settings moves to the Home
  avatar; warnings become a count on Home, a badge on the Active Quest card,
  and filter chips on the Quests panel.
- **B — three-item nav**: Home / Map / Settings.
- **C — keep all five**: two routes to the same lists; argued against.

**George chose A.** Built:

- **Bottom nav removed entirely.**
- **Settings** now opens from the Home avatar (a gear), with its own back
  button. It would otherwise have been orphaned.
- **The warnings** are pills under LAST VISIT on Home — "8 closing soon", and
  "N behind you" only when N > 0. Both open the Quests panel.
- **Header regrouped** per the updated mockup, with a fourth button: switch
  map (`arrow-up-down`), then Quests, Everything else, Info.
- **Switch map** opens a panel listing all five maps with marker and found
  counts; the current one is chipped "Showing now".
- **The filter toolbar is gone** — region picker, Hide found, My level and the
  39 category chips. Everything is shown, as asked. `hiddenCategories`,
  `hideFound` and `onlyMyLevel` state deleted with it.
- **Leaflet's +/- zoom control removed.** Pinch and double-tap remain.

### Knock-ons

1. **`pages/Now.tsx`, `pages/Quests.tsx` and `pages/Collection.tsx` are
   deleted** (26 Oct), along with their routes and the `now` / `quests` /
   `collection` page entries. `PAGES` is now just `home | map | settings`.

   **Before deleting, Collection's ticking had to be ported.** It was the only
   place gear, Gwent and trophies could be marked — 419 of the 877 completion
   items — and the Everything-else panel listed them read-only. `ListRow` now
   takes `toggles`, so rows carry their own ticks: gear has *Found* and *Made*
   (only Made counts toward 100%), Gwent has *Collected*, trophies *Earned*.
   Verified end to end: ticking Steel Sword stored `s002`, struck the row
   through and moved Home's Gear card to 1/153.

   Lost with Collection, and worth knowing: its **"Show spoilers" toggle**.
   Trophy requirement text is no longer rendered at all, so there is nothing
   to blur — but if requirements come back to the row, the blur has to come
   back with them. Its "Hide done" chip went too; search covers most of it.

   **`src/sidebar.ts` is also orphaned** — 64 lines left from the original
   sidebar-accordion layout, imported by nothing. Not deleted, since it was
   not named; it is the next thing to go.
2. **The map now covers rather than contains.** `fitBounds` letterboxed a tall
   phone frame; it now zooms until the short axis fills, capped at the region's
   `maxZoom`. Velen fills the frame. **White Orchard still letterboxes** —
   it spans 225° by 85°, far wider than a phone frame, and its declared bounds
   are larger than the tiles actually cover, so the image also sits slightly
   low. Worth fixing by tightening that region's bounds to its real coverage.
3. **Velen draws all 1,301 markers at once.** That is what "everything will be
   shown" means, and it is dense at full-map zoom. The two-tap tooltip (step 6)
   will help identify them, but density may want revisiting.

## Step 6 result — two-tap pins

First tap names the pin, second tap opens the drawer, and tapping a different
pin moves the preview instead of opening anything. Verified as a sequence:
tap A → tooltip only; tap B → tooltip moves, still no drawer; tap B again →
drawer.

- The tooltip leads with the **real name** where the marker has one —
  "Devil by the Well · Contract", "Save Tomira From Burning · Event" — and
  falls back to the bare category otherwise, which is the spec's "ideally the
  correct name not the generic one".
- **Leaflet's hover trigger is switched off** (`marker.off("mouseover")`).
  Tooltips are driven from the tap instead, so a desktop browser behaves
  exactly like a phone; left on, hovering would open tooltips without setting
  the preview state and the first tap would then open the drawer.
- Tapping the map background clears the preview, and a marker rebuild resets it.
- Tooltips are styled to the theme (`--surface`, Manrope, 10px radius) with the
  callout arrow recoloured on all four sides.

**Interpretation to confirm:** the spec says "Same experience with the quests
etc." Quest *rows* still open the drawer on a single tap, because a row already
shows the name and chips — the information a pin tooltip exists to reveal — so
a second tap would be friction rather than a preview. If two-tap was meant
there too, it is a small change to `ListPage`.

## Step 7 result — swipe to complete

`SwipeRow` in `ListPage.tsx`. Drag right to complete, drag left to undo one
already done; the other direction does nothing, so the gesture means one thing
per direction. Behind the card a panel is revealed — lime with a check and
"Done", red with a cross and "Not done" — which fills once you are past the
88px threshold, so the commit is felt rather than guessed. Drag resists past
the threshold rather than running away with the finger.

Wired on every list: quests, gear (to *Made*, the state that counts), Gwent,
trophies and markers.

**The two things that make it usable rather than annoying:**

- **The axis is locked on the first 8px.** A mostly-vertical first move is
  abandoned for good and left to the scroller — otherwise every scroll attempt
  nudges rows sideways. Verified: a diagonal drag starting downward produced
  no transform and no state change.
- **`touch-action: pan-y`** on the card, so the browser keeps vertical
  scrolling and only the x axis is ours.

Pointer events, not touch events, so a mouse behaves like a finger — which is
also what made it testable here.

Verified end to end: dragging *Funeral Pyres* right stored `q0020: true` and
took the done rows from 22 to 23; dragging it left set it back to `false` and
22. Wrong-direction and vertical-first drags both changed nothing.

`user-select: none` on the card — without it a drag selected the chip text.

## Step 8 — the end-to-end pass, and what it caught

A 16-step walk from a cleared browser: Home → tracking → every panel → quest
drawer → warnings → tabs → ticks → legend → switch map → Settings → Home.
**Zero console errors**, ending on Home with every tick persisted. Totals
verified independently: 458 + 79 + 187 + 153 = **877**.

It found four real problems, all now fixed:

1. **`quest-links.json` was never imported.** The 187 auto-derived links from
   step 2 sat in a file nothing read, so every quest still looked unlocated on
   a fresh install. They are now seeded as `SEEDED_LINKS` and merged under
   anything set by hand. *Jenny O' the Woods* now opens with its contract
   marker already attached.
   Unlinking a seeded link needed a tombstone: `setLink(id, "")` records an
   explicit "none" that survives a reload, while `null` forgets the choice and
   lets the seed apply again. Verified both ways across reloads.
2. **A crash I introduced in step 5.** The deferred `requestAnimationFrame`
   refit could fire after a region change tore the map down —
   `Cannot read properties of undefined (reading '_leaflet_pos')`, 53 of them.
   Now guarded on `getContainer()?.isConnected` and cancelled on cleanup. Two
   map switches, zero errors.
3. **Stat cards were 163px, not the spec's 167.** The grid gap was 12px where
   the spec's x=24/x=199 geometry implies 8, and the inner scroller stole
   another 8. With `gap: 9px 8px` and the scrollbar hidden (Android overlays
   it anyway) the cards land at exactly **x=24 and x=199, 167×95**.
4. A `.pick-banner` scare that turned out to be my bad selector — the linking
   banner is present, styled and has a Cancel button.

Also checked: 360×780 has no horizontal overflow anywhere and the five header
buttons still fit; progress and player state survive reloads; the built output
uses relative `./assets` paths, carries the `#131313` manifest colours, and the
service worker precaches 13 entries with runtime caches for tiles and fonts.

**Not exercised:** export/import. Export triggers a file download, which is not
something to fire off unasked, so the round trip is unverified — worth one
manual run before trusting a backup. The built bundle was inspected but not
served and clicked through; the preview tooling only starts the first
`launch.json` config.

## Levels and monsters, merged back (26 Oct)

They were never fields in either repo. In the **original** `witcher3map` they
are interpolation arguments on the popup call:

```js
popup: $.t("monsterden.desc", {monster: '(lvl 19<span> ' +
         $.t("v:monsters.golem") + '</span>)'})
```

so they have to be parsed out of that argument text and applied to every
coordinate in the entry. `docs/scripts/extract_levels.py` does that;
`docs/scripts/merge_levels.py` merges the result into `markers.json` by exact
coordinate.

**The extraction reproduces the original dataset's own figures exactly —
145 with levels, 136 with monsters** — which is the main reason to trust it.
144 of those 146 coordinates exist in the fork, so the merged file now has
**144 with levels and 135 with monsters**, with all 2,804 markers and 540 names
intact.

The two that did not match sit 1.0 and 3.1 units from their nearest fork
marker. That is a real reposition, not rounding, so they were left alone rather
than snapped to a neighbour — attaching "Cyclops, lvl 19–26" to the wrong
treasure is worse than leaving one blank.

Spot-checked against the raw source: the Monster den at (237.641, 105.016)
reads lvl 19 / Golem, and (165.891, 99.375) reads lvl 16 & 18 /
Rabid Rock Troll, Nekkers — both exactly as the JS says.

**Where levels surface now.** The "My level" filter was removed in step 5, so
they feed three places instead: the number badge on the pin (76 of them on
Velen), the first-tap tooltip ("Abandoned site · lvl 4 · Drowners"), and the
drawer, whose dormant **"Guarded by"** section is live again.

`markers.json` before the merge is kept at
`<scratchpad>/markers-before-levels.json` for this session only.

## Review round, 26 Oct (phone test)

Changes from George's comments after trying it on the phone:

- **Active quest card now sits below the map**, not over it, so it can't be
  mistaken for a drawer. `.track` is a flex column — header, `.track-map`
  (flex: 1, inset 8px, radius 16), then the card. Verified no overlap.
- **The four map actions are one divided control**: shared `--surface`
  background, 1px inset dividers between buttons, square inner corners.
- **Quest drawer**: "Reveal notes" is gone and notes render unblurred; the
  "Unlink" action is gone. `setLink(id, "")` is still how an unlink would be
  recorded, it just has no button any more.
- **Map switcher has no search** — `ListPage` takes `search={false}`; five
  fixed rows had nothing to find.
- **Home's first pill is now "N done last session"**, replacing "closing
  soon", and opens a **Last session** panel listing what you got through with
  its type and the time.

  A session is inferred rather than declared — the app has no start or stop and
  asking you to mark one is a chore. `src/session.ts` walks completion times
  newest first and stops at the first gap over **3 hours**. `Progress.doneAt`
  records `"bucket:id" -> timestamp` when something is ticked, and drops it
  when unticked, so a correction does not look like an achievement. Nothing
  from the spreadsheet baseline has a timestamp, so a fresh install reads 0.

  Verified: ticking a quest, a gear piece and a trophy gave "3 done last
  session" with all three listed; seeding two runs either side of a 4-hour gap
  gave 2, excluding the older pair.

  **"Behind you" is unchanged** and still appears beside it when it is non-zero.

- **List rows have three states**: active (lime stripe and lime title), done
  (red stripe, struck through), neutral. The stripe is a `::before` layer
  because the swipe backdrop fills the wrapper and was hiding a plain
  background. Applied to every list, and `active` is set from `activeQuest`.
- **Every pushed page carries its title in the header** beside the back
  button, the legend included.

**Drawer lifetime (bug found while testing this):** a quest or marker drawer
used to survive navigating to Home and sat on top of whatever came next. It now
closes when the screen changes or a panel is pushed — but deliberately *not*
when a panel closes, since opening a quest from the list sets `panel` to null
and the drawer in the same tick, and clearing on any panel change wiped the
drawer the moment it opened.

**Map fit:** the view now refits when the container resizes, since the card
appearing changes the map's height and left the first fit off-centre. A pan or
zoom marks the view as the user's and stops the refit.

### White Orchard's blank band — fixed 26 Oct

**My earlier diagnosis here was wrong** and is corrected below. I had probed
the fork at zoom 2 only, found White Orchard occupying a 2x2 block, and
concluded its tile set was incomplete on the eastern side. Probing zoom 3
shows x=0..4 across every row — a complete grid matching the declared bounds
exactly. The bounds were right all along.

Two real causes, both now fixed:

1. **Zoom 2 is an incomplete grid.** The fork does not publish the full z2
   tile set, so any view at that zoom shows blank where tiles were never
   published. `FULL_TILES = 3` is now the floor for both the map and the tile
   layer, and `setMinZoom(cover)` stops a pinch-out going below the zoom that
   fills the frame — the gap cannot appear and then snap back, because it
   cannot appear.
2. **`box.getCenter()` is not the pixel centre.** In Mercator the mid-latitude
   is nowhere near the mid-pixel, so on the two geographic regions (White
   Orchard, Skellige) centring there left a sliver of empty at one edge. The
   view now centres on the projected midpoint of the bounds.

Panning is a hard edge now (`maxBounds: box`, `maxBoundsViscosity: 1`) rather
than elastic — with the view always smaller than the map there is no reason to
pan off it, and the old 0.05 padding let a corner drag expose 318px of nothing.

Measured on all five regions, tile overflow past every container edge
(negative = covered):

| region | top | bottom | left | right |
|---|---|---|---|---|
| White Orchard | −207 | −210 | −205 | −204 |
| Velen & Novigrad | −245 | −172 | −13 | −140 |
| Skellige | −79 | −82 | −205 | −204 |
| Toussaint | −17 | −144 | −141 | −12 |
| Kaer Morhen | −81 | −80 | −77 | −76 |

Dragging to a corner lands flush at 0, and a hard wheel-out afterwards does not
move it.

## Review round 2, 26 Oct

- **The quest list opens on the active quest**, scrolled to centre, rather than
  at the top of 458 rows. It only does this while the list is untouched —
  once you have typed in search or switched tab you are looking for something
  else, so it leaves the scroll alone.
- **Every row sits on a rounded panel, inset 6px on both sides**, so a curved
  sliver shows down each edge — red for done, lime for active, grey for
  neutral, so all three read as one component rather than two decorated rows
  and a plain one. The card needed `width: auto`; with the inherited
  `width: 100%` it hung 6px past the panel on the right.

### Keeping progress (asked: "how are we going to keep track of what I do?")

Every tick writes to `localStorage` on that device immediately. Nothing is
sent anywhere, so the phone is the only copy — and a browser may **evict**
localStorage when the device is short of space.

`keepStorage()` now calls `navigator.storage.persist()` once on startup. Granted,
the data stops being evictable and only goes if the app is uninstalled or site
data is cleared by hand. Chrome grants it to an installed PWA without
prompting; in a plain browser tab it usually refuses — which is itself an
argument for installing rather than a failure. Settings reports which state it
is in, honestly, rather than claiming safety it does not have.

That leaves two real risks, both needing the backup file: uninstalling the PWA,
and clearing site data.

### Settings is gone (26 Oct) — backup moved onto the avatar

Tapping the avatar opens a small popover styled like the map's pin tooltips
(`components/Menu.tsx`), with two items: **Export backup** (noting when you
last did) and **Import backup**. It dismisses on an outside tap, on Escape, and
by tapping the avatar again — all four verified.

Deleting the page forced the rest of the player state to be resolved, which was
the point:

- **`player.level` is gone.** It only ever fed `quickWins`, which nothing read.
- **`player.zone` is gone, and so is `usePlayer` and `player.ts`.** The current
  zone is now *derived*: the active quest's zone, falling back to the furthest
  completed main quest's. It updates itself as you play instead of being a
  field to maintain, and it drives the same two things zone used to — the map
  opens on that region once, and Home names it before any marker is opened.
- **`standing()` lost `zone`, `level`, `quickWins`, `zoneOpen`, `zoneDone` and
  `zoneTotal`** — all unused. It now takes `(quests, done)` and returns
  position, `at`, `behind`, `upcoming` and `closing`. The active quest is
  `closing[0] ?? upcoming[0]`.
- **The app bar went with it.** With pages down to `home | map` it could never
  render: home returns early and the bar was hidden on map.
- `zonesInGuideOrder()` went too — it only fed the Settings zone picker.
- The obsolete "Reset Gwent" fix is gone.

### Export / import — finally verified

Previously untested, and now load-bearing, since the chosen way to share
progress with Claude is to export and hand the file over.

Round trip tested without triggering a download: build the exact bytes
`exportProgress` writes, clear storage as if it were the other phone, then feed
the file through the real `<input type="file">`. Every field came back —
quests, trophies, markers, scavCrafted, links, doneAt, lastPlace — and the UI
agreed (Quests 23/458, Gear 1/153, Trophies 1/79, "Mill", "1 done last
session"). The only part still unexercised is the anchor click that saves the
file.

**Sync, as decided:** manual. Export, then hand the JSON over (Drive or chat)
and Claude can read it — Drive access is confirmed working. Automatic Drive
sync was costed and deferred: it needs a Google Cloud project, an OAuth client
and consent screen, and it would sync whole-file snapshots, so two phones
edited between syncs means one side wins.

## Active quest pin and focus (26 Oct)

A lime teardrop marks the active quest, in its own Leaflet layer so it redraws
without touching the 2,804 pins. **The route line and last-visit dot were built
and then removed** at George's request — the line could only ever be a straight
bearing, since nothing in the data describes roads, and it was not worth the
clutter. `LastPlace` keeps its `lat`/`lng` from that work; nothing draws them
now.

**The map centres on the active quest**, both when it opens and whenever the
quest changes, so finishing one carries you to the next instead of leaving you
to find it. It does not re-centre on every render — once the map has been
panned or zoomed, that view is theirs (`touched`), and `centredOn` holds the
quest id already framed so the same one is not chased repeatedly.

`focusZoom()` is one step in from the zoom that fills the frame. Two steps
showed little but the pin; one step leaves about 37 markers of context around
it, which reads as a neighbourhood rather than a close-up.

**It only appears when the active quest has a linked marker in the region on
screen — 113 of 266 order-critical quests (42%)**, rising as manual links
accrue. Verified: opens dead centre (0,0 px offset); marking it done moved the
map to the next linked quest, *Man's Best Friend*, which sits at a different
coordinate and was again dead centre. A quest with no link simply draws no pin.

## The tiles were never aligned (26 Oct) — fixed

George spotted that the map "doesn't align". It was worse than a seam: on the
three flat regions the pins had never sat on the right ground.

**Cause 1 — the TMS flip silently did nothing.** The tiles are TMS (y counts up
from the south), and the layer asked for `tms: true`. Leaflet flips against
`_globalTileRange`, which it can only derive from a bounded CRS. The flat
regions use a custom `CRS.Simple` with no bounds, so there the flip was a no-op
and rows were drawn in reverse. The geographic regions (White Orchard,
Skellige) were fine, which is why this hid for so long. The flip is now done
explicitly in `getTileUrl`, so every region follows the same visible rule.

**Cause 2 — the flat maps publish a local tile grid.** Flipping them against
the global `2^z` grid asks for rows that were never published: switching the
flip on immediately left Kaer Morhen and Toussaint with 5 and 6 missing tiles
in view. They start at y=0 and run up only as far as their own content, so the
flip is against `ceil(2^z · north / 256)` rows instead.

**Cause 3 — Velen's declared north was 9 units too tall** (265 where the tiles
give 256), which slid every marker down relative to the terrain.

### How it was measured, rather than eyeballed

Two objective tests, both runnable again:

1. **Seam error** — mean per-channel difference between the bottom row of one
   tile and the top row of the one below. Correct order scores 5–10, reversed
   scores 19–29. All three flat maps came back TMS.
2. **Marker alignment** — "redness" (R − (G+B)/2) of the tile pixel under a
   marker, vendors against wilderness. Vendors sit on red roofs, so a correct
   alignment separates them:

| Velen, zoom 4 | vendors | wilderness | separation |
|---|---|---|---|
| global flip, north 265 (before) | 40 | 32 | 8 |
| local flip, north 265 | 37 | 31 | 6 |
| **local flip, north 256 (shipped)** | **65** | **52** | **13** |

Against the *unflipped* original the separation was **1** — i.e. markers had no
relationship to the ground under them at all.

Cross-check: the old session verified by hand that Novigrad (lat 210, lng 110)
is tile `3/3/6`. The shipped model reproduces exactly that.

**All five regions now**: no missing tiles in view, rows in the right order,
and tiles overflowing every container edge.

**Side effect:** six Velen markers sit above lat 256 (bandit camps and an
entrance, up to 260.9) and are now outside the panning bounds. They render, but
the map will not scroll to them. If that matters, the fix is to pad `maxBounds`
on that region rather than re-inflate `north`.

## The spec being built

From the user, verbatim in intent:

> Let's restructure and redesign the app a bit and make it more simple.

**Home screen** — avatar; "LAST VISIT" + place name; an INSIGHTS section with a
total progress bar and a 2-column grid of stat cards (Quests, Gear, Trophies,
Gwent, Bandits, Nests, Treasures…, each reading like "12 /481"); a
"Start tracking" pill button pinned at the bottom.

**Start tracking → the map screen** with pins. Its header: back button;
**Quests**, opening a page of all quests in the mandatory order, **not
re-sortable**; search; an **other** button giving the same experience for
everything else in tabs; and a **question button explaining all the icons**.

**Two-tap pins** — first tap shows a tooltip with *the correct name, not the
generic category*; second tap opens the drawer. Same pattern for quests.

**Swipe rows, Wolt-style** — drag right = done; drag left from the done list =
undone.

**Tokens** (see `design/README.md`): `#131313` bg, `#1A1A1A` cards, `#E9FF69`
lime accent, `#F0F0F0` text, `#808080` muted, `#EDEDED` section labels,
`#262626` progress track. Font **Manrope**. Frame 390×844, card radius 16,
button radius 23 / 46px tall, stat cards 167×95 at x=24 and x=199.

A search page ("Search anything") with tabs sits behind the *other* button.

---

## Risks

1. **No version control.** `witcher3-tracker/` is not a git repo, which is why
   the marker rebuild above can't be diffed or reverted. Cheapest high-value
   fix available.
2. **`dist/` was rebuilt during this handoff**, so it carries the 2,804-marker
   data including the missing levels — relevant if it gets deployed as-is.
3. **Progress is localStorage only**, export manual. Audit item 2.7.
4. **Deployed to GitHub Pages** — https://georgekoul13.github.io/witcher3-tracker/
   Public repo `georgekoul13/witcher3-tracker`, licensed CC BY-NC-SA 4.0 (the
   user agreed to public + share-alike on 26 Oct 2026, after having it
   explained). `.github/workflows/pages.yml` typechecks, builds and deploys on
   every push to `main`; Pages is set to `build_type=workflow`.

   Verified live: every asset 200 with the right MIME, app mounted on the dark
   shell, **service worker active** with scope
   `/witcher3-tracker/` and 12 precached entries, 8 map tiles in the runtime
   tile cache, 1302 markers, active-quest pin, zero failed requests. The
   service worker is the thing that could not be proven earlier — the in-app
   browser refuses to register one on localhost, but it registers fine on real
   HTTPS.

   Still unproven: a true airplane-mode test and the Android install prompt.
   All four install criteria are met (HTTPS, manifest, SW, icons).

5. **The private Claude Artifact is now redundant** but still live at
   https://claude.ai/artifact/J91xNk5aaNESXMKZCjHr9z — kept as a fallback, not
   deleted. It will drift from `main` since nothing republishes it.

## Version control

Git repo as of 26 Oct 2026, `main`, `.gitignore` covering `node_modules/`,
`dist/` and `*.tsbuildinfo`. Remote is `origin` →
github.com/georgekoul13/witcher3-tracker (public). Pushing deploys.

## The app icon

Replaced 26 Oct 2026. The old one was a gold-on-brown imitation of the School
of the Wolf medallion: off-brand against the near-black and lime shell, and not
ours to ship. The mark is now the product's own — the lime map pin that already
marks the active quest, carrying a check.

Sources are `public/icon.svg` and `public/icon-maskable.svg`; the PNGs are
rendered from them with headless Chrome (`--screenshot --window-size=N,N`),
since no rsvg/ImageMagick is installed on this Mac.

The maskable one is separate on purpose. The manifest used to offer the rounded
square for both `any` and `maskable`, so Android would round its corners a
second time; the maskable file bleeds the ground to the edges and keeps the
mark inside the 80% safe circle.

## Settled — don't reopen

Own app (not a Map Genie extension); PWA (not native); phone-first; dark
palette; 100% = 877 items (458 quests + 79 trophies + 187 Gwent + 153 gear),
alchemy and trivia excluded; markers are navigation aids and don't count.

Licensing: marker data is CC BY-NC-SA — **attribution stays on the map, no
commercial use.** Don't strip the `Referer` to get around `witcher3map.com`'s
403; use the jsDelivr fork. Don't scrape Map Genie's API. Game icon art can't
be redistributed — icons are Lucide.

Dead ends: Map Genie's API, REDkit / `wcc_lite` extraction, the Fandom CDN.

## Why there's a handoff at all

A 19 MB SVG pasted into chat was recorded six times across two transcript files
(~115 MB), putting the conversation permanently over the context limit —
compaction can't shrink one giant paste. **Keep large images in `docs/design/`
and pass the path.**
