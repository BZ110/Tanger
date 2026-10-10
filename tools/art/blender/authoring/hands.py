"""Unify anatomical palm/digits, then sculpt rather than keep symbolic mittens."""

import bpy
from .editing import mask, sculpt, relax, subdivision


def unify_existing(source_objects, side, voxel=0.0012):
    parts = [
        obj
        for obj in source_objects
        if obj.type == "MESH"
        and obj.name.endswith("." + side)
        and any(
            obj.name.startswith(prefix) for prefix in ("Palm.", "Finger ", "Thumb.")
        )
    ]
    if len(parts) < 6:
        raise ValueError("Hand requires palm, thumb, and four distinct fingers")
    if any(obj.data.shape_keys for obj in parts):
        raise ValueError("Preserve expression topology before hand remeshing")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "Hand anatomy." + side
    obj.data.remesh_voxel_size = voxel
    bpy.ops.object.voxel_remesh()
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj["TANGER_digit_count"] = 5
    obj["TANGER_artist_passes"] = 0
    obj["TANGER_initialization_only"] = True
    return obj


def shape_hand(obj, strokes):
    for stroke in strokes:
        weights = mask(
            obj, stroke["center"], stroke["radius"], stroke.get("axes", [1, 1, 1])
        )
        sculpt(obj, weights, stroke["amount"], stroke.get("direction"))
        relax(obj, weights, 2, 0.2)
    obj["TANGER_artist_passes"] = obj.get("TANGER_artist_passes", 0) + 1
