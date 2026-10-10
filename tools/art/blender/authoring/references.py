import bpy
from .context import path


def import_references(state):
    collection = bpy.data.collections.get("REFERENCES") or bpy.data.collections.new(
        "REFERENCES"
    )
    if not collection.users:
        bpy.context.scene.collection.children.link(collection)
    positions = {
        "face": (-0.5, 0, 1.6),
        "hair": (0.5, 0, 1.6),
        "outfit": (0.7, 0, 1),
        "color": (-0.7, 0, 1),
        "concept": (1.2, 0, 1),
        "turnaround": (-1.2, 0, 1),
    }
    for reference in state["references"]:
        name = "Reference / " + reference["role"] + " / " + path(reference["path"]).name
        if bpy.data.objects.get(name):
            continue
        image = bpy.data.images.load(str(path(reference["path"])), check_existing=True)
        obj = bpy.data.objects.new(name, None)
        collection.objects.link(obj)
        obj.empty_display_type = "IMAGE"
        obj.data = image
        obj.location = positions[reference["role"]]
        obj.rotation_euler = (1.570796, 0, 0)
        obj.empty_display_size = (
            0.5 if reference["role"] in {"face", "hair", "color"} else 1.8
        )
        obj.hide_render = True
        obj["provenance"] = reference["provenance"]
        obj["geometrically_consistent"] = False
