"""Small brush and mesh actions on existing topology, in artist coordinates."""

import math
import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector, Matrix
from authoring.editing import relax

BRUSHES = {
    "grab",
    "smooth",
    "relax",
    "clay",
    "clay_strips",
    "inflate",
    "crease",
    "flatten",
    "scrape",
    "pinch",
}


def falloff(distance, kind="smooth"):
    t = max(0, min(1, 1 - distance))
    if kind == "constant":
        return float(distance < 1)
    if kind == "linear":
        return t
    if kind == "sharp":
        return t * t
    if kind == "smooth":
        return t * t * (3 - 2 * t)
    raise ValueError("Unknown falloff")


def basis(obj, args, camera):
    space = args.get("space", "world")
    if space in ["world", "symmetry"]:
        return Matrix.Identity(3)
    if space == "object":
        return obj.matrix_world.to_3x3()
    if space == "camera":
        return camera.matrix_world.to_3x3()
    if space == "bone":
        rig = bpy.data.objects.get(args.get("rig", ""))
        bone = (
            rig.pose.bones.get(args.get("bone", ""))
            if rig and rig.type == "ARMATURE"
            else None
        )
        if not bone:
            raise ValueError("Bone coordinates need an existing rig and bone")
        return (rig.matrix_world @ bone.matrix).to_3x3()
    if space == "surface":
        values = args.get("_values", {})
        normal = sum(
            (obj.data.vertices[i].normal * w for i, w in values.items()), Vector()
        ).normalized()
        normal = (
            obj.matrix_world.to_3x3().inverted().transposed() @ normal
        ).normalized()
        up = Vector((0, 0, 1))
        tangent = up.cross(normal).normalized()
        if tangent.length < 0.1:
            tangent = Vector((1, 0, 0))
        return Matrix((tangent, normal.cross(tangent), normal)).transposed()
    raise ValueError("Unsupported coordinate space: " + space)


def weighted(regions, args, camera):
    selection = regions.masked()
    result = {}
    if (
        args.get("symmetry", False)
        and regions.selected_name
        and regions.selected_name.endswith((".L", ".R"))
    ):
        mirrored_name = regions.selected_name[:-1] + (
            "R" if regions.selected_name.endswith(".L") else "L"
        )
        if mirrored_name in regions.bindings:
            for obj, values in regions.resolve(mirrored_name).items():
                dest = selection.setdefault(obj, {})
                for i, w in values.items():
                    dest[i] = max(w, dest.get(i, 0))
    center = args.get("center")
    radius = args.get("radius")
    if radius is not None and radius <= 0:
        raise ValueError("Brush radius must be positive")
    for obj, values in selection.items():
        chosen = {}
        for index, weight in values.items():
            vertex = obj.data.vertices[index]
            world = obj.matrix_world @ vertex.co
            if center is not None and radius is not None:
                origin = Vector(center)
                if args.get("space") == "object":
                    origin = obj.matrix_world @ origin
                distance = (world - origin).length
                if args.get("symmetry", False):
                    mirrored = Vector((-origin.x, origin.y, origin.z))
                    distance = min(distance, (world - mirrored).length)
                weight *= falloff(distance / radius, args.get("falloff", "smooth"))
            if args.get("frontFaceOnly", False):
                normal = (
                    obj.matrix_world.to_3x3().inverted().transposed() @ vertex.normal
                ).normalized()
                if normal.dot(camera.location - world) <= 0:
                    continue
            if weight > 1e-6:
                chosen[index] = weight
        result[obj] = chosen
    return result


