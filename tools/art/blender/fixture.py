"""Technical fixture for skin/morph/NLA export. This is not character art."""
import json
import pathlib
import sys
import bpy
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import ROOT, export_glb

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
collection = bpy.data.collections.new("EXPORT")
bpy.context.scene.collection.children.link(collection)
vertices = []
for z in (0, 0.45, 0.9, 1.35, 1.8):
    vertices.extend([(-0.3, -0.16, z), (0.3, -0.16, z), (0.3, 0.16, z), (-0.3, 0.16, z)])
faces = [(3, 2, 1, 0), (16, 17, 18, 19)]
for level in range(4):
    for edge in range(4):
        a, b = level * 4 + edge, level * 4 + (edge + 1) % 4
        faces.append((a, b, b + 4, a + 4))
mesh = bpy.data.meshes.new("SkinMorphTest")
mesh.from_pydata(vertices, [], faces)
mesh.update()
obj = bpy.data.objects.new("TechnicalFixture", mesh)
collection.objects.link(obj)
uv = mesh.uv_layers.new(name="UVMap")
for loop in mesh.loops:
    coord = mesh.vertices[loop.vertex_index].co
    uv.data[loop.index].uv = ((coord.x + 0.3) / 0.6, coord.z / 1.8)
material = bpy.data.materials.new("Fixture")
material.use_nodes = True
material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.12, 0.42, 0.55, 1)
material.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = 0.65
image = bpy.data.images.new("OriginalUVTest", width=64, height=64, alpha=True)
pixels = []
for y in range(64):
    for x in range(64):
        color = (0.12, 0.42, 0.55, 1) if (x // 16 + y // 16) % 2 else (0.65, 0.27, 0.12, 1)
        pixels.extend(color)
image.pixels = pixels
image.file_format = "PNG"
image.pack()
texture = material.node_tree.nodes.new("ShaderNodeTexImage")
texture.image = image
material.node_tree.links.new(texture.outputs["Color"], material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
obj.data.materials.append(material)
obj.shape_key_add(name="Basis")
shape = obj.shape_key_add(name="test-squash")
for point in shape.data:
    if point.co.z > 1.3:
        point.co.x *= 0.55
        point.co.z -= 0.2
armature = bpy.data.armatures.new("TestRig")
rig = bpy.data.objects.new("Rig", armature)
collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
root = armature.edit_bones.new("root")
root.head, root.tail = (0, 0, 0), (0, 0, 0.9)
bend = armature.edit_bones.new("bend")
bend.head, bend.tail, bend.parent, bend.use_connect = (0, 0, 0.9), (0, 0, 1.8), root, True
bpy.ops.object.mode_set(mode="OBJECT")
modifier = obj.modifiers.new("Skin", "ARMATURE")
modifier.object = rig
groups = {name: obj.vertex_groups.new(name=name) for name in ("root", "bend")}
for index, vertex in enumerate(mesh.vertices):
    weight = min(1, max(0, (vertex.co.z - 0.65) / 0.5))
    if weight < 1:
        groups["root"].add([index], 1 - weight, "REPLACE")
    if weight > 0:
        groups["bend"].add([index], weight, "REPLACE")
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, 31
bone = rig.pose.bones["bend"]
bone.rotation_mode = "XYZ"
for clip, peak in (("idle", 0.05), ("test-bend", 0.8)):
    rig.animation_data_create()
    rig.animation_data.action = None
    for frame, angle in ((1, 0), (16, peak), (31, 0)):
        bone.rotation_euler.z = angle
        bone.keyframe_insert(data_path="rotation_euler", frame=frame)
    action = rig.animation_data.action
    action.name = clip
    track = rig.animation_data.nla_tracks.new()
    track.name = clip
    track.strips.new(clip, 1, action)
    rig.animation_data.action = None
    track.mute = True
for track in rig.animation_data.nla_tracks:
    track.mute = False
bone.rotation_euler.z = 0
scene.frame_set(1)
directory = ROOT / "art/.build/fixture"
directory.mkdir(parents=True, exist_ok=True)
manifest = {
    "schemaVersion": 1, "id": "pipeline-fixture", "kind": "technical-fixture", "stage": "rigged",
    "brief": "art/.build/fixture/brief.md", "source": "art/.build/fixture/fixture.blend",
    "export": "art/.build/fixture/fixture.glb", "exportCollection": "EXPORT",
    "coordinates": "gltf-meters-y-up", "heightMeters": 1.8, "shading": "anime-toon",
    "materialRoles": {"test": "Fixture"},
    "rig": {"requiredJoints": ["root", "bend"], "clips": {"idle": "idle", "test": "test-bend"}, "expressions": ["test-squash"], "rootMotion": "in-place"},
    "deliveryBudgets": {"triangles": 1000, "materials": 4, "joints": 8, "textureEdge": 4096, "fileMiB": 5},
    "provenance": [{"id": "test-geometry", "kind": "original", "description": "Skin and morph export fixture, not a character reference.", "creator": "TANGER", "license": "Project test code", "files": ["tools/art/blender/fixture.py"]}],
    "review": {"evidence": [], "notes": "art/.build/fixture/review.md", "verdict": "pending", "reviewer": ""},
}
(directory / "character.json").write_text(json.dumps(manifest, indent=2) + "\n")
(directory / "brief.md").write_text("# Technical fixture\n\nExport test only. Do not use as character art.\n")
bpy.ops.wm.save_as_mainfile(filepath=str(directory / "fixture.blend"), compress=False)
export_glb(manifest)
