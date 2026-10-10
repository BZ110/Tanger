"""Report authoring data; topology counts are diagnostics, not quality scores."""
import json
import pathlib
import sys
import bmesh
import bpy
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import ROOT, export_objects, load_character

manifest = load_character()
report = {"id": manifest["id"], "blender": bpy.app.version_string, "objects": []}
for obj in export_objects(manifest):
    entry = {"name": obj.name, "type": obj.type, "scale": list(obj.scale)}
    if obj.type == "MESH":
        mesh = obj.data
        mesh.calc_loop_triangles()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        groups = {group.index for group in obj.vertex_groups if any(group.name in modifier.object.data.bones for modifier in obj.modifiers if modifier.type == "ARMATURE" and modifier.object)}
        entry.update({
            "vertices": len(mesh.vertices), "trianglesBeforeModifiers": len(mesh.loop_triangles),
            "boundaryEdges": sum(edge.is_boundary for edge in bm.edges),
            "nonManifoldEdges": sum(not edge.is_manifold for edge in bm.edges),
            "uvMaps": [uv.name for uv in mesh.uv_layers],
            "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
            "morphs": [key.name for key in mesh.shape_keys.key_blocks] if mesh.shape_keys else [],
            "modifiers": [modifier.type for modifier in obj.modifiers],
            "verticesWithoutDeformWeights": sum(not any(group.group in groups and group.weight > 0 for group in vertex.groups) for vertex in mesh.vertices) if groups else None,
        })
        bm.free()
    elif obj.type == "ARMATURE":
        entry["bones"] = [bone.name for bone in obj.data.bones]
        entry["nlaTracks"] = [track.name for track in obj.animation_data.nla_tracks] if obj.animation_data else []
    report["objects"].append(entry)
output = ROOT / f'art/.build/reports/{manifest["id"]}/scene.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
