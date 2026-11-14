#!/usr/bin/env python3
"""
Append the three side maps — Land of a Thousand Fables, Gaunter O'Dimm's
realm and the Isle of Mists — to src/data/markers.json.

They are separate map images in the source, not areas of the five big ones,
which is the only reason they were missed the first time round.

Run with `python3 -I docs/scripts/add_maps.py` from the project root. It is
idempotent: markers already carrying one of these regions are rebuilt rather
than duplicated, and existing ids are never renumbered, because progress is
keyed on them.
"""

import json
import pathlib
import re
import sys
import urllib.request

RAW = "https://raw.githubusercontent.com/root-BB/witcher3map/master/files"

# region label -> (map path, locale namespace for its own names)
MAPS = {
    "Land of a Thousand Fables": ("fables", "f"),
    "Gaunter's realm": ("gaunter", "g"),
    "Isle of Mists": ("isle_mists", "i"),
}

# the source's own key for a category -> the name we show. Taken from the
# five maps already in the file, so the new markers land in the same buckets.
CATEGORY = {
    "abandoned": "Abandoned site", "alchemy": "Alchemy supplies",
    "armourer": "Armourer", "armourerstable": "Armourer's table",
    "banditcamp": "Bandit camp", "barber": "Barber", "blacksmith": "Blacksmith",
    "boat": "Boat", "brothel": "Brothel", "contracts": "Contract",
    "entrance": "Entrance", "event": "Event", "grindstone": "Grindstone",
    "guarded": "Guarded treasure", "gwent": "Gwent card",
    "gwentquest": "Gwentquest", "hansebase": "Hanse base",
    "harbor": "Harbor", "herbalist": "Herbalist", "hidden": "Hidden treasure",
    "hollow": "Hollow", "honeycomb": "Honeycomb", "innkeep": "Innkeep",
    "kid": "Child", "monsterden": "Monster den", "monsternest": "Monster nest",
    "notice": "Notice board", "pid": "Person in distress",
    "poi": "Point of interest", "pop": "Place of power",
    "scavenger": "Scavenger", "shopkeeper": "Merchant",
    "signalfire": "Signal fire", "signpost": "Signpost",
    "sidequests": "Side quest", "smugglers": "Smuggler's cache",
    "spoils": "Spoils of war", "treasure": "Treasure",
    "vineyardinfestation": "Vineyard infestation",
}

HEADER = re.compile(r"window\.map_(sWest|nEast|mZoom)\s*=\s*"
                    r"(?:L\.latLng\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)|(-?[\d.]+))")
CATEGORY_KEY = re.compile(r"^\s*([a-z0-9_]+)\s*:\s*\[", re.M)
ENTRY = re.compile(r"\{(.*?)\}(?=\s*(?:,\s*\{|\s*\]))", re.S)
COORD = re.compile(r"\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]")
LABEL = re.compile(r'label:\s*\$\.t\(\s*"([^"]+)"')


def fetch(path: str) -> str:
    with urllib.request.urlopen(f"{RAW}/{path}", timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def dig(tree: dict, dotted: str):
    """Walk "poi.label.hut" through a locale file."""
    node = tree
    for part in dotted.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, str) else None


def parse(js: str, region: str, namespace: str, locales: dict) -> tuple[dict, list]:
    header = {}
    for m in HEADER.finditer(js):
        header[m.group(1)] = ([float(m.group(2)), float(m.group(3))]
                              if m.group(2) else float(m.group(4)))

    body = js[js.index("= {") + 2:]
    keys = [(m.start(), m.group(1)) for m in CATEGORY_KEY.finditer(body)
            if m.group(1) != "coords"]

    out = []
    for i, (pos, key) in enumerate(keys):
        if key not in CATEGORY:
            print(f"  ! unknown category {key!r} in {region}", file=sys.stderr)
            continue
        end = keys[i + 1][0] if i + 1 < len(keys) else len(body)
        for entry in ENTRY.finditer(body[pos:end]):
            chunk = entry.group(1)
            label = LABEL.search(chunk)
            name = None
            if label:
                raw = label.group(1)
                # "sidebar.treasure" is the category's own word, not a name
                if not raw.startswith("sidebar."):
                    ns, _, dotted = raw.partition(":")
                    name = (dig(locales.get(ns, {}), dotted) if dotted
                            else dig(locales["general"], ns))
            for lat, lng in COORD.findall(chunk):
                marker = {
                    "region": region, "category": CATEGORY[key], "key": key,
                    "lat": float(lat), "lng": float(lng),
                }
                if name and name.strip():
                    marker["name"] = name.strip()
                out.append(marker)
    return header, out


def main() -> int:
    root = pathlib.Path(__file__).resolve().parents[2]
    target = root / "src" / "data" / "markers.json"
    data = json.loads(target.read_text(encoding="utf-8"))

    locales = {ns: json.loads(fetch(f"locales/en/{ns}.json"))
               for ns in ("general", "f", "g", "i")}

    # drop any earlier run's markers for these regions, keeping everything else
    kept = [m for m in data["markers"] if m["region"] not in MAPS]
    dropped = len(data["markers"]) - len(kept)
    next_id = max(int(m["id"][1:]) for m in kept) + 1

    added = 0
    for region, (path, namespace) in MAPS.items():
        header, markers = parse(fetch(f"scripts/mapdata-{path}.js"),
                                region, namespace, locales)
        # a map whose corners are all positive is one of the flat ones
        flat = header["sWest"] == [0.0, 0.0]
        data["regions"][region] = {
            "path": path, "simple": flat,
            "sWest": header["sWest"], "nEast": header["nEast"],
            "maxZoom": int(header["mZoom"]),
        }
        for m in markers:
            m["id"] = f"m{next_id:05d}"
            next_id += 1
        kept.extend(markers)
        added += len(markers)
        named = sum(1 for m in markers if "name" in m)
        print(f"{region}: {len(markers)} markers ({named} named), "
              f"flat={flat}, nEast={header['nEast']}")

    data["markers"] = kept
    target.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n",
                      encoding="utf-8")
    print(f"\nrebuilt {dropped}, added {added}, total {len(kept)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
