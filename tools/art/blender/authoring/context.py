import json
import pathlib
import bpy

ROOT = pathlib.Path(__file__).resolve().parents[4]


def path(value):
    target = (ROOT / value).resolve()
    if not target.is_relative_to(ROOT):
        raise ValueError("Asset path escapes repository")
    return target


def load(workflow):
    state = json.loads(path(workflow).read_text())
    bpy.ops.wm.open_mainfile(filepath=str(path(state["source"])))
    return state


def objects(state):
    collection = bpy.data.collections.get(state["collection"])
    if not collection:
        raise ValueError("Missing source collection. Run art:source:prepare.")
    return list(collection.all_objects)


def save(state):
    # Blender itself keeps an autosave, while the controller records checkpoints.
    bpy.context.scene.render.filepath = "//renders/"
    bpy.ops.wm.save_as_mainfile(filepath=str(path(state["source"])), compress=False)
    from .privacy import sanitize_blend

    sanitize_blend(path(state["source"]), ROOT)
