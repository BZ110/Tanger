import json
import pathlib
import sys
import bpy

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import arguments
from authoring.context import load, objects, path, save
from authoring.materials.anime import apply

state = load(arguments()[0])
if bpy.data.collections.get(state["collection"]):
    raise ValueError("Source already prepared; no repeated destructive conversion")
legacy = bpy.data.collections.get("EXPORT")
if not legacy:
    raise ValueError("Migration needs the existing EXPORT collection")
legacy.name = state["collection"]
archive = bpy.data.collections.new("ARCHIVE — old rig, not approved")
bpy.context.scene.collection.children.link(archive)
for obj in list(legacy.all_objects):
    if obj.type == "ARMATURE":
        legacy.objects.unlink(obj)
        archive.objects.link(obj)
        obj.hide_render = True
        obj.hide_set(True)
    elif obj.type == "MESH":
        if obj.data.shape_keys:
            obj.shape_key_clear()  # V1 eye flattening keys do not define the new neutral source.
        for modifier in list(obj.modifiers):
            if modifier.type == "ARMATURE":
                obj.modifiers.remove(modifier)
        obj.parent = None
        obj["TANGER_source_part"] = obj.name
basis = bpy.data.objects.new("FaceBasis", None)
legacy.objects.link(basis)
profile = json.loads(path(state["shaderProfile"]).read_text())
apply(profile, objects(state))
for image in bpy.data.images:
    if image.source == "FILE" and image.filepath:
        image.pack()
        image.filepath = "//textures/" + pathlib.Path(image.filepath).name
bpy.context.scene["TANGER_representation"] = (
    "artistic-source; no runtime polygon budget"
)
bpy.context.scene["TANGER_visual_status"] = "unreviewed"
save(state)
