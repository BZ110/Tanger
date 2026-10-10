"""Reusable eyes built around shaped lid silhouettes, with partial iris occlusion."""

import math
import bmesh
import bpy
from .editing import subdivision


def opening(t, center, width, upper, lower, canthus, sign):
    return (
        center[0] + sign * (t - 0.5) * width * 2,
        center[2]
        + canthus * t
        + (upper if upper is not None else -lower) * math.sin(math.pi * t) ** 0.8,
    )


def surface(collection, name, vertices, faces, material, uv):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    mesh.materials.append(material)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    layer = mesh.uv_layers.new(name="AuthoredUV")
    for loop in mesh.loops:
        layer.data[loop.index].uv = uv[loop.vertex_index]
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj["TANGER_initialization_only"] = True
    obj["TANGER_artist_passes"] = 0
    return obj


def rebuild(source_objects, collection, settings):
    face = next(obj for obj in source_objects if obj.name.startswith("Face —"))
    # Delete only the eye subsystem; body, clothing, hair and source checkpoints stay intact.
    for obj in list(source_objects):
        if any(
            obj.name.startswith(prefix)
            for prefix in (
                "Sclera.",
                "Brown iris.",
                "Eye catchlight",
                "Upper lid.",
                "Lower lid.",
                "Upper lash.",
                "Soft eyebrow.",
                "Cornea.",
            )
        ):
            bpy.data.objects.remove(obj, do_unlink=True)
    for sign, side in ((-1, "R"), (1, "L")):
        center = (sign * settings["centerX"], settings["surfaceY"], settings["centerZ"])
        width, up, down, tilt = (
            settings["halfWidth"],
            settings["upperHeight"],
            settings["lowerHeight"],
            settings["canthusRise"],
        )
        # Shape the actual aperture and adjacent facial loops; skin stays integrated.
        for vertex in face.data.vertices:
            if vertex.co.y > -0.025:
                continue
            dx = (vertex.co.x - center[0]) / settings["oldHalfWidth"]
            dz = (vertex.co.z - center[2]) / settings["oldHeight"]
            radius = max(0.01, math.sqrt(dx * dx + dz * dz))
            if 0.65 < radius < 2.25:
                angle = math.atan2(dz, dx * sign)
                t = (math.cos(angle) + 1) / 2
                target_x, target_z = opening(
                    t,
                    center,
                    width,
                    up if math.sin(angle) >= 0 else None,
                    down,
                    tilt,
                    sign,
                )
                strength = max(0, 1 - abs(radius - 1) / 1.25)
                vertex.co.x += (
                    target_x - (center[0] + dx / radius * settings["oldHalfWidth"])
                ) * strength
                vertex.co.z += (
                    target_z - (center[2] + dz / radius * settings["oldHeight"])
                ) * strength
                vertex.co.y = (1 - strength * 0.55) * vertex.co.y + strength * 0.55 * (
                    center[1] + 0.0005
                )
        face.data.update()
        count, rings = 64, 12

        def patch(name, iris=False):
            vertices = [center]
            uvs = [(0.5, 0.5)]
            faces = []
            for ring in range(1, rings + 1):
                r = ring / rings
                for i in range(count):
                    angle = i / count * math.tau
                    if iris:
                        x = center[0] + math.cos(angle) * settings["irisRadius"]
                        t = (sign * (x - center[0]) / width + 1) / 2
                        low = (
                            opening(t, center, width, None, down, tilt, sign)[1]
                            + 0.0003
                        )
                        high = (
                            opening(t, center, width, up, down, tilt, sign)[1] - 0.0003
                        )
                        z = max(
                            low,
                            min(
                                high,
                                center[2] + math.sin(angle) * settings["irisRadius"],
                            ),
                        )
                    else:
                        t = (math.cos(angle) + 1) / 2
                        x, z = opening(
                            t,
                            center,
                            width,
                            up if math.sin(angle) >= 0 else None,
                            down,
                            tilt,
                            sign,
                        )
                    x = center[0] + (x - center[0]) * r
                    z = center[2] + (z - center[2]) * r
                    y = center[1] + 0.0012 * (r * r) - (0.0014 if iris else 0.0001)
                    vertices.append((x, y, z))
                    uvs.append(
                        (
                            0.5 + (x - center[0]) / settings["irisRadius"] * 0.5,
                            0.5 + (z - center[2]) / settings["irisRadius"] * 0.5,
                        )
                        if iris
                        else (
                            0.5 + 0.5 * r * math.cos(angle),
                            0.5 + 0.5 * r * math.sin(angle),
                        )
                    )
            for i in range(count):
                faces.append((0, 1 + i, 1 + (i + 1) % count))
            for ring in range(rings - 1):
                a = 1 + ring * count
                b = a + count
                for i in range(count):
                    faces.append(
                        (a + i, a + (i + 1) % count, b + (i + 1) % count, b + i)
                    )
            return surface(
                collection,
                name,
                vertices,
                faces,
                bpy.data.materials["Iris" if iris else "Eyes"],
                uvs,
            )

        patch("Sclera." + side)
        patch("Brown iris." + side, True)
        # Upper lash is a shaped tapered ribbon, not a round dark tube.
        for upper in (True, False):
            vertices = []
            uv = []
            faces = []
            for i in range(49):
                t = i / 48
                x, z = opening(
                    t, center, width, up if upper else None, down, tilt, sign
                )
                thickness = (0.0014 if upper else 0.00045) * math.sin(
                    math.pi * t
                ) ** 0.5
                vertices.extend(
                    [
                        (x, center[1] - 0.002, z),
                        (
                            x,
                            center[1] - 0.0018,
                            z + (thickness if upper else -thickness),
                        ),
                    ]
                )
                uv.extend([(t, 0), (t, 1)])
            for i in range(48):
                faces.append((i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2))
            lash = surface(
                collection,
                ("Upper lash." if upper else "Lower lash.") + side,
                vertices,
                faces,
                bpy.data.materials["Ink"],
                uv,
            )
            lash["TANGER_eye_landmark"] = True
        vertices = []
        uv = []
        faces = []
        for i in range(33):
            t = i / 32
            x = center[0] + sign * (t - 0.5) * width * 1.9
            z = center[2] + 0.026 + tilt * t + 0.002 * math.sin(math.pi * t)
            vertices.extend(
                [
                    (x, center[1] + 0.004, z),
                    (x, center[1] + 0.004, z + 0.0025 * math.sin(math.pi * t) ** 0.6),
                ]
            )
            uv.extend([(t, 0), (t, 1)])
        for i in range(32):
            faces.append((i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2))
        surface(
            collection,
            "Soft eyebrow." + side,
            vertices,
            faces,
            bpy.data.materials["Hair"],
            uv,
        )
        # Flat authored catchlight shapes sit within the partly occluded iris.
        for number, (dx, dz, radius) in enumerate(
            ((-0.003, 0.004, 0.0022), (0.004, -0.002, 0.0008))
        ):
            vertices = [(center[0] + dx, center[1] - 0.0022, center[2] + dz)]
            for i in range(32):
                a = i / 32 * math.tau
                vertices.append(
                    (
                        center[0] + dx + radius * math.cos(a),
                        center[1] - 0.0022,
                        center[2] + dz + radius * math.sin(a),
                    )
                )
            surface(
                collection,
                f"Eye catchlight {number}.{side}",
                vertices,
                [(0, i + 1, (i + 1) % 32 + 1) for i in range(32)],
                bpy.data.materials["Eye-light"],
                [(0.5, 0.5)] * len(vertices),
            )
    face["TANGER_artist_passes"] = face.get("TANGER_artist_passes", 0) + 1


def lid_blink(obj, upper_group, lower_group, closed_points, name="blink"):
    """Authored lid vertices close to an explicit closure curve. Eyeballs unchanged."""
    if not obj.data.shape_keys:
        obj.shape_key_add(name="Basis")
    key = obj.shape_key_add(name=name)
    for group_name in (upper_group, lower_group):
        group = obj.vertex_groups.get(group_name)
        if not group:
            raise ValueError("Blink requires authored eyelid masks")
        for index, target in closed_points.items():
            try:
                weight = group.weight(int(index))
            except RuntimeError:
                continue
            key.data[int(index)].co = key.data[int(index)].co.lerp(target, weight)
    return key
