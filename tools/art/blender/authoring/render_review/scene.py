import math
import bpy
from mathutils import Vector

LIGHTS = {
    "front": ((0, -4, 3), 0.35),
    "quarter": ((-3, -4, 3), 0.35),
    "side": ((-4, 0, 2), 0.25),
    "opposite": ((4, 0, 2), 0.25),
    "neutral": ((-2, -5, 4), 0.65),
    "dramatic": ((-3, -2, 4), 0.15),
}


def setup(size=1536):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = 128
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = (
        "Medium High Contrast"
        if "Medium High Contrast"
        in [
            item.identifier
            for item in scene.view_settings.bl_rna.properties["look"].enum_items
        ]
        else "None"
    )
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("TANGER diagnostic world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (
        0.075,
        0.093,
        0.13,
        1,
    )
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
    scene.world = world
    camera_data = bpy.data.cameras.new("TANGER 85mm review camera")
    camera_data.lens = 85
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    camera_data.sensor_fit = "VERTICAL"
    camera_data.sensor_height = 36
    scene.camera = camera
    camera_data.clip_start, camera_data.clip_end = 0.01, 100
    lights = []
    for name, energy, size in (("Key", 650, 4), ("Fill", 200, 4), ("Rim", 350, 3)):
        data = bpy.data.lights.new("Review " + name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        obj = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(obj)
        lights.append(obj)
    lights[1].location = (3, -4, 2)
    lights[2].location = (1, 3, 4)
    return camera, lights


def light_preset(lights, preset, center):
    position, fill = LIGHTS[preset]
    lights[0].location = position
    lights[1].data.energy = fill * 650
    lights[2].data.energy = 420 if preset == "dramatic" else 180
    for light in lights:
        light.rotation_euler = (
            (Vector(center) - light.location).to_track_quat("-Z", "Y").to_euler()
        )
    return (lights[0].location - Vector(center)).normalized()


def frame(camera, center, span, azimuth=0, elevation=0):
    # Identical stored span/target/lens across iterations, independent of new bounds.
    center = Vector(center)
    distance = span / (2 * math.tan(camera.data.angle_y / 2)) * 1.16
    offset = (
        Vector(
            (
                math.sin(azimuth) * math.cos(elevation),
                -math.cos(azimuth) * math.cos(elevation),
                math.sin(elevation),
            )
        )
        * distance
    )
    camera.location = center + offset
    camera.rotation_euler = (-offset).to_track_quat("-Z", "Y").to_euler()


def views(framing, pack):
    result = []
    if pack in {"standard", "full"}:
        for name, angle in (
            ("front", 0),
            ("quarter-left", -math.pi / 4),
            ("quarter-right", math.pi / 4),
            ("side", math.pi / 2),
            ("back", math.pi),
        ):
            result.append(
                (
                    "full-" + name,
                    [0, 0, framing["height"] / 2],
                    framing["height"] * 1.07,
                    angle,
                    0,
                    "neutral",
                )
            )
    if pack in {"standard", "portrait", "presentation"}:
        for name, angle, elevation in (
            ("front", 0, 0),
            ("quarter-left", -math.pi / 4, 0),
            ("quarter-right", math.pi / 4, 0),
            ("side", math.pi / 2, 0),
            ("above", 0, 0.14),
            ("below", 0, -0.12),
        ):
            result.append(
                (
                    "portrait-" + name,
                    framing["headCenter"],
                    framing["headSpan"],
                    angle,
                    elevation,
                    "dramatic" if pack == "presentation" else "neutral",
                )
            )
    if pack in {"standard", "details"}:
        for name, detail in framing["details"].items():
            result.append(
                (
                    "detail-" + name,
                    detail["center"],
                    detail["span"],
                    math.pi / 9,
                    0,
                    "neutral",
                )
            )
    if pack in {"standard", "lookdev"}:
        for light in LIGHTS:
            result.append(
                (
                    "light-" + light,
                    framing["headCenter"],
                    framing["headSpan"],
                    math.pi / 6,
                    0,
                    light,
                )
            )
    if not result and pack != "deformation":
        raise ValueError("Unknown review pack")
    return result
