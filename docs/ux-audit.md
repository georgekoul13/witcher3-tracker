# UX / product audit and plan

Written 2026-10-25, against the app as built. The question behind it: what has
to exist before this is genuinely usable while playing, on a phone, one-handed.

---

## 1. What the app already does well

- **The temporal split is real.** 266 order-critical vs 192 anytime quests is
  information no interactive map has, and it's correctly modelled.
- **The data is complete and validated.** 458 quests, 905 detail lines, 79
  trophies, 187 Gwent cards, 170 gear entries, 166 recipes, 1,221 markers.
- **The map works.** Real tiles, correct coordinates, filterable markers with
  levels and monsters.
- **Progress is honest.** One number over a defensible definition of 100%.

The raw material is done. Everything below is about *shaping* it.

---

## 2. What's wrong, ranked by how much it costs you in play

### 2.1 The two halves never meet — this is the big one
The whole premise is "spatial + temporal in one place". In practice they're two
panes that share a window. Tapping a quest doesn't show where it is. Tapping a
marker doesn't say which quest it serves. The product promise isn't delivered.

### 2.2 The app doesn't know where you are in the story
Everything is a manual checkbox. Because the app has no notion of your current
act, quest or level, it can't answer the only question that matters mid-play:
**"what becomes unavailable if I move on now?"** Missability is modelled in the
data and never computed.

### 2.3 A 458-item flat list is not a phone interface
With Quests open the sidebar is ~43,000px tall. Search works only if you
already know the name. There is no "what's near me", no "what's cheap to
finish", no sense of an area being clear.

### 2.4 Two parallel tracking systems
877 completion items and 1,221 map markers are tracked separately and never
meet. Marking a Gwent marker found does nothing to the Gwent card list.

### 2.5 Levels are collected and never used
Quests carry a suggested level (408 of 458). Markers carry enemy levels (145).
Neither is compared against your actual level, so the app can't say "too early"
or "you've outlevelled this".

### 2.6 No first-run state
The app opens on a stranger's spreadsheet progress. There's no moment where it
asks who you are, where you're up to, or what you care about.

### 2.7 Your data is one cleared cache from gone
localStorage only; export is manual and unprompted. Over a 100-hour playthrough
that's a real risk, not a theoretical one.

### 2.8 Alchemy is dead weight
166 recipes with no locations and no link to anything. It pads the UI without
earning its place.

---

## 3. The missing primitives

Three things unlock almost everything above. Build these before building pages.

**P1 — Player state.** Current level, current zone, current act/main quest.
Three fields, entered once and nudged occasionally. Unlocks missable warnings,
level filtering, "near me", and a meaningful home screen.

**P2 — Zone as the join.** Quest zones and marker regions already map onto each
other (`VELEN` + `NOVIGRAD/OXENFURT` + `HEARTS OF STONE` → *Velen & Novigrad*,
`BLOOD AND WINE` → *Toussaint*, and so on). **This works today with no new
data** and gives "everything outstanding in this zone, on the map and in the
list" immediately.

**P3 — Quest↔marker links.** The precise version of P2. No dataset provides it.
Realistic approach: let the app link opportunistically — a "set location" action
on a quest, and a "link quest" action on a marker — so the mapping accrues as
you play, seeded with what the Gwent and scavenger location text already gives.

---

## 4. The pages

Five screens. Four in the nav, one pushed.

### Now — the home screen *(new)*
The glanceable one, built for a 3-second look mid-play.
- Where you are: zone, level, act.
- **Next order-critical quest**, with what it blocks.
- **Closing soon** — order-critical things still open in your current zone,
  the app's single most valuable output.
- Quick wins: anytime quests at or below your level, in this zone.
- Zone progress: "Velen 23/108".

### Map — *(exists, needs the join)*
Full-bleed, floating controls, marker sheet. Add: outstanding quests as pins
once linked, "hide completed", filter by level vs yours, and zone framing so
opening the map in Velen shows Velen.

### Quests — *(exists, needs restructuring)*
Zone first, then order. Order-critical and anytime visually separated rather
than filtered apart. Row tap opens detail instead of only expanding.

### Collection — *(exists as three sections, needs merging)*
Gwent, gear and trophies are one mental category: things to collect. One screen,
three groups, shared progress, filterable by zone. Alchemy demoted to reference
here or dropped until it links to something.

### Detail — *(new, pushed from anywhere)*
One screen for a quest, marker or collectible: what it is, where, whether it's
missable and by when, the spoiler-blurred detail lines, and links to related
items. This is where the 905 detail lines finally have a home.

### Settings
Player state, export/import with a reminder, spoiler preferences, reset.

---

## 5a. Status, 2026-10-25

Done: P1 player state, P2 zone join, Now, Quests (zone-first), Collection
merge, Settings, detail sheets for quest and marker, and P3 manual linking in
both directions. Alchemy dropped from the nav.

Not done: a suggested route (needs links to exist first), and detail is a sheet
rather than a pushed page — it earns promotion only if the content outgrows it.

## 5. Sequence

1. **P1 player state + Settings** — small, unlocks everything else.
2. **P2 zone join** — free, immediately makes Map and Quests feel connected.
3. **Now screen** — the payoff; only possible after 1 and 2.
4. **Detail screen** — gives quests somewhere to go.
5. **Collection merge** — tidying, lower value.
6. **P3 opportunistic linking** — ongoing, improves the map over time.

Deploy after step 3. That's the first version worth having on a phone.
