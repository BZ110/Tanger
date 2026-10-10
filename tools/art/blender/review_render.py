import json
import os
import pathlib
import sys
import bpy

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import arguments
from authoring.context import load, objects, path
from authoring.privacy import sanitize_png
from authoring.materials.face_shadow import update_light
from authoring.render_review.scene import setup, frame, views, light_preset
from authoring.render_review.sheets import sheet
from authoring.render_review.outlines import build, update_depth
from authoring.rig.correctives import POSES, pose

workflow, output, pack = arguments()
state = load(workflow)
source = objects(state)
for obj in bpy.context.scene.objects:
    obj.hide_render = obj not in source
for obj in source:
    if obj.animation_data:
        obj.animation_data.action = None
        for track in obj.animation_data.nla_tracks:
            track.mute = True
    if obj.type == "MESH" and obj.data.shape_keys:
        for key in obj.data.shape_keys.key_blocks:
            key.value = 0
profile = json.loads(path(state["shaderProfile"]).read_text())
camera, lights = setup(int(os.environ.get("TANGER_REVIEW_SIZE", "1536")))
hulls = build(source, profile["outline"])
records = []
shots = views(state["framing"], pack)
rig = next((obj for obj in source if obj.type == "ARMATURE"), None)
if pack == "deformation":
    if not rig:
        raise ValueError(
            "Deformation review requires an approved source rig; no static-pose substitute"
        )
    shots = [
        (
            "deformation-" + name,
            [0, 0, state["framing"]["height"] / 2],
            state["framing"]["height"] * 1.1,
            0.45,
            0,
            "neutral",
        )
        for name in POSES
    ]
for name, center, span, angle, elevation, lighting in shots:
    if rig and name.startswith("deformation-"):
        pose(rig, POSES[name.removeprefix("deformation-")])
    frame(camera, center, span, angle, elevation)
    direction = light_preset(lights, lighting, state["framing"]["headCenter"])
    update_light(profile, direction)
    update_depth(hulls, camera)
    image = output + "/" + name + ".png"
    bpy.context.scene.render.filepath = str(path(image))
    bpy.ops.render.render(write_still=True)
    sanitize_png(path(image))
    records.append(
        {
            "path": image,
            "view": name,
            "lighting": lighting,
            "lensMm": camera.data.lens,
            "center": center,
            "span": span,
            "azimuth": angle,
            "elevation": elevation,
            "exposure": 0,
        }
    )
sheet([path(item["path"]) for item in records], path(output + "/contact-sheet.png"))
path(output + "/capture.json").write_text(
    json.dumps(
        {
            "schemaVersion": 1,
            "cameraVersion": "tanger-review-v2-85mm-vertical36",
            "pack": pack,
            "engine": "EEVEE",
            "images": records,
        },
        indent=2,
    )
    + "\n"
)
