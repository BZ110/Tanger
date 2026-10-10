import math
import bpy
import numpy as np
from mathutils import Vector
from ..context import path


def initialize_mask(filename, size=1024):
    """Original editable directional shadow threshold artwork, not face geometry."""
    if path(filename).exists():
        return
    v, u = np.mgrid[0:size, 0:size].astype(np.float32) / (size - 1)
    # R and G are artist-editable left/right threshold fields in facial UV space.
    cheek = 0.06 * np.exp(-(((v - 0.40) / 0.20) ** 2))
    bridge = 0.08 * np.exp(-(((u - 0.5) / 0.06) ** 2) - ((v - 0.43) / 0.18) ** 2)
    red = np.clip(0.5 + (u - 0.5) * 0.72 + cheek + bridge, 0, 1)
    green = np.clip(0.5 - (u - 0.5) * 0.72 + cheek + bridge, 0, 1)
    rgba = np.stack([red, green, np.zeros_like(red), np.ones_like(red)], axis=-1)
    image = bpy.data.images.new(
        "Face direction thresholds", width=size, height=size, alpha=True
    )
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(rgba.ravel())
    path(filename).parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = str(path(filename))
    image.file_format = "PNG"
    image.save()
    image.pack()


def update_light(profile, direction):
    direction = Vector(direction).normalized()
    basis = bpy.data.objects.get(profile["face"]["basisObject"])
    transform = basis.matrix_world.to_3x3() if basis else None
    head = profile["face"]["headBone"]
    for rig in bpy.data.objects:
        if rig.type == "ARMATURE" and head in rig.pose.bones and not rig.hide_render:
            transform = (rig.matrix_world @ rig.pose.bones[head].matrix).to_3x3()
            break
    local = transform.inverted() @ direction if transform else direction
    azimuth = math.atan2(local.x, -local.y)
    threshold = min(
        1, max(0, abs(azimuth) / math.pi + profile["face"]["thresholdBias"])
    )
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        nodes = material.node_tree.nodes
        for axis, value in zip("XYZ", direction):
            if nodes.get("Key" + axis):
                nodes["Key" + axis].outputs[0].default_value = value
        if nodes.get("FaceThreshold"):
            nodes["FaceThreshold"].outputs[0].default_value = threshold
        if nodes.get("FaceSide"):
            nodes["FaceSide"].outputs[0].default_value = 1 if local.x < 0 else 0
