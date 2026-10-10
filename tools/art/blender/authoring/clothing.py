"""Garment construction, deformation and folds; noise is not a fold tool."""

import bpy
from .editing import mask, sculpt, relax


def garment_start(body, collection, name, offset=0.006, thickness=0.002):
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = name
    collection.objects.link(obj)
    obj.modifiers.clear()
    shrinkwrap = obj.modifiers.new("Garment offset from underlying body", "SHRINKWRAP")
    shrinkwrap.target = body
    shrinkwrap.offset = offset
    solidify = obj.modifiers.new("Garment thickness", "SOLIDIFY")
    solidify.thickness = thickness
    obj["TANGER_initialization_only"] = True
    obj["TANGER_artist_passes"] = 0
    return obj


def separate_panel(obj, polygon_indices, name):
    from .eyes import surface

    chosen = [obj.data.polygons[index] for index in polygon_indices]
    indices = sorted({index for polygon in chosen for index in polygon.vertices})
    lookup = {index: i for i, index in enumerate(indices)}
    vertices = [obj.data.vertices[index].co.copy() for index in indices]
    faces = [tuple(lookup[i] for i in polygon.vertices) for polygon in chosen]
    return surface(
        obj.users_collection[0],
        name,
        vertices,
        faces,
        obj.data.materials[0],
        [(0, 0)] * len(vertices),
    )


def seam_curve(collection, name, points, radius=0.0006):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    return obj


def fold_pass(obj, folds):
    for fold in folds:
        weights = mask(obj, fold["center"], fold["radius"], fold["axes"])
        sculpt(obj, weights, fold["amplitude"], fold["direction"])
        relax(obj, weights, 1, 0.12)
    obj["TANGER_artist_passes"] = obj.get("TANGER_artist_passes", 0) + 1


def cloth_test(obj, pin_group, quality=12):
    modifier = obj.modifiers.new("Source cloth tension study", "CLOTH")
    modifier.settings.quality = quality
    modifier.settings.vertex_group_mass = pin_group
    modifier.collision_settings.use_self_collision = True
    return (
        modifier  # Bake/inspect/clean up explicitly; never silently bless a simulation.
    )
