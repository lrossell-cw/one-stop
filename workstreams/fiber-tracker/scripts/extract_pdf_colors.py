#!/usr/bin/env python3
"""
Extract per-hop occupancy colors from data/raw/MMR_Cutsheet.pdf.

Why this exists
---------------
The MMR cutsheet's status legend (Yellow = Occupied, Green = Open,
Red = Faulty) lives ONLY as cell background fills in the PDF export.
MMR_Cutsheet.csv carries no color information whatsoever, so the CSV alone
cannot tell you a run's derived status. This script recovers those fills by
walking the PDF content stream directly (no third-party deps).

What it found
-------------
The export merges runs of same-colored cells into single filled rectangles,
and those rectangles align exactly with the sheet's `<>` separator columns.
That means each fill covers one HOP GROUP horizontally and a run of rows
vertically -- i.e. the colors are already per-circuit-per-hop, which is
exactly the granularity the app models.

Row alignment is 1:1: PDF text row N corresponds to CSV line N+1. This is
verified at runtime by comparing the Circuit column text against the CSV;
the script fails loudly if the two ever drift apart.

Output: data/generated/mmr_cell_colors.json
"""

import csv
import json
import os
import re
import sys
import zlib
from collections import Counter

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(REPO, "data", "raw", "MMR_Cutsheet.pdf")
CSV_PATH = os.path.join(REPO, "data", "raw", "MMR_Cutsheet.csv")
OUT_DIR = os.path.join(REPO, "data", "generated")
OUT = os.path.join(OUT_DIR, "mmr_cell_colors.json")

# Legend fills as emitted by the spreadsheet's PDF export, with tolerance for
# float rounding.
LEGEND = [
    ("OCCUPIED", (1.0, 1.0, 0.0)),
    ("OPEN",     (0.0, 1.0, 0.0)),
    ("FAULTY",   (0.918, 0.263, 0.208)),
    ("NOTE",     (0.290, 0.525, 0.910)),   # blue annotation, not a status
    ("NOTE",     (0.275, 0.741, 0.776)),   # teal annotation, not a status
]
# Fills that are structural, not semantic: text runs, empty cells, header grey.
IGNORE = [(0, 0, 0), (1, 1, 1), (0.851, 0.851, 0.851), (0.718, 0.718, 0.718)]

TOL = 0.02
ROW_H = 6.25          # table row pitch, in points, in the exported PDF
HEADER_Y = 553.5      # baseline of the header row

# Hop groups, named by the pair of halls the columns describe. Boundaries are
# the x positions of the `<>` separator columns in the header.
HOPS = ["MMR-151", "151-120", "120-160"]


def close(a, b, tol=TOL):
    return all(abs(x - y) <= tol for x, y in zip(a, b))


def classify(rgb):
    for name, ref in LEGEND:
        if close(rgb, ref):
            return name
    for ref in IGNORE:
        if close(rgb, ref):
            return None
    return None


def decompressed_streams(path):
    """All inflatable streams in the file, in document order."""
    raw = open(path, "rb").read()
    out = []
    for s in re.findall(rb"stream\r?\n(.*?)endstream", raw, re.S):
        try:
            out.append(zlib.decompress(s))
        except zlib.error:
            pass
    return out


def content_stream(path):
    """Just the page content stream.

    The file also embeds a TrueType font program and a ToUnicode CMap;
    concatenating those into the operator stream yields garbage operators.
    """
    parts = []
    for s in decompressed_streams(path):
        if s[:4] in (b"\x00\x01\x00\x00", b"OTTO", b"true", b"ttcf"):
            continue
        if s.lstrip()[:9] == b"/CIDInit ":
            continue
        if s[:200].lstrip()[:1] in (b"q", b"Q", b"B") or b" cm" in s[:400]:
            parts.append(s)
    if not parts:
        sys.exit("could not locate a page content stream in %s" % path)
    return b"\n".join(parts).decode("latin-1")


def mat_mul(m, n):
    a, b, c, d, e, f = m
    A, B, C, D, E, F = n
    return (a * A + b * C, a * B + b * D,
            c * A + d * C, c * B + d * D,
            e * A + f * C + E, e * B + f * D + F)


def apply(m, x, y):
    a, b, c, d, e, f = m
    return (a * x + c * y + e, b * x + d * y + f)


