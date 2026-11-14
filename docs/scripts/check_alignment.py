#!/usr/bin/env python3
"""
Does the tile source still line up with the marker coordinates?

The map has no ground truth to compare against, so this measures a correlation
instead: shopkeepers stand in settlements, which are the only red-roofed thing
on these maps, while monster nests and bandit camps sit in open country. If the
tiles are aligned, the pixel under a vendor pin is markedly redder than the one
under a wilderness pin. If they are not, the two groups score the same.

Run after changing the tile mirror or any region's corner coordinates:

    python3 -I docs/scripts/check_alignment.py

A separation in double figures is healthy; the misaligned build this was
written to catch scored 1.
"""

import json
import math
import pathlib
import struct
import subprocess
import sys
import urllib.request
import zlib

TILES = "https://cdn.jsdelivr.net/gh/root-BB/witcher3map@master/files/maps"
TILE = 256

VENDOR = {"Merchant", "Blacksmith", "Armourer", "Innkeep", "Herbalist",
          "Barber", "Alchemy supplies", "Armourer's table", "Grindstone"}
WILD = {"Monster nest", "Bandit camp", "Abandoned site", "Monster den",
        "Hollow", "Guarded treasure"}


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def to_rgb_grid(jpeg: bytes, tmp: pathlib.Path) -> list:
    """Convert a JPEG to a small raw RGB grid using sips, which ships with macOS."""
    src = tmp / "tile.jpg"
    png = tmp / "tile.png"
    src.write_bytes(jpeg)
    subprocess.run(["sips", "-s", "format", "png", str(src), "--out", str(png)],
                   capture_output=True, check=True)
    return read_png(png.read_bytes())


def read_png(data: bytes) -> list:
    """Minimal PNG reader: 8-bit RGB/RGBA, no interlacing. Returns rows of (r,g,b)."""
    pos, width, height, depth, colour = 8, 0, 0, 0, 0
    idat = b""
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            width, height, depth, colour = (*struct.unpack(">II", body[:8]),
                                            body[8], body[9])
        elif kind == b"IDAT":
            idat += body
        elif kind == b"IEND":
            break
        pos += 12 + length

    if depth != 8 or colour not in (2, 6):
        raise ValueError(f"unsupported png: depth={depth} colour={colour}")
    channels = 3 if colour == 2 else 4
    raw = zlib.decompress(idat)
    stride = width * channels

    out, prev, at = [], bytearray(stride), 0
    for _ in range(height):
        filt = raw[at]; at += 1
        line = bytearray(raw[at:at + stride]); at += stride
        for i in range(stride):
            a = line[i - channels] if i >= channels else 0
            b = prev[i]
            c = prev[i - channels] if i >= channels else 0
            if filt == 1: line[i] = (line[i] + a) & 0xFF
            elif filt == 2: line[i] = (line[i] + b) & 0xFF
            elif filt == 3: line[i] = (line[i] + (a + b) // 2) & 0xFF
            elif filt == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        prev = line
        out.append([(line[i], line[i + 1], line[i + 2])
                    for i in range(0, stride, channels)])
    return out


def project(lat: float, lng: float, region: dict, zoom: int):
    """Marker coordinates to a pixel on the whole-map image, as MapView does."""
    span = 2 ** zoom
    if region["simple"]:
        north = region["nEast"][0]
        east = region["nEast"][1]
        rows = math.ceil(span * north / TILE)
        # y counts down from north, x across from west
        px = lng / east * span * TILE * (east / north) if north else 0
        return None  # flat maps need the layer's own transform; skipped below
    # geographic: standard web mercator over the declared corners
    x = (lng + 180.0) / 360.0 * span * TILE
    siny = math.sin(math.radians(lat))
    siny = min(max(siny, -0.9999), 0.9999)
    y = (0.5 - math.log((1 + siny) / (1 - siny)) / (4 * math.pi)) * span * TILE
    return x, y


def main() -> int:
    root = pathlib.Path(__file__).resolve().parents[2]
    data = json.loads((root / "src/data/markers.json").read_text(encoding="utf-8"))
    tmp = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/w3align")
    tmp.mkdir(parents=True, exist_ok=True)

    region_name = "Skellige"          # geographic, plenty of both kinds
    region = data["regions"][region_name]
    zoom = 4
    span = 2 ** zoom
    rows = span

    groups = {"vendor": [], "wild": []}
    cache = {}

    for m in data["markers"]:
        if m["region"] != region_name:
            continue
        kind = ("vendor" if m["category"] in VENDOR
                else "wild" if m["category"] in WILD else None)
        if not kind:
            continue
        p = project(m["lat"], m["lng"], region, zoom)
        if p is None:
            continue
        gx, gy = p
        tx, ty = int(gx // TILE), int(gy // TILE)
        key = (zoom, tx, ty)
        if key not in cache:
            url = f"{TILES}/{region['path']}/{zoom}/{tx}/{rows - 1 - ty}.jpg"
            try:
                cache[key] = to_rgb_grid(fetch(url), tmp)
            except Exception:
                cache[key] = None
        grid = cache[key]
        if not grid:
            continue
        px, py = int(gx % TILE), int(gy % TILE)
        if py >= len(grid) or px >= len(grid[0]):
            continue
        r, g, b = grid[py][px]
        groups[kind].append(r - (g + b) / 2)

    print(f"region: {region_name}  zoom: {zoom}  tiles fetched: "
          f"{sum(1 for v in cache.values() if v)}")
    for k, v in groups.items():
        avg = sum(v) / len(v) if v else 0
        print(f"  {k:7s} n={len(v):4d}  mean redness {avg:6.2f}")
    if groups["vendor"] and groups["wild"]:
        sep = (sum(groups["vendor"]) / len(groups["vendor"])
               - sum(groups["wild"]) / len(groups["wild"]))
        print(f"\nseparation: {sep:.2f}  "
              f"({'aligned' if sep > 5 else 'SUSPECT — check the tile source'})")
        return 0 if sep > 5 else 1
    print("not enough markers to judge")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
