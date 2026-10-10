"""Facial regions remain editable on a continuous mesh, not feature attachments."""

import bpy
from .editing import mask, move_vertices, relax, subdivision

REGIONS = {
    "cranium": ((0, 0.04, 1.75), 0.11),
    "forehead": ((0, -0.055, 1.73), 0.085),
    "brow": ((0, -0.075, 1.68), 0.06),
    "eye-socket.L": ((0.052, -0.075, 1.651), 0.045),
    "eye-socket.R": ((-0.052, -0.075, 1.651), 0.045),
    "upper-eyelid.L": ((0.052, -0.075, 1.662), 0.04),
    "lower-eyelid.L": ((0.052, -0.075, 1.643), 0.035),
    "upper-eyelid.R": ((-0.052, -0.075, 1.662), 0.04),
    "lower-eyelid.R": ((-0.052, -0.075, 1.643), 0.035),
    "inner-canthus.L": ((0.024, -0.078, 1.651), 0.015),
    "outer-canthus.L": ((0.081, -0.067, 1.654), 0.015),
    "inner-canthus.R": ((-0.024, -0.078, 1.651), 0.015),
    "outer-canthus.R": ((-0.081, -0.067, 1.654), 0.015),
    "cheek-plane": ((0, -0.062, 1.619), 0.085),
    "cheek-fullness": ((0, -0.06, 1.604), 0.08),
    "nose-bridge": ((0, -0.09, 1.65), 0.031),
    "nose-tip": ((0, -0.095, 1.616), 0.023),
    "nose-underside": ((0, -0.09, 1.607), 0.018),
    "philtrum": ((0, -0.075, 1.593), 0.018),
    "mouth-volume": ((0, -0.074, 1.582), 0.04),
    "upper-lip": ((0, -0.073, 1.583), 0.033),
    "lower-lip": ((0, -0.073, 1.579), 0.033),
    "jaw": ((0, -0.04, 1.56), 0.078),
    "chin": ((0, -0.056, 1.543), 0.035),
    "ear-placement.L": ((0.106, 0, 1.636), 0.034),
    "ear-placement.R": ((-0.106, 0, 1.636), 0.034),
    "profile-curvature": ((0, -0.07, 1.645), 0.14),
}


def register_regions(obj):
    for name, (center, radius) in REGIONS.items():
        group = obj.vertex_groups.get("face/" + name) or obj.vertex_groups.new(
            name="face/" + name
        )
        for index, weight in mask(obj, center, radius, axes=(1, 1, 1)).items():
            group.add([index], weight, "REPLACE")


def refine_bebben(source_objects, settings):
    obj = next(item for item in source_objects if item.name.startswith("Face —"))
    register_regions(obj)
    # Explicit proportional vertex strokes: restrain nose projection and soften
    # the orbicular shelf. The original face topology remains continuously editable.
    for stroke in settings["strokes"]:
        weights = mask(
            obj, stroke["center"], stroke["radius"], stroke.get("axes", (1, 1, 1))
        )
        move_vertices(obj, weights, stroke["delta"])
        if stroke.get("relax", 0):
            relax(obj, weights, stroke["relax"], 0.22)
    subdivision(obj, 1)
    obj["TANGER_artist_passes"] = obj.get("TANGER_artist_passes", 0) + 1
    for item in list(source_objects):
        if item.name.startswith("Nostril "):
            bpy.data.objects.remove(
                item, do_unlink=True
            )  # V1 attached nostril arcs fought the refined surface.
