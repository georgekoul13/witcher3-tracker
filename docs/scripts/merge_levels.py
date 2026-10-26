"""Merge enemy levels and monster names from the original witcher3map repo
into the marker set extracted from the psychodracon fork.

The two repos are different datasets, not versions of one. The fork has far
more markers and carries their real names; the original is sparser but encodes
enemy levels and monsters in its popup interpolation arguments. Matching is by
exact coordinate within a region — the overlap is 144 of 146 — and the two
that do not match are left alone rather than snapped to a nearby marker.

Usage: merge_levels.py <levels.json from extract_levels.py> <markers.json>
"""
import json, sys

levels = json.load(open(sys.argv[1], encoding="utf-8"))
path = sys.argv[2]
doc = json.load(open(path, encoding="utf-8"))

index = {}
for m in doc["markers"]:
    index.setdefault((m["region"], round(m["lat"], 3), round(m["lng"], 3)), []).append(m)

applied = skipped = 0
for key, data in levels.items():
    region, lat, lng = key.rsplit("|", 2)
    hits = index.get((region, float(lat), float(lng)))
    if not hits:
        skipped += 1
        continue
    for m in hits:
        if data["levels"]:
            m["levels"] = data["levels"]
        if data["monsters"]:
            m["monsters"] = data["monsters"]
    applied += 1

doc["source"]["note"] = (
    "Coordinates, names and categories from the psychodracon fork; enemy levels "
    "and monsters merged from the original witcher3map repo by exact coordinate. "
    "Non-commercial, attribution required."
)
json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False)

m = doc["markers"]
print("entries applied:", applied, "| unmatched and left alone:", skipped)
print("markers with levels:  ", sum(1 for x in m if x.get("levels")))
print("markers with monsters:", sum(1 for x in m if x.get("monsters")))
print("total markers:", len(m))
