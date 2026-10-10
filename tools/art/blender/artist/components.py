"""Local curve editing and provenance-bearing library components."""

import json
import bpy
from mathutils import Vector
from authoring.context import path


def curve(state, kind, args):
    obj = bpy.data.objects.get(args["name"])
    if kind == "create":
        if obj:
            raise ValueError("Curve name already exists")
        data = bpy.data.curves.new(args["name"], "CURVE")
        data.dimensions = "3D"
        spline = data.splines.new("BEZIER")
        spline.bezier_points.add(len(args["points"]) - 1)
        for point, co in zip(spline.bezier_points, args["points"]):
            point.co = co
            point.handle_left_type = point.handle_right_type = "AUTO"
        obj = bpy.data.objects.new(args["name"], data)
        bpy.data.collections[state["collection"]].objects.link(obj)
        data.bevel_depth = args.get("radius", 0.001)
        material = bpy.data.materials.get(args.get("material", "Hair"))
        if material:
            data.materials.append(material)
    else:
        if (
            not obj
            or obj.type != "CURVE"
            or obj not in bpy.data.collections[state["collection"]].all_objects
        ):
            raise ValueError("Select an editable SOURCE curve")
        if kind == "convert":
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target="MESH")
            return {"component": obj.name}
        if kind == "profile":
            obj.data.bevel_depth = args.get("radius", obj.data.bevel_depth)
            obj.data.bevel_resolution = args.get("resolution", 4)
        else:
            spline = obj.data.splines[args.get("spline", 0)]
            points = spline.bezier_points
            if kind == "add":
                points.add(1)
                points[-1].co = args["point"]
                points[-1].handle_left_type = points[-1].handle_right_type = "AUTO"
            elif kind == "remove":
                coords = [
                    p.co.copy() for i, p in enumerate(points) if i != args["index"]
                ]
                if len(coords) < 2:
                    raise ValueError("Keep at least two curve points")
                obj.data.splines.remove(spline)
                replacement = obj.data.splines.new("BEZIER")
                replacement.bezier_points.add(len(coords) - 1)
                for point, co in zip(replacement.bezier_points, coords):
                    point.co = co
                    point.handle_left_type = point.handle_right_type = "AUTO"
            elif kind in ["move", "edit"]:
                point = points[args["index"]]
                if "point" in args:
                    point.co = args["point"]
                if "delta" in args:
                    point.co += Vector(args["delta"])
                if "radius" in args:
                    point.radius = args["radius"]
                for key in ["handle_left", "handle_right"]:
                    if key in args:
                        setattr(point, key, args[key])
            else:
                raise ValueError("Unknown curve operation")
    return {"component": obj.name}


def library_import(state, args):
    registry = json.loads(path("art/library/index.json").read_text())
    entry = next((x for x in registry["components"] if x["id"] == args["id"]), None)
    if not entry:
        raise ValueError("Unknown library component")
    if not entry.get("provenance"):
        raise ValueError("Library inputs require provenance")
    if args.get("requireProductionReady", True) and entry["quality"] != "reviewed":
        raise ValueError("Component is not reviewed production art")
    with bpy.data.libraries.load(str(path(entry["source"])), link=False) as (
        available,
        target,
    ):
        if entry["object"] not in available.objects:
            raise ValueError("Missing library object")
        target.objects = [entry["object"]]
    obj = target.objects[0]
    obj.name = args.get("name", entry["id"])
    bpy.data.collections[state["collection"]].objects.link(obj)
    obj["TANGER_provenance"] = entry["provenance"]
    obj["TANGER_library_quality"] = entry["quality"]
    if "replace" in args:
        old = bpy.data.objects.get(args["replace"])
        if not old or old not in bpy.data.collections[state["collection"]].all_objects:
            raise ValueError("Replacement target is not in SOURCE")
        old_name = old.name
        obj.matrix_world = old.matrix_world.copy()
        bpy.data.objects.remove(old, do_unlink=True)
        obj.name = args.get("name", old_name)
    return {"component": obj.name, "quality": entry["quality"]}
