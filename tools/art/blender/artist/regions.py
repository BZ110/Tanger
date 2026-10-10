"""Semantic selections over authored meshes. No generated replacement geometry."""

import fnmatch
import json
import bpy
from mathutils import Vector
from authoring.context import objects, path

# Bindings can be replaced per character; centers are authored landmarks, not a
# face generator. Groups remain editable in Blender's normal vertex-group UI.
FACE = {
    "cranium": ((0, 0.04, 1.75), 0.11),
    "forehead": ((0, -0.055, 1.73), 0.085),
    "nose_bridge": ((0, -0.09, 1.65), 0.031),
    "nose_tip": ((0, -0.095, 1.616), 0.023),
    "nose_alar": ((0, -0.09, 1.61), 0.027),
    "nose_base": ((0, -0.09, 1.607), 0.018),
    "upper_lip": ((0, -0.073, 1.583), 0.023),
    "lower_lip": ((0, -0.073, 1.579), 0.023),
    "chin": ((0, -0.056, 1.543), 0.035),
}
SIDED = {
    "brow": ((0.052, -0.075, 1.68), 0.035),
    "eye_socket": ((0.045, -0.075, 1.652), 0.040),
    "upper_lid": ((0.045, -0.075, 1.661), 0.031),
    "lower_lid": ((0.045, -0.075, 1.646), 0.028),
    "inner_canthus": ((0.016, -0.075, 1.652), 0.018),
    "outer_canthus": ((0.074, -0.070, 1.654), 0.019),
    "cheek": ((0.061, -0.055, 1.613), 0.041),
    "mouth_corner": ((0.025, -0.073, 1.582), 0.018),
    "jaw": ((0.067, -0.023, 1.568), 0.044),
}


