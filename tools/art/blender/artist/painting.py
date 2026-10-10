"""UV-space strokes on source images, constrained by selected polygons/materials."""

import math
import bpy
import numpy as np
from authoring.context import path


def uv_mask(regions, width, height, material=None):
    result = np.zeros((height, width), dtype=bool)
    for obj, selection in regions.selection.items():
        if not obj.data.uv_layers.active:
            raise ValueError("Painting requires authored UVs")
        obj.data.calc_loop_triangles()
        uv = obj.data.uv_layers.active.data
        for triangle in obj.data.loop_triangles:
            if not any(i in selection for i in triangle.vertices):
                continue
            if (
                material
                and obj.material_slots[triangle.material_index].name != material
            ):
                continue
            points = np.array([uv[i].uv[:] for i in triangle.loops]) * [
                width - 1,
                height - 1,
            ]
            low = np.maximum(0, np.floor(points.min(axis=0)).astype(int))
            high = np.minimum(
                [width - 1, height - 1], np.ceil(points.max(axis=0)).astype(int)
            )
            if np.any(high < low):
                continue
            xs, ys = np.meshgrid(
                np.arange(low[0], high[0] + 1), np.arange(low[1], high[1] + 1)
            )
            p = np.stack([xs, ys], axis=-1)
            a, b, c = points
            den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(den) < 1e-10:
                continue
            u = (
                (b[1] - c[1]) * (p[:, :, 0] - c[0])
                + (c[0] - b[0]) * (p[:, :, 1] - c[1])
            ) / den
            v = (
                (c[1] - a[1]) * (p[:, :, 0] - c[0])
                + (a[0] - c[0]) * (p[:, :, 1] - c[1])
            ) / den
            result[low[1] : high[1] + 1, low[0] : high[0] + 1] |= (
                (u >= 0) & (v >= 0) & (u + v <= 1)
            )
    return result


def paint(regions, args):
    filename = args["image"]
    image = bpy.data.images.load(str(path(filename)), check_existing=True)
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(height, width, 4)
    original = pixels.copy()
    mode = args.get("mode", "stroke")
    points = args.get("points", [[0.5, 0.5]])
    radius = args.get("radius", 0.02)
    if radius <= 0:
        raise ValueError("Paint radius must be positive")
    yy, xx = np.mgrid[0:height, 0:width]
    u = xx / max(1, width - 1)
    v = yy / max(1, height - 1)
    weight = np.zeros((height, width), dtype=np.float32)
    if mode in ["fill", "gradient", "mirror"]:
        weight[:] = 1
    else:
        # Interpolate stroke segments; UV coordinates are bottom-left origin.
        samples = [points[0]]
        for start, end in zip(points, points[1:]):
            count = max(1, math.ceil(math.dist(start, end) / max(radius * 0.3, 1e-6)))
            samples.extend(np.linspace(start, end, count + 1).tolist())
        for x, y in samples:
            distance = np.sqrt((u - x) ** 2 + (v - y) ** 2) / radius
            t = np.maximum(0, 1 - distance)
            weight = np.maximum(weight, t * t * (3 - 2 * t))
    if args.get("selectedOnly", True):
        weight *= uv_mask(regions, width, height, args.get("material"))
    weight *= args.get("strength", 1)
    channels = args.get("channels", [0, 1, 2])
    target = np.array(args.get("color", [1, 1, 1, 1]), dtype=np.float32)
    if len(target) == 3:
        target = np.append(target, 1)
    if mode == "erase":
        target = np.zeros(4, dtype=np.float32)
    if mode in ["blur", "smudge"]:
        shifts = (
            [(-1, 0), (1, 0), (0, -1), (0, 1), (0, 0)]
            if mode == "blur"
            else [(args.get("delta", [1, 0])[1], args.get("delta", [1, 0])[0])]
        )
        candidate = sum(np.roll(original, (dy, dx), (0, 1)) for dy, dx in shifts) / len(
            shifts
        )
    elif mode == "mirror":
        candidate = original[:, ::-1, :].copy()
        if args.get("swapRG", False):
            candidate[:, :, [0, 1]] = candidate[:, :, [1, 0]]
    elif mode == "gradient":
        axis = u if args.get("axis", "U") == "U" else v
        start = np.array(args.get("start", [0, 0, 0, 1]))
        end = np.array(args.get("end", [1, 1, 1, 1]))
        candidate = (
            start[None, None, :] * (1 - axis[:, :, None])
            + end[None, None, :] * axis[:, :, None]
        )
    elif mode in ["stroke", "erase", "fill"]:
        candidate = np.broadcast_to(target, pixels.shape)
    else:
        raise ValueError("Unknown paint operation")
    for channel in channels:
        pixels[:, :, channel] = (
            original[:, :, channel] * (1 - weight) + candidate[:, :, channel] * weight
        )
    image.pixels.foreach_set(np.ascontiguousarray(pixels).ravel())
    image.update()
    image.filepath_raw = str(path(filename))
    image.file_format = "PNG"
    image.save()
    image.pack()
    image.filepath = "//textures/" + path(filename).name
    return {
        "pixels": int(np.count_nonzero(weight > 1e-6)),
        "image": filename,
        "mode": mode,
    }


def create_mask(state, args):
    import json

    filename = args["image"]
    size = args.get("size", 2048)
    if path(filename).exists():
        raise ValueError("Mask already exists; paint it directly")
    if not path(filename).is_relative_to(path(state["source"]).parent / "textures"):
        raise ValueError("Source masks belong in source/textures")
    if size < 1:
        raise ValueError("Texture dimensions must be positive")
    image = bpy.data.images.new(
        path(filename).name, width=size, height=size, alpha=True
    )
    color = args.get("color", [0, 0, 0, 1])
    pixels = np.broadcast_to(np.array(color, dtype=np.float32), (size, size, 4)).copy()
    image.pixels.foreach_set(pixels.ravel())
    image.colorspace_settings.name = "Non-Color"
    image.filepath_raw = str(path(filename))
    image.file_format = "PNG"
    image.save()
    image.pack()
    image.filepath = "//textures/" + path(filename).name
    if "parameter" in args:
        profile = json.loads(path(state["shaderProfile"]).read_text())
        category, key = args["parameter"].split(".")
        if not (
            (
                category in ["skin", "hair", "clothing", "leather", "metal"]
                and key in ["specularMask", "roughnessMask"]
            )
            or (category, key)
            in [("skin", "faceShadowMask"), ("hair", "highlightMask")]
        ):
            raise ValueError("Unknown source mask binding")
        profile[category][key] = filename
        path(state["shaderProfile"]).write_text(json.dumps(profile, indent=2) + "\n")
        from authoring.materials.anime import apply
        from authoring.context import objects

        apply(profile, objects(state))
    return {"image": filename, "pixels": size * size}
