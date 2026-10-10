"""Region-based edits, independent of mesh initializers and other body parts."""

import math
import bmesh
import bpy
from mathutils import Vector


def mask(obj, center, radius, axes=(1, 1, 1), group=None):
    center, axes = Vector(center), Vector(axes)
    values = {}
    vertex_group = obj.vertex_groups.get(group) if group else None
    for vertex in obj.data.vertices:
        delta = vertex.co - center
        distance = math.sqrt(
            sum((delta[i] / max(axes[i], 1e-6)) ** 2 for i in range(3))
        )
        weight = max(0, 1 - distance / radius)
        weight = weight * weight * (3 - 2 * weight)
        if group:
            try:
                weight *= vertex_group.weight(vertex.index) if vertex_group else 0
            except RuntimeError:
                weight = 0
        if weight:
            values[vertex.index] = weight
    return values


def move_vertices(obj, weights, delta):
    delta = Vector(delta)
    for index, weight in weights.items():
        obj.data.vertices[index].co += delta * weight
    obj.data.update()


def relax(obj, weights, iterations=1, factor=0.3, sharpen=False):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    for _ in range(iterations):
        changes = {}
        for index, weight in weights.items():
            vertex = bm.verts[index]
            neighbors = [edge.other_vert(vertex).co for edge in vertex.link_edges]
            if neighbors:
                average = sum(neighbors, Vector()) / len(neighbors)
                changes[index] = (
                    (average - vertex.co) * factor * weight * (-1 if sharpen else 1)
                )
        for index, delta in changes.items():
            bm.verts[index].co += delta
    bm.to_mesh(obj.data)
    bm.free()


def sculpt(obj, weights, amount, direction=None):
    """Local inflate/deflate/clay stroke over an explicit artist mask."""
    obj.data.update()
    for index, weight in weights.items():
        vertex = obj.data.vertices[index]
        vertex.co += (
            (Vector(direction) if direction else vertex.normal) * amount * weight
        )
    obj.data.update()


def subdivide_region(obj, indices, cuts=1):
    if obj.data.shape_keys:
        raise ValueError(
            "Topology changes need a pre-expression source checkpoint; shape keys are not discarded."
        )
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    edges = {
        edge
        for index in indices
        for edge in bm.verts[index].link_edges
        if all(v.index in indices for v in edge.verts)
    }
    bmesh.ops.subdivide_edges(bm, edges=list(edges), cuts=cuts, use_grid_fill=True)
    bm.to_mesh(obj.data)
    bm.free()


def crease(obj, edges, amount):
    attribute = obj.data.attributes.get("crease_edge") or obj.data.attributes.new(
        "crease_edge", "FLOAT", "EDGE"
    )
    for index in edges:
        attribute.data[index].value = amount


def slide_vertices(obj, indices, neighbor_indices, amount):
    for index, neighbor in zip(indices, neighbor_indices, strict=True):
        obj.data.vertices[index].co = obj.data.vertices[index].co.lerp(
            obj.data.vertices[neighbor].co, amount
        )
    obj.data.update()


def subdivision(obj, level):
    modifier = next(
        (m for m in obj.modifiers if m.type == "SUBSURF"), None
    ) or obj.modifiers.new("Source subdivision", "SUBSURF")
    modifier.levels = modifier.render_levels = level


def lattice(obj, resolution=(3, 3, 3)):
    data = bpy.data.lattices.new(obj.name + " sculpt lattice")
    data.points_u, data.points_v, data.points_w = resolution
    cage = bpy.data.objects.new(data.name, data)
    obj.users_collection[0].objects.link(cage)
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector(tuple(min(point[i] for point in corners) for i in range(3)))
    high = Vector(tuple(max(point[i] for point in corners) for i in range(3)))
    cage.location = (low + high) / 2
    cage.scale = high - low
    modifier = obj.modifiers.new("Source lattice", "LATTICE")
    modifier.object = cage
    return cage


def shape_key_edit(obj, name, weights, delta):
    if not obj.data.shape_keys:
        obj.shape_key_add(name="Basis")
    key = obj.data.shape_keys.key_blocks.get(name) or obj.shape_key_add(name=name)
    for index, weight in weights.items():
        key.data[index].co += Vector(delta) * weight


def edit_curve(obj, spline, point, co, handle_left=None, handle_right=None):
    control = obj.data.splines[spline].bezier_points[point]
    control.co = co
    if handle_left is not None:
        control.handle_left = handle_left
    if handle_right is not None:
        control.handle_right = handle_right


def apply_operation(operation):
    obj = bpy.data.objects[operation["object"]]
    kind = operation["type"]
    if kind == "subdivision":
        subdivision(obj, operation["level"])
        return
    if kind == "curve":
        edit_curve(
            obj,
            operation["spline"],
            operation["point"],
            operation["co"],
            operation.get("handleLeft"),
            operation.get("handleRight"),
        )
        return
    if kind == "crease":
        crease(obj, operation["edges"], operation["amount"])
        return
    if kind == "slide":
        slide_vertices(
            obj, operation["vertices"], operation["neighbors"], operation["amount"]
        )
        return
    if kind == "lattice":
        cage = lattice(obj, tuple(operation.get("resolution", [3, 3, 3])))
        for index, delta in operation.get("points", {}).items():
            cage.data.points[int(index)].co_deform += Vector(delta)
        return
    weights = (
        {int(key): value for key, value in operation["weights"].items()}
        if "weights" in operation
        else mask(
            obj,
            operation["center"],
            operation["radius"],
            operation.get("axes", [1, 1, 1]),
            operation.get("group"),
        )
    )
    if kind == "move":
        move_vertices(obj, weights, operation["delta"])
    elif kind in {"relax", "smooth", "sharpen"}:
        relax(
            obj,
            weights,
            operation.get("iterations", 1),
            operation.get("factor", 0.3),
            kind == "sharpen",
        )
    elif kind == "sculpt":
        sculpt(obj, weights, operation["amount"], operation.get("direction"))
    elif kind == "loop-insert":
        subdivide_region(obj, weights, operation.get("cuts", 1))
    elif kind == "shape-key":
        shape_key_edit(obj, operation["name"], weights, operation["delta"])
    else:
        raise ValueError(f"Unknown source edit: {kind}")