def defaults(source):
    result = {}
    face = [o.name for o in source if o.type == "MESH" and o.name.startswith("Face —")]
    for key, (center, radius) in FACE.items():
        result["face." + key] = {
            "objects": face,
            "center": list(center),
            "radius": radius,
            "density": "high",
        }
    for side, sign in [("L", 1), ("R", -1)]:
        for key, (center, radius) in SIDED.items():
            center = [center[0] * sign, center[1], center[2]]
            names = list(face)
            if key in [
                "upper_lid",
                "lower_lid",
                "inner_canthus",
                "outer_canthus",
                "eye_socket",
            ]:
                prefixes = [
                    "Sclera.",
                    "Brown iris.",
                    "Upper lash.",
                    "Lower lash.",
                    "Eye catchlight",
                ]
                if key == "upper_lid":
                    prefixes = ["Upper lash."]
                if key == "lower_lid":
                    prefixes = ["Lower lash."]
                names += [
                    o.name
                    for o in source
                    if any(o.name.startswith(p) for p in prefixes)
                    and o.name.endswith("." + side)
                ]
            if key == "brow":
                names += [o.name for o in source if o.name == "Soft eyebrow." + side]
            result[f"face.{key}.{side}"] = {
                "objects": names,
                "center": center,
                "radius": radius,
                "density": "high",
            }
        result["ear." + side] = {
            "objects": [
                o.name
                for o in source
                if "ear" in o.name.lower() and o.name.endswith("." + side)
            ],
            "density": "high",
        }
        # Named whole-eye selection is useful for depth/slant/exposure corrections.
        result["eyes." + side] = {
            "objects": [
                o.name
                for o in source
                if any(
                    o.name.startswith(p)
                    for p in [
                        "Sclera.",
                        "Brown iris.",
                        "Upper lash.",
                        "Lower lash.",
                        "Eye catchlight",
                    ]
                )
                and o.name.endswith("." + side)
            ],
            "density": "high",
        }
    result["face.jaw"] = {"union": ["face.jaw.L", "face.jaw.R"], "density": "high"}
    for name, patterns in {
        "body.neck": ["*Neck*", "*neck*"],
        "body.ribcage": ["*Torso*", "*Body*"],
        "body.waist": ["*Torso*", "*Body*"],
        "body.pelvis": ["*Pelvis*", "*pelvis*"],
        "jacket.collar": ["Standing collar", "Collar binding"],
        "jacket.torso": ["*Jacket*", "*jacket*"],
        "jacket.sleeves": ["*Sleeve*", "*sleeve*"],
        "hair.mass": ["*hair*", "*Hair*", "*lock*", "*Lock*", "*Fringe*", "*fringe*"],
    }.items():
        result[name] = {
            "objects": [
                o.name
                for o in source
                if o.type in ["MESH", "CURVE"]
                and any(
                    fnmatch.fnmatchcase(o.name.lower(), p.lower()) for p in patterns
                )
            ],
            "density": "medium",
        }
    for side in ["L", "R"]:
        for key, patterns in {
            "clavicle": [],
            "shoulder": [],
            "upper_arm": [],
            "forearm": [],
            "hand": ["Palm.*", "Finger*", "Thumb*"],
            "thigh": [],
            "knee": [],
            "calf": [],
            "foot": [
                "Boot upper.*",
                "Rubber outsole.*",
                "Boot welt.*",
                "Boot collar.*",
            ],
        }.items():
            result[f"body.{key}.{side}"] = {
                "objects": [
                    o.name
                    for o in source
                    if o.name.endswith("." + side)
                    and any(fnmatch.fnmatchcase(o.name, p) for p in patterns)
                ],
                "density": "high" if key == "hand" else "medium",
                "covered": not bool(patterns),
            }
        result["jacket.sleeve." + side] = {
            "objects": ["Jacket sleeve." + side],
            "density": "medium",
        }
        result["trousers." + side] = {
            "objects": ["Cargo trousers — continuous crotch and waist topology"],
            "center": [0.085 * (1 if side == "L" else -1), 0, 0.7],
            "radius": 0.45,
            "density": "medium",
        }
        result["eyes.upper_lid." + side] = {
            "objects": ["Upper lash." + side],
            "density": "high",
        }
        result["eyes.lower_lid." + side] = {
            "objects": ["Lower lash." + side],
            "density": "high",
        }
    locks = [
        o
        for o in source
        if o.type == "MESH" and any(x in o.name.lower() for x in ["lock", "fringe"])
    ]
    for i, o in enumerate(sorted(locks, key=lambda x: x.name), 1):
        result[f"hair.fringe.{i:02d}"] = {
            "objects": [o.name],
            "density": "high",
            "importance": "secondary",
            "layer": o.get("hair_level", "unassigned"),
        }
        o["TANGER_semantic_region"] = f"hair.fringe.{i:02d}"
    for prefix, pattern in [
        ("crown", "Crown sweep*"),
        ("temple.L", "Temple / L*"),
        ("temple.R", "Temple / R*"),
        ("nape.L", "Nape / L*"),
        ("nape.R", "Nape / R*"),
    ]:
        for i, obj in enumerate(
            sorted(
                [o for o in source if fnmatch.fnmatchcase(o.name, pattern)],
                key=lambda o: o.name,
            ),
            1,
        ):
            result[f"hair.{prefix}.{i:02d}"] = {
                "objects": [obj.name],
                "density": "medium",
                "importance": "secondary",
                "layer": "unassigned",
            }
    result["hair.mass"]["objects"] = [
        o.name
        for o in source
        if o.type == "MESH"
        and any(m and m.name == "Hair" for m in o.data.materials)
        and not o.name.startswith("Soft eyebrow")
    ]
    return result


