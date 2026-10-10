import bmesh
import bpy
from mathutils import Vector


def build(source_objects, settings):
    if not settings["enabled"]:
        return []
    ink = bpy.data.materials.new("TANGER source outline")
    ink.use_nodes = True
    ink.use_backface_culling = True
    tree = ink.node_tree
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    emission = tree.nodes.new("ShaderNodeEmission")
    emission.inputs[0].default_value = (*settings["color"], 1)
    tree.links.new(emission.outputs[0], output.inputs[0])
    result = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in source_objects:
        if obj.type != "MESH" or any(
            name.lower() in obj.name.lower() for name in settings["objectExclusions"]
        ):
            continue
        if any(
            slot.material and slot.material.name in settings["materialExclusions"]
            for slot in obj.material_slots
        ):
            continue
        data = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
        data.materials.clear()
        data.materials.append(ink)
        bm = bmesh.new()
        bm.from_mesh(data)
        bases = []
        directions = []
        bm.verts.ensure_lookup_table()
        for vertex in bm.verts:
            bases.append(tuple(vertex.co))
            directions.append(tuple(vertex.normal))
            # Artist normal sensitivity attenuates extrusion along highly curved rims.
            vertex.co += (
                vertex.normal
                * settings["width"]
                * (1 - settings["normalSensitivity"] * 0.35)
            )
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.to_mesh(data)
        bm.free()
        base = data.attributes.new("outline_base", "FLOAT_VECTOR", "POINT")
        direction = data.attributes.new("outline_direction", "FLOAT_VECTOR", "POINT")
        for index, (co, normal) in enumerate(zip(bases, directions)):
            base.data[index].vector = co
            direction.data[index].vector = normal
        hull = bpy.data.objects.new("Outline / " + obj.name, data)
        bpy.context.scene.collection.objects.link(hull)
        hull.matrix_world = obj.matrix_world
        hull["depthSensitivity"] = settings["depthSensitivity"]
        hull["width"] = settings["width"] * (1 - settings["normalSensitivity"] * 0.35)
        result.append(hull)
    return result


def update_depth(hulls, camera):
    for hull in hulls:
        factor = (
            1
            + min(3, (camera.location - hull.matrix_world.translation).length)
            * hull["depthSensitivity"]
            * 0.015
        )
        base = hull.data.attributes["outline_base"]
        direction = hull.data.attributes["outline_direction"]
        for vertex in hull.data.vertices:
            vertex.co = (
                base.data[vertex.index].vector
                + direction.data[vertex.index].vector * hull["width"] * factor
            )
        hull.data.update()
