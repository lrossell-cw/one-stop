#!/usr/bin/env python3
"""Minimal positioned-text extractor for the cutsheet PDF (no third-party deps).

Walks the content stream tracking the CTM and text matrices, and yields
(x, y, string) for each show-text operator. Used to anchor the geometric
color bands recovered by extract_pdf_colors.py onto real table rows.
"""

import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_pdf_colors import (  # noqa: E402
    content_stream, decompressed_streams, mat_mul, apply)


def load_tounicode(path):
    """Parse the ToUnicode CMap so CID-encoded strings decode to real text.

    The cutsheet uses a subset CID font, so the bytes inside (...) are glyph
    ids, not ASCII. Without this map every extracted string is mojibake.
    """
    cmap = {}
    for s in decompressed_streams(path):
        if s.lstrip()[:9] != b"/CIDInit ":
            continue
        txt = s.decode("latin-1")

        for block in re.findall(r"beginbfchar(.*?)endbfchar", txt, re.S):
            for src, dst in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>",
                                       block):
                cmap[int(src, 16)] = _utf16be(dst)

        for block in re.findall(r"beginbfrange(.*?)endbfrange", txt, re.S):
            for lo, hi, dst in re.findall(
                    r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>",
                    block):
                base = int(dst, 16)
                for i in range(int(lo, 16), int(hi, 16) + 1):
                    cmap[i] = chr(base + i - int(lo, 16))
    return cmap


def _utf16be(hexstr):
    raw = bytes.fromhex(hexstr)
    try:
        return raw.decode("utf-16-be")
    except UnicodeDecodeError:
        return ""


def decode_cid(raw, cmap):
    """Map a raw show-text string through the CMap, 2 bytes per glyph."""
    if not cmap:
        return raw
    b = raw.encode("latin-1", "ignore")
    out = []
    for i in range(0, len(b) - 1, 2):
        out.append(cmap.get((b[i] << 8) | b[i + 1], ""))
    return "".join(out)


def _unescape(s):
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == "\\" and i + 1 < len(s):
            n = s[i + 1]
            mapping = {"n": "\n", "r": "\r", "t": "\t", "b": "\b",
                       "f": "\f", "(": "(", ")": ")", "\\": "\\"}
            if n in mapping:
                out.append(mapping[n])
                i += 2
                continue
            m = re.match(r"[0-7]{1,3}", s[i + 1:])
            if m:
                out.append(chr(int(m.group(), 8)))
                i += 1 + len(m.group())
                continue
            out.append(n)
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def tokenize(stream):
    """Yield tokens, keeping (...) strings and [...] arrays intact."""
    i, n = 0, len(stream)
    while i < n:
        c = stream[i]
        if c.isspace():
            i += 1
        elif c == "(":
            depth, j = 1, i + 1
            buf = []
            while j < n and depth:
                ch = stream[j]
                if ch == "\\":
                    buf.append(stream[j:j + 2])
                    j += 2
                    continue
                if ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                    if not depth:
                        break
                buf.append(ch)
                j += 1
            yield ("str", _unescape("".join(buf)))
            i = j + 1
        elif c == "[":
            depth, j = 1, i + 1
            while j < n and depth:
                if stream[j] == "\\":
                    j += 2
                    continue
                if stream[j] == "[":
                    depth += 1
                elif stream[j] == "]":
                    depth -= 1
                j += 1
            yield ("arr", stream[i + 1:j - 1])
            i = j
        else:
            j = i
            while j < n and not stream[j].isspace() and stream[j] not in "()[]":
                j += 1
            if j == i:
                j = i + 1
            yield ("tok", stream[i:j])
            i = j


def extract_text(path):
    stream = content_stream(path)
    cmap = load_tounicode(path)
    ctm = (1.0, 0, 0, 1.0, 0, 0)
    stack = []
    tm = tlm = (1.0, 0, 0, 1.0, 0, 0)
    nums = []
    items = []
    pending = []

    def flush():
        if pending:
            text = decode_cid("".join(pending), cmap).strip()
            if text:
                x, y = apply(mat_mul(tm, ctm), 0, 0)
                items.append((x, y, text))
            pending.clear()

    for kind, val in tokenize(stream):
        if kind == "str":
            pending.append(val)
            continue
        if kind == "arr":
            for m in re.finditer(r"\((?:\\.|[^\\)])*\)", val):
                pending.append(_unescape(m.group()[1:-1]))
            continue

        tok = val
        try:
            nums.append(float(tok))
            continue
        except ValueError:
            pass

        if tok == "q":
            stack.append(ctm)
        elif tok == "Q":
            if stack:
                ctm = stack.pop()
        elif tok == "cm" and len(nums) >= 6:
            ctm = mat_mul(tuple(nums[-6:]), ctm)
        elif tok == "BT":
            tm = tlm = (1.0, 0, 0, 1.0, 0, 0)
        elif tok == "ET":
            flush()
        elif tok == "Tm" and len(nums) >= 6:
            flush()
            tm = tlm = tuple(nums[-6:])
        elif tok == "Td" and len(nums) >= 2:
            flush()
            tm = tlm = mat_mul((1, 0, 0, 1, nums[-2], nums[-1]), tlm)
        elif tok == "TD" and len(nums) >= 2:
            flush()
            tm = tlm = mat_mul((1, 0, 0, 1, nums[-2], nums[-1]), tlm)
        elif tok in ("T*",):
            flush()
            tm = tlm = mat_mul((1, 0, 0, 1, 0, -10), tlm)
        elif tok in ("Tj", "TJ", "'", '"'):
            flush()

        if tok not in ("q", "Q"):
            nums = []

    flush()
    return items


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "raw", "MMR_Cutsheet.pdf")
    for x, y, t in sorted(extract_text(path), key=lambda i: (-i[1], i[0])):
        print("%8.1f %8.1f  %s" % (x, y, t))
