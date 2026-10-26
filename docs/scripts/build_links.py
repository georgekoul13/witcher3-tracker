import json, re, sys, unicodedata
from collections import defaultdict

rows   = json.load(open(sys.argv[1], encoding="utf-8"))
qfile  = json.load(open(sys.argv[2], encoding="utf-8"))
mfile  = json.load(open(sys.argv[3], encoding="utf-8"))
qs     = qfile["quests"] if isinstance(qfile, dict) else qfile

ZONE_REGION = {
    "WHITE ORCHARD": "White Orchard", "VELEN": "Velen & Novigrad",
    "NOVIGRAD/OXENFURT": "Velen & Novigrad", "HEARTS OF STONE": "Velen & Novigrad",
    "SKELLIGE": "Skellige", "KAER MORHEN": "Kaer Morhen",
    "BLOOD AND WINE": "Toussaint", "VIZIMA": None,
}
# categories whose names denote a quest. signpost/poi/entrance are places whose
# names can coincide with a quest title, so they are excluded on purpose.
QUEST_CATS = {"contracts", "sidequests", "event"}

def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = s.replace("&", "and").replace("’", "'")
    s = re.sub(r"^(the|a|an)\s+", "", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

qby = defaultdict(list)
for q in qs:
    qby[norm(q["name"])].append(q)

# map a resolved fork row onto the marker id already in markers.json
mid = {}
for m in mfile["markers"]:
    mid[(m["region"], round(m["lat"], 3), round(m["lng"], 3))] = m["id"]

links, unmatched_coord = [], 0
for r in rows:
    if r["cat"] not in QUEST_CATS or ".label." not in r["ref"]:
        continue
    cands = qby.get(norm(r["name"]))
    if not cands:
        continue
    cands = [q for q in cands if ZONE_REGION.get(q["zone"]) == r["region"]]
    if not cands:
        continue
    key = (r["region"], round(r["lat"], 3), round(r["lng"], 3))
    if key not in mid:
        unmatched_coord += 1
        continue
    links.append({"questId": cands[0]["id"], "markerId": mid[key],
                  "name": r["name"], "category": r["cat"], "region": r["region"]})

out = {
    "note": ("Quest-to-marker links derived by matching witcher3map marker labels "
             "against quest names. Categories contracts/sidequests/event only; "
             "signpost, poi and entrance are excluded because their place names "
             "can coincide with quest titles. Region must agree."),
    "generated": "2026-10-26",
    "links": links,
}
json.dump(out, open(sys.argv[4], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("links written:", len(links))
print("distinct quests:", len({l['questId'] for l in links}))
print("distinct markers:", len({l['markerId'] for l in links}))
print("dropped (coord not in markers.json):", unmatched_coord)
