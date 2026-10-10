"""Source renders: full body, face, morphs and selected animation poses."""
import json
import math
import os
import pathlib
import sys
import bpy
from mathutils import Vector
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import ROOT, arguments, export_objects, load_character

manifest = load_character()
objects = export_objects(manifest)
for obj in bpy.context.scene.objects:
    obj.hide_render = obj not in objects
scene = bpy.context.scene
engine = arguments()[1] if len(arguments()) > 1 else "cycles"
if engine not in {"cycles", "eevee"}:
    raise ValueError("Render engine must be cycles or eevee")
scene.render.engine = "CYCLES" if engine == "cycles" else "BLENDER_EEVEE_NEXT"
scene.cycles.samples = int(os.environ.get("TANGER_RENDER_SAMPLES", "48"))
scene.cycles.use_denoising = True
if engine == "cycles" and os.environ.get("TANGER_RENDER_DEVICE", "AUTO") != "CPU":
    preferences = bpy.context.preferences.addons["cycles"].preferences
    supported = {item[0] for item in preferences.get_device_types(bpy.context)}
    for device_type in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
        if device_type not in supported:
            continue
        preferences.compute_device_type = device_type
        preferences.get_devices()
        if any(device.type != "CPU" for device in preferences.devices):
            for device in preferences.devices:
                device.use = device.type != "CPU"
            scene.cycles.device = "GPU"
            break
scene.render.resolution_x = scene.render.resolution_y = int(os.environ.get("TANGER_RENDER_SIZE", "1536"))
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("ReviewWorld")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.16, 0.18, 0.22, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.5
scene.world = world
height = manifest["heightMeters"]
camera_data = bpy.data.cameras.new("ReviewCamera")
camera = bpy.data.objects.new("ReviewCamera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = "ORTHO"
camera_data.clip_start, camera_data.clip_end = 0.01, 1000
for name, location, energy, color, size in (
    ("Key", (-3, -4, 5), 800, (1, 0.94, 0.88), 4),
    ("Fill", (4, -2, 3), 450, (0.75, 0.86, 1), 3),
    ("Rim", (1, 3, 4), 950, (0.85, 0.95, 1), 3),
):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.color, data.shape, data.size = energy, color, "DISK", size
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (Vector((0, 0, height * 0.6)) - light.location).to_track_quat("-Z", "Y").to_euler()
output = ROOT / f'art/.build/renders/{manifest["id"]}'
output.mkdir(parents=True, exist_ok=True)
records = []


def render(name, angle=0, face=False):
    target = Vector((0, 0, height * (0.91 if face else 0.5)))
    distance = height * 3
    camera.location = target + Vector((math.sin(angle) * distance, -math.cos(angle) * distance, 0))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.ortho_scale = height * (0.32 if face else 1.2)
    scene.render.filepath = str(output / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    records.append({"image": f'art/.build/renders/{manifest["id"]}/{name}.png', "frame": scene.frame_current, "angle": angle, "face": face})


animated = [obj for obj in objects if obj.animation_data]
for obj in animated:
    obj.animation_data.action = None
    for track in obj.animation_data.nla_tracks:
        track.mute = True
for obj in objects:
    if obj.type == "ARMATURE":
        for bone in obj.pose.bones:
            bone.matrix_basis.identity()
    if obj.type == "MESH" and obj.data.shape_keys:
        for key in obj.data.shape_keys.key_blocks:
            key.value = 0
scene.frame_set(1)
for name, angle in (("front", 0), ("three-quarter", math.pi / 4), ("profile", math.pi / 2), ("back", math.pi)):
    render(name, angle)
render("face", face=True)
for expression in manifest["rig"]["expressions"]:
    keys = [obj.data.shape_keys.key_blocks.get(expression) for obj in objects if obj.type == "MESH" and obj.data.shape_keys]
    for key in keys:
        if key:
            key.value = 1
    render("expression-" + expression.replace("/", "-"), face=True)
    for key in keys:
        if key:
            key.value = 0
for semantic, clip in manifest["rig"]["clips"].items():
    tracks = [track for obj in animated for track in obj.animation_data.nla_tracks if track.name == clip]
    if not tracks:
        print(f"No NLA track for review pose: {clip}")
        continue
    for track in tracks:
        track.mute = False
    start = min(strip.frame_start for track in tracks for strip in track.strips)
    end = max(strip.frame_end for track in tracks for strip in track.strips)
    scene.frame_set(round(start + (end - start) * 0.5))
    render("pose-" + semantic.replace("/", "-"), math.pi / 4)
    for track in tracks:
        track.mute = True
scene.frame_set(1)
(output / "capture.json").write_text(json.dumps({"id": manifest["id"], "renderer": scene.render.engine, "viewTransform": scene.view_settings.view_transform, "resolution": scene.render.resolution_x, "images": records}, indent=2) + "\n")
print(f'Rendered source review images to art/.build/renders/{manifest["id"]}')
