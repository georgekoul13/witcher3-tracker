# Icons

**Family: [Lucide](https://lucide.dev) (ISC).** Installed as `lucide-static` and
imported as raw SVG in `src/components/Icons.tsx`, so one source serves both
React components and the Leaflet markers, which need markup strings.

Nothing needs sourcing by hand. To change an icon, swap the import — every
Lucide name is available locally under `node_modules/lucide-static/icons/`.

~26KB of SVG inlined across 55 imports; they're deduped where two names share a
glyph.

## Usage

```tsx
<Icon name="monster-nest" size={16} />        // React
iconMarkup("monster-nest", "#cc8844", 15)      // Leaflet divIcon
```

Icons inherit `currentColor` and default to stroke width 1.9 in the UI, 2 on
map pins where they sit at 15px inside a 26px badge.

---

## Map markers — one icon per category (32)

Colour still groups them; the shape distinguishes them.

| Category | Lucide | Colour group |
|---|---|---|
| Merchant | `store` | vendors (gold) |
| Innkeep | `bed-double` | vendors |
| Blacksmith | `anvil` | vendors |
| Armourer | `shield` | vendors |
| Herbalist | `leaf` | vendors |
| Barber | `scissors` | vendors |
| Signpost | `signpost` | travel (grey) |
| Entrance | `door-open` | travel |
| Harbor | `anchor` | travel |
| Guarded treasure | `shield-alert` | treasure (green) |
| Hidden treasure | `gem` | treasure |
| Smuggler's cache | `waves` | treasure |
| Spoils of war | `swords` | treasure |
| Bandit camp | `tent` | threats (orange) |
| Monster nest | `egg` | threats |
| Monster den | `skull` | threats |
| Vineyard infestation | `grape` | threats |
| Hanse base | `castle` | threats |
| Contract | `scroll-text` | threats |
| Grindstone | `disc-3` | craft (blue) |
| Armourer's table | `hammer` | craft |
| Alchemy supplies | `flask-conical` | craft (teal) |
| Place of power | `sparkles` | arcane (purple) |
| Signal fire | `flame` | arcane |
| Notice board | `clipboard-list` | quests (amber) |
| Side quest | `diamond` | quests |
| Person in distress | `hand-helping` | people (red) |
| Child | `baby` | people |
| Brothel | `heart` | people |
| Gwent card | `spade` | collectible (light blue) |
| Point of interest | `circle-help` | generic |
| Abandoned site | `house` | generic |

## Quest types (7)

`quest-main` → `star` · `quest-side` → `diamond` · `quest-contract` →
`scroll-text` · `quest-treasure-hunt` → `gem` · `quest-scavenger-hunt` →
`swords` · `quest-chance-encounter` → `users` · `quest-gwent-race` → `dices`

## Navigation (5)

`nav-now` → `compass` · `nav-map` → `map` · `nav-quests` → `list-checks` ·
`nav-collect` → `trophy` · `nav-settings` → `settings`

## UI (15)

`search` · `close`→`x` · `chevron-right` · `chevron-down` · `filter`→`funnel` ·
`check` · `plus` · `location-pin`→`map-pin` · `unlink`→`link-2-off` ·
`external-link` · `export`→`download` · `import`→`upload` ·
`warning`→`triangle-alert` · `info` · `drag-handle`→`grip-horizontal`

The UI set is defined and ready; most of those spots are still text labels or
native controls in the interface.
