"""Parse witcher3map mapdata JS, resolve $.t() label refs against locale JSON."""
import re, json, pathlib, sys

REGION_NS = {            # mapdata file -> (region name, locale namespace)
    "hos_velen":     ("Velen & Novigrad", "v"),
    "white_orchard": ("White Orchard",    "w"),
    "skellige":      ("Skellige",         "s"),
    "toussaint":     ("Toussaint",        "t"),
    "kaer_morhen":   ("Kaer Morhen",      "k"),
}

def load_locales(d):
    out = {}
    for p in pathlib.Path(d).glob("*.json"):
        out[p.stem] = json.load(open(p, encoding="utf-8"))
    return out

def resolve(ref, loc, default_ns):
    """'v:signpost.label.x' or 'sidequests.label.x' -> string or None."""
    ns, _, path = ref.partition(":")
    if not _:
        ns, path = "general", ref
    node = loc.get(ns if ns in loc else default_ns)
    if node is None:
        return None
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, str) else None

# one entry: coords: [[lat,lng],...], label: $.t("..."), popup: $.t("...")
ENTRY = re.compile(
    r'coords:\s*\[(?P<coords>.*?)\]\s*,\s*'
    r'label:\s*(?P<label>.*?)\s*,\s*'
    r'popup:', re.S)
CAT = re.compile(r'^\s*(?P<cat>[a-zA-Z_]+):\s*\[\{', re.M)
TREF = re.compile(r'\$\.t\("([^"]+)"\)')
PAIR = re.compile(r'\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]')

def parse(path, loc):
    src = open(path, encoding="utf-8").read()
    stem = pathlib.Path(path).stem.replace("mapdata-", "")
    region, ns = REGION_NS[stem]
    # category spans
    cats = [(m.group("cat"), m.start()) for m in CAT.finditer(src)]
    cats.append((None, len(src)))
    rows = []
    for i in range(len(cats) - 1):
        cat, start = cats[i]
        end = cats[i + 1][1]
        for m in ENTRY.finditer(src, start, end):
            refs = TREF.findall(m.group("label"))
            name = resolve(refs[0], loc, ns) if refs else None
            for lat, lng in PAIR.findall(m.group("coords")):
                rows.append({"region": region, "cat": cat,
                             "ref": refs[0] if refs else None,
                             "name": name,
                             "lat": float(lat), "lng": float(lng)})
    return rows

if __name__ == "__main__":
    scripts, locales = sys.argv[1], sys.argv[2]
    loc = load_locales(locales)
    all_rows = []
    for p in sorted(pathlib.Path(scripts).glob("mapdata-*.js")):
        all_rows += parse(p, loc)
    json.dump(all_rows, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False)
    unres = [r for r in all_rows if r["ref"] and r["name"] is None]
    print("entries:", len(all_rows))
    print("with a ref:", sum(1 for r in all_rows if r["ref"]))
    print("resolved:", sum(1 for r in all_rows if r["name"]))
    print("unresolved:", len(unres))
    for r in unres[:5]:
        print("   miss:", r["ref"])
