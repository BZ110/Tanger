"""Proportion controls and anatomical construction cages, never final art by fiat."""

import bpy
from mathutils import Vector
from .editing import subdivision

DEFAULT_PROPORTIONS = {
    "headsTall": 7.2,
    "shoulderWidth": 0.40,
    "ribcageWidth": 0.31,
    "waistWidth": 0.25,
    "pelvisWidth": 0.29,
    "legProportion": 0.53,
    "armProportion": 0.34,
    "handScale": 1.0,
    "footScale": 1.0,
    "neckLength": 0.08,
    "torsoLength": 0.45,
}


def map_coordinate(value, knots):
    if value <= knots[0][0]:
        return knots[0][1]
    for (a, b), (c, d) in zip(knots, knots[1:]):
        if value <= c:
            return b + (value - a) / (c - a) * (d - b)
    return knots[-1][1] + value - knots[-1][0]


def reshape_existing(source_objects, settings):
    """A deliberate proportional-edit pass over existing topology, no regeneration."""
    knots = settings["heightLandmarks"]
    for obj in source_objects:
        if obj.type != "MESH":
            continue
        if obj.get("TANGER_proportion_pass") == settings["revision"]:
            raise ValueError("Proportion revision already applied")
        for vertex in obj.data.vertices:
            old = vertex.co.z
            vertex.co.z = map_coordinate(old, knots)
            if old >= settings["headStart"]:
                vertex.co.x *= settings["headWidthScale"]
                vertex.co.y *= settings["headDepthScale"]
            else:
                vertex.co.x *= settings["bodyWidthScale"]
        obj.data.update()
        obj["TANGER_proportion_pass"] = settings["revision"]
        obj["TANGER_artist_passes"] = obj.get("TANGER_artist_passes", 0) + 1


def anatomy_cage(collection, height, proportions=None):
    """Editable torso cage with ribcage, clavicle and pelvic landmarks.

    The cage has shaped polygonal sections (not circular tubes), distinct front,
    side and back planes, and subdivision. Limb/hand construction is separate.
    Artist shaping and a body review are still required before approval.
    """
    p = {**DEFAULT_PROPORTIONS, **(proportions or {})}
    pelvis = height * p["legProportion"]
    sections = [
        (pelvis - 0.06, p["pelvisWidth"], 0.13),
        (pelvis + 0.04, p["pelvisWidth"], 0.16),
        (pelvis + 0.16, p["waistWidth"], 0.12),
        (pelvis + 0.30, p["ribcageWidth"], 0.17),
        (pelvis + p["torsoLength"] - 0.07, p["ribcageWidth"] * 1.06, 0.16),
        (pelvis + p["torsoLength"], p["shoulderWidth"], 0.12),
    ]
    profile = [
        (-0.34, -0.5),
        (0.34, -0.5),
        (0.5, -0.30),
        (0.5, 0.24),
        (0.34, 0.5),
        (-0.34, 0.5),
        (-0.5, 0.24),
        (-0.5, -0.30),
    ]
    vertices = [
        (x * width, y * depth, z) for z, width, depth in sections for x, y in profile
    ]
    faces = [
        (i + j * 8, (i + 1) % 8 + j * 8, (i + 1) % 8 + (j + 1) * 8, i + (j + 1) * 8)
        for j in range(len(sections) - 1)
        for i in range(8)
    ]
    faces.extend(
        [
            tuple(range(7, -1, -1)),
            tuple(range((len(sections) - 1) * 8, len(sections) * 8)),
        ]
    )
    mesh = bpy.data.meshes.new("Anatomy construction cage")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Body anatomy / sculpt starting cage", mesh)
    collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj["TANGER_initialization_only"] = True
    obj["TANGER_artist_passes"] = 0
    for name, center in {
        "pelvis": (0, 0, pelvis),
        "ribcage": (0, 0, pelvis + 0.31),
        "clavicle": (0, -0.05, pelvis + p["torsoLength"] - 0.035),
        "shoulder-cap.L": (0.19, 0, pelvis + p["torsoLength"]),
        "shoulder-cap.R": (-0.19, 0, pelvis + p["torsoLength"]),
    }.items():
        marker = bpy.data.objects.new("Anatomy landmark / " + name, None)
        collection.objects.link(marker)
        marker.location = Vector(center)
    subdivision(obj, 2)
    return obj
