"""Pull enemy levels and monster names out of the original witcher3map popups.

They are not fields. They are interpolation arguments on the popup call:

    popup: $.t("monsterden.desc", {monster: '(lvl 19<span> ' +
             $.t("v:monsters.golem") + '</span>)'})

so each entry's levels/monsters have to be read out of that argument text and
applied to every coordinate in the entry.
"""
import re, json, pathlib, sys
from collections import defaultdict

REGION = {
    "hos_velen":     ("Velen & Novigrad", "v"),
    "white_orchard": ("White Orchard",    "w"),
    "skellige":      ("Skellige",         "s"),
    "toussaint":     ("Toussaint",        "t"),
    "kaer_morhen":   ("Kaer Morhen",      "k"),
}
ENTRY = re.compile(r"coords:\s*\[(?P<coords>.*?)\]\s*,\s*label:(?P<rest>.*?)(?=\}\s*,\s*\{|\}\s*\])", re.S)
PAIR  = re.compile(r"\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]")
LVL   = re.compile(r"lvl\s*(\d+)(?:\s*-\s*(\d+))?")
TREF  = re.compile(r'\$\.t\("([^"]+)"\)')

def load_locales(d):
    return {p.stem: json.load(open(p, encoding="utf-8"))
            for p in pathlib.Path(d).glob("*.json")}

def resolve(ref, loc, default_ns):
    ns, sep, path = ref.partition(":")
    if not sep:
        ns, path = "general", ref
    node = loc.get(ns if ns in loc else default_ns)
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, str) else None

def run(scripts, locales):
    loc = load_locales(locales)
    out = {}
    for p in sorted(pathlib.Path(scripts).glob("mapdata-*.js")):
        stem = p.stem.replace("mapdata-", "")
        if stem not in REGION:
            continue
        region, ns = REGION[stem]
        src = open(p, encoding="utf-8").read()
        for m in ENTRY.finditer(src):
            rest = m.group("rest")
            levels = []
            for a, b in LVL.findall(rest):
                levels.append(int(a))
                if b:
                    levels.append(int(b))
            monsters = []
            for ref in TREF.findall(rest):
                _, _, path = ref.partition(":")
                if (path or ref).startswith("monsters."):
                    name = resolve(ref, loc, ns)
                    if name:
                        monsters.append(name)
            if not levels and not monsters:
                continue
            for lat, lng in PAIR.findall(m.group("coords")):
                key = (region, round(float(lat), 3), round(float(lng), 3))
                e = out.setdefault(key, {"levels": [], "monsters": []})
                e["levels"] += levels
                e["monsters"] += monsters
    # dedupe, keep order
    for e in out.values():
        e["levels"] = sorted(set(e["levels"]))
        e["monsters"] = list(dict.fromkeys(e["monsters"]))
    return out

if __name__ == "__main__":
    data = run(sys.argv[1], sys.argv[2])
    print("entries carrying levels or monsters:", len(data))
    print("  with levels:  ", sum(1 for v in data.values() if v["levels"]))
    print("  with monsters:", sum(1 for v in data.values() if v["monsters"]))
    json.dump({f"{k[0]}|{k[1]}|{k[2]}": v for k, v in data.items()},
              open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False)
    for k, v in list(data.items())[:6]:
        print("  ", k, v)
