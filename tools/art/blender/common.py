"""Shared paths and strict export-set selection. Run from the repository root."""
import json
import pathlib
import sys
import bpy

ROOT = pathlib.Path(__file__).resolve().parents[3]


def arguments():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def project_path(value):
    path = (ROOT / value).resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError("Asset path escapes the project")
    return path


def load_character():
    args = arguments()
    if not args:
        raise ValueError("Provide a character.json manifest")
    manifest = json.loads(project_path(args[0]).read_text())
    bpy.ops.wm.open_mainfile(filepath=str(project_path(manifest["source"])))
    return manifest


def export_objects(manifest):
    collection = bpy.data.collections.get(manifest["exportCollection"])
    if not collection:
        raise ValueError(f'Missing collection: {manifest["exportCollection"]}')
    objects = [obj for obj in collection.all_objects if obj.type in {"MESH", "ARMATURE", "EMPTY"}]
    if not any(obj.type == "MESH" for obj in objects):
        raise ValueError("Export collection has no mesh")
    for obj in objects:
        if obj.hide_get() or obj.hide_viewport:
            raise ValueError(f"Export object is hidden: {obj.name}")
    return objects


def export_glb(manifest):
    objects = export_objects(manifest)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(obj for obj in objects if obj.type == "MESH")
    output = project_path(manifest["export"])
    output.parent.mkdir(parents=True, exist_ok=True)
    result = bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", use_selection=True,
        export_yup=True, export_normals=True, export_texcoords=True,
        export_materials="EXPORT", export_skins=True, export_morph=True,
        export_animations=True, export_animation_mode="NLA_TRACKS",
        export_nla_strips_merged_animation_name="idle", export_force_sampling=True,
        export_cameras=False, export_lights=False, export_extras=True,
        export_apply=False,
    )
    if "FINISHED" not in result:
        raise RuntimeError("glTF exporter did not finish")
    print(f'Exported {manifest["export"]}')