def screen_grab(regions, args, camera):
    scene = bpy.context.scene
    width = scene.render.resolution_x
    height = scene.render.resolution_y
    point = Vector(args["point"])
    delta = Vector(args["delta"])
    radius = args["radius"]
    if radius <= 0:
        raise ValueError("Pixel radius must be positive")
    depth_behavior = args.get("depthBehavior", "visible")
    if depth_behavior not in ["visible", "front_surface", "all"]:
        raise ValueError("Invalid depth behavior")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    affected = 0
    for obj, values in regions.masked().items():
        inverse = obj.matrix_world.inverted().to_3x3()
        for index, weight in values.items():
            vertex = obj.data.vertices[index]
            world = obj.matrix_world @ vertex.co
            projected = world_to_camera_view(scene, camera, world)
            if projected.z <= 0:
                continue
            pixel = Vector((projected.x * width, (1 - projected.y) * height))
            distance = (pixel - point).length / radius
            if distance >= 1:
                continue
            if depth_behavior != "all":
                direction = (world - camera.location).normalized()
                hit, location, _, _, _, _ = scene.ray_cast(
                    depsgraph, camera.location, direction
                )
                if (
                    hit
                    and (location - camera.location).length + 0.006
                    < (world - camera.location).length
                ):
                    continue
                normal = (
                    obj.matrix_world.to_3x3().inverted().transposed() @ vertex.normal
                ).normalized()
                if (
                    args.get("frontFaceOnly", True)
                    and normal.dot(camera.location - world) < 0
                ):
                    continue
            scale = 2 * projected.z * math.tan(camera.data.angle_y / 2) / height
            world_delta = camera.matrix_world.to_3x3() @ Vector(
                (delta.x * scale, -delta.y * scale, 0)
            )
            vertex.co += (
                inverse
                @ world_delta
                * weight
                * falloff(distance, args.get("falloff", "smooth"))
            )
            affected += 1
        obj.data.update()
    return affected


def brush(regions, kind, args, camera):
    if kind not in BRUSHES:
        raise ValueError("Unknown brush")
    weights = weighted(regions, args, camera)
    strength = args.get("strength", 1)
    iterations = args.get("iterations", 1)
    if not 1 <= iterations <= 100:
        raise ValueError("Iterations must be 1..100 per stroke")
    count = sum(len(x) for x in weights.values())
    for obj, values in weights.items():
        if kind in ["smooth", "relax"]:
            relax(obj, values, iterations, min(1, abs(strength)))
            continue
        center = sum(
            (obj.data.vertices[i].co * w for i, w in values.items()), Vector()
        ) / max(1e-12, sum(values.values()))
        avg_normal = sum(
            (obj.data.vertices[i].normal * w for i, w in values.items()), Vector()
        ).normalized()
        local_basis = basis(obj, {**args, "_values": values}, camera)
        inverse = obj.matrix_world.to_3x3().inverted()
        delta = inverse @ (local_basis @ Vector(args.get("displacement", [0, 0, 0])))
        direction = (
            inverse @ (local_basis @ Vector(args["direction"]))
            if "direction" in args
            else None
        )
        amount = args.get("amount", 0.001)
        for _ in range(iterations):
            for i, weight in values.items():
                vertex = obj.data.vertices[i]
                normal = (direction or vertex.normal).normalized()
                w = weight * strength
                if kind == "grab":
                    change = delta.copy()
                    if (
                        args.get("symmetry", False)
                        and regions.selected_name
                        and regions.selected_name.endswith((".L", ".R"))
                    ):
                        side_sign = 1 if regions.selected_name.endswith(".L") else -1
                        if (obj.matrix_world @ vertex.co).x * side_sign < 0:
                            mirrored_world = obj.matrix_world.to_3x3() @ change
                            mirrored_world.x *= -1
                            change = inverse @ mirrored_world
                elif kind in ["inflate", "clay"]:
                    change = normal * amount
                elif kind == "clay_strips":
                    projection = (vertex.co - center).dot(avg_normal)
                    change = avg_normal * (amount - projection)
                elif kind in ["flatten", "scrape"]:
                    projection = (vertex.co - center).dot(avg_normal)
                    change = -avg_normal * (
                        max(0, projection) if kind == "scrape" else projection
                    )
                elif kind == "pinch":
                    toward = center - vertex.co
                    change = (
                        (toward - avg_normal * toward.dot(avg_normal))
                        * amount
                        / max(args.get("radius", 0.02), 1e-6)
                    )
                else:
                    toward = center - vertex.co
                    change = (
                        toward - avg_normal * toward.dot(avg_normal)
                    ) * amount / max(
                        args.get("radius", 0.02), 1e-6
                    ) - avg_normal * amount
                vertex.co += change * w
            obj.data.update()
    return count


