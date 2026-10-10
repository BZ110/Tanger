import json
import pathlib
import sys
import bpy

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import arguments
from authoring.context import load, objects, path, save
from authoring.editing import apply_operation
from authoring.body import reshape_existing
from authoring.face import refine_bebben
from authoring.eyes import rebuild
from authoring.materials.anime import apply
from authoring.hair import reshape
from authoring.clothing import fold_pass
from authoring.hands import unify_existing, shape_hand
from authoring.references import import_references

workflow, recipe_path = arguments()
state = load(workflow)
recipe = json.loads(path(recipe_path).read_text())
component = recipe["component"]
if component == "proportions":
    reshape_existing(objects(state), recipe["settings"])
elif component == "face":
    refine_bebben(objects(state), recipe["settings"])
elif component == "eyes":
    rebuild(
        objects(state), bpy.data.collections[state["collection"]], recipe["settings"]
    )
elif component == "materials":
    apply(json.loads(path(state["shaderProfile"]).read_text()), objects(state))
elif component == "hair":
    reshape(objects(state), recipe["settings"])
elif component == "clothing":
    for garment in recipe["settings"]["garments"]:
        fold_pass(bpy.data.objects[garment["name"]], garment["folds"])
elif component == "hands":
    for side in ("L", "R"):
        obj = unify_existing(
            objects(state), side, recipe["settings"].get("voxel", 0.0012)
        )
        shape_hand(obj, recipe["settings"]["strokes"][side])
elif component == "references":
    import_references(state)
elif component == "vertices":
    for operation in recipe["operations"]:
        apply_operation(operation)
else:
    raise ValueError("Unknown source subsystem: " + component)
bpy.context.scene["TANGER_visual_status"] = "changed; render and critique required"
save(state)
