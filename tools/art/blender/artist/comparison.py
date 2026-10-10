"""Pixel evidence, never an automatic artistic verdict."""

import json
import bpy
import numpy as np
from authoring.context import path


def pixels(filename):
    image = bpy.data.images.load(str(path(filename)), check_existing=False)
    width, height = image.size
    array = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(array)
    bpy.data.images.remove(image)
    return array.reshape(height, width, 4)


def save(array, filename):
    h, w, _ = array.shape
    image = bpy.data.images.new("Artist comparison", width=w, height=h, alpha=True)
    image.pixels.foreach_set(np.ascontiguousarray(array).ravel())
    image.filepath_raw = str(path(filename))
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def compare(before, after, root, target=False):
    if not target:
        a = json.loads(path(before + ".json").read_text())
        b = json.loads(path(after + ".json").read_text())
        if any(
            a.get(k) != b.get(k)
            for k in ["cameraVersion", "size", "view", "pass", "exposure", "pose"]
        ):
            raise ValueError(
                "Comparison requires matching camera, lighting, pass and viewport mode"
            )
    first, second = pixels(before), pixels(after)
    if first.shape != second.shape:
        raise ValueError(
            "Target/render dimensions must match; do not silently distort a paintover"
        )
    path(root).mkdir(parents=True, exist_ok=True)
    outputs = {}
    background = np.array([0.18, 0.20, 0.24], dtype=np.float32)

    def composite(value):
        result = value.copy()
        alpha = value[:, :, 3:4]
        result[:, :, :3] = value[:, :, :3] * alpha + background * (1 - alpha)
        result[:, :, 3] = 1
        return result

    a, b = composite(first), composite(second)
    diff = np.abs(a - b)
    diff[:, :, 3] = 1
    silhouette = np.zeros_like(a)
    silhouette[:, :, 3] = 1
    mask_a, mask_b = first[:, :, 3] > 0.1, second[:, :, 3] > 0.1
    if not target and a_record_pass(before) in ["silhouette", "outline_only"]:
        mask_a = first[:, :, :3].mean(axis=2) < 0.5
        mask_b = second[:, :, :3].mean(axis=2) < 0.5
    silhouette[:, :, :3] = 0.92
    silhouette[mask_a & mask_b, :3] = 0.12
    silhouette[mask_a & ~mask_b, :3] = [0.85, 0.16, 0.12]
    silhouette[mask_b & ~mask_a, :3] = [0.10, 0.65, 0.90]
    for name, value in {
        "side-by-side": np.concatenate([a, b], axis=1),
        "overlay": (a + b) * 0.5,
        "difference": diff,
        "silhouette-difference": silhouette,
    }.items():
        filename = root + "/" + name + ".png"
        save(value, filename)
        outputs[name] = filename
    return {
        "before": before,
        "after": after,
        "images": outputs,
        "silhouetteLegend": "red: removed, blue: added; uses alpha for beauty, black/white coverage for silhouette/outline diagnostics",
        "targetPaintover": target,
    }


def a_record_pass(filename):
    return json.loads(path(filename + ".json").read_text())["pass"]