def mesh_edit(regions, kind, args, camera):
    values = weighted(regions, args, camera)
    if kind in ["move", "proportional_move"]:
        return brush(regions, "grab", args, camera)
    if kind in ["smooth", "relax"]:
        return brush(regions, "smooth", args, camera)
    count = sum(len(x) for x in values.values())
    for obj, selection in values.items():
        center = sum(
            (obj.data.vertices[i].co * w for i, w in selection.items()), Vector()
        ) / max(1e-12, sum(selection.values()))
        if kind in ["scale", "rotate"]:
            matrix = (
                Matrix.Diagonal(Vector(args.get("scale", [1, 1, 1])))
                if kind == "scale"
                else Matrix.Rotation(args["angle"], 3, args.get("axis", "Z"))
            )
            for i, w in selection.items():
                v = obj.data.vertices[i]
                target = center + matrix @ (v.co - center)
                v.co = v.co.lerp(target, w)
        elif kind in ["subdivide", "insert_loop", "merge", "delete_loop", "split"]:
            if obj.data.shape_keys:
                raise ValueError(
                    "Topology changes require transferring shape keys first"
                )
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bm.verts.ensure_lookup_table()
            chosen = {bm.verts[i] for i in selection}
            edges = [e for e in bm.edges if set(e.verts) <= chosen]
            if kind in ["subdivide", "insert_loop"]:
                bmesh.ops.subdivide_edges(
                    bm, edges=edges, cuts=args.get("cuts", 1), use_grid_fill=True
                )
            elif kind == "merge":
                bmesh.ops.remove_doubles(
                    bm, verts=list(chosen), dist=args.get("distance", 0.0001)
                )
            elif kind == "delete_loop":
                bmesh.ops.dissolve_edges(bm, edges=edges, use_verts=True)
            else:
                bmesh.ops.split_edges(bm, edges=edges)
            bm.to_mesh(obj.data)
            bm.free()
        elif kind == "edge_slide":
            direction = Vector(args.get("direction", [0, 0, 1])).normalized()
            neighbors = {i: [] for i in selection}
            for edge in obj.data.edges:
                a, b = edge.vertices
                if a in neighbors:
                    neighbors[a].append(b)
                if b in neighbors:
                    neighbors[b].append(a)
            targets = {}
            for i, adjacent in neighbors.items():
                if adjacent:
                    v = obj.data.vertices[i].co
                    neighbor = max(
                        adjacent,
                        key=lambda j: (obj.data.vertices[j].co - v)
                        .normalized()
                        .dot(direction),
                    )
                    targets[i] = v.lerp(
                        obj.data.vertices[neighbor].co,
                        args.get("factor", 0.1) * selection[i],
                    )
            for i, target in targets.items():
                obj.data.vertices[i].co = target
        elif kind in ["snap_to_surface", "shrinkwrap", "reproject"]:
            target = bpy.data.objects.get(args["target"])
            if not target or target.type != "MESH":
                raise ValueError("Projection requires a named mesh target")
            inverse = target.matrix_world.inverted()
            evaluated = target.evaluated_get(bpy.context.evaluated_depsgraph_get())
            for i, w in selection.items():
                v = obj.data.vertices[i]
                point = inverse @ (obj.matrix_world @ v.co)
                hit, location, normal, _ = evaluated.closest_point_on_mesh(point)
                if hit:
                    v.co = v.co.lerp(
                        obj.matrix_world.inverted()
                        @ (
                            target.matrix_world
                            @ (location + normal * args.get("offset", 0))
                        ),
                        w,
                    )
        elif kind in ["subdivision", "multires"]:
            modifier = obj.modifiers.new(
                "Artist " + kind, "SUBSURF" if kind == "subdivision" else "MULTIRES"
            )
            if kind == "subdivision":
                modifier.levels = modifier.render_levels = args.get("levels", 2)
            else:
                bpy.context.view_layer.objects.active = obj
                for _ in range(args.get("levels", 2)):
                    bpy.ops.object.multires_subdivide(
                        modifier=modifier.name, mode="CATMULL_CLARK"
                    )
        elif kind == "voxel_remesh":
            # Whole selected object only: a local face mask must never remesh its head.
            if len(selection) != len(obj.data.vertices):
                raise ValueError("Voxel remesh requires the entire isolated component")
            if obj.data.shape_keys:
                raise ValueError("Preserve/transfer shape keys before remeshing")
            bpy.context.view_layer.objects.active = obj
            obj.data.remesh_voxel_size = args["voxelSize"]
            bpy.ops.object.voxel_remesh()
        else:
            raise ValueError("Unknown mesh operation: " + kind)
        obj.data.update()
    # Index-based selections must be re-resolved after a topology operation.
    if kind in [
        "subdivide",
        "insert_loop",
        "merge",
        "delete_loop",
        "split",
        "voxel_remesh",
    ]:
        regions.select(regions.selected_name)
    return count


