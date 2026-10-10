"""Strip private authoring paths from known Blender pathname fields only.

Blender retains file-browser directories, packed-image paths and render paths even
when an Image.filepath is relative. Preserve the binary block sizes and all mesh
bytes. Compressed files must be resaved uncompressed before using this helper.
"""

import pathlib
import struct


def _dna_names(payload, endian):
    cursor = 4
    assert payload[:4] == b"SDNA" and payload[cursor : cursor + 4] == b"NAME"
    cursor += 4
    count = struct.unpack_from(endian + "I", payload, cursor)[0]
    cursor += 4
    for _ in range(count):
        cursor = payload.index(b"\0", cursor) + 1
    cursor = (cursor + 3) & ~3
    assert payload[cursor : cursor + 4] == b"TYPE"
    cursor += 4
    count = struct.unpack_from(endian + "I", payload, cursor)[0]
    cursor += 4
    types = []
    for _ in range(count):
        end = payload.index(b"\0", cursor)
        types.append(payload[cursor:end].decode())
        cursor = end + 1
    cursor = (cursor + 3) & ~3
    assert payload[cursor : cursor + 4] == b"TLEN"
    cursor += 4 + count * 2
    cursor = (cursor + 3) & ~3
    assert payload[cursor : cursor + 4] == b"STRC"
    cursor += 4
    count = struct.unpack_from(endian + "I", payload, cursor)[0]
    cursor += 4
    structs = []
    for _ in range(count):
        index, fields = struct.unpack_from(endian + "HH", payload, cursor)
        cursor += 4
        structs.append(types[index])
        cursor += fields * 4
    return structs


def sanitize_blend(filename, repo_root):
    filename = pathlib.Path(filename)
    data = bytearray(filename.read_bytes())
    if data[:7] != b"BLENDER":
        raise ValueError("Privacy normalization requires an uncompressed .blend")
    pointer = "Q" if data[7:8] == b"-" else "I"
    endian = "<" if data[8:9] == b"v" else ">"
    header = endian + "4sI" + pointer + "II"
    header_size = struct.calcsize(header)
    blocks = []
    cursor = 12
    types = None
    while cursor + header_size <= len(data):
        code, size, _, sdna, _ = struct.unpack_from(header, data, cursor)
        start = cursor + header_size
        blocks.append((code, start, size, sdna))
        if code == b"DNA1":
            types = _dna_names(bytes(data[start : start + size]), endian)
        cursor = start + size
        if code == b"ENDB":
            break
    if types is None:
        raise ValueError("Missing Blender DNA")
    repo_prefix = str(pathlib.Path(repo_root).resolve()).encode()
    home_prefix = str(pathlib.Path.home()).encode()
    replacements = 0
    allowed = {
        "FileSelectParams",
        "Image",
        "ImagePackedFile",
        "Scene",
        "Library",
        "LibraryWeakReference",
    }
    for _, start, size, sdna in blocks:
        name = types[sdna] if sdna < len(types) else ""
        payload = bytes(data[start : start + size])
        index = 0
        while True:
            index = payload.find(home_prefix + b"/", index)
            # File-browser directory may contain only the home path.
            if index < 0:
                index = payload.find(home_prefix + b"\0")
            if index < 0:
                break
            end = payload.find(b"\0", index)
            if end < 0:
                raise ValueError("Private pathname is not a terminated field")
            old = payload[index:end]
            if name not in allowed:
                raise ValueError("Unrecognized private pathname field in " + name)
            if name == "FileSelectParams":
                new = b"//"
            elif name == "Scene":
                new = b"//renders/"
            elif name in ["Library", "LibraryWeakReference"] and old.startswith(
                repo_prefix + b"/"
            ):
                import os

                new = (
                    b"//"
                    + os.path.relpath(old.decode(), filename.resolve().parent).encode()
                )
            elif old.startswith(repo_prefix + b"/") and b"/textures/" in old:
                new = b"//textures/" + old.rsplit(b"/", 1)[-1]
            else:
                raise ValueError(
                    "External source image must be packed/provenance-reviewed before publication"
                )
            data[start + index : start + end] = new + b"\0" * (end - index - len(new))
            replacements += 1
            payload = bytes(data[start : start + size])
            index = 0
    if home_prefix in data:
        raise ValueError("Private authoring path remains outside recognized fields")
    if replacements:
        filename.write_bytes(data)
    return replacements


def sanitize_png(filename):
    """Drop Blender's File stamp/private textual metadata; preserve pixel chunks."""
    import zlib

    filename = pathlib.Path(filename)
    data = filename.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Expected PNG evidence")
    cursor = 8
    result = bytearray(data[:8])
    removed = 0
    home = str(pathlib.Path.home()).encode()
    while cursor + 12 <= len(data):
        length = struct.unpack_from(">I", data, cursor)[0]
        kind = data[cursor + 4 : cursor + 8]
        end = cursor + length + 12
        if end > len(data):
            raise ValueError("Truncated PNG chunk")
        payload = data[cursor + 8 : cursor + 8 + length]
        text = payload
        if kind == b"zTXt":
            _, packed = payload.split(b"\0", 1)
            text = zlib.decompress(packed[1:])
        private = kind in [b"tEXt", b"zTXt", b"iTXt"] and (
            payload.split(b"\0", 1)[0] == b"File" or home in text
        )
        if private:
            removed += 1
        else:
            result.extend(data[cursor:end])
        cursor = end
    if removed:
        filename.write_bytes(result)
    return removed
