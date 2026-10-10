"""Semantic eye corrections made on existing cages, with no eye regeneration."""

import bpy
from .operations import brush


def edit(regions, kind, args, camera):
    side = args.get("side", "L")
    if side not in ["L", "R"]:
        raise ValueError("Eye side must be L or R")
    sign = 1 if side == "L" else -1
    if kind in ["upper_arc", "lower_arc"]:
        regions.select(
            "face." + ("upper_lid" if kind == "upper_arc" else "lower_lid") + "." + side
        )
        return brush(
            regions, "grab", {"displacement": [0, 0, args["amount"]], **args}, camera
        )
    if kind in ["outer_canthus", "inner_canthus"]:
        regions.select("face." + kind + "." + side)
        return brush(regions, "grab", args, camera)
    if kind == "depth":
        regions.select("eyes." + side)
        return brush(
            regions, "grab", {"displacement": [0, args["amount"], 0], **args}, camera
        )
    if kind == "slant":
        regions.select("eyes." + side)
        count = 0
        for obj, values in regions.selection.items():
            center = sum(
                obj.data.vertices[i].co.x * w for i, w in values.items()
            ) / sum(values.values())
            for i, w in values.items():
                obj.data.vertices[i].co.z += (
                    (obj.data.vertices[i].co.x - center) * sign * args["slope"] * w
                )
                count += 1
            obj.data.update()
        return count
    if kind == "iris_exposure":
        # Move the existing lash and adjacent facial opening, not a flattened iris.
        regions.select("face.upper_lid." + side)
        return brush(
            regions, "grab", {"displacement": [0, 0, args["amount"]], **args}, camera
        )
    if kind == "lid_thickness":
        regions.select("eyes.upper_lid." + side)
        count = 0
        for prefix in ["Upper lash.", "Lower lash."]:
            obj = bpy.data.objects.get(prefix + side)
            if not obj:
                raise ValueError("No authored lash component")
            modifier = obj.modifiers.get("Artist lid thickness") or obj.modifiers.new(
                "Artist lid thickness", "SOLIDIFY"
            )
            modifier.thickness = args["thickness"]
            modifier.offset = 0
            count += len(obj.data.vertices)
        return count
    raise ValueError("Unknown semantic eye correction")