def parse_fills(tokens):
    """Walk the token stream tracking CTM + fill color, yielding filled rects."""
    ctm = (1.0, 0, 0, 1.0, 0, 0)
    stack = []
    fill = (0.0, 0.0, 0.0)
    pts = []
    nums = []
    rects = []

    for tok in tokens:
        try:
            nums.append(float(tok))
            continue
        except ValueError:
            pass

        if tok == "q":
            stack.append((ctm, fill))
        elif tok == "Q":
            if stack:
                ctm, fill = stack.pop()
        elif tok == "cm" and len(nums) >= 6:
            ctm = mat_mul(tuple(nums[-6:]), ctm)
        elif tok == "rg" and len(nums) >= 3:
            fill = tuple(nums[-3:])
        elif tok == "m" and len(nums) >= 2:
            pts = [apply(ctm, nums[-2], nums[-1])]
        elif tok == "l" and len(nums) >= 2:
            pts.append(apply(ctm, nums[-2], nums[-1]))
        elif tok == "re" and len(nums) >= 4:
            x, y, w, h = nums[-4:]
            pts = [apply(ctm, x, y), apply(ctm, x + w, y),
                   apply(ctm, x + w, y + h), apply(ctm, x, y + h)]
        elif tok in ("f", "F", "f*", "b", "b*", "B", "B*"):
            if len(pts) >= 3:
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                rects.append({"x0": min(xs), "x1": max(xs),
                              "y0": min(ys), "y1": max(ys), "rgb": fill})
            pts = []
        elif tok in ("n", "S", "s"):
            pts = []

        if tok not in ("q", "Q"):
            nums = []

    return rects


def hop_separators(text_items):
    """x positions of the `<>` separator columns in the header row."""
    xs = sorted(x for x, y, t in text_items
                if abs(y - HEADER_Y) < 1.0 and t.strip() == "<>")
    if len(xs) < 7:
        sys.exit("expected 7 `<>` separators in the header, found %d -- has "
                 "the sheet layout changed?" % len(xs))
    # Groups are delimited by separators 3, 5 and 7 (indices 2, 4, 6): those
    # are the ones that terminate each hop's block of columns.
    return xs[2], xs[4], xs[6]


def hop_of(x, bounds):
    b0, b1, b2 = bounds
    if x < b0:
        return "MMR-151"
    if x < b1:
        return "151-120"
    if x < b2:
        return "120-160"
    return None  # trailing Location / Nokia Port / Notes columns


def main():
    from _pdf_text import extract_text

    text_items = extract_text(PDF)
    bounds = hop_separators(text_items)

    # --- Row grid, anchored on the header baseline -------------------------
    rows = {}
    for x, y, t in text_items:
        ri = round((HEADER_Y - y) / ROW_H)
        rows.setdefault(ri, []).append((x, t))

    # --- Verify PDF row N == CSV line N+1 ----------------------------------
    with open(CSV_PATH, newline="") as fh:
        csv_rows = list(csv.reader(fh))

    checked = mismatched = 0
    for ri, cells in rows.items():
        if ri == 0 or ri + 1 > len(csv_rows):
            continue
        pdf_circuit = next((t for x, t in sorted(cells) if x < 90), "").strip()
        csv_circuit = csv_rows[ri][0].strip()
        if not pdf_circuit and not csv_circuit:
            continue
        checked += 1
        if pdf_circuit != csv_circuit:
            mismatched += 1
            print("  row %-3d PDF=%-24r CSV=%r" % (ri, pdf_circuit,
                                                   csv_circuit),
                  file=sys.stderr)
    if mismatched:
        sys.exit("\nPDF/CSV row alignment broke on %d of %d rows. The color "
                 "map cannot be trusted -- re-export both files from the same "
                 "sheet revision." % (mismatched, checked))

    # --- Colored fills -> (csv_line, hop) ----------------------------------
    rects = parse_fills(content_stream(PDF).split())
    cells = {}
    counts = Counter()
    for r in rects:
        kind = classify(r["rgb"])
        if not kind or (r["x1"] - r["x0"]) < 4 or (r["y1"] - r["y0"]) < 4:
            continue
        hop = hop_of(r["x0"], bounds)
        if hop is None:
            continue
        counts[kind] += 1
        # A fill may span several consecutive rows. Assign it to exactly those
        # rows whose text baseline falls inside the rectangle -- rounding the
        # rectangle's own edges to the row grid bleeds into neighbouring rows
        # and lets a later fill silently overwrite an earlier one.
        for ri in sorted(rows):
            if ri == 0:
                continue
            baseline = HEADER_Y - ri * ROW_H
            if r["y0"] <= baseline <= r["y1"]:
                cells.setdefault(str(ri + 1), {})[hop] = kind

    payload = {
        "source": "data/raw/MMR_Cutsheet.pdf",
        "generated_by": "scripts/extract_pdf_colors.py",
        "note": ("Occupancy colors recovered from PDF cell fills; the CSV has "
                 "none. Keyed by CSV line number (1-based, line 1 = header) "
                 "and hop. NOTE-colored cells are annotations, not statuses."),
        "legend": {"OCCUPIED": "yellow", "OPEN": "green", "FAULTY": "red",
                   "NOTE": "blue/teal annotation"},
        "hops": HOPS,
        "fill_counts": dict(counts),
        "rows_verified_against_csv": checked,
        "cells": {k: cells[k] for k in sorted(cells, key=int)},
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(payload, fh, indent=2)

    print("row alignment verified on %d rows (0 mismatches)" % checked)
    print("legend fills found:")
    for k, v in counts.most_common():
        print("  %-9s %d" % (k, v))
    print("rows with color: %d" % len(cells))
    print("wrote %s" % os.path.relpath(OUT, REPO))


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