class Regions:
    def __init__(self, state):
        self.state = state
        filename = path(state["source"]).parent / "semantic-regions.json"
        self.bindings = (
            json.loads(filename.read_text())
            if filename.exists()
            else defaults(objects(state))
        )
        self.selection = {}
        self.selected_name = None
        self.masks = set()
        for name in self.bindings:
            for obj, weights in self.resolve(name).items():
                group = obj.vertex_groups.get(
                    "artist/" + name
                ) or obj.vertex_groups.new(name="artist/" + name)
                for index, weight in weights.items():
                    group.add([index], weight, "REPLACE")

    def catalog(self):
        return [
            {"region": name, **spec, "available": bool(self.resolve(name))}
            for name, spec in self.bindings.items()
        ]

    def resolve(self, name, stack=()):
        if name in stack:
            raise ValueError("Cyclic semantic region union")
        spec = self.bindings.get(name)
        if not spec:
            raise ValueError("Unknown semantic region: " + name)
        weights = {}
        for member in spec.get("union", []):
            for obj, values in self.resolve(member, (*stack, name)).items():
                dest = weights.setdefault(obj, {})
                for index, weight in values.items():
                    dest[index] = max(dest.get(index, 0), weight)
        for object_name in spec.get("objects", []):
            obj = bpy.data.objects.get(object_name)
            if not obj or obj.type != "MESH":
                continue
            if obj not in objects(self.state):
                raise ValueError("Region binds an object outside SOURCE")
            group = obj.vertex_groups.get(spec.get("group", "artist/" + name))
            values = {}
            for vertex in obj.data.vertices:
                if "group" in spec:
                    if not group:
                        raise ValueError(
                            "Missing authored vertex group " + spec["group"]
                        )
                    try:
                        weight = group.weight(vertex.index)
                    except RuntimeError:
                        weight = 0
                elif "center" in spec:
                    distance = (
                        obj.matrix_world @ vertex.co - Vector(spec["center"])
                    ).length / spec["radius"]
                    weight = (
                        max(0, 1 - distance) ** 2 * (3 - 2 * max(0, 1 - distance))
                        if distance < 1
                        else 0
                    )
                else:
                    weight = 1
                if weight > 1e-6:
                    values[vertex.index] = weight
            if values:
                weights.setdefault(obj, {}).update(values)
        return weights

    def select(self, name):
        self.selection = self.resolve(name)
        self.selected_name = name
        if not self.selection:
            raise ValueError(
                "Region has no bound vertices; author its binding first: " + name
            )
        for obj in objects(self.state):
            obj.select_set(obj in self.selection)
            if obj.type == "MESH":
                for v in obj.data.vertices:
                    v.select = v.index in self.selection.get(obj, {})
        bpy.context.view_layer.objects.active = next(iter(self.selection))
        return self.report()

    def report(self):
        bounds = [
            obj.matrix_world @ obj.data.vertices[i].co
            for obj, values in self.selection.items()
            for i in values
        ]
        return {
            "region": self.selected_name,
            "objects": [o.name for o in self.selection],
            "vertices": sum(len(x) for x in self.selection.values()),
            "center": list(sum(bounds, Vector()) / len(bounds)) if bounds else None,
        }

    def grow(self, amount=1, shrink=False):
        for obj, values in self.selection.items():
            neighbors = {v.index: set() for v in obj.data.vertices}
            for edge in obj.data.edges:
                a, b = edge.vertices
                neighbors[a].add(b)
                neighbors[b].add(a)
            selected = set(values)
            for _ in range(amount):
                selected = (
                    {i for i in selected if neighbors[i] <= selected}
                    if shrink
                    else selected | {j for i in selected for j in neighbors[i]}
                )
            self.selection[obj] = {i: values.get(i, 1) for i in selected}
        return self.report()

    def masked(self):
        exclusions = {}
        for name in self.masks:
            for obj, values in self.resolve(name).items():
                dest = exclusions.setdefault(obj, {})
                for index, weight in values.items():
                    dest[index] = max(weight, dest.get(index, 0))
        return {
            o: {i: w * (1 - exclusions.get(o, {}).get(i, 0)) for i, w in values.items()}
            for o, values in self.selection.items()
        }