def hair_edit(regions, args):
    """Deform one existing lock in longitudinal coordinates, preserving its cage."""
    count = 0
    for obj, values in regions.selection.items():
        points = [v.co.copy() for v in obj.data.vertices]
        root = Vector(args.get("root", max(points, key=lambda p: p.z)))
        tip = Vector(args.get("tip", min(points, key=lambda p: p.z)))
        axis = tip - root
        length2 = max(1e-12, axis.length_squared)
        direction = axis.normalized()
        side = direction.cross(
            Vector(args.get("normalOrientation", [0, -1, 0]))
        ).normalized()
        if side.length < 0.1:
            side = direction.cross(Vector((1, 0, 0))).normalized()
        up = side.cross(direction).normalized()
        for i, weight in values.items():
            v = obj.data.vertices[i]
            t = max(0, min(1, (v.co - root).dot(axis) / length2))
            on_axis = root + axis * t
            lateral = v.co - on_axis
            lateral = side * lateral.dot(side) * args.get(
                "width", 1
            ) + up * lateral.dot(up) * args.get("depth", 1)
            if "crossSection" in args:
                profiles = {"ribbon": 0.35, "oval": 0.65, "round": 1}
                if args["crossSection"] not in profiles:
                    raise ValueError("Cross-section must be ribbon, oval or round")
                lateral = (
                    side * lateral.dot(side)
                    + up * lateral.dot(up) * profiles[args["crossSection"]]
                )
            if "taper" in args:
                lateral *= max(0.02, (1 - t) ** args["taper"])
            if "twist" in args:
                lateral = Matrix.Rotation(args["twist"] * t, 3, direction) @ lateral
            target = on_axis + lateral
            target += Vector(args.get("rootDelta", [0, 0, 0])) * (1 - t)
            target += Vector(args.get("tipDelta", [0, 0, 0])) * t
            target += Vector(args.get("curvature", [0, 0, 0])) * math.sin(math.pi * t)
            v.co = v.co.lerp(target, weight)
            count += 1
        for key in [
            "root",
            "tip",
            "direction",
            "curvature",
            "twist",
            "width",
            "depth",
            "taper",
            "overlap",
            "layer",
            "importance",
            "crossSection",
        ]:
            if key in args:
                obj["hair." + key] = args[key]
        obj.data.update()
    return count
