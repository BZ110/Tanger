"""Hair hierarchy, editable guides and independent lock shaping."""

import math
import bpy
from mathutils import Vector
from .editing import mask, move_vertices, relax, subdivision


def create_clump(collection, name, controls, settings):
    guide_data = bpy.data.curves.new(name + " editable guide", "CURVE")
    guide_data.dimensions = "3D"
    spline = guide_data.splines.new("BEZIER")
    spline.bezier_points.add(len(controls) - 1)
    for point, control in zip(spline.bezier_points, controls):
        point.co = control
        point.handle_left_type = point.handle_right_type = "AUTO"
    guide = bpy.data.objects.new(guide_data.name, guide_data)
    collection.objects.link(guide)
    guide.hide_render = True
    vertices = []
    faces = []
    uv = []
    steps = 24
    around = 10
    a, b, c, d = map(Vector, controls)
    normal = Vector(settings.get("normalOrientation", [0, -1, 0])).normalized()
    for ring in range(steps + 1):
        t = ring / steps
        center = (
            (1 - t) ** 3 * a
            + 3 * (1 - t) ** 2 * t * b
            + 3 * (1 - t) * t * t * c
            + t**3 * d
        )
        tangent = (
            3 * (1 - t) ** 2 * (b - a) + 6 * (1 - t) * t * (c - b) + 3 * t * t * (d - c)
        ).normalized()
        side = tangent.cross(normal).normalized()
        up = side.cross(tangent).normalized()
        twist = settings.get("twist", 0) * t
        width = (
            settings["thickness"]
            * (0.55 + 0.55 * math.sin(math.pi * t))
            * (1 - t) ** settings.get("taper", 0.7)
            + 0.0001
        )
        depth = settings.get("depth", 0.004) * (1 - t) ** 0.8 + 0.0001
        for index in range(around):
            angle = index / around * math.tau + twist
            vertex = (
                center
                + side * (math.cos(angle) * width)
                + up * (math.sin(angle) * depth)
            )
            vertices.append(vertex)
            uv.append((index / around, t))
    for ring in range(steps):
        for index in range(around):
            faces.append(
                (
                    ring * around + index,
                    ring * around + (index + 1) % around,
                    (ring + 1) * around + (index + 1) % around,
                    (ring + 1) * around + index,
                )
            )
    faces.extend(
        [
            tuple(range(around - 1, -1, -1)),
            tuple(range(steps * around, (steps + 1) * around)),
        ]
    )
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(bpy.data.materials["Hair"])
    layer = data.uv_layers.new(name="AuthoredUV")
    for loop in data.loops:
        layer.data[loop.index].uv = uv[loop.vertex_index]
    for polygon in data.polygons:
        polygon.use_smooth = True
    obj["hair_level"] = settings["level"]
    obj["root_direction"] = list((b - a).normalized())
    obj["highlight_direction"] = settings.get("highlightDirection", [0, 1, 0])
    obj["tip_shape"] = settings.get("tipShape", "pointed")
    obj["overlap"] = settings.get("overlap", 0.002)
    obj["TANGER_initialization_only"] = True
    obj["TANGER_artist_passes"] = 0
    return obj, guide


def reshape(source_objects, settings):
    """Targeted manual-like strokes over chosen locks, no uniform randomization."""
    for edit in settings["locks"]:
        obj = next(item for item in source_objects if item.name == edit["name"])
        for stroke in edit.get("strokes", []):
            weights = mask(
                obj, stroke["center"], stroke["radius"], stroke.get("axes", [1, 1, 1])
            )
            move_vertices(obj, weights, stroke["delta"])
            if stroke.get("relax", 0):
                relax(obj, weights, stroke["relax"], 0.25)
        if "subdivision" in edit:
            subdivision(obj, edit["subdivision"])
        obj["hair_level"] = edit["level"]
        obj["TANGER_artist_passes"] = obj.get("TANGER_artist_passes", 0) + 1
